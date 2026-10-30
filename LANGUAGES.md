# English and Spanish

Use the Language / Idioma selector on the sign-in screen or above the navigation.
Menus, forms, calendar headings, dates, accessibility labels, confirmations and
known validation errors switch immediately. Browser-provided date-input and
required-field messages follow the browser's own language settings.

The initial language follows the browser (Spanish for es variants, English
otherwise). A sign-in-screen choice is remembered in that browser. After login,
each username has its own saved choice in that browser. Preferences do not sync
between phones or PCs; select the language on each device. If browser storage is
blocked, switching still works until the page reloads.

Task titles, notes, categories and checklist items remain as their authors wrote
them. The application name remains My Daily Hub in both languages. This change
needs no database migration or new dependencies.

## Update the existing Ubuntu installation after merging

Run as the owner in the existing checkout. Keep .env private and preserve volumes.

```bash
cd /home/jurgen/my-daily-hub
bash scripts/backup.sh
git -c core.sshCommand="ssh -i /home/jurgen/.ssh/my_daily_hub_deploy -o IdentitiesOnly=yes" pull --ff-only origin main
docker compose build web
docker compose up -d --no-deps web
curl --fail http://192.168.100.29:8080/api/health
```

Run each step only after the previous one succeeds. If Git reports local changes
or a divergent branch, inspect it; do not reset or overwrite server configuration.
The health check may need a few seconds after the web container starts. Refresh
the browser to load the updated app.

## Acceptance checks

- Select Español before login, reload, and confirm the sign-in labels stay Spanish.
- Sign in and select each language. Check Today, All tasks, Calendar, Settings and
  the task editor. Month/day headings and recurrence labels should switch too.
- Enter a task title and notes in Spanish. Switching to English must preserve them.
- Switch users in the same browser and confirm each user's choice is restored.
- Check the selector and navigation on a narrow phone screen.
- Confirm an invalid login and a duplicate username show errors in the chosen language.

Automated checks: `npm test` and `npm run build` from frontend/.
