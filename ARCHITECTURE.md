# My Daily Hub architecture

One origin: browser → Nginx :8080 → ASP.NET Core :8080 → PostgreSQL :5432. Only Nginx publishes a host port, bound to the configured LAN address. The database network is internal. No Docker socket or host administrative services are mounted.

The backend uses .NET 10 LTS, EF Core and PostgreSQL. React/TypeScript/Vite produces static UI assets served by unprivileged Nginx. Runtime container memory limits total 960 MiB plus Docker overhead, leaving room for Ubuntu, Portainer and filesystem cache. Build-time memory use is higher.

## Boundaries

- `backend/Models.cs`: persistence entities, ownership constraints, recurrence and input validation.
- `backend/Program.cs`: service registration, authentication configuration, bootstrap, health and error handling.
- `backend/AuthEndpoints.cs`: account/session routes and admin-controlled user creation.
- `backend/TaskEndpoints.cs`: ownership-scoped task and completion routes.
- `backend/Migrations`: versioned database schema. Apply with one API instance during startup; back up before upgrading.
- `frontend/src`: `App.tsx` UI, `api.ts` HTTP boundary, `types.ts` contracts and `schedule.mjs` date helpers; the backend is authoritative for writes.
- `tests`: HTTP integration tests with real cookie authentication and relational SQLite persistence; PostgreSQL migration validation is a separate deployment gate.

## Ownership and authentication

Cookie sessions contain only server-issued user identity and role. Passwords use ASP.NET Core's versioned PBKDF2 hasher with 210,000 iterations. Cookies are HttpOnly, SameSite Strict, expire after 12 hours and persist safely across restarts using the keys volume. Only admins can create users; there is no registration endpoint. Bootstrap only runs against an empty database.

Every task read/update/archive/completion is scoped to the authenticated user ID. Client-supplied ownership is never accepted. Activity queries are also scoped. A composite foreign key prevents completion ownership differing from its parent task. Cross-user task identifiers return 404. Admin status does not bypass personal data isolation.

All mutations require `X-Hub-Request: 1`; no cross-origin policy is enabled. Browsers cannot send that header cross-origin without a successful preflight. SameSite cookies add protection. Nginx also restricts framing and script sources. Login attempts have a fixed-window rate limit; behind Nginx this is deliberately a conservative shared limit (10/minute across the installation). API bodies are bounded at Nginx and fields validated at the API.

HTTP on a trusted LAN meets the requested address/port, but does not encrypt credentials in transit. For untrusted Wi-Fi, terminate locally trusted TLS and set SECURE_COOKIES=true; no public exposure is required. Secrets reside in server `.env`, never the client bundle. Protect Docker/Portainer access because administrators of the host can inspect container environment variables.

## Task and history semantics

Each task has a start date, optional due/end date and none/daily/weekly recurrence. A one-time task occurs on its due date or start date; weekly uses the start weekday. Recurrence end is inclusive. Dated completion rows are unique per task/date, contain checklist indices and a UTC modification timestamp. There are no background schedulers or midnight jobs. Future completion writes are rejected according to the user's current timezone (default America/Costa_Rica).

Archiving hides a definition but preserves records. Calendar history shows archived completions. Once a completion record exists, schedule/checklist structure is immutable; title, notes, priority and category remain editable. Historical labels reflect current titles. A streak counts consecutive dates with at least one completed task, including today if applicable, otherwise ending yesterday. Dashboard history/streak computation is bounded to the last 367 days. Changing timezone changes today's boundary but never rewrites past date labels.

## Milestones / release gates

1. Schema, cookie authentication and ownership-scoped endpoints.
2. Task editor, dated checklists, recurrence, dashboard and calendar.
3. API isolation tests and recurrence/timezone tests.
4. Reproducible frontend install, .NET compilation, PostgreSQL migration smoke test and Docker image builds.
5. LAN firewall validation, first login, reboot persistence, backup/restore rehearsal on the target host.

No remote server commands are executed by this project. Deployment requires the owner's explicit approval for any agent-performed server access.
