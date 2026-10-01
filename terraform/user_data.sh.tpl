#!/bin/bash
set -euo pipefail

# Redirect logs for debugging
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1
echo "=== Starting Chat Portal Cloud-Init Setup ==="

# 1. Update and install prerequisites
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl gnupg git

# 2. Install official Docker Engine
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  tee /etc/apt/sources.list.d/docker.list > /dev/null

apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

systemctl enable docker
systemctl start docker
usermod -aG docker ubuntu

# 3. Clone Repository
DEPLOY_DIR="/opt/chat-portal"
rm -rf "$DEPLOY_DIR"
git clone https://github.com/v-sinha9004/chat-portal.git "$DEPLOY_DIR"
cd "$DEPLOY_DIR"

# 4. Create Production Environment Configuration
DOMAIN="api.${STATIC_IP}.sslip.io"

cat << EOF > "$DEPLOY_DIR/.env"
# Global
NODE_ENV=production
CORS_ORIGIN=*

# PostgreSQL
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres_secure_pass_2026
POSTGRES_DB=chat_portal
POSTGRES_PORT=5432

# MongoDB
MONGO_INITDB_ROOT_USERNAME=admin
MONGO_INITDB_ROOT_PASSWORD=mongo_secure_pass_2026
MONGO_INITDB_DATABASE=chat_portal
MONGO_PORT=27017

# Redis
REDIS_PORT=6379

# JWT Secrets
JWT_ACCESS_SECRET="${JWT_ACCESS_SECRET}"
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET}"
JWT_REFRESH_EXPIRES_IN=7d

# AWS S3 Storage
STORAGE_REGION="${AWS_REGION}"
STORAGE_ACCESS_KEY="${S3_ACCESS_KEY}"
STORAGE_SECRET_KEY="${S3_SECRET_KEY}"
STORAGE_BUCKET="${S3_BUCKET}"
STORAGE_PUBLIC_URL="https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com"
STORAGE_FORCE_PATH_STYLE=false
EOF

# 5. Create Caddyfile for automated HTTPS / WSS reverse proxy
mkdir -p "$DEPLOY_DIR/caddy"
cat << EOF > "$DEPLOY_DIR/caddy/Caddyfile"
$DOMAIN {
    reverse_proxy api-gateway:3000
}
EOF

# 6. Append Caddy reverse proxy to docker-compose.prod.yml
cat << 'EOF' >> "$DEPLOY_DIR/docker-compose.prod.yml"

  caddy:
    image: caddy:2-alpine
    container_name: chat-portal-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./caddy/Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - api-gateway
    networks:
      - chat-network

volumes:
  caddy_data:
  caddy_config:
EOF

# 7. Build and run all services
echo "=== Launching Docker Compose Stack ==="
docker compose -f docker-compose.prod.yml --env-file .env up -d --build

echo "=== Chat Portal Setup Complete ==="
