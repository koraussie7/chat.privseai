#!/usr/bin/env bash
#
# scripts/deploy.sh — build the app and rsync dist/ to the origin server
# that backs privseai.com (Cloudflare-fronted).
#
# Required:
#   - SSH key at ~/.ssh/agentmesh_ed25519 (or override with DEPLOY_KEY)
#   - SSH access to 185.55.240.110 (or override with DEPLOY_HOST)
#   - The remote server runs Caddy with /var/www/privseai as doc root
#
# Usage:
#   ./scripts/deploy.sh                  # full build + deploy
#   ./scripts/deploy.sh --skip-build     # reuse current dist/
#   ./scripts/deploy.sh --dry-run        # rsync --dry-run, no changes
#   ./scripts/deploy.sh --no-backup      # skip remote backup step

set -euo pipefail

# -------- configuration ----------------------------------------------------
DEPLOY_HOST="${DEPLOY_HOST:-185.55.240.110}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_KEY="${DEPLOY_KEY:-$HOME/.ssh/agentmesh_ed25519}"
REMOTE_DOC_ROOT="${REMOTE_DOC_ROOT:-/var/www/privseai}"

# Patterns to never overwrite on the remote (preserves menu, sitemap, etc.).
KEEP_PATTERNS=(
  --exclude='menu*'
  --exclude='sitemap.xml'
  --exclude='og-image.README'
  --exclude='build/'
  --exclude='*.bak-*'
)

# -------- argument parsing -------------------------------------------------
SKIP_BUILD=0
DRY_RUN=0
BACKUP=1
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=1 ;;
    --dry-run)    DRY_RUN=1 ;;
    --no-backup)  BACKUP=0 ;;
    -h|--help)
      sed -n '2,16p' "$0"; exit 0 ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1 ;;
  esac
done

# -------- preflight --------------------------------------------------------
cd "$(dirname "$0")/.."

if [[ ! -f "$DEPLOY_KEY" ]]; then
  echo "ERROR: SSH key not found at $DEPLOY_KEY" >&2
  echo "Set DEPLOY_KEY env var to override." >&2
  exit 1
fi

# Quick connectivity probe so we fail fast on network issues.
if ! ssh -q -o BatchMode=yes -o ConnectTimeout=10 \
       -i "$DEPLOY_KEY" -p "$DEPLOY_PORT" \
       "${DEPLOY_USER}@${DEPLOY_HOST}" \
       "echo deploy-probe-ok" >/dev/null 2>&1; then
  echo "ERROR: SSH probe to ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_PORT} failed" >&2
  exit 1
fi

SSH_CMD=(ssh -i "$DEPLOY_KEY" -p "$DEPLOY_PORT"
  -o StrictHostKeyChecking=accept-new
  "${DEPLOY_USER}@${DEPLOY_HOST}")

# -------- build ------------------------------------------------------------
if [[ "$SKIP_BUILD" -eq 0 ]]; then
  echo "==> Running npm run build"
  npm run build
else
  if [[ ! -d dist ]] || [[ -z "$(ls -A dist 2>/dev/null)" ]]; then
    echo "ERROR: --skip-build given but dist/ is empty or missing" >&2
    exit 1
  fi
  echo "==> Reusing existing dist/"
fi

# -------- remote backup ----------------------------------------------------
if [[ "$BACKUP" -eq 1 ]]; then
  TS="$(date +%Y%m%d-%H%M%S)"
  echo "==> Backing up remote index.html (suffix: $TS)"
  "${SSH_CMD[@]}" \
    "if [[ -f ${REMOTE_DOC_ROOT}/index.html ]]; then \
       cp -p ${REMOTE_DOC_ROOT}/index.html ${REMOTE_DOC_ROOT}/index.html.bak-${TS}; \
       echo backed-up; \
     else \
       echo no-existing-index; \
     fi"
fi

# -------- rsync ------------------------------------------------------------
RSYNC_FLAGS=(-avz --progress --human-readable "${KEEP_PATTERNS[@]}")
if [[ "$DRY_RUN" -eq 1 ]]; then
  RSYNC_FLAGS+=(--dry-run)
fi

echo "==> Rsync dist/ -> ${DEPLOY_USER}@${DEPLOY_HOST}:${REMOTE_DOC_ROOT}/"
rsync "${RSYNC_FLAGS[@]}" \
  -e "ssh -i ${DEPLOY_KEY} -p ${DEPLOY_PORT} -o StrictHostKeyChecking=accept-new" \
  dist/ "${DEPLOY_USER}@${DEPLOY_HOST}:${REMOTE_DOC_ROOT}/"

# -------- verification -----------------------------------------------------
if [[ "$DRY_RUN" -eq 0 ]]; then
  echo "==> Verifying remote files"
  "${SSH_CMD[@]}" \
    "echo '--- index.html ---'; head -3 ${REMOTE_DOC_ROOT}/index.html; \
     echo '--- assets/ ---'; ls ${REMOTE_DOC_ROOT}/assets/ 2>/dev/null | head -10; \
     echo '--- total size ---'; du -sh ${REMOTE_DOC_ROOT}/"
fi

echo
echo "==> Done."
echo "    Visit https://privseai.com/ to verify the deploy."
