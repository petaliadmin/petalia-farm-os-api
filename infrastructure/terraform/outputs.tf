# Terraform Outputs — Post-deployment configuration values

output "alb_dns_name" {
  description = "DNS name of the load balancer"
  value       = aws_lb.petalia.dns_name
}

output "alb_arn" {
  description = "ARN of the load balancer"
  value       = aws_lb.petalia.arn
}

output "target_group_arn" {
  description = "ARN of the target group"
  value       = aws_lb_target_group.petalia.arn
}

output "autoscaling_group_name" {
  description = "Name of the Auto Scaling Group"
  value       = aws_autoscaling_group.petalia.name
}

output "launch_template_id" {
  description = "ID of the launch template"
  value       = aws_launch_template.petalia.id
}

output "rds_proxy_endpoint" {
  description = "RDS Proxy endpoint (use instead of RDS hostname)"
  value       = aws_db_proxy.petalia.endpoint
}

output "rds_proxy_arn" {
  description = "ARN of the RDS Proxy"
  value       = aws_db_proxy.petalia.arn
}

output "alb_security_group_id" {
  description = "Security group ID for ALB"
  value       = aws_security_group.alb.id
}

output "ec2_security_group_id" {
  description = "Security group ID for EC2 instances"
  value       = aws_security_group.ec2.id
}

output "rds_proxy_security_group_id" {
  description = "Security group ID for RDS Proxy"
  value       = aws_security_group.rds_proxy.id
}

output "deployment_info" {
  description = "Post-deployment configuration steps"
  value = {
    alb_url         = "http://${aws_lb.petalia.dns_name}"
    rds_proxy_host  = aws_db_proxy.petalia.endpoint
    asg_name        = aws_autoscaling_group.petalia.name
    min_instances   = var.min_capacity
    max_instances   = var.max_capacity
    desired         = var.desired_capacity
    instance_type   = var.instance_type
    health_check_interval = var.health_check_interval
    database_pooling = "Enabled via RDS Proxy"
  }
}

output "next_steps" {
  description = "Post-deployment steps"
  value = <<-EOT
    1. Update DNS records to point to ALB:
       CNAME: api.petalia.com -> ${aws_lb.petalia.dns_name}

    2. Test health check:
       curl http://${aws_lb.petalia.dns_name}/api/health

    3. Monitor instances:
       aws autoscaling describe-auto-scaling-groups \
         --auto-scaling-group-names ${aws_autoscaling_group.petalia.name}

    4. View logs:
       aws logs tail /aws/ec2/${var.project_name} --follow

    5. For HTTPS, request certificate and update terraform:
       variable "certificate_arn" = "arn:aws:acm:..."

    6. Set up monitoring and alarms (see next task)
  EOT
}
