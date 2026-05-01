# AWS Infrastructure Deployment Guide

**Project:** Petalia Farm OS API  
**Infrastructure:** Multi-AZ Load Balanced Setup with RDS Proxy  
**Tools:** Terraform 1.x + AWS CLI v2  
**Status:** Production-Ready (IaC)  

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Internet (0.0.0.0/0)                          │
│                         api.petalia.com (DNS)                          │
└──────────────────────────────┬─────────────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Application Load   │
                    │   Balancer (ALB)    │
                    │  - HTTP/HTTPS       │
                    │  - SSL/TLS          │
                    │  - Health Checks    │
                    └──────────┬──────────┘
                               │
                ┌──────────────┼──────────────┐
                │              │              │
         ┌──────▼─────┐ ┌──────▼─────┐ ┌──────▼─────┐
         │ EC2 Instance│ │ EC2 Instance│ │ EC2 Instance│
         │  (us-east-1a) │  (us-east-1b) │ (us-east-1c)|
         │  (t3.medium)   │  (t3.medium)   │ (t3.medium) │
         │  Petalia API   │  Petalia API   │ Petalia API │
         │  Docker       │  Docker       │ Docker     │
         └──────┬─────┘ └──────┬─────┘ └──────┬─────┘
                │              │              │
                └──────────────┼──────────────┘
                               │
                    ┌──────────▼──────────┐
                    │  RDS Proxy          │
                    │  (Connection Pool)  │
                    │  - Max 500 conns    │
                    │  - Connection pooling│
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  RDS PostgreSQL     │
                    │  (Multi-AZ)         │
                    │  petalia database   │
                    │  150 MB             │
                    └─────────────────────┘
```

---

## Prerequisites

### Local Machine Requirements

1. **Terraform >= 1.0**
   ```bash
   terraform --version
   # terraform v1.0+
   ```

2. **AWS CLI v2**
   ```bash
   aws --version
   # aws-cli/2.x.x
   ```

3. **AWS Credentials** (configured)
   ```bash
   aws configure
   # Enter AWS Access Key ID, Secret Access Key
   # Region: us-east-1
   # Output format: json
   ```

4. **jq** (for JSON parsing)
   ```bash
   jq --version
   ```

### AWS Prerequisites

1. **VPC with Subnets**
   - 2+ public subnets (for ALB, in different AZs)
   - 2+ private subnets (for EC2, in different AZs)
   - 2+ DB subnets (for RDS Proxy, in different AZs)
   - Each subnet in different Availability Zone

2. **RDS PostgreSQL**
   - Existing RDS instance running
   - Database: `petalia`
   - Master user: `postgres`
   - Password stored in AWS Secrets Manager

3. **EC2 AMI**
   - Amazon Linux 2 with Docker pre-installed
   - Or standard Amazon Linux 2 (script will install Docker)

4. **Docker Image**
   - Petalia API pushed to ECR or DockerHub
   - Example: `123456789.dkr.ecr.us-east-1.amazonaws.com/petalia:latest`

5. **Secrets Manager**
   - Secret name: `petalia-db-credentials`
   - Format: `{"username": "postgres", "password": "..."}`

---

## Step-by-Step Deployment

### Step 1: Prepare Terraform Variables

Create `terraform.tfvars`:

```bash
cd infrastructure/terraform

cat > terraform.tfvars <<EOF
environment      = "prod"
project_name     = "petalia"
aws_region       = "us-east-1"
availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]

# VPC & Subnets (replace with your actual IDs)
vpc_id = "vpc-0abc123xyz"
public_subnet_ids = ["subnet-1abc123", "subnet-2def456"]
private_subnet_ids = ["subnet-3ghi789", "subnet-4jkl012"]
db_subnet_ids = ["subnet-5mno345", "subnet-6pqr678"]

# EC2 Configuration
instance_type = "t3.medium"
min_capacity = 2
max_capacity = 4
desired_capacity = 2
ami_id = "ami-0c55b159cbfafe1f0"  # Find latest with: aws ec2 describe-images --owners amazon --filters "Name=name,Values=amzn2-ami-hvm-*-x86_64-gp2" --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId'
docker_image = "petalia:latest"  # Or use ECR: 123456789.dkr.ecr.us-east-1.amazonaws.com/petalia:latest

# Database
db_host = "petalia-db.xxxxx.rds.amazonaws.com"
db_port = 5432
db_name = "petalia"
db_user = "postgres"
db_max_connections = 100
db_proxy_max_connections = 500

# SSL/TLS (optional)
certificate_arn = ""  # Leave empty for HTTP; provide ACM ARN for HTTPS

# Health checks
health_check_path = "/api/health"
health_check_interval = 30
health_check_timeout = 5

# Tags
tags = {
  Project     = "petalia"
  Environment = "prod"
  ManagedBy   = "Terraform"
  Owner       = "DevOps"
}
EOF
```

### Step 2: Initialize Terraform

```bash
# Initialize Terraform working directory
terraform init

