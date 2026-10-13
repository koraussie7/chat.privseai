#!/data/data/com.termux/files/usr/bin/bash
# PrivseAI RPG Pack - install-termux.sh (Android 11+ via Termux from F-Droid)
# Ollama 미지원 -> llama.cpp 빌드 + GGUF 서버모드
set -euo pipefail
MODEL_URL="https://huggingface.co/Chun121/Qwen3-4B-RPG-Roleplay-V2/resolve/main/unsloth.Q4_K_M.gguf"
MODEL_DIR="$HOME/storage/shared/Download/AI"
mkdir -p "$MODEL_DIR"

echo "[1/5] pkg update"
apt update && apt upgrade -y
apt install -y git cmake ccache curl nodejs-lts

echo "[2/5] build llama.cpp (시간 소요)"
if [ ! -d "$HOME/llama.cpp" ]; then git clone https://github.com/ggerganov/llama.cpp.git "$HOME/llama.cpp"; fi
cd "$HOME/llama.cpp" && cmake -B build -DGGML_NATIVE=OFF && cmake --build build -j$(nproc) --target llama-cli llama-server

echo "[3/5] storage permission + model download (2.5GB)"
termux-setup-storage || true
if [ ! -f "$MODEL_DIR/rpg-v2-q4km.gguf" ]; then
  curl -L -o "$MODEL_DIR/rpg-v2-q4km.gguf" "$MODEL_URL"
else echo "model exists, skip download"; fi

echo "[4/5] smoke test"
./build/bin/llama-cli -m "$MODEL_DIR/rpg-v2-q4km.gguf" -p "안녕" -n 32 --color || true

echo "[5/5] start server: llama-server --port 8080"
echo "RUN: ~/llama.cpp/build/bin/llama-server -m $MODEL_DIR/rpg-v2-q4km.gguf -c 4096 --port 8080 --host 0.0.0.0"
echo "PHONE CHAT: privseai.com/?backend=local  또는  http://localhost:8080"
