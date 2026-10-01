terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# ------------------------------------------------------------------------------
# Random suffix for unique S3 bucket name
# ------------------------------------------------------------------------------
resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

# ------------------------------------------------------------------------------
# S3 Media Storage Bucket (Production)
# ------------------------------------------------------------------------------
resource "aws_s3_bucket" "media_bucket" {
  bucket        = "${var.project_name}-media-${random_string.suffix.result}"
  force_destroy = true # Allows easy clean teardown with terraform destroy
}

resource "aws_s3_bucket_public_access_block" "media_public_access" {
  bucket = aws_s3_bucket.media_bucket.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# Public read policy for media attachments
resource "aws_s3_bucket_policy" "media_bucket_public_read" {
  depends_on = [aws_s3_bucket_public_access_block.media_public_access]
  bucket     = aws_s3_bucket.media_bucket.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.media_bucket.arn}/*"
      }
    ]
  })
}

# CORS configuration for browser uploads and cross-origin access from Vercel
resource "aws_s3_bucket_cors_configuration" "media_bucket_cors" {
  bucket = aws_s3_bucket.media_bucket.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# Dedicated IAM User & Key for media-service S3 access
resource "aws_iam_user" "s3_app_user" {
  name = "${var.project_name}-s3-app-user"
}

resource "aws_iam_access_key" "s3_app_key" {
  user = aws_iam_user.s3_app_user.name
}

resource "aws_iam_user_policy" "s3_app_policy" {
  name = "${var.project_name}-s3-rw-policy"
  user = aws_iam_user.s3_app_user.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.media_bucket.arn,
          "${aws_s3_bucket.media_bucket.arn}/*"
        ]
      }
    ]
  })
}

# ------------------------------------------------------------------------------
# SSH Key Pair Generation
# ------------------------------------------------------------------------------
resource "tls_private_key" "ec2_key" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "aws_key_pair" "generated_key" {
  key_name   = "${var.project_name}-key"
  public_key = tls_private_key.ec2_key.public_key_openssh
}

resource "local_file" "private_key" {
  content         = tls_private_key.ec2_key.private_key_pem
  filename        = "${path.module}/ec2_key.pem"
  file_permission = "0600"
}

# ------------------------------------------------------------------------------
# Networking & Security Group (Default VPC)
# ------------------------------------------------------------------------------
data "aws_vpc" "default" {
  default = true
}

resource "aws_security_group" "portal_sg" {
  name        = "${var.project_name}-sg"
  description = "Allow HTTP, HTTPS, WebSockets, and SSH"
  vpc_id      = data.aws_vpc.default.id

  # SSH
  ingress {
    description = "SSH from anywhere"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTP (Port 80)
  ingress {
    description = "HTTP / Caddy SSL Challenge"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # HTTPS (Port 443) - SSL & Secure WebSockets (WSS)
  ingress {
    description = "HTTPS / WSS for API Gateway & Sockets"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow all outbound
  egress {
    from_port        = 0
    to_port          = 0
    protocol         = "-1"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }

  tags = {
    Name = "${var.project_name}-sg"
  }
}

# ------------------------------------------------------------------------------
# Ubuntu 24.04 AMI Lookup
# ------------------------------------------------------------------------------
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# ------------------------------------------------------------------------------
# Static Elastic IP
# ------------------------------------------------------------------------------
resource "aws_eip" "portal_eip" {
  domain = "vpc"
  tags = {
    Name = "${var.project_name}-eip"
  }
}

# ------------------------------------------------------------------------------
# EC2 Instance
# ------------------------------------------------------------------------------
resource "aws_instance" "backend_server" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  key_name               = aws_key_pair.generated_key.key_name
  vpc_security_group_ids = [aws_security_group.portal_sg.id]

  root_block_device {
    volume_size           = 40
    volume_type           = "gp3"
    delete_on_termination = true
  }

  user_data = templatefile("${path.module}/user_data.sh.tpl", {
    AWS_REGION          = var.aws_region
    S3_BUCKET           = aws_s3_bucket.media_bucket.bucket
    S3_ACCESS_KEY       = aws_iam_access_key.s3_app_key.id
    S3_SECRET_KEY       = aws_iam_access_key.s3_app_key.secret
    JWT_ACCESS_SECRET   = var.jwt_access_secret
    JWT_REFRESH_SECRET  = var.jwt_refresh_secret
    STATIC_IP           = aws_eip.portal_eip.public_ip
  })

  tags = {
    Name = "${var.project_name}-server"
  }
}

resource "aws_eip_association" "eip_assoc" {
  instance_id   = aws_instance.backend_server.id
  allocation_id = aws_eip.portal_eip.id
}
