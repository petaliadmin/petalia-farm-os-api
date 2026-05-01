# PostgreSQL Backup Deployment Checklist

**Project:** Petalia Farm OS API  
**Sprint:** 5.3 — Backup Automation  
**Deployment Date:** 2026-05-01  
**Owner:** DevOps Team  

---

## Pre-Deployment: AWS Setup

### IAM User Creation

- [ ] Create IAM user: `petalia-backup`
- [ ] Attach policy with S3 permissions (see `/docs/BACKUP_RECOVERY.md`)
- [ ] Generate access key & secret
- [ ] **Store credentials securely** (not in git, use AWS Secrets Manager)

### S3 Bucket Setup

- [ ] Create S3 bucket: `petalia-backups-prod`
- [ ] Enable versioning (extra protection)
- [ ] Enable encryption at rest (SSE-S3)
- [ ] Set bucket policy to deny public access
- [ ] Enable bucket logging (CloudTrail)
- [ ] Configure lifecycle policy (delete after 30 days if desired)

### RDS Security Group

- [ ] Verify EC2 instance can reach RDS:
  ```bash
  psql -h <rds-host> -U postgres -d petalia -c "SELECT 1"
  ```
- [ ] Check RDS security group allows inbound on port 5432 from EC2 security group

---

## EC2 Instance Setup

### 1. Prerequisites Installation

```bash
# SSH to EC2 instance
ssh -i ~/petalia-prod.pem ec2-user@<instance-ip>

# Install PostgreSQL client
sudo yum install -y postgresql

# Verify AWS CLI v2 (should be pre-installed on Amazon Linux 2)
aws --version

# Verify curl (for Slack notifications)
curl --version
```

- [ ] PostgreSQL client installed (`psql --version`)
- [ ] AWS CLI v2 installed (`aws --version`)
- [ ] curl installed (for notifications)
- [ ] jq installed (optional, for JSON processing)

### 2. Directory Structure

```bash
# Create directories
mkdir -p /home/ec2-user/petalia/scripts
mkdir -p /var/log/petalia
mkdir -p /tmp/petalia-backups
mkdir -p /tmp/petalia-restore

# Set permissions
sudo chown ec2-user:ec2-user /var/log/petalia
chmod 755 /home/ec2-user/petalia/scripts
```

- [ ] `/home/ec2-user/petalia/` exists
- [ ] `/var/log/petalia/` writable by ec2-user
- [ ] `/tmp/petalia-*` directories created

### 3. Deploy Backup Scripts

```bash
# Copy scripts from git repo to EC2
scp -i ~/petalia-prod.pem \
  scripts/backup-postgres.sh \
  scripts/restore-postgres.sh \
  ec2-user@<instance>:/home/ec2-user/petalia/scripts/

# Verify scripts are executable
ssh -i ~/petalia-prod.pem ec2-user@<instance> \
  "ls -lh /home/ec2-user/petalia/scripts/"
```

- [ ] `backup-postgres.sh` copied and executable
- [ ] `restore-postgres.sh` copied and executable
- [ ] Scripts are readable by ec2-user

### 4. Configure Environment Variables

Add to `.env.production` on EC2:

```bash
# Database connection
DB_HOST=<rds-endpoint>.rds.amazonaws.com
DB_PORT=5432
DB_NAME=petalia
DB_USER=postgres
DB_PASSWORD=<secure-password-from-secrets-manager>

# AWS S3
AWS_REGION=us-east-1
AWS_S3_BUCKET=petalia-backups-prod
AWS_ACCESS_KEY_ID=<from-iam-user>
AWS_SECRET_ACCESS_KEY=<from-iam-user>

# Backup settings
RETENTION_DAYS=7
LOG_DIR=/var/log/petalia
BACKUP_TEMP_DIR=/tmp/petalia-backups

# Notifications
SLACK_WEBHOOK=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
BACKUP_EMAIL=devops@petalia.com
```

