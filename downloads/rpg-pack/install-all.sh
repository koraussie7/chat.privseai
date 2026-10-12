#!/usr/bin/env bash
# PrivseAI RPG Pack - install-all.sh (macOS/Linux 원클릭)
# 1회 실행으로: Ollama+모델(Qwen3-4B-RPG Q4_K_M) + Kilo CLI + bitterbot 에이전트까지 설치
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== [1/3] 모델 설치 (Ollama + privseai-rpg) ==="
bash "$SCRIPT_DIR/install.sh"

echo ""
echo "=== [2/3] Kilo CLI + bitterbot 에이전트 설치 ==="
bash "$SCRIPT_DIR/kilo-setup.sh"

echo ""
echo "=== [3/3] 최종 검증 ==="
ollama list 2>/dev/null | head -n 10 || true
kilo models 2>&1 | head -n 20 || true
echo ""
echo "DONE. 사용법:"
echo "  채팅: ollama run privseai-rpg '안녕, 자기소개해줘'"
echo "  에이전트: kilo   (bitterbot 에이전트 선택)"
echo "  llama.cpp 모드였다면: USE_LLAMA_CPP=1 KILO_BASE_URL=http://localhost:8080/v1 bash kilo-setup.sh"
