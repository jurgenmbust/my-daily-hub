# Validation — 2026-10-27

## Executed successfully

- .NET 10 backend compiles and publishes in Release.
- Six backend tests pass: four recurrence cases and two HTTP integration scenarios covering per-user reads, updates, archives, completion writes, task lists, activity history, admin boundaries, authentication/logout, mutation header protection and separate dated records.
- Four frontend date tests pass: daily bounds, weekly weekday, one-time due date and Costa Rica/UTC boundary with leap-day arithmetic.
- Frontend TypeScript check and Vite production build pass. Lockfile is included for `npm ci`.
- EF migration generated with designer and snapshot; `migrations has-pending-model-changes` reports no differences. Idempotent PostgreSQL SQL generated in `backend/Migrations/deploy.sql`.
- `docker compose --env-file .env.example config --quiet` passes.
- `bash -n` passes for backup and restore scripts.
- npm audit: zero known vulnerabilities. NuGet full transitive test-project audit: no vulnerable packages in the current feed. These are point-in-time checks, not a guarantee against future advisories.
- Local Vite preview responds HTTP 200. Login page inspected in the in-app browser at 127.0.0.1:5173.

## Blocked environment checks

Docker Desktop fails to start on this Windows host. The supplied screenshot reports an inference-manager Unix socket/path initialization error. `docker info` and Compose build cannot reach a working Linux engine. No factory reset, Docker configuration repair or server connection was performed.

Consequently, Docker image builds, PostgreSQL migration execution, Nginx runtime behavior, volume permissions, container health, actual memory use and backup/restore execution are **not verified** here. API tests use relational SQLite, not PostgreSQL. Authenticated dashboard/mobile browser flows also remain for the acceptance run with a live backend.

## Remaining release acceptance

On a working local Docker engine or the Ubuntu host under owner control: build images, start the stack, verify health, run the Windows/Android scenarios in DEPLOYMENT.md, rehearse restore on a disposable stack, and verify reboot/firewall behavior. Configure server `.env`, LAN IP reservation, protected off-host backups and optional local TLS. Do not treat the stack as production-validated until these gates pass.

No access to 192.168.100.29 or remote deployment commands occurred.