- [ ] `.env.production` has all DB_* variables
- [ ] `.env.production` has all AWS_* variables
- [ ] Credentials sourced from AWS Secrets Manager (not hardcoded)
- [ ] Slack webhook URL configured (for alerts)

### 5. Test Backup Manually

```bash
# Run backup script manually
/home/ec2-user/petalia/scripts/backup-postgres.sh

# Tail logs
tail -50 /var/log/petalia/backup.log

# Verify S3 upload
aws s3 ls s3://petalia-backups-prod/backups/postgres/

# Verify backup can be restored (to staging DB first!)
/home/ec2-user/petalia/scripts/restore-postgres.sh --list
```

- [ ] Backup script runs without errors
- [ ] Log file created at `/var/log/petalia/backup.log`
- [ ] Backup appears in S3 bucket
- [ ] File is compressed (`.sql.gz`)
- [ ] Slack notification received
- [ ] No sensitive data in logs

---

## Systemd Service Setup

### 1. Install System Files

```bash
# Copy systemd service files to EC2
scp -i ~/petalia-prod.pem \
  scripts/petalia-backup.service \
  scripts/petalia-backup.timer \
  scripts/petalia-backup-failure@.service \
  ec2-user@<instance>:/home/ec2-user/

# Install as root
sudo cp /home/ec2-user/petalia-backup.* /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload
```

- [ ] `.service` file copied to `/etc/systemd/system/`
- [ ] `.timer` file copied to `/etc/systemd/system/`
- [ ] `-failure@.service` file copied
- [ ] `systemctl daemon-reload` executed

### 2. Enable and Start Timer

```bash
# Enable timer to start on boot
sudo systemctl enable petalia-backup.timer

# Start timer (not the service, the timer)
sudo systemctl start petalia-backup.timer

# Verify status
sudo systemctl status petalia-backup.timer

# List next scheduled run
sudo systemctl list-timers petalia-backup.timer

# Check for errors
sudo journalctl -u petalia-backup.timer -n 20
```

- [ ] Timer enabled (`systemctl is-enabled petalia-backup.timer`)
- [ ] Timer started (`systemctl is-active petalia-backup.timer`)
- [ ] Next run time visible in `list-timers`
- [ ] No errors in journalctl

### 3. Test Timer Execution

```bash
# Manually trigger backup for testing (instead of waiting until 2 AM)
sudo systemctl start petalia-backup.service

# Monitor execution in real-time
sudo journalctl -u petalia-backup.service -f

# After completion, verify:
# - Backup created in S3
# - Log file updated
# - Slack notification sent
```

- [ ] Manual backup execution successful
- [ ] S3 backup created
- [ ] Backup log updated
- [ ] Slack notification received
- [ ] All systems operational

---

## Verification & Testing

### 1. Backup Verification

```bash
# List all backups
aws s3 ls s3://petalia-backups-prod/backups/postgres/ --human-readable

# Check latest backup size and date
aws s3 ls s3://petalia-backups-prod/backups/postgres/ | tail -1

# Verify backup integrity (optional)
aws s3 cp s3://petalia-backups-prod/backups/postgres/petalia_20260501.sql.gz - | \
  gunzip | head -5 | grep -q "PostgreSQL database dump" && echo "✅ Valid"
```

- [ ] Latest backup appears in S3
- [ ] Backup size reasonable (~100-200MB for typical DB)
- [ ] Backup date is today/yesterday
- [ ] Backup file is gzipped (`.gz` extension)

### 2. Restore Test (to Staging DB)

```bash
# This should be done to a staging/test database first
# SSH to staging EC2 instance
ssh -i ~/petalia-staging.pem ec2-user@<staging-instance>

# Configure for staging DB
export DB_HOST=staging-db.rds.amazonaws.com
export DB_NAME=petalia_test

# Restore from latest backup
/home/ec2-user/petalia/scripts/restore-postgres.sh

# Verify restore
psql -h $DB_HOST -U postgres -d petalia_test -c "SELECT COUNT(*) FROM parcelles;"

# Check table count
psql -h $DB_HOST -U postgres -d petalia_test -c \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"
```

