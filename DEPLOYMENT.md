# Deployment to Ubuntu 24.04 — 192.168.100.29

These commands are instructions for the owner. The implementation workflow does not connect to the server. Agent-performed SSH access or remote deployment requires explicit owner approval.

## 1. Prepare the host

Use a DHCP reservation or static address for 192.168.100.29. Confirm Ubuntu, Docker Engine, Compose v2 and Portainer CE are installed and maintained. Keep the laptop on AC with adequate cooling. Configure lid/suspend behavior according to your server policy so the host stays awake. With only 8GB RAM, avoid concurrent image builds and other large workloads.

On the server, using an authorized console or SSH shell:

```bash
sudo systemctl enable --now docker
docker version
docker compose version
ip -4 address
sudo install -d -m 0750 -o "$USER" -g "$(id -gn)" /opt/my-daily-hub
```

Docker access grants root-equivalent host control. Restrict Docker-group membership and Portainer access. The app does not need the Docker socket or Portainer credentials.

## 2. Transfer source using a controlled SSH workflow

After independently verifying the server's SSH fingerprint, copy the project from Windows PowerShell. Replace `YOUR_SSH_USER` with your actual server account. This is a manual instruction, not an executed command:

```powershell
tar -czf my-daily-hub-source.tar.gz --exclude=node_modules --exclude=bin --exclude=obj --exclude=dist --exclude=.env --exclude=.tools --exclude=.git --exclude=backups --exclude=.local-keys -C 'E:\ChatGPT Codex\my-daily-hub' .
scp .\my-daily-hub-source.tar.gz YOUR_SSH_USER@192.168.100.29:/opt/my-daily-hub/
ssh YOUR_SSH_USER@192.168.100.29
```

On Ubuntu:

```bash
cd /opt/my-daily-hub
tar -xzf my-daily-hub-source.tar.gz
rm my-daily-hub-source.tar.gz
cp .env.example .env
chmod 600 .env
openssl rand -hex 32
openssl rand -hex 24
nano .env
```

Set `DB_PASSWORD` and `ADMIN_PASSWORD` to distinct generated values, `ADMIN_USERNAME` to your chosen name, `LAN_IP=192.168.100.29`, and `SECURE_COOKIES=false` for the requested HTTP LAN origin. Use random hex database credentials to avoid connection-string delimiters. Never commit `.env`, paste it in chat or include it in source archives. Keep a secure offline copy for recovery.

## 3. Build and start with Compose

```bash
cd /opt/my-daily-hub
docker compose config --quiet
docker compose build --no-cache
docker compose up -d
docker compose ps
docker compose logs --tail=100 api
curl --fail http://192.168.100.29:8080/api/health
```

Initial builds require outbound internet for Microsoft, npm, NuGet and container registries. Runtime features have no external network dependencies. Allow several minutes for first builds on the i5 laptop. API startup waits for PostgreSQL health, applies migrations and creates the bootstrap admin on an empty database. The web health check covers both API and database.

Open **http://192.168.100.29:8080** from the Windows PC and Android browser on the same LAN. Sign in and create additional users under Settings.

## 4. Portainer alternative (use instead of Compose ownership)

Build the images on the Ubuntu host first, using the Compose build commands above. In Portainer CE, select that same local Docker environment, then **Stacks → Add stack → Web editor**. Choose stack name `my-daily-hub`.

