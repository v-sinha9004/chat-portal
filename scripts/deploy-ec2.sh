#!/usr/bin/env bash
set -e

# Configuration
SERVER_IP="52.66.128.110"
KEY_PATH="terraform/ec2_key.pem"
REMOTE_DIR="/opt/chat-portal"

echo "🚀 Starting redeployment to EC2 (${SERVER_IP})..."

# Check SSH key exists
if [ ! -f "$KEY_PATH" ]; then
  echo "❌ Error: SSH key not found at $KEY_PATH"
  exit 1
fi

chmod 600 "$KEY_PATH"

# Run remote git pull and targeted rebuild
ssh -o StrictHostKeyChecking=no -i "$KEY_PATH" "ubuntu@${SERVER_IP}" << 'EOF'
  set -e
  echo "📥 Pulling latest changes from Git..."
  cd /opt/chat-portal
  sudo git pull origin main

  echo "🔨 Rebuilding and restarting updated containers..."
  sudo docker compose -f docker-compose.prod.yml --env-file .env up -d --build

  echo "🧹 Cleaning unused build caches..."
  sudo docker image prune -f

  echo "✅ Redeployment completed successfully!"
EOF

echo "🎉 Done! Verifying health..."
sleep 3
curl -s "https://api.${SERVER_IP}.sslip.io/health" | grep -q '"status":"ok"' && echo "✅ API Gateway and microservices are healthy!" || echo "⚠️ Check container logs if needed."
