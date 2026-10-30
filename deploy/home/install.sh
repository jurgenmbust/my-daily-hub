#!/usr/bin/env bash
# Owner-run installation only. The GitHub workflow never invokes this file.
set -euo pipefail
test "$EUID" -eq 0 || { echo 'Run: sudo bash deploy/home/install.sh'; exit 1; }
source_dir=$(cd -- "$(dirname -- "$0")" && pwd)
command -v python3 >/dev/null
command -v visudo >/dev/null
test -x /usr/bin/docker
test ! -e /etc/sudoers.d/my-daily-hub-deploy || { echo 'Already installed; review installed files before updating.'; exit 1; }
if id hub-runner >/dev/null 2>&1; then
  echo 'hub-runner already exists; inspect it rather than modifying an existing account.'; exit 1
fi
base=$(/usr/bin/docker inspect --format '{{.Image}}' my-daily-hub-web-1)
[[ "$base" =~ ^sha256:[0-9a-f]{64}$ ]]
/usr/bin/docker network inspect my-daily-hub_frontend >/dev/null
/usr/bin/docker inspect my-daily-hub-db-1 >/dev/null
# Preserve the known-working runtime for deployments. No repository Dockerfile runs as root.
/usr/bin/docker tag "$base" my-daily-hub-web:deploy-base
useradd --create-home --home-dir /var/lib/hub-runner --shell /bin/bash hub-runner
passwd --lock hub-runner
install -d -o root -g root -m 0700 /etc/my-daily-hub-deploy /var/lib/my-daily-hub-deploy /var/backups/my-daily-hub
install -o root -g root -m 0755 "$source_dir/deploy-web.py" /usr/local/sbin/my-daily-hub-deploy
install -o root -g root -m 0600 "$source_dir/web.yml" /etc/my-daily-hub-deploy/web.yml
printf '%s\n' "$base" > /etc/my-daily-hub-deploy/base-image
chmod 0600 /etc/my-daily-hub-deploy/base-image
rule=$(mktemp)
trap 'rm -f "$rule"' EXIT
printf '%s\n' 'hub-runner ALL=(root) NOPASSWD: /usr/local/sbin/my-daily-hub-deploy ""' > "$rule"
visudo -cf "$rule"
install -o root -g root -m 0440 "$rule" /etc/sudoers.d/my-daily-hub-deploy
/usr/bin/docker compose --project-directory /etc/my-daily-hub-deploy -f /etc/my-daily-hub-deploy/web.yml config --quiet
echo 'Installed. hub-runner has no Docker-group membership and only a no-argument website deployment sudo rule.'
