#!/bin/bash

################################################################################
# PostgreSQL Backup to S3
# Daily automated backup of petalia database with 7-day retention
#
# Usage: ./backup-postgres.sh
# Cron: 0 2 * * * /home/ec2-user/petalia/scripts/backup-postgres.sh >> /var/log/petalia/backup.log 2>&1
#
# Environment variables (set in .env or systemd service):
#   DB_HOST, DB_PORT, DB_NAME, DB_USER
#   AWS_S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
################################################################################

set -euo pipefail

# Configuration
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
readonly LOG_DIR="${LOG_DIR:-/var/log/petalia}"
readonly BACKUP_TEMP_DIR="${BACKUP_TEMP_DIR:-/tmp/petalia-backups}"
readonly TIMESTAMP=$(date +%Y%m%d_%H%M%S)
readonly DATE_ONLY=$(date +%Y%m%d)

# Log file
readonly LOG_FILE="$LOG_DIR/backup.log"
mkdir -p "$LOG_DIR"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env.production" ]; then
  export $(grep -v '^#' "$PROJECT_ROOT/.env.production" | xargs)
fi

# Defaults from environment or .env
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-petalia}"
DB_USER="${DB_USER:-petalia}"
DB_PASSWORD="${DB_PASSWORD:-}"
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_S3_BUCKET="${AWS_S3_BUCKET:-}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
COMPRESSION="${COMPRESSION:-gzip}"  # gzip or none

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
# Validation
################################################################################

validate_config() {
  log_info "Validating configuration..."

  if [ -z "$AWS_S3_BUCKET" ]; then
    log_error "AWS_S3_BUCKET not set"
    return 1
  fi

  if ! command -v aws &> /dev/null; then
    log_error "AWS CLI not installed"
    return 1
  fi

  if ! command -v pg_dump &> /dev/null; then
    log_error "pg_dump not found (PostgreSQL client not installed)"
    return 1
  fi

  # Verify DB connectivity
  log_info "Testing database connection..."
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1 || {
    log_error "Cannot connect to database: $DB_HOST:$DB_PORT/$DB_NAME"
    return 1
  }

  log_info "Configuration valid"
  return 0
}

################################################################################
# Backup
################################################################################

perform_backup() {
  log_info "Starting backup of database: $DB_NAME"

  mkdir -p "$BACKUP_TEMP_DIR"

  local backup_file="$BACKUP_TEMP_DIR/petalia_${DATE_ONLY}.sql"
  local compressed_file="$backup_file.gz"

  # Check if backup already exists (avoid duplicates on same day)
  if [ -f "$compressed_file" ]; then
    log_warn "Backup for today already exists: $compressed_file"
    log_info "Removing old backup to create new one"
    rm -f "$compressed_file"
  fi

  log_info "Creating database dump: $backup_file"

  # Dump database
  PGPASSWORD="$DB_PASSWORD" pg_dump \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --format=plain \
    --verbose \
    --no-password \
    --no-owner \
    --compress=9 \
    > "$compressed_file" 2>> "$LOG_FILE"

  if [ ! -f "$compressed_file" ]; then
    log_error "Backup failed: file not created"
    return 1
  fi

  local file_size=$(du -h "$compressed_file" | cut -f1)
  log_info "Backup created successfully: $file_size"

  echo "$compressed_file"
  return 0
}

################################################################################
# S3 Upload
################################################################################

upload_to_s3() {
  local backup_file="$1"
  local s3_key="backups/postgres/$(basename "$backup_file")"

  log_info "Uploading to S3: s3://$AWS_S3_BUCKET/$s3_key"

  aws s3 cp "$backup_file" "s3://$AWS_S3_BUCKET/$s3_key" \
    --region "$AWS_REGION" \
    --sse AES256 \
    --storage-class STANDARD_IA \
    2>> "$LOG_FILE"

  if [ $? -eq 0 ]; then
    log_info "Upload successful"
    return 0
  else
    log_error "S3 upload failed"
    return 1
  fi
}

################################################################################
# Cleanup
################################################################################

