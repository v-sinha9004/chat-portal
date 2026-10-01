variable "aws_region" {
  description = "AWS region to deploy resources in"
  type        = string
  default     = "ap-south-1"
}

variable "instance_type" {
  description = "EC2 instance size"
  type        = string
  default     = "t3.large"
}

variable "project_name" {
  description = "Project tag and naming prefix"
  type        = string
  default     = "chat-portal"
}

variable "jwt_access_secret" {
  description = "JWT Access Secret Key"
  type        = string
  default     = "chat-portal-jwt-access-secret-key-32chars"
}

variable "jwt_refresh_secret" {
  description = "JWT Refresh Secret Key"
  type        = string
  default     = "chat-portal-jwt-refresh-secret-key-32chars"
}
