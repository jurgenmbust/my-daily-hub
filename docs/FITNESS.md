# My Fitness Hub

Status: implementation for review; **do not merge or deploy without owner approval**.
The existing push-to-main workflow publishes the frontend only. It cannot install
this feature's backend or migrations. Merging this PR would otherwise expose a
Fitness UI before the matching API exists. Keep this change on its branch until a
coordinated backend/frontend deployment is approved.

## Implementation plan and architecture

1. Extend the existing EF Core HubDb, cookie authentication and owner-scoped routes.
2. Validate bounded JSON in the backend, preview latest/incoming versions, then
   transactionally confirm with optimistic concurrency and unique constraints.
3. Keep immutable plan versions and session snapshots. Store actual set results
   separately. Add execution, history, performance records and owner-only statistics.
4. Integrate the existing calendar and add a responsive Fitness section, with
   English/Spanish messages and existing light/dark tokens.
5. Test validation, ownership, duplicate/stale imports, preservation and migrations;
   review the supplied reference JSON before final format sign-off.

The request mentioned an attached `my-fitness-hub-plan-v1.json`, but only the
written specification was supplied. `examples/my-fitness-hub-plan-v1.json` is a
provisional example based on its listed fields. Exact compatibility with the user's
original file must be checked when it is supplied. No original plan has been invented.

### Data migration

`20261101222223_FitnessPlansAndSessions` adds FitnessPlans, FitnessVersions and
FitnessSessions. Each row carries UserId. Composite alternate/foreign keys enforce
the same owner through plan → version → session. Unique user/external ID,
plan/version and plan/date constraints prevent duplicates. Concurrency tokens
protect simultaneous imports and session saves. No existing table/data is removed.
Exercise configuration is immutable JSON within an owned version, not a shared
catalog. Session Planned JSON snapshots that day's configuration; Actual contains
only user-recorded performance. All endpoint lookups filter the authenticated owner;
admin accounts have no special access to other users' fitness records.

Versions never overwrite old rows. Updates take effect no earlier than tomorrow
in the plan's timezone (or a later supplied start_date). Today's/in-progress and
completed sessions remain on their original version. Multiple imports for tomorrow
are resolved by effective date then import time. A plan imported for the first time
can have a past start date, so earlier scheduled dates appear missed, but it creates
no fabricated sessions. Only today's scheduled, non-rest workout can be started;
finished sessions are read-only. Older incomplete sessions can be resumed/saved.

### Import format v1

Import a UTF-8 `.json` object, at most 96 KiB (server-enforced even with chunked
requests). The existing nginx 128 KiB request limit remains unchanged. Structure:

- `schema_version`: 1 (also accepts `"1"`/`"1.0"`). Other versions fail clearly.
- `import_mode`: `create`, `update`, or `upsert` (default for omitted/null).
- `plan.external_id`: required, <=100 characters, stable within one user's account.
- `plan.name`: required, <=200 characters.
- `plan.version`: required string or number, <=50 characters. Each value may be
  imported once for that user's plan, regardless of its contents. To update, change
  version while retaining external_id. Version labels are not compared numerically.
- `language`: en/es, default es; `timezone`: valid IANA/.NET zone, default user's zone.
- `start_date`: ISO YYYY-MM-DD or null; description <=10000 characters or null.
- `general_rest_seconds`: 0–3600 or null.
- `days`: 1–7 entries with distinct `weekday` values (ISO 1 Monday through 7 Sunday).
  English/Spanish full weekday names and English three-letter abbreviations also work.
- Day title <=200, notes <=10000 (both optional/null); exercises omitted/null/[]
  means a rest day. Unlisted weekdays are also rest days after a version takes effect.
- Up to 40 exercises per day and 500 total planned sets per week. Each exercise
  requires a nonempty id (<=100) and name (<=200), unique id within that day.
- `sets`: 1–30, default 1 for omitted/null.
- `repetitions` and `duration_seconds`: optional/null objects with nullable `min`
  and `max`. Values are nonnegative integers; min <= max where both exist.
  Repetitions <=10000; duration <=86400 seconds.
- `suggested_weight`: optional/null; nullable value 0–10000. A supplied numeric
  value requires `unit` kg/lb. No unit conversion is inferred.
- `per_side`: optional/null boolean; `notes`: optional/null, <=10000 characters.

