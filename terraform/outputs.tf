output "elastic_ip" {
  description = "The public static IP address of the EC2 backend instance"
  value       = aws_eip.portal_eip.public_ip
}

output "backend_domain" {
  description = "The SSL domain generated via sslip.io"
  value       = "api.${aws_eip.portal_eip.public_ip}.sslip.io"
}

output "backend_api_url" {
  description = "Backend REST API Base URL to set in Vercel as VITE_API_URL"
  value       = "https://api.${aws_eip.portal_eip.public_ip}.sslip.io"
}

output "backend_socket_url" {
  description = "Backend WebSocket URL to set in Vercel as VITE_CHAT_SOCKET_URL"
  value       = "https://api.${aws_eip.portal_eip.public_ip}.sslip.io"
}

output "s3_bucket_name" {
  description = "The S3 Media storage bucket name"
  value       = aws_s3_bucket.media_bucket.bucket
}

output "ssh_command" {
  description = "Command to SSH directly into the instance"
  value       = "ssh -i terraform/ec2_key.pem ubuntu@${aws_eip.portal_eip.public_ip}"
}
