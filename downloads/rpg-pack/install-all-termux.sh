#!/data/data/com.termux/files/usr/bin/bash
# PrivseAI RPG Pack - install-all-termux.sh (Android 원클릭: llama.cpp + Kilo + bitterbot)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MODEL_DIR="$HOME/storage/shared/Download/AI"

echo "=== [1/3] llama.cpp + 모델 (2.5GB) ==="
bash "$SCRIPT_DIR/install-termux.sh"

echo ""
echo "=== [2/3] Kilo CLI + bitterbot (llama.cpp openai-compatible 모드) ==="
if ! command -v kilo >/dev/null 2>&1; then
  npm install -g @kilocode/cli || echo "npm 실패 -> https://github.com/Kilo-Org/kilocode/releases 에서 수동설치"
fi
USE_LLAMA_CPP=1 KILO_BASE_URL=http://localhost:8080/v1 bash "$SCRIPT_DIR/kilo-setup.sh" || \
  (mkdir -p ~/.config/kilo && cp "$SCRIPT_DIR/kilo-config.template.json" ~/.config/kilo/kilo.json && echo "template config 복사됨")

echo ""
echo "=== [3/3] 서버 시작 안내 ==="
echo "RUN: ~/llama.cpp/build/bin/llama-server -m $MODEL_DIR/rpg-v2-q4km.gguf -c 4096 --port 8080 --host 0.0.0.0 &"
echo "THEN: kilo   (폰에서는 무거울 수 있음, 채팅은 privseai.com/?backend=local 권장)"
