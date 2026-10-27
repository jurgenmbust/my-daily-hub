#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
file="${1:?Usage: bash scripts/restore.sh backups/file.dump --confirm-replace}"
test "${2:-}" = --confirm-replace || { echo 'Restore replaces all application data. Pass --confirm-replace after taking a fresh backup.' >&2; exit 1; }
test -r "$file"
sha256sum -c "$file.sha256"
docker compose stop web api
trap 'echo "Restore did not finish. Inspect the database before restarting api and web." >&2' ERR
docker compose exec -T db pg_restore -U dailyhub -d dailyhub --clean --if-exists --single-transaction --exit-on-error < "$file"
docker compose up -d api web
echo 'Restore complete. Verify /api/health and user data.'
