#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${DEPLOY_HOST:-root@103.74.93.91}"
KEY="${DEPLOY_KEY:-$HOME/.ssh/id_ed25519_timeweb}"

rsync -az --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude dist \
  --exclude uploads \
  --exclude .env \
  --exclude apps/api/.env \
  --exclude .DS_Store \
  -e "ssh -i ${KEY}" \
  "${ROOT}/" \
  "${HOST}:/opt/faverum/"

ssh -i "${KEY}" "${HOST}" 'cd /opt/faverum && docker compose -f docker-compose.prod.yml up --build -d'
