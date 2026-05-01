# Petalia AWS Infrastructure — Terraform Variables

variable "environment" {
  description = "Environment name (prod, staging, dev)"
  type        = string
  default     = "prod"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "petalia"
}

variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "availability_zones" {
  description = "List of AZs for multi-AZ setup"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b", "us-east-1c"]
}

variable "vpc_id" {
  description = "VPC ID for resources"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnets for EC2 instances"
  type        = list(string)
  # Must have at least 2 subnets in different AZs
}

variable "public_subnet_ids" {
  description = "Public subnets for ALB"
  type        = list(string)
  # Must have at least 2 subnets in different AZs
}

variable "db_subnet_ids" {
  description = "DB subnets for RDS Proxy"
  type        = list(string)
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.medium"  # 2 vCPU, 4 GB RAM
}

variable "min_capacity" {
  description = "Minimum number of EC2 instances"
  type        = number
  default     = 2
}

variable "max_capacity" {
  description = "Maximum number of EC2 instances"
  type        = number
  default     = 4
}

variable "desired_capacity" {
  description = "Desired number of EC2 instances"
  type        = number
  default     = 2
}

variable "api_port" {
  description = "Port the API listens on"
  type        = number
  default     = 3000
}

variable "health_check_path" {
  description = "Health check endpoint path"
  type        = string
  default     = "/api/health"
}

variable "health_check_interval" {
  description = "Health check interval in seconds"
  type        = number
  default     = 30
}

variable "health_check_timeout" {
  description = "Health check timeout in seconds"
  type        = number
  default     = 5
}

variable "healthy_threshold" {
  description = "Number of successful checks before healthy"
  type        = number
  default     = 2
}

variable "unhealthy_threshold" {
  description = "Number of failed checks before unhealthy"
  type        = number
  default     = 2
}

# RDS Database Configuration
variable "db_host" {
  description = "RDS database hostname"
  type        = string
}

variable "db_port" {
  description = "RDS database port"
  type        = number
  default     = 5432
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "petalia"
}

variable "db_user" {
  description = "Database master user"
  type        = string
  default     = "postgres"
}

variable "db_max_connections" {
  description = "RDS Proxy max connections to database"
  type        = number
  default     = 100
}

variable "db_proxy_max_connections" {
  description = "RDS Proxy max client connections"
  type        = number
  default     = 500
}

# SSL/TLS
variable "certificate_arn" {
  description = "ACM certificate ARN for HTTPS"
  type        = string
  default     = ""  # Leave empty for HTTP only; provide for HTTPS
}

# Tags
variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default = {
    Project     = "petalia"
    Environment = "prod"
    ManagedBy   = "Terraform"
  }
}

# AMI Configuration
variable "ami_id" {
  description = "AMI ID for EC2 instances (Amazon Linux 2 with Docker)"
  type        = string
  # Example: ami-0c55b159cbfafe1f0 (Amazon Linux 2 in us-east-1)
  # Find latest with: aws ec2 describe-images --owners amazon --filters "Name=name,Values=amzn2-ami-hvm-*-x86_64-gp2"
}

# API Configuration
variable "docker_image" {
  description = "Docker image URI for Petalia API"
  type        = string
  default     = "petalia:latest"  # Build and push to ECR first
}

variable "container_port" {
  description = "Container port"
  type        = number
  default     = 3000
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 30
}
