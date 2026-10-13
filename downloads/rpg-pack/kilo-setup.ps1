# kilo-setup.ps1 (Windows) - Kilo CLI + privseai-rpg + bitterbot 원클릭 (공식 kilo.json 포맷)
$ErrorActionPreference = "Stop"
$OLLAMA_URL = if ($env:KILO_OLLAMA_URL) { $env:KILO_OLLAMA_URL } else { "http://localhost:11434" }
$MODEL = if ($env:KILO_MODEL) { $env:KILO_MODEL } else { "privseai-rpg" }
$USE_LLAMA_CPP = if ($env:USE_LLAMA_CPP) { $env:USE_LLAMA_CPP } else { "0" }
$CONFIG_DIR = "$env:USERPROFILE\.config\kilo"
New-Item -ItemType Directory -Force -Path $CONFIG_DIR | Out-Null
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Get-Command kilo -ErrorAction SilentlyContinue)) {
  npm install -g @kilocode/cli
}
kilo --version

if ($USE_LLAMA_CPP -eq "1") {
  $BASE_URL = if ($env:KILO_OLLAMA_URL) { $env:KILO_OLLAMA_URL } else { "http://localhost:8080/v1" }
  $config = @{
    model = "privseai-local/privseai-rpg"
    provider = @{ "privseai-local" = @{
      options = @{ baseURL = $BASE_URL; apiKey = "local" }
      models = @{ "privseai-rpg" = @{
        name = "PrivseAI RPG (Qwen3-4B-RPG-Roleplay-V2 Q4_K_M, llama.cpp)"
        tool_call = $true
        limit = @{ context = 8192; output = 1024 }
      } }
    } }
  } | ConvertTo-Json -Depth 6
} else {
  $config = @{
    model = "ollama/$MODEL"
    provider = @{ "ollama" = @{
      options = @{ baseURL = $OLLAMA_URL }
      models = @{ "$MODEL" = @{
        name = "PrivseAI RPG (Qwen3-4B-RPG-Roleplay-V2 Q4_K_M)"
        tool_call = $true
        limit = @{ context = 8192; output = 1024 }
      } }
    } }
  } | ConvertTo-Json -Depth 6
}
$config | Out-File -FilePath (Join-Path $CONFIG_DIR "kilo.json") -Encoding utf8
Write-Host "config written: $CONFIG_DIR\kilo.json"

# bitterbot 에이전트 설치 (현재폴더 + 글로벌)
foreach ($DEST in @("$PWD\.kilo\agents", "$CONFIG_DIR\agents")) {
  New-Item -ItemType Directory -Force -Path $DEST | Out-Null
  $SRC = Join-Path $ScriptDir ".kilo\agents\bitterbot.md"
  if (Test-Path $SRC) { Copy-Item $SRC (Join-Path $DEST "bitterbot.md") -Force; Write-Host "agent installed: $DEST\bitterbot.md" }
}
try { (Invoke-WebRequest -Uri "$OLLAMA_URL/api/tags" -UseBasicParsing).Content.Substring(0,200) } catch { Write-Host "endpoint not ready yet, ollama serve 확인" }
try { kilo models } catch { Write-Host "kilo models 확인 필요" }
Write-Host "START: kilo  (bitterbot 에이전트 선택 후 사용)"
