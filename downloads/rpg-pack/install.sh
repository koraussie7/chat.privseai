#!/usr/bin/env bash
# PrivseAI RPG Pack - install.sh (macOS / Linux)
# Qwen3-4B-RPG-Roleplay-V2 Q4_K_M (2.5GB) + Ollama (llama.cpp fallback)
set -euo pipefail
MODEL_HF="hf.co/Chun121/Qwen3-4B-RPG-Roleplay-V2:Q4_K_M"
MODEL_URL="https://huggingface.co/Chun121/Qwen3-4B-RPG-Roleplay-V2/resolve/main/unsloth.Q4_K_M.gguf"
MODEL_NAME="privseai-rpg"
DATA_DIR="${HOME}/.privseai/models"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$DATA_DIR"

echo "[1/4] OS check: $(uname -s -m)"
if ! command -v ollama >/dev/null 2>&1; then
  echo "[2/4] Installing Ollama..."
  if [[ "$(uname -s)" == "Darwin" ]]; then
    if command -v brew >/dev/null 2>&1; then brew install ollama;
    else curl -fsSL https://ollama.com/install.sh | sh; fi
  else
    curl -fsSL https://ollama.com/install.sh | sh
  fi
else echo "[2/4] Ollama already installed: $(ollama --version || true)"; fi

# ensure serve running
if ! curl -sf http://localhost:11434/api/tags >/dev/null 2>&1; then
  echo "Starting ollama serve..."
  (ollama serve >/tmp/ollama.log 2>&1 &) ; sleep 4
fi

echo "[3/4] Pull model: $MODEL_HF"
if ollama pull "$MODEL_HF"; then
  echo "Creating $MODEL_NAME from Modelfile-RPG..."
  ollama create "$MODEL_NAME" -f "$SCRIPT_DIR/Modelfile-RPG"
else
  echo "Ollama pull failed -> llama.cpp fallback download"
  curl -L -o "$DATA_DIR/rpg-v2-q4km.gguf" "$MODEL_URL"
  if ! command -v llama-server >/dev/null 2>&1; then
    curl -LsSf https://llama.app/install.sh | sh
    export PATH="$HOME/.llama/bin:$PATH"
  fi
fi

echo "[4/4] Verify"
curl -s http://localhost:11434/api/tags | head -c 500; echo
echo "DONE. Test: ollama run $MODEL_NAME '안녕, 자기소개해줘'"
