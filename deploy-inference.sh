#!/bin/bash
# deploy-inference.sh - Deploy PrivseAI Inference Stack
# Usage: sudo bash deploy-inference.sh

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# Config
INSTALL_DIR="/opt/privseai"
DATA_DIR="${INSTALL_DIR}/data"
LOG_DIR="${INSTALL_DIR}/logs"

echo "========================================"
echo "PrivseAI Inference Stack Deployment"
echo "========================================"

# Check root
[[ $EUID -eq 0 ]] || error "Run as root: sudo bash deploy-inference.sh"

# Check Docker
command -v docker >/dev/null || error "Docker not installed"
command -v docker-compose >/dev/null || error "Docker Compose not installed"

# Create directories
log "Creating directories..."
mkdir -p "${DATA_DIR}/fellowship" "${DATA_DIR}/girlfriend-ai" "${DATA_DIR}/omniroute"
mkdir -p "${INSTALL_DIR}/logs/fellowship" "${INSTALL_DIR}/logs/girlfriend-ai" "${INSTALL_DIR}/logs/omniroute"
mkdir -p "${INSTALL_DIR}/cache/omniroute"

# Set permissions
chmod 755 "${DATA_DIR}" "${LOG_DIR}"

# Copy systemd services
log "Installing systemd services..."
cp /opt/privseai/systemd/*.service /etc/systemd/system/ 2>/dev/null || true

# Create systemd service files inline if not present
if [[ ! -f /etc/systemd/system/privseai-fellowship.service ]]; then
    cat > /etc/systemd/system/privseai-fellowship.service << 'EOF'
[Unit]
Description=PrivseAI Fellowship (Colibri WASM)
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
Restart=always
RestartSec=10
User=root
WorkingDirectory=/opt/privseai
ExecStartPre=-/usr/bin/docker stop privseai-fellowship
ExecStartPre=-/usr/bin/docker rm privseai-fellowship
ExecStart=/usr/bin/docker run --rm \
    --name privseai-fellowship \
    --network host \
    -e PORT=3001 \
    -e LOG_LEVEL=info \
    -e ENABLE_WASM=true \
    -e MAX_CONCURRENT=10 \
    -e MODEL_CACHE_DIR=/data/models \
    -v /opt/privseai/data/fellowship:/data/models \
    -v /opt/privseai/logs/fellowship:/var/log/fellowship \
    muhanai/fellowship:latest
ExecStop=/usr/bin/docker stop privseai-fellowship
TimeoutStartSec=120
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
EOF
fi

if [[ ! -f /etc/systemd/system/privseai-girlfriend-ai.service ]]; then
    cat > /etc/systemd/system/privseai-girlfriend-ai.service << 'EOF'
[Unit]
Description=PrivseAI Girlfriend.ai Server
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
Restart=always
RestartSec=10
User=root
WorkingDirectory=/opt/privseai
ExecStartPre=-/usr/bin/docker stop privseai-girlfriend-ai
ExecStartPre=-/usr/bin/docker rm privseai-girlfriend-ai
ExecStart=/usr/bin/docker run --rm \
    --name privseai-girlfriend-ai \
    --network host \
    -e PORT=3002 \
    -e NODE_ENV=production \
    -e LOG_LEVEL=info \
    -e DB_PATH=/data/gf.db \
    -e ENABLE_NSFW=true \
    -e MAX_HISTORY=50 \
    -v /opt/privseai/data/girlfriend-ai:/data \
    -v /opt/privseai/logs/girlfriend-ai:/var/log/girlfriend-ai \
    giovancarl444/girlfriend-ai:latest
ExecStop=/usr/bin/docker stop privseai-girlfriend-ai
TimeoutStartSec=60
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
EOF
fi

if [[ ! -f /etc/systemd/system/privseai-omniroute.service ]]; then
    cat > /etc/systemd/system/privseai-omniroute.service << 'EOF'
[Unit]
Description=PrivseAI OmniRoute (MuhanAI)
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
Restart=always
RestartSec=10
User=root
WorkingDirectory=/opt/privseai
ExecStartPre=-/usr/bin/docker stop privseai-omniroute
ExecStartPre=-/usr/bin/docker rm privseai-omniroute
ExecStart=/usr/bin/docker run --rm \
    --name privseai-omniroute \
    --network host \
    -e PORT=4000 \
    -e ROUTER_MODE=smart \
    -e DEFAULT_MODEL=omni \
    -e FALLBACK_MODELS=qwen3-0.6b,qwen2.5-7b,llama3.2-3b \
    -e TIMEOUT_MS=20000 \
    -e RATE_LIMIT=100 \
    -v /opt/privseai/cache/omniroute:/cache \
    muhanai/omniroute:latest
ExecStop=/usr/bin/docker stop privseai-omniroute
TimeoutStartSec=60
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
EOF
fi

# Pull images
log "Pulling Docker images..."
docker pull muhanai/fellowship:latest || warn "fellowship image pull failed"
docker pull giovancarl444/girlfriend-ai:latest || warn "girlfriend-ai image pull failed"
docker pull muhanai/omniroute:latest || warn "omniroute image pull failed"

# Reload systemd
log "Reloading systemd..."
systemctl daemon-reload

# Enable and start services
log "Enabling and starting services..."
systemctl enable --now privseai-fellowship || warn "fellowship enable failed"
systemctl enable --now privseai-girlfriend-ai || warn "girlfriend-ai enable failed"
systemctl enable --now privseai-omniroute || warn "omniroute enable failed"

# Wait for services
log "Waiting for services to start..."
sleep 15

# Health checks
log "Running health checks..."
for service in fellowship girlfriend-ai omniroute; do
    port=0
    case $service in
        fellowship) port=3001 ;;
        girlfriend-ai) port=3002 ;;
        omniroute) port=4000 ;;
    esac
    for i in {1..10}; do
        if curl -sf "http://localhost:${port}/health" >/dev/null 2>&1; then
            log "${service} is healthy on port ${port}"
            break
        fi
        sleep 3
    done
done

# Show status
log "Service status:"
systemctl status privseai-fellowship privseai-girlfriend-ai privseai-omniroute --no-pager

log "========================================"
log "Deployment complete!"
log "========================================"
log "Services running on:"
log "  - Fellowship (Colibri):    http://localhost:3001"
log "  - Girlfriend.ai:           http://localhost:3002"
log "  - OmniRoute (MuhanAI):     http://localhost:4000"
log ""
log "Configure Caddy with Caddyfile.production"
log "Set DNS A records for: fellowship.privseai.com, gf.privseai.com, omniroute.privseai.com"
log "Add .env.production to frontend build"