cleanup_local_backups() {
  log_info "Cleaning up local backup files older than $RETENTION_DAYS days"

  find "$BACKUP_TEMP_DIR" -name "petalia_*.sql.gz" -mtime "+$RETENTION_DAYS" -delete

  local remaining=$(ls -1 "$BACKUP_TEMP_DIR"/petalia_*.sql.gz 2>/dev/null | wc -l)
  log_info "Remaining local backups: $remaining"
}

cleanup_s3_old_backups() {
  log_info "Cleaning up S3 backups older than $RETENTION_DAYS days"

  # List all backups, filter by date, delete old ones
  aws s3api list-objects-v2 \
    --bucket "$AWS_S3_BUCKET" \
    --prefix "backups/postgres/" \
    --region "$AWS_REGION" \
    --query "Contents[].Key" \
    --output text | tr '\t' '\n' | while read -r key; do

    if [ -z "$key" ]; then
      continue
    fi

    # Extract date from filename (YYYYMMDD)
    filename=$(basename "$key")
    backup_date="${filename:8:8}"  # petalia_YYYYMMDD.sql.gz

    if [ -z "$backup_date" ]; then
      continue
    fi

    # Calculate age in days
    current_epoch=$(date +%s)
    backup_epoch=$(date -d "$backup_date" +%s 2>/dev/null || echo 0)

    if [ $backup_epoch -eq 0 ]; then
      continue
    fi

    age_days=$(( (current_epoch - backup_epoch) / 86400 ))

    if [ $age_days -gt $RETENTION_DAYS ]; then
      log_info "Deleting old backup: $key (age: $age_days days)"
      aws s3api delete-object \
        --bucket "$AWS_S3_BUCKET" \
        --key "$key" \
        --region "$AWS_REGION"
    fi
  done
}

################################################################################
# Notification
################################################################################

send_notification() {
  local status="$1"
  local message="$2"

  # Slack notification (if SLACK_WEBHOOK configured)
  if [ -n "${SLACK_WEBHOOK:-}" ]; then
    local color="good"
    [ "$status" = "failure" ] && color="danger"

    curl -X POST "$SLACK_WEBHOOK" \
      -H 'Content-Type: application/json' \
      -d "{
        \"attachments\": [{
          \"color\": \"$color\",
          \"title\": \"PostgreSQL Backup: $status\",
          \"text\": \"$message\",
          \"ts\": $(date +%s)
        }]
      }" 2>/dev/null || true
  fi

  # Email notification (if BACKUP_EMAIL configured)
  if [ -n "${BACKUP_EMAIL:-}" ] && command -v mail &> /dev/null; then
    echo "PostgreSQL Backup Status: $status

$message

Database: $DB_NAME
Host: $DB_HOST
Date: $(date)
Log: $LOG_FILE" | mail -s "Petalia Backup $status" "$BACKUP_EMAIL" || true
  fi
}

################################################################################
# Main
################################################################################

main() {
  log_info "=========================================="
  log_info "PostgreSQL Backup Script Started"
  log_info "Database: $DB_NAME"
  log_info "S3 Bucket: $AWS_S3_BUCKET"
  log_info "Retention: $RETENTION_DAYS days"
  log_info "=========================================="

  # Validate configuration
  if ! validate_config; then
    log_error "Configuration validation failed"
    send_notification "failure" "Backup configuration validation failed"
    exit 1
  fi

  # Perform backup
  local backup_file
  if ! backup_file=$(perform_backup); then
    log_error "Database backup failed"
    send_notification "failure" "Database dump failed"
    exit 1
  fi

  # Upload to S3
  if ! upload_to_s3 "$backup_file"; then
    log_error "S3 upload failed"
    send_notification "failure" "S3 upload failed"
    exit 1
  fi

  # Cleanup
  cleanup_local_backups
  cleanup_s3_old_backups

  # Success notification
  local file_size=$(du -h "$backup_file" | cut -f1)
  local message="✅ Successfully backed up $DB_NAME ($file_size) to S3"
  log_info "$message"
  send_notification "success" "$message"

  log_info "=========================================="
  log_info "Backup completed successfully"
  log_info "=========================================="

  return 0
}

# Run main function
main "$@"
exit $?
