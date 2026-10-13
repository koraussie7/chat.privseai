# PrivseAI RPG Pack 사용법 (KO) — Kilo CLI + Bitterbot 원클릭 통합

모델: `Chun121/Qwen3-4B-RPG-Roleplay-V2` Q4_K_M 2.5GB / 성인콘텐츠 포함(19+)
에이전트: Bitterbot (muhanai bitterbot-engine 규칙 계승: 동일언어 응답, 로컬우선, honest offline fallback)

## 원클릭 설치 (권장)

### macOS / Linux
```bash
chmod +x install-all.sh
./install-all.sh
# -> [1/3] Ollama + privseai-rpg 모델, [2/3] Kilo CLI + bitterbot 에이전트, [3/3] 검증까지 한번에
kilo   # bitterbot 에이전트 선택 후 사용
```

### Windows (PowerShell)
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
.\install-all.ps1
kilo   # bitterbot 에이전트 선택 후 사용
```

### Android (Termux, F-Droid 권장)
```bash
chmod +x install-all-termux.sh
./install-all-termux.sh
~/llama.cpp/build/bin/llama-server -m ~/storage/shared/Download/AI/rpg-v2-q4km.gguf -c 4096 --port 8080 --host 0.0.0.0 &
kilo   # 폰에서는 무거울 수 있음, 채팅은 https://privseai.com/?backend=local 권장
```
- 저사양폰은 서버폴백(웹채팅) 사용. 8GB+ 플래그십 권장.

## 개별 설치 (고급)
```bash
chmod +x install.sh kilo-setup.sh privseai-chat.sh
./install.sh
./kilo-setup.sh
# llama.cpp로 받았으면: USE_LLAMA_CPP=1 KILO_BASE_URL=http://localhost:8080/v1 ./kilo-setup.sh
./privseai-chat.sh
kilo
```

## Kilo 설정 설명 (공식 kilo.json 포맷)
- Ollama 모드: `~/.config/kilo/kilo.json` → `{ "model": "ollama/privseai-rpg", "provider": { "ollama": { "options": { "baseURL": "http://localhost:11434" }, "models": { "privseai-rpg": {..., "tool_call": true, "limit": {"context": 8192, "output": 1024}}}}}}`
- llama.cpp 모드: `USE_LLAMA_CPP=1` → openai-compatible custom provider `privseai-local` (`http://localhost:8080/v1`), model key `privseai-local/privseai-rpg`
- Context는 기본 8192. Kilo 공식 권장 32k로 올리려면 Modelfile `num_ctx 32768` 후 `ollama create` 다시 + kilo.json `limit.context`도 32768로 (RAM 16GB+ 필요)
- Bitterbot 에이전트: `./.kilo/agents/bitterbot.md` + `~/.config/kilo/agents/bitterbot.md`에 자동복사됨. Kilo 실행 후 에이전트 목록에서 `bitterbot` 선택.
- Bitterbot 체인: WebGPU(phi-3-mini-q4) → 로컬 OpenAI호환(8080/3456) → Ollama privseai-rpg → honest offline fallback

## 문제해결
- `ollama: command not found` → 터미널 재시작 후 PATH 확인
- 구형CPU Illegal instruction → https://github.com/Kilo-Org/kilocode/releases 에서 `-baseline` zip 수동설치
- 포트충돌 11434/8080 → `ollama ps` / 작업관리자에서 종료 후 재시작
- `kilo models`에 privseai-rpg 안보임 → `ollama list` 확인 + kilo.json model 키가 `ollama/privseai-rpg`인지 확인
- 4B 로컬모델 한계: 공식 문서처럼 코딩 정밀도는 클라우드보다 낮음. 짧은 지시 + 짧은 대화 + MCP 최소화 권장
