# Systemd Service Files for Inference Servers
# Copy to /etc/systemd/system/

# ============================================
# Fellowship Service
# ============================================
# /etc/systemd/system/privseai-fellowship.service
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

# ============================================
# Girlfriend.ai Service
# ============================================
# /etc/systemd/system/privseai-girlfriend-ai.service
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

# ============================================
# OmniRoute Service (Optional)
# ============================================
# /etc/systemd/system/privseai-omniroute.service
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

# ============================================
# Installation Commands
# ============================================
# sudo cp *.service /etc/systemd/system/
# sudo systemctl daemon-reload
# sudo systemctl enable --now privseai-fellowship privseai-girlfriend-ai privseai-omniroute
# sudo systemctl status privseai-fellowship privseai-girlfriend-ai privseai-omniroute