- [ ] Restore script runs without errors
- [ ] Database created/replaced successfully
- [ ] Table count > 0 (backup was not empty)
- [ ] Data integrity verified (SELECT statements return expected results)
- [ ] Row counts reasonable

### 3. Cleanup Verification

```bash
# Verify old backups are deleted
aws s3 ls s3://petalia-backups-prod/backups/postgres/ --human-readable

# Should only show recent backups (within retention window)
# Current date - retention_days = oldest backup date

# Count backups (should be ~7)
aws s3 ls s3://petalia-backups-prod/backups/postgres/ | wc -l
```

- [ ] Only recent backups visible (no backups > 7 days old)
- [ ] Backup count reasonable (~7 for 7-day retention)
- [ ] Old files successfully cleaned up

---

## Monitoring Setup

### 1. CloudWatch Alarms

```bash
# Monitor S3 bucket size
aws cloudwatch put-metric-alarm \
  --alarm-name petalia-backup-size \
  --alarm-description "Alert if backup exceeds 500MB" \
  --metric-name BucketSizeBytes \
  --namespace AWS/S3 \
  --statistic Average \
  --period 3600 \
  --threshold 536870912 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1
```

- [ ] CloudWatch alarm created for backup size
- [ ] CloudWatch alarm created for backup failure
- [ ] SNS topic configured for alarms

### 2. Log Aggregation

```bash
# Configure CloudWatch Logs agent to stream /var/log/petalia/backup.log
# See: https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/QuickStartEC2Instance.html

# Option: Simple approach - upload logs manually
while true; do
  aws logs put-log-events \
    --log-group-name /petalia/backups \
    --log-stream-name prod \
    --log-events file:///var/log/petalia/backup.log
  sleep 300
done
```

- [ ] Backup logs appear in CloudWatch Logs
- [ ] Log retention set (90 days recommended)
- [ ] Alarms configured on ERROR messages

### 3. Slack Notifications

- [ ] Slack webhook URL configured in `.env.production`
- [ ] Test notification sent and received
- [ ] Success notifications arriving daily
- [ ] Failure notifications trigger (will test after first week)

---

## Documentation & Runbooks

- [ ] Copy `/docs/BACKUP_RECOVERY.md` to team wiki/confluence
- [ ] Create runbook: "How to restore from backup" (link to guide)
- [ ] Create runbook: "What to do if backup fails"
- [ ] Share Slack channel: #petalia-backup-alerts
- [ ] Add to team on-call playbook

---

## Post-Deployment: Schedule Verification

Schedule these recurring checks:

- [ ] **Weekly (Monday morning):** Verify latest backup exists and size is normal
- [ ] **Monthly (1st of month):** Test restore to staging environment
- [ ] **Quarterly:** Full disaster recovery drill (restore to prod-equivalent env)
- [ ] **Annually:** Review backup & retention policies

---

## Rollback Plan (if needed)

If backup system causes issues:

1. **Disable timer:** `sudo systemctl stop petalia-backup.timer`
2. **Disable service:** `sudo systemctl disable petalia-backup.service`
3. **Remove from cron:** Delete any cron jobs added
4. **Notify team:** Post to #petalia-incidents
5. **Investigate:** Check logs, fix issues
6. **Re-enable when ready:** `sudo systemctl enable petalia-backup.timer && sudo systemctl start petalia-backup.timer`

- [ ] Rollback procedure documented
- [ ] Team knows how to disable backups if needed

---

## Sign-Off

| Role | Name | Date | Notes |
|---|---|---|---|
| DevOps Lead | | | |
| SRE | | | |
| Database Admin | | | |
| Security | | | |

---

## Appendix: Deployment Day Timeline

**2 AM UTC:** First automated backup runs (systemd timer)
**2:15 AM:** Backup completes, S3 upload finishes, Slack notification sent
**Tomorrow:** Verify backup exists, size reasonable
**Next week:** Test restore to staging
**30 days:** Review backup policy, adjust retention if needed

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-01  
**Next Review:** 2026-06-01