Unknown fields (including imported user IDs) have no authority and are ignored.
JSON is parsed as data only. Text is rendered through React escaping, never HTML
or executable code. Optional numeric values remain null; suggestions are never
copied into actual performance automatically.

Select a file, inspect its incoming days/exercises and the current version side by
side, and confirm or cancel. Confirm revalidates the entire document and compares
the preview's current-version hash, so a concurrent update requires another preview.
A failure rolls back the transaction rather than leaving an empty plan/version.

### API (existing session authentication and X-Hub-Request protection)

- GET /api/fitness/plans and /plans/{id}: own plans and previous versions.
- POST /import/preview: raw v1 document; returns normalized document, current
  version, expectedHash and effectiveFrom. No writes.
- POST /import/confirm: `{document,expectedHash,confirm:true}`; returns new version.
- GET /schedule?from=YYYY-MM-DD&to=YYYY-MM-DD: at most 93 days. Includes rest,
  scheduled, in_progress, completed, skipped and missed; no materialized duplicate entries.
- POST /sessions: `{planId,date}`; idempotently returns an existing own session.
- GET /sessions and /sessions/{id}: own history including planned and actual values.
- PUT /sessions/{id}: `{revision,status,notes,sets}`; set records use camelCase
  exerciseId, set (one-based), completed, skipped, repetitions, weight, unit,
  durationSeconds, notes. Only planned exercise IDs/set numbers are accepted.
- GET /statistics: completed count, distinct active dates and completed non-skipped
  actual sets. UI computes weekly completion over scheduled workouts, shows
  exercise records by date and keeps kg/lb labels separate (no mixed-unit chart).

Plan and session deletion are intentionally not exposed, preserving history.
Importing identical external IDs from two accounts creates independent plans.

## Validation and acceptance

Run `dotnet test tests/Hub.Tests.csproj` and from frontend/ `npm test` / `npm run build`.
Fitness tests cover malformed/oversize/unsupported/null inputs, duplicate versions,
stale preview, full ownership checks, stats isolation, invalid actual sets and
immutable completed history after updating the plan. Existing task/auth tests remain.
CI also starts PostgreSQL 17 and the real API to apply migrations and smoke-test
JSON preview/import. SQLite authorization tests alone do not prove PostgreSQL DDL.

Owner acceptance: preview/cancel a file with no writes; import v1; start and complete
a set today; record reps/weight/duration/notes and skip another; finish and inspect
history. Import v2 with changed exercises and verify today's snapshot and previous
versions remain intact, tomorrow changes, and duplicate import is rejected. Use two
browser profiles to confirm isolation. Test mobile, both themes and languages.

## Owner-approved Ubuntu deployment (not executed)

Do not use the existing website-only button for the initial Fitness installation.
Once approved, coordinate the merge so the automatic frontend job cannot publish
before the matching API. For example, temporarily disable just the deployment
workflow in GitHub, merge the reviewed feature, and follow the steps below. This
requires explicit owner approval; no workflow is disabled by this change.

On Ubuntu as jurgen, run steps individually and stop on failures:

```bash
cd /home/jurgen/my-daily-hub
bash scripts/backup.sh
git -c core.sshCommand="ssh -i /home/jurgen/.ssh/my_daily_hub_deploy -o IdentitiesOnly=yes" pull --ff-only origin main
docker compose build api web
docker compose up -d api
docker compose logs --tail=100 api
curl --fail http://192.168.100.29:8080/api/health
docker compose up -d --no-deps web
curl --fail http://192.168.100.29:8080/api/health
```

API startup applies EF migrations using the existing database connection and keeps
all task/user data. Verify the migration log, login and Fitness acceptance checks
before enabling future frontend deployments. No additional host database ports,
credentials, runner privileges or Docker socket mounts are introduced.

Keep the pre-upgrade backup off-server and retain prior API/web image IDs. Rolling
back the frontend alone cannot undo backend/schema changes. If a full database
restore is needed, stop app writers and use the existing owner-run restore procedure;
restoring the old backup discards subsequent writes, so make a fresh backup first.
Do not run migration Down on production fitness data: it drops the new tables.

The installed privileged deployment gate remains unchanged. After this coordinated
installation, frontend-only Fitness refinements can use the existing automatic
workflow; future backend/schema changes again require owner approval/manual updates.
