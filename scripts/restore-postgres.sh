#!/bin/bash

################################################################################
# PostgreSQL Restore from S3 Backup
# Restore database from daily backup stored in S3
#
# Usage: ./restore-postgres.sh [backup-date]
#   backup-date: YYYYMMDD (e.g., 20260501)
#   If not provided, restores latest backup
#
# Example:
#   ./restore-postgres.sh                    # Restore latest
#   ./restore-postgres.sh 20260501           # Restore specific date
#   ./restore-postgres.sh --list             # List available backups
################################################################################

set -euo pipefail

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
readonly LOG_DIR="${LOG_DIR:-/var/log/petalia}"
readonly RESTORE_TEMP_DIR="${RESTORE_TEMP_DIR:-/tmp/petalia-restore}"

# Log file
readonly LOG_FILE="$LOG_DIR/restore.log"
mkdir -p "$LOG_DIR"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env.production" ]; then
  export $(grep -v '^#' "$PROJECT_ROOT/.env.production" | xargs)
fi

# Defaults
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-petalia}"
DB_USER="${DB_USER:-petalia}"
DB_PASSWORD="${DB_PASSWORD:-}"
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_S3_BUCKET="${AWS_S3_BUCKET:-}"

################################################################################
# Logging
################################################################################

log() {
  local level="$1"
  shift
  local message="$@"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  echo "[${timestamp}] [${level}] ${message}" | tee -a "$LOG_FILE"
}

log_info() {
  log "INFO" "$@"
}

log_warn() {
  log "WARN" "$@"
}

log_error() {
  log "ERROR" "$@"
}

################################################################################
# Backup Management
################################################################################

list_backups() {
  log_info "Listing available backups in S3..."

  aws s3api list-objects-v2 \
    --bucket "$AWS_S3_BUCKET" \
    --prefix "backups/postgres/petalia_" \
    --region "$AWS_REGION" \
    --query "Contents[].[Key,LastModified,Size]" \
    --output table | tee -a "$LOG_FILE"
}

get_latest_backup() {
  log_info "Finding latest backup..."

  local latest=$(aws s3api list-objects-v2 \
    --bucket "$AWS_S3_BUCKET" \
    --prefix "backups/postgres/petalia_" \
    --region "$AWS_REGION" \
    --query "reverse(sort_by(Contents[], &LastModified))[0].Key" \
    --output text)

  if [ "$latest" = "None" ] || [ -z "$latest" ]; then
    log_error "No backups found in S3"
    return 1
  fi

  echo "$latest"
}

download_backup() {
  local s3_key="$1"
  local local_file="$RESTORE_TEMP_DIR/$(basename "$s3_key")"

  log_info "Downloading backup from S3: $s3_key"

  mkdir -p "$RESTORE_TEMP_DIR"
  aws s3 cp "s3://$AWS_S3_BUCKET/$s3_key" "$local_file" \
    --region "$AWS_REGION" \
    2>> "$LOG_FILE"

  if [ ! -f "$local_file" ]; then
    log_error "Failed to download backup"
    return 1
  fi

  log_info "Download completed: $local_file"
  echo "$local_file"
}

################################################################################
# Restore
################################################################################

validate_before_restore() {
  log_warn "========================================"
  log_warn "⚠️  RESTORE WILL OVERWRITE DATABASE"
  log_warn "========================================"
  log_warn "Database: $DB_NAME"
  log_warn "Host: $DB_HOST"
  log_warn "This will DROP and recreate all tables"
  log_warn "========================================"

  # Confirmation
  read -p "Type 'yes' to continue: " confirmation
  if [ "$confirmation" != "yes" ]; then
    log_info "Restore cancelled by user"
    return 1
  fi

  return 0
}

restore_database() {
  local backup_file="$1"

  log_info "Starting database restore..."
  log_info "Backup file: $backup_file"

  if [ ! -f "$backup_file" ]; then
    log_error "Backup file not found: $backup_file"
    return 1
  fi

  # Test database connection
  log_info "Testing database connection..."
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1 || {
    log_error "Cannot connect to database"
    return 1
  }

  # Drop and recreate database to ensure clean restore
  log_warn "Dropping existing database..."
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d postgres \
    -c "DROP DATABASE IF EXISTS \"$DB_NAME\" WITH (FORCE);" \
    2>> "$LOG_FILE" || true

  log_warn "Creating fresh database..."
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d postgres \
    -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\";" \
    2>> "$LOG_FILE"

  # Restore from backup
  log_info "Restoring from backup (this may take a few minutes)..."
  gunzip -c "$backup_file" | \
    PGPASSWORD="$DB_PASSWORD" psql \
      -h "$DB_HOST" \
      -p "$DB_PORT" \
      -U "$DB_USER" \
      -d "$DB_NAME" \
      --single-transaction \
      --exit-on-error \
      2>> "$LOG_FILE"

  if [ $? -eq 0 ]; then
    log_info "Database restore completed successfully"
    return 0
  else
    log_error "Database restore failed"
    return 1
  fi
}

verify_restore() {
  log_info "Verifying restore..."

  local table_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" \
    -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null || echo 0)

  local row_count=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" \
    -t -c "SELECT sum(n_live_tup) FROM pg_stat_user_tables;" 2>/dev/null || echo 0)

  log_info "Verification Results:"
  log_info "  Tables: $table_count"
  log_info "  Total Rows: $row_count"

  if [ "$table_count" -gt 0 ]; then
    log_info "✅ Restore verified successfully"
    return 0
  else
    log_warn "⚠️  Restore may be incomplete (no tables found)"
    return 1
  fi
}

cleanup_temp_files() {
  log_info "Cleaning up temporary files..."
  rm -rf "$RESTORE_TEMP_DIR"
}

################################################################################
# Main
################################################################################

main() {
  local backup_date="${1:-}"

  log_info "=========================================="
  log_info "PostgreSQL Restore Script"
  log_info "Database: $DB_NAME"
  log_info "S3 Bucket: $AWS_S3_BUCKET"
  log_info "=========================================="

  # Handle special commands
  if [ "$backup_date" = "--list" ]; then
    list_backups
    return 0
  fi

  # Determine which backup to restore
  local s3_key
  if [ -z "$backup_date" ]; then
    s3_key=$(get_latest_backup) || return 1
  else
    # Validate date format YYYYMMDD
    if ! [[ $backup_date =~ ^[0-9]{8}$ ]]; then
      log_error "Invalid date format. Use YYYYMMDD (e.g., 20260501)"
      return 1
    fi
    s3_key="backups/postgres/petalia_${backup_date}.sql.gz"
  fi

  log_info "Restore backup: $s3_key"

  # Confirm before restore
  if ! validate_before_restore; then
    return 1
  fi

  # Download backup
  local backup_file
  if ! backup_file=$(download_backup "$s3_key"); then
    return 1
  fi

  # Restore database
  if ! restore_database "$backup_file"; then
    cleanup_temp_files
    return 1
  fi

  # Verify restore
  if ! verify_restore; then
    log_warn "Restore completed but verification found issues"
    cleanup_temp_files
    return 1
  fi

  # Cleanup
  cleanup_temp_files

  log_info "=========================================="
  log_info "✅ Restore completed successfully"
  log_info "=========================================="
  return 0
}

# Run main function
main "$@"
exit $?