Paste `docker-compose.yml`, removing the `build:` lines from `api` and `web` (keep their `image:` names). The locally built images are `my-daily-hub-api:local` and `my-daily-hub-web:local`; disable any option that always re-pulls images because these tags are local. Enter `LAN_IP`, `DB_PASSWORD`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` and `SECURE_COOKIES` as stack environment variables, with the same values as the protected server `.env`. Deploy the stack. Keep these variables out of the compose source committed to Git.

Choose one management method. If switching an existing Compose deployment to Portainer, take a backup, run `docker compose down` without `-v`, and deploy under the same stack name. Verify the stack uses `my-daily-hub_database` and `my-daily-hub_keys`; choosing another name creates empty volumes. Do not run two API instances against migrations at once. Keep `/opt/my-daily-hub/.env` protected and synchronized for the backup scripts. Portainer upgrades: rebuild locally, then update/redeploy the existing stack using its local images and retained volumes. Never paste Portainer credentials into this app.

## 5. Enforce LAN-only access

The host port binds only 192.168.100.29, not every interface. Do not create router port forwards, public tunnels or a public reverse proxy. Keep UPnP mappings disabled for this service. PostgreSQL and API have no published ports. Portainer remains a separate administrative service.

Docker-published ports may bypass ordinary UFW INPUT rules. If the host has additional routed interfaces, enforce source restrictions through the host's Docker forwarding firewall. On the standard Docker iptables backend, after confirming the real LAN subnet is 192.168.100.0/24:

```bash
sudo iptables -I DOCKER-USER 1 -p tcp -m conntrack --ctorigdst 192.168.100.29 --ctorigdstport 8080 ! -s 192.168.100.0/24 -j DROP
sudo iptables -S DOCKER-USER
```

Use your host firewall management system to persist this rule after Docker starts, and verify it after reboot. On an nftables Docker backend, implement the equivalent forwarding restriction using its documented configuration instead. Do not blindly replace an existing firewall policy or lock yourself out of SSH. Validate from an allowed LAN device and a disallowed routed subnet. This restriction intentionally uses original destination/port because Docker NAT has already changed the packet by the forwarding chain.

For encryption on shared/untrusted Wi-Fi, configure a LAN-only TLS reverse proxy with a locally trusted certificate, pass requests to port 8080, and set `SECURE_COOKIES=true`. Distribute trust to Android/Windows. The default HTTP setup transmits passwords and sessions without transport encryption.

## 6. Acceptance checks

1. `/api/health` returns healthy; `docker compose ps` reports the web container healthy.
2. Admin can create User A and B. Each creates a task in separate browser profiles. Lists and calendars show only that user's data.
3. Complete a daily task and checklist today; previous dates retain independent values. Future completion is disabled/rejected.
4. Archive a task; its saved calendar history remains visible.
5. Check monthly/weekly calendar, progress and notes on Windows and Android widths.
6. `docker compose restart` preserves users, tasks and sessions. A host reboot restarts the stack (`unless-stopped` does not restart containers you intentionally stopped).
7. `docker compose port db 5432` shows no mapping. The API has no host mapping. No application container mounts `/var/run/docker.sock`.
8. Rehearse a backup restore against a disposable installation before relying on recovery.

## 7. Backups and restore

```bash
cd /opt/my-daily-hub
bash scripts/backup.sh
```

The script uses PostgreSQL's consistent custom-format dump, restrictive permissions, a temporary file and a SHA-256 sidecar. Copy both files to encrypted storage off this laptop. A host disk failure destroys on-disk backups too. Schedule it with your approved backup mechanism; for example `crontab -e` can run `15 2 * * * cd /opt/my-daily-hub && bash scripts/backup.sh` at 02:15 host time. Configure the host timezone first if you need Costa Rica wall time. Review failures and manage retention; the script does not delete older backups automatically.

To restore, take a fresh backup first and choose the correct dump. The following deliberately replaces application data:

```bash
bash scripts/restore.sh backups/dailyhub-YYYYMMDDTHHMMSSZ.dump --confirm-replace
curl --fail http://192.168.100.29:8080/api/health
```

The script stops web/API, verifies the checksum and restores in one transaction. On failure it leaves the application stopped for investigation. Keep the `.env` recovery copy. The `keys` volume preserves sessions but is not necessary to recover user data; replacing/loss of keys logs everyone out. Protect the volume with normal host backups if session continuity matters. On a fresh host, initialize the stack, stop web/API, then restore the dump. Database schema history is included in the dump.

## 8. Updates and diagnosis

Back up, transfer reviewed source, rebuild images, then `docker compose up -d`. In Portainer, update the existing stack instead. Record image digests and source revision for rollback. Schema rollback may require restoring the pre-upgrade dump as well as prior images. PostgreSQL major upgrades require an explicit dump/restore procedure; do not change the volume's image major version casually.

```bash
docker compose logs --tail=150 api db web
docker stats --no-stream
docker compose ps
df -h
```

If the API exits during startup, check database credentials, bootstrap password length, volume permissions and migration logs. If login fails after changing `.env`, remember that bootstrap credentials do not reset existing accounts. If cookies do not persist over HTTP, check `SECURE_COOKIES=false`. If port binding fails, confirm the IP exists on the host and port 8080 is unused. Keep secrets out of diagnostic output shared externally.
