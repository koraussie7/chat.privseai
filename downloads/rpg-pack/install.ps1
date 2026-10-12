# PrivseAI RPG Pack - install.ps1 (Windows 10 22H2+)
# Requires: PowerShell 5.1+, 5GB disk, 8GB RAM
$ErrorActionPreference = "Stop"
$MODEL_HF = "hf.co/Chun121/Qwen3-4B-RPG-Roleplay-V2:Q4_K_M"
$MODEL_URL = "https://huggingface.co/Chun121/Qwen3-4B-RPG-Roleplay-V2/resolve/main/unsloth.Q4_K_M.gguf"
$MODEL_NAME = "privseai-rpg"
$DATA_DIR = "$env:USERPROFILE\.privseai\models"
New-Item -ItemType Directory -Force -Path $DATA_DIR | Out-Null
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "[1/4] Windows check: $([Environment]::OSVersion.Version)"
if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
  Write-Host "[2/4] Installing Ollama..."
  $installer = "$env:TEMP\OllamaSetup.exe"
  Invoke-WebRequest -Uri "https://ollama.com/download/OllamaSetup.exe" -OutFile $installer
  Start-Process -FilePath $installer -Args "/SILENT" -Wait
  $env:Path = [Environment]::GetEnvironmentVariable("Path","User") + ";" + [Environment]::GetEnvironmentVariable("Path","Machine")
} else { Write-Host "[2/4] Ollama exists"; ollama --version }

Write-Host "[3/4] Pull model: $MODEL_HF"
try {
  ollama pull $MODEL_HF
  ollama create $MODEL_NAME -f (Join-Path $ScriptDir "Modelfile-RPG")
} catch {
  Write-Host "Ollama pull failed -> llama.cpp fallback"
  $gguf = Join-Path $DATA_DIR "rpg-v2-q4km.gguf"
  Invoke-WebRequest -Uri $MODEL_URL -OutFile $gguf
  if (-not (Get-Command llama-server -ErrorAction SilentlyContinue)) {
    winget install --id GGML.llama.cpp -e --silent
  }
}

Write-Host "[4/4] Verify"
try { (Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -UseBasicParsing).Content.Substring(0,300) } catch { Write-Host "ollama not yet serving, tray icon에서 실행 확인" }
Write-Host "DONE. Test: ollama run $MODEL_NAME '안녕, 자기소개해줘'"
