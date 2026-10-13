#!/usr/bin/env bash
# privseai-chat.sh - 상태체크 후 채팅 오픈 (mac/Linux, Termux는 localhost:8080)
set -u
for URL in http://localhost:11434/api/tags http://localhost:8080/health; do
  if curl -sf "$URL" >/dev/null 2>&1; then echo "OK: $URL"; READY=1; fi
done
if [ "${READY:-0}" != "1" ]; then echo "모델 서버 없음. ./install.sh 먼저 실행 (또는 서버폴백으로 웹채팅)"; fi
if command -v xdg-open >/dev/null 2>&1; then xdg-open "https://privseai.com/?backend=local" &
elif command -v open >/dev/null 2>&1; then open "https://privseai.com/?backend=local" &
else echo "OPEN: https://privseai.com/?backend=local"; fi
