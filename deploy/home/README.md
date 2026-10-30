# Home-server website deployment

Every push to **main**, including a merged pull request, automatically tests, builds
and deploys the website. Other branches and unmerged pull requests do not deploy.
The server runner must be online; an offline server leaves deployment queued.

The manual button remains available: GitHub Actions → **Deploy website to home
server** → **Run workflow** → select **main**, tick the confirmation box, and run.
Confirmation is required for manual runs only. Both triggers use the same restricted
helper, backup, health check, rollback and deployment lock. One-time server setup is
still required; an existing configured server needs no new installation for this trigger change.

## What runs where

GitHub-hosted Ubuntu installs dependencies, runs tests and builds frontend/dist.
Only the built static website is sent to the server. A dedicated hub-runner account
runs the repository's self-hosted runner with label daily-hub-deploy. It checks out
no repository code and has no Docker-group membership. No inbound router port,
public tunnel, SSH server credential, database password or PAT is needed by this
workflow. The runner connects outbound to GitHub.

The only sudo permission is the exact installed helper, with **no arguments**.
It accepts a bounded archive over stdin, rejects path traversal and links, builds
using a fixed Dockerfile and the administrator's frozen existing web runtime,
backs up PostgreSQL, and replaces only the web container with fixed settings.
Health failure restores the previous web image and fails the GitHub job. A rollback
failure also fails the job and requires the owner to investigate. Successful
deployments record the source revision in /var/lib/my-daily-hub-deploy/last-success.

This does NOT deploy backend, migrations, Compose changes, nginx settings, runtime
base-image upgrades or new services. Those remain owner-run maintenance. A changed
frontend API contract must not be deployed until its matching backend is installed.
Changing the repository installer/helper does not update the installed root-owned
copies. Review and install those changes manually as administrator.

## One-time setup on Ubuntu (owner runs these commands)

Start with the existing working application at /home/jurgen/my-daily-hub. Keep the
192.168.100.29 DHCP reservation and existing network-wait startup fix.

1. After merging this change, pull main using your existing read-only deploy key:

   ```bash
   cd /home/jurgen/my-daily-hub
   git -c core.sshCommand="ssh -i /home/jurgen/.ssh/my_daily_hub_deploy -o IdentitiesOnly=yes" pull --ff-only origin main
   docker compose ps
   ```

2. Review deploy/home/deploy-web.py, web.yml and install.sh, then install the gate:

   ```bash
   sudo bash deploy/home/install.sh
   sudo -l -U hub-runner
   id hub-runner
   ```

   The sudo listing should contain only `/usr/local/sbin/my-daily-hub-deploy ""`.
   The account must not belong to docker, sudo, adm or jurgen's private group.
   The installer refuses to overwrite an existing installation/account. It leaves
   the running containers alone. If installation fails, resolve the failure before
   registering the runner; do not delete existing accounts or overwrite files blindly.

3. On GitHub open this private repository → Settings → Actions → Runners → New
   self-hosted runner → Linux → x64. Use the current official download and checksum
   instructions shown there. On the Ubuntu terminal first switch to the new account:

   ```bash
   sudo -iu hub-runner
   mkdir actions-runner
   cd actions-runner
   ```

   Run the download, checksum and extraction commands GitHub shows **as hub-runner**.
   Configure with the repository URL and the short-lived registration token GitHub
   provides. Choose runner name `homeserver-daily-hub`, add the custom label
   `daily-hub-deploy`, and use the default work folder. Do not enable the option to
   run the runner as root. Do not paste registration tokens into chat or commit them.

4. Exit back to jurgen, then install and start the official runner service:

   ```bash
   exit
   cd /var/lib/hub-runner/actions-runner
   sudo ./svc.sh install hub-runner
   sudo ./svc.sh start
   sudo ./svc.sh status
   ```

   The service runs as hub-runner and starts on boot. Confirm it shows **Idle** in
   GitHub's runner list. It must not run as root or jurgen.

5. Verify the account cannot reach the host Docker socket or application secrets:

   ```bash
   sudo -u hub-runner test ! -r /var/run/docker.sock && echo 'Docker socket restricted'
   sudo -u hub-runner test ! -r /home/jurgen/my-daily-hub/.env && echo 'Environment restricted'
   sudo -u hub-runner test ! -r /home/jurgen/.ssh/my_daily_hub_deploy && echo 'Deploy key restricted'
   ```

   All three messages must appear. If not, fix the relevant ownership/groups/file
   permissions before using the runner. Never add hub-runner to the Docker group or
   grant it general sudo, docker, systemctl, shell or writable privileged scripts.

## First deployment and verification

Merge a change into main, or run the manual button from main. The build runs on GitHub; deployment waits until the home
server is online. Avoid cancelling a deployment during container replacement.
The server account can execute workflows, so keep repository write access limited
to trusted people and keep this repository private. Workflow permissions alone do
not isolate a self-hosted runner; the fixed helper is the host privilege boundary.

Success in GitHub means the web health check (including API/database) passed. Open
http://www.my-home-local-server.cr:8080 and check login, language switching and tasks.
For the first run also reboot and repeat the health check to verify startup.

Deployment logs must not contain credentials or dump contents. Backups are now
root-owned under /var/backups/my-daily-hub with checksum sidecars, not the checkout's
backups directory. Copy them to encrypted off-server storage and manage retention;
they are not automatically deleted. The existing owner-run backup script continues
to work independently. Restore is an owner operation, never a workflow permission.

Automatic and manual runs are serialized in GitHub and the helper locks on the server.
The helper also retains `my-daily-hub-web:previous` for recovery. Manual owner
deployments must not overlap a button run. Don't prune the `deploy-base` or `previous`
image tags. Restart the runner service after a runner upgrade if its official
instructions require it. If a later full manual build is used, the next button run
still uses the installed frozen runtime; update that baseline deliberately.

## Troubleshooting and removal

- Queued deploy: check the server is on and the runner is Idle with the right label.
- sudo error: inspect `sudo -l -U hub-runner`; never broaden permissions to fix it.
- Health/rollback failure: owner checks `docker compose ps -a` and web/API logs.
- Token expired during runner registration: generate a new registration token.
- To disable, stop the named runner service through its svc.sh, remove the runner
  in GitHub, and remove the helper's sudoers rule as administrator. Preserve backups
  and the app's volumes. Do not recursively delete accounts/directories blindly.

Tests: `python3 -m unittest discover -s deploy/home/tests -v`.
An actual deployment, sudoers validation, runner service and reboot must be verified
on Ubuntu; local tests do not establish that the server has been configured.

References: [manual workflow triggers](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-running-a-workflow),
[runner setup](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners),
[runner security](https://docs.github.com/en/actions/reference/security/secure-use).
