#!/usr/bin/env bash
# SysLegis — commit + push + deploy na VPS (rsync + Docker).
#
# Uso:
#   ./scripts/deploy-rsync.sh                    # só rsync + rebuild no remoto (sem Git)
#   ./scripts/deploy-rsync.sh -m "mensagem"      # git add -A, commit, push, rsync, rebuild
#   ./scripts/deploy-rsync.sh --sync-only        # só rsync (sem docker build)
#
# Variáveis (opcional):
#   DEPLOY_SSH=vps-syslegis   # host do ~/.ssh/config
#   DEPLOY_PATH=/opt/syslegis
#   DEPLOY_ENV_FILE=deploy/env.docker
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SSH_TARGET="${DEPLOY_SSH:-vps-syslegis}"
REMOTE_PATH="${DEPLOY_PATH:-/opt/syslegis}"
ENV_FILE="${DEPLOY_ENV_FILE:-deploy/env.docker}"

DO_GIT=0
COMMIT_MSG=""
SYNC_ONLY=0
SKIP_BUILD=0

usage() {
  cat <<'EOF'
SysLegis — commit, push e deploy (rsync + Docker na VPS).

Uso:
  ./scripts/deploy-rsync.sh
      Sincroniza o diretório atual com a VPS e corre «docker compose up -d --build».
  ./scripts/deploy-rsync.sh -m "mensagem do commit"
      git add -A, commit, push (branch actual), depois rsync + rebuild.
  ./scripts/deploy-rsync.sh --sync-only
      Apenas rsync (sem rebuild Docker).
  ./scripts/deploy-rsync.sh --no-build
      Rsync sem «docker compose up» (útil se só mudaste ficheiros estáticos).

Variáveis opcionais: DEPLOY_SSH, DEPLOY_PATH, DEPLOY_ENV_FILE
  Ex.: DEPLOY_SSH=outro-host ./scripts/deploy-rsync.sh

EOF
  exit "${1:-0}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h | --help)
      usage 0
      ;;
    -m)
      DO_GIT=1
      COMMIT_MSG="${2:?}"
      shift 2
      ;;
    --sync-only)
      SYNC_ONLY=1
      shift
      ;;
    --no-build)
      SKIP_BUILD=1
      shift
      ;;
    *)
      echo "Argumento desconhecido: $1" >&2
      usage 1
      ;;
  esac
done

rsync_deploy() {
  echo "==> rsync → ${SSH_TARGET}:${REMOTE_PATH}"
  rsync -avz --delete \
    --exclude node_modules \
    --exclude .next \
    --exclude deploy/env.docker \
    --exclude .env \
    --exclude .env.local \
    --exclude .env.* \
    --exclude .git \
    --exclude .cursor \
    --exclude public/uploads \
    ./ "${SSH_TARGET}:${REMOTE_PATH}/"
}

remote_build() {
  if [[ "$SKIP_BUILD" -eq 1 ]]; then
    echo "==> (--no-build) a saltar docker compose"
    return 0
  fi
  echo "==> Docker no remoto: compose up --build"
  ssh -o BatchMode=yes "${SSH_TARGET}" "cd '${REMOTE_PATH}' && docker compose --env-file '${ENV_FILE}' up -d --build"
}

git_commit_push() {
  if [[ "$DO_GIT" -ne 1 ]]; then
    return 0
  fi
  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "Erro: não é um repositório Git." >&2
    exit 1
  fi
  local branch
  branch="$(git rev-parse --abbrev-ref HEAD)"
  if [[ -z "$(git status --porcelain)" ]]; then
    echo "==> Git: sem alterações — a saltar commit/push"
    return 0
  fi
  echo "==> Git: add + commit + push (${branch})"
  git add -A
  git commit -m "${COMMIT_MSG}"
  git push origin "${branch}"
}

if [[ "$DO_GIT" -eq 1 && -z "${COMMIT_MSG// }" ]]; then
  echo "Erro: use -m \"mensagem do commit\" com texto não vazio." >&2
  exit 1
fi

git_commit_push
rsync_deploy

if [[ "$SYNC_ONLY" -eq 1 ]]; then
  echo "==> Concluído (apenas rsync)."
  exit 0
fi

remote_build
echo "==> Deploy concluído."