# This downloads AWS provider and sets up state files
```

### Step 3: Review Plan

```bash
# Generate execution plan
terraform plan -out=tfplan

# Review the plan (should show):
# - ALB creation
# - Target Group creation
# - Security Groups creation
# - Launch Template creation
# - Auto Scaling Group creation
# - RDS Proxy creation
# - IAM roles creation
```

### Step 4: Apply Terraform

```bash
# Deploy infrastructure
terraform apply tfplan

# This will:
# 1. Create ALB (5-10 min)
# 2. Create Security Groups (immediate)
# 3. Create Launch Template (immediate)
# 4. Create Auto Scaling Group (5 min)
# 5. Create RDS Proxy (10-15 min)
# Total time: ~15-20 minutes

# Monitor progress
watch -n 5 'aws autoscaling describe-auto-scaling-groups --auto-scaling-group-names petalia-asg'
```

### Step 5: Retrieve Outputs

```bash
# Show outputs
terraform output -json | jq .

# Key outputs:
terraform output alb_dns_name
# Output: petalia-alb-123456789.us-east-1.elb.amazonaws.com

terraform output rds_proxy_endpoint
# Output: petalia-db-proxy.123456789.rds.amazonaws.com
```

### Step 6: Update DNS Records

```bash
# Create CNAME record in Route53 or your DNS provider
# Point: api.petalia.com → petalia-alb-123456789.us-east-1.elb.amazonaws.com

# Verify DNS propagation (may take 5-30 min)
nslookup api.petalia.com
# Should resolve to ALB IP address
```

### Step 7: Test ALB Health

```bash
# Get ALB DNS name
ALB_DNS=$(terraform output -raw alb_dns_name)

# Test health endpoint
curl http://$ALB_DNS/api/health
# Should return: {"status":"ok","db":...,"redis":...}

# Test a few times (should hit different instances)
for i in {1..5}; do
  curl -s http://$ALB_DNS/api/health | jq .
  sleep 1
done
```

### Step 8: Monitor Auto Scaling

```bash
# View ASG status
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names petalia-asg \
  --region us-east-1 \
  --query 'AutoScalingGroups[0].[DesiredCapacity,MinSize,MaxSize,Instances[*].InstanceId]'

# View EC2 instances
aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=petalia-instance" \
  --query 'Reservations[0].Instances[*].[InstanceId,PrivateIpAddress,State.Name]'

# View ALB target health
aws elbv2 describe-target-health \
  --target-group-arn $(terraform output -raw target_group_arn) \
  --region us-east-1
```

---

## Configuration Updates

### Change Instance Type

```bash
# Update terraform.tfvars
# Change: instance_type = "t3.large"

terraform plan -out=tfplan
terraform apply tfplan

# This triggers instance refresh (rolling update)
# Instances are replaced one at a time (min_healthy = 50%)
```

### Scale Up/Down

```bash
# Change desired capacity
terraform apply -var="desired_capacity=3" -auto-approve

# Or update terraform.tfvars
# Change: desired_capacity = 3
terraform apply tfplan
```

### Update Docker Image

```bash
# Update Docker image in Launch Template
terraform apply -var="docker_image=petalia:v2.1.0" -auto-approve

# Auto Scaling will replace instances with new image
```

### Enable HTTPS

```bash
# Request ACM certificate
aws acm request-certificate \
  --domain-name api.petalia.com \
  --subject-alternative-names "*.petalia.com" \
  --validation-method DNS

# Wait for certificate approval (DNS validation)

# Get certificate ARN
aws acm list-certificates --region us-east-1 \
  --filters Name=domain,Values=api.petalia.com

# Update terraform.tfvars
# certificate_arn = "arn:aws:acm:us-east-1:123456789:certificate/abc123"

terraform apply tfplan
# ALB will now listen on HTTPS (443) and redirect HTTP to HTTPS
```

---

## Monitoring & Observability

### CloudWatch Metrics

```bash
# CPU Utilization
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 \
  --metric-name CPUUtilization \
  --dimensions Name=AutoScalingGroupName,Value=petalia-asg \
  --statistics Average \
  --start-time 2026-05-01T00:00:00Z \
  --end-time 2026-05-02T00:00:00Z \
  --period 3600

# ALB Request Count
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name RequestCount \
  --dimensions Name=LoadBalancer,Value=app/petalia-alb/abc123 \
  --statistics Sum \
  --start-time 2026-05-01T00:00:00Z \
  --end-time 2026-05-02T00:00:00Z \
  --period 3600

# Target Health
aws elbv2 describe-target-health \
  --target-group-arn $(terraform output -raw target_group_arn)
```

### Application Logs

```bash
# View real-time logs from CloudWatch
aws logs tail /aws/ec2/petalia --follow

# View from specific instance
aws logs tail /aws/ec2/petalia --log-stream-names $(hostname)

# Search for errors
aws logs filter-log-events \
  --log-group-name /aws/ec2/petalia \
  --filter-pattern "ERROR"
