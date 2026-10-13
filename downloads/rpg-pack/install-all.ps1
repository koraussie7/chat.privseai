# PrivseAI RPG Pack - install-all.ps1 (Windows 원클릭)
# 1회 실행으로: Ollama+모델 + Kilo CLI + bitterbot 에이전트 설치
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "=== [1/3] 모델 설치 (Ollama + privseai-rpg) ==="
& (Join-Path $ScriptDir "install.ps1")

Write-Host ""
Write-Host "=== [2/3] Kilo CLI + bitterbot 에이전트 설치 ==="
& (Join-Path $ScriptDir "kilo-setup.ps1")

Write-Host ""
Write-Host "=== [3/3] 최종 검증 ==="
try { ollama list } catch { Write-Host "ollama list 확인 필요" }
try { kilo models } catch { Write-Host "kilo models 확인 필요" }
Write-Host ""
Write-Host "DONE. 사용법:"
Write-Host "  채팅: ollama run privseai-rpg '안녕, 자기소개해줘'"
Write-Host "  에이전트: kilo   (bitterbot 에이전트 선택)"
