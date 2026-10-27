#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
mkdir -p backups
file="backups/dailyhub-$(date -u +%Y%m%dT%H%M%SZ).dump"
tmp="${file}.partial"
trap 'rm -f "$tmp"' EXIT
docker compose exec -T db pg_dump -U dailyhub -d dailyhub -Fc > "$tmp"
test -s "$tmp"
mv "$tmp" "$file"
sha256sum "$file" > "$file.sha256"
printf 'Backup saved: %s\n' "$file"
