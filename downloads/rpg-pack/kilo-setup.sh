#!/usr/bin/env bash
# kilo-setup.sh (macOS/Linux) - Kilo CLI + privseai-rpg + bitterbot 원클릭 연동 (공식 kilo.json 포맷)
set -euo pipefail
OLLAMA_URL="${KILO_OLLAMA_URL:-http://localhost:11434}"
MODEL="${KILO_MODEL:-privseai-rpg}"
# llama.cpp(openai-compatible) 사용시: KILO_OLLAMA_URL=http://localhost:8080 ./kilo-setup.sh
#   -> llama.cpp는 ollama provider가 아니라 openai-compatible custom provider로 연결해야 함 (아래 분기 참고)
USE_LLAMA_CPP="${USE_LLAMA_CPP:-0}"
CONFIG_DIR="$HOME/.config/kilo"
mkdir -p "$CONFIG_DIR"

if ! command -v kilo >/dev/null 2>&1; then
  echo "Installing @kilocode/cli..."
  npm install -g @kilocode/cli || { echo "npm 실패 -> baseline 바이너리 수동설치: https://github.com/Kilo-Org/kilocode/releases"; exit 1; }
fi
kilo --version || true

if [ "$USE_LLAMA_CPP" = "1" ]; then
  BASE_URL="${KILO_BASE_URL:-http://localhost:8080/v1}"
  cat > "$CONFIG_DIR/kilo.json" <<EOF
{
  "model": "privseai-local/privseai-rpg",
  "provider": {
    "privseai-local": {
      "options": { "baseURL": "$BASE_URL", "apiKey": "local" },
      "models": {
        "privseai-rpg": {
          "name": "PrivseAI RPG (Qwen3-4B-RPG-Roleplay-V2 Q4_K_M, llama.cpp)",
          "tool_call": true,
          "limit": { "context": 8192, "output": 1024 }
        }
      }
    }
  }
}
EOF
else
  cat > "$CONFIG_DIR/kilo.json" <<EOF
{
  "model": "ollama/$MODEL",
  "provider": {
    "ollama": {
      "options": { "baseURL": "$OLLAMA_URL" },
      "models": {
        "$MODEL": {
          "name": "PrivseAI RPG (Qwen3-4B-RPG-Roleplay-V2 Q4_K_M)",
          "tool_call": true,
          "limit": { "context": 8192, "output": 1024 }
        }
      }
    }
  }
}
EOF
fi
echo "config written: $CONFIG_DIR/kilo.json"

# bitterbot 에이전트 설치 (프로젝트 + 글로벌)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
for DEST in "$PWD/.kilo/agents" "$HOME/.config/kilo/agents"; do
  mkdir -p "$DEST"
  if [ -f "$SCRIPT_DIR/.kilo/agents/bitterbot.md" ]; then
    cp "$SCRIPT_DIR/.kilo/agents/bitterbot.md" "$DEST/bitterbot.md"
    echo "agent installed: $DEST/bitterbot.md"
  fi
done

echo "--- smoke ---"
curl -sf "$OLLAMA_URL/api/tags" | head -c 300; echo
kilo models 2>&1 | head -n 20 || true
echo "START: kilo  (bitterbot 에이전트 선택 후 사용)"
