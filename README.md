# My Daily Hub

A private, self-hosted productivity dashboard for a household or small LAN. React + TypeScript + Vite, ASP.NET Core 10 LTS, EF Core and PostgreSQL. Production origin: **http://192.168.100.29:8080**.

## Features

- Secure cookie login/logout, PBKDF2 password hashing, admin-controlled user creation.
- Per-user task and activity isolation, including edits, archives and dated completion writes.
- Tasks with notes, category, three priorities, due dates, checklists and daily/weekly recurrence.
- Independent completion/checklist state for each occurrence; monthly/weekly calendar and archived completion history.
- Today dashboard, progress, consecutive active-day streak and recent completions.
- Responsive mobile and desktop layout, timezone settings (America/Costa_Rica by default).
- Persistent database and cookie-key volumes, structured logs, database-aware health endpoint, backup/restore scripts.

See [ARCHITECTURE.md](ARCHITECTURE.md) for semantics and [DEPLOYMENT.md](DEPLOYMENT.md) for the exact server workflow. See [VALIDATION.md](VALIDATION.md) for executed checks and limits. Deployment is not automatic.

## Run locally with Docker

Requirements: Docker Engine/Compose v2, internet access for the initial image and dependency downloads. No internet is needed by the running app.

```bash
cp .env.example .env
chmod 600 .env
# Edit .env: LAN_IP=127.0.0.1 for local-only testing.
# Set DB_PASSWORD to a random hex value and ADMIN_PASSWORD to 14+ characters.
docker compose config --quiet
docker compose build
docker compose up -d
docker compose ps
curl --fail http://127.0.0.1:8080/api/health
```

Open http://127.0.0.1:8080 and sign in with your bootstrap credentials. Bootstrap is only used when the database has no users. Changing ADMIN_PASSWORD in `.env` later does not change an existing user's password. Add users through Settings as an administrator. Do not reuse passwords from other services.

Use `docker compose down` to stop; named volumes remain. **`docker compose down -v` destroys the database and session keys.** Never use it against production data.

## Development without application containers

Install .NET SDK 10, Node.js 22.12+ and PostgreSQL 17. Create a development database/user using your local PostgreSQL administration tools. Do not publish production PostgreSQL to the LAN.

In a shell at the project root (example Bash; on PowerShell use `$env:NAME='value'`):

```bash
export ConnectionStrings__Database='Host=localhost;Database=dailyhub_dev;Username=dailyhub_dev;Password=YOUR_DEV_PASSWORD'
export Bootstrap__Username=admin
export Bootstrap__Password='YOUR_UNIQUE_DEV_PASSWORD_14_PLUS'
export KeyPath="$PWD/.local-keys"
export ASPNETCORE_ENVIRONMENT=Development
dotnet run --project backend/Hub.csproj --urls http://localhost:5000
```

In a second terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open the URL printed by Vite. Its `/api` proxy points to localhost:5000, so cookie authentication remains same-origin. Keep development servers bound to trusted networks; Vite uses `--host 0.0.0.0` for optional device testing. Change to `--host 127.0.0.1` when only the PC needs access.

## Tests and builds

```bash
dotnet test tests/Hub.Tests.csproj
dotnet publish backend/Hub.csproj -c Release -o /tmp/hub-publish
cd frontend
npm ci
npm test
npm run build
cd ..
docker compose --env-file .env.example config --quiet
docker compose build
```

API tests run in-process with SQLite, real password hashing and real authentication cookies. They prove cross-user read/update/archive/completion rejection, list/activity isolation, admin-only creation, anonymous rejection, logout and mutation-header protection. They also verify independent completion records and history after archiving. SQLite tests do not substitute for a PostgreSQL migration/container smoke test.

## Schema changes

The initial EF migration and snapshot are checked in. Startup applies migrations before accepting requests. Run one API instance and back up before upgrading. To create a new migration:

```bash
dotnet tool install --global dotnet-ef --version '10.*'
dotnet ef migrations add MeaningfulName --project backend/Hub.csproj
dotnet ef migrations has-pending-model-changes --project backend/Hub.csproj
dotnet ef migrations script --idempotent --project backend/Hub.csproj
```

Review generated SQL before deploying. The design-time factory uses a dummy connection for generation; it does not contact the production server. For manual `database update`, supply the intended connection explicitly with `--connection` through a controlled secret mechanism; prefer startup migration for this single-instance installation.

## API overview

All routes are under `/api`. Mutations require `X-Hub-Request: 1` and JSON where a body is required. Send the session cookie returned by login. Health and login are public; all other endpoints require authentication.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/auth/login` | `{username,password}` |
| POST | `/auth/logout` | End current browser session |
| GET | `/auth/me` | Current account and timezone |
| PUT | `/auth/timezone` | `{timezone:"America/Costa_Rica"}` |
| POST | `/admin/users` | Admin only: `{username,password,isAdmin}` |
| GET/POST | `/tasks` | Own definitions / create |
| GET/PUT/DELETE | `/tasks/{id}` | Own definition / edit / archive |
| PUT | `/tasks/{id}/completion/{YYYY-MM-DD}` | `{done,checkedItems:[0,1]}` |
| GET | `/activity?from=YYYY-MM-DD&to=YYYY-MM-DD` | Own definitions and bounded completion records |
| GET | `/health` | Database readiness |

Task input: `title`, `notes`, `category`, `priority` (0–2), `startDate`, nullable `dueDate`, `recurrence` (`none`, `daily`, `weekly`), `checklist` (array of strings). Ownership and record IDs are assigned by the backend. Archived history is retained, so DELETE means archive. Future completion is rejected. There is currently no user deletion/password-change UI, email integration, reminders or offline sync.