```

### RDS Proxy Monitoring

```bash
# View proxy status
aws rds describe-db-proxies \
  --db-proxy-name petalia-db-proxy \
  --region us-east-1

# View connection statistics
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS/Proxy \
  --metric-name DatabaseConnections \
  --dimensions Name=DBProxyName,Value=petalia-db-proxy \
  --statistics Average
```

---

## Troubleshooting

### Instances Failing Health Checks

```bash
# 1. Check instance logs
aws ec2 describe-instances \
  --instance-ids i-0abc123 \
  --query 'Reservations[0].Instances[0].PrivateIpAddress'

# 2. SSH to instance (via bastion or SSM Session Manager)
aws ssm start-session --target i-0abc123

# 3. Check Docker container
docker ps -a
docker logs petalia-api

# 4. Test health endpoint locally
curl http://localhost:3000/api/health

# 5. Check environment variables
docker exec petalia-api env | grep DB_

# 6. Check RDS Proxy connectivity
docker exec petalia-api \
  psql -h petalia-db-proxy.xxxxx.rds.amazonaws.com \
       -U postgres -d petalia -c "SELECT 1"
```

### ALB Target Health Check Failures

```bash
# 1. View target health
aws elbv2 describe-target-health \
  --target-group-arn $(terraform output -raw target_group_arn)

# 2. Check security group rules
aws ec2 describe-security-groups \
  --group-ids $(terraform output -raw ec2_security_group_id) \
  --query 'SecurityGroups[0].IpPermissions'

# 3. Test from ALB security group
# Verify ALB can reach EC2 on port 3000
# Verify EC2 can reach RDS on port 5432
```

### RDS Proxy Connection Issues

```bash
# 1. Check proxy status
aws rds describe-db-proxies --db-proxy-name petalia-db-proxy

# 2. Check credentials in Secrets Manager
aws secretsmanager get-secret-value --secret-id petalia-db-credentials

# 3. Test credentials
PGPASSWORD=password psql \
  -h petalia-db-proxy.xxxxx.rds.amazonaws.com \
  -U postgres -d petalia -c "SELECT 1"

# 4. Check proxy logs
aws logs tail /aws/rds/proxy/petalia-db-proxy --follow
```

---

## Zero-Downtime Deployments

### Gradual Instance Replacement

```bash
# Terraform handles rolling updates automatically
# Instance Refresh configuration:
# - Min healthy percentage: 50%
# - Warmup period: 300 seconds

# Example: Replace all instances with new Docker image
terraform apply -var="docker_image=petalia:v2.0.0" -auto-approve

# Monitor progress
watch -n 5 'aws autoscaling describe-auto-scaling-group-instances --auto-scaling-group-name petalia-asg'

# Expected behavior:
# 1. New instances launch with new image
# 2. Health checks verify new instances are healthy
# 3. Old instances drain connections
# 4. Old instances terminate
# No requests lost, no downtime
```

### Canary Deployments (Advanced)

```bash
# 1. Create new target group with new instances
# 2. Route % of traffic to new target group
# 3. Monitor metrics (error rate, latency)
# 4. Gradually shift traffic 10% → 50% → 100%
# 5. Terminate old target group

# This requires Terraform code update (not covered here)
```

---

## Cleanup / Destruction

### Delete All Infrastructure

```bash
# WARNING: This will delete ALB, instances, RDS Proxy, etc.

terraform destroy -auto-approve

# Or review before deleting
terraform destroy
# (review, type 'yes' to confirm)
```

### Delete Specific Resources

```bash
# Delete only ASG (keep ALB, RDS Proxy)
terraform destroy -target aws_autoscaling_group.petalia

# Delete only RDS Proxy (keep ASG)
terraform destroy -target aws_db_proxy.petalia
```

---

## Cost Optimization

| Resource | Cost/Month | Optimization |
|---|---|---|
| ALB | $16 | Already optimized |
| EC2 (t3.medium × 2) | $60 | Use spot instances (save 70%) |
| Data transfer out | $10 | Check CloudFront for static assets |
| RDS Proxy | $0.30 | Minimal cost |
| **Total** | **~$90** | Down to ~$30 with spot instances |

### Use Spot Instances (Save 70%)

```bash
# Modify launch template to use spot instances
# This requires terraform code change (not in current template)
# Add to launch_template:
# spot_price = "0.05"
# instance_interruption_behavior = "terminate"
```

---

## Next Steps

1. ✅ **Infrastructure deployed** — ALB + ASG + RDS Proxy
2. ⏳ **Task 7:** Monitoring & Alerting (Prometheus + Slack)
3. ⏳ **Post-deployment:** SSL/TLS, auto-scaling policies tuning
4. ⏳ **Future:** Multi-region DR, canary deployments, container orchestration (ECS/K8s)

---

## Support & Documentation

- [AWS ALB Documentation](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/)
- [AWS Auto Scaling](https://docs.aws.amazon.com/autoscaling/)
- [AWS RDS Proxy](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.html)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)

---

**Last Updated:** 2026-05-01  
**Version:** 1.0  
**Status:** Production-Ready
