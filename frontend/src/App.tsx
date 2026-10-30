import React, { useEffect, useState } from "react";
import { api } from "./api";
import type { User, Task, RecordDay, Draft } from "./types";
import { shift, occurs, localDate } from "./schedule.mjs";
import "./style.css";
import "./polish.css";
import {
  initialLanguage,
  savedLanguage,
  saveLanguage,
  translate,
} from "./i18n.mjs";
import type { Language } from "./i18n.mjs";
import { initialTheme, savedTheme, saveTheme, applyTheme } from "./theme.mjs";
import type { Theme } from "./theme.mjs";

function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    home: (
      <>
        <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />
      </>
    ),
    list: (
      <>
        <path d="M9 6h11M9 12h11M9 18h11M3 6l1 1 2-2M3 12l1 1 2-2M3 18l1 1 2-2" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M7 3v4m10-4v4M3 11h18m-13 5h2m4 0h2" />
      </>
    ),
    settings: (
      <>
        <path d="m10 3-.6 2.2-2 .9-2-.7-2 3.5 1.6 1.5v2.3L3.4 14l2 3.5 2-.7 2 .9.6 2.3h4l.6-2.3 2-.9 2 .7 2-3.5-1.6-1.3v-2.3l1.6-1.5-2-3.5-2 .7-2-.9L14 3Z" />
        <circle cx="12" cy="11.5" r="3" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="4" ry="9" />
        <path d="M3 12h18" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
      </>
    ),
    moon: <path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z" />,
    monitor: (
      <>
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M8 21h8m-4-4v4" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    logout: (
      <>
        <path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4m6-12 4 4-4 4M8 12h11" />
      </>
    ),
    hub: (
      <>
        <path d="m12 2 10 10-10 10L2 12Z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
  };
  return (
    <svg
      className="icon"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

function monthOffset(date: string, offset: number) {
  const d = new Date(date.slice(0, 7) + "-01T12:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + offset);
  return d.toISOString().slice(0, 10);
}
export default function App() {
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [page, setPage] = useState("Today"),
    [tasks, setTasks] = useState<Task[]>([]),
    [records, setRecords] = useState<RecordDay[]>([]),
    [selected, setSelected] = useState(""),
    [mode, setMode] = useState("month"),
    [editor, setEditor] = useState<Draft | null>(null),
    [editId, setEditId] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const [language, setLanguage] = useState<Language>(() => initialLanguage());
  const [theme, setTheme] = useState<Theme>(() => initialTheme());
  useEffect(() => {
    setTheme(
      user ? savedTheme(user.username) || initialTheme() : initialTheme(),
    );
  }, [user?.username]);
  useEffect(() => applyTheme(theme), [theme]);
  const tr = (key: string, values?: Record<string, string | number>) =>
    translate(language, key, values);
  const locale = language === "es" ? "es-CR" : "en-US";
  useEffect(() => {
    if (user) setLanguage(savedLanguage(user.username) || initialLanguage());
  }, [user?.username]);
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);
  function chooseLanguage(next: Language) {
    setLanguage(next);
    saveLanguage(next, user?.username);
  }
  const appearanceControls = (
    <div className="appearance-controls">
      <fieldset className="preference-group">
        <legend>
          <Icon name="globe" />
          {tr("Language")}
        </legend>
        <div className="segmented language-options">
          {(["es", "en"] as Language[]).map((value) => (
            <label key={value} className={language === value ? "chosen" : ""}>
              <input
                type="radio"
                name="language"
                value={value}
                checked={language === value}
                onChange={() => chooseLanguage(value)}
              />
              <span lang={value}>{value === "es" ? "Español" : "English"}</span>
              {language === value && <Icon name="check" />}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="preference-group">
        <legend>{tr("Appearance")}</legend>
        <div className="segmented theme-options">
          {(["light", "dark", "system"] as Theme[]).map((value) => (
            <label key={value} className={theme === value ? "chosen" : ""}>
              <input
                type="radio"
                name="theme"
                value={value}
                checked={theme === value}
                onChange={() => {
                  setTheme(value);
                  saveTheme(value, user?.username);
                }}
              />
              <Icon
                name={
                  value === "light"
                    ? "sun"
                    : value === "dark"
                      ? "moon"
                      : "monitor"
                }
              />
              <span>
                {tr(
                  value === "light"
                    ? "Light"
                    : value === "dark"
                      ? "Dark"
                      : "System",
                )}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const today = localDate(user?.timezone || "America/Costa_Rica", clock);
  const date = selected || today;
  // API limits each request to one year; fetch past and future independently.
  async function load() {
    const [past, future] = await Promise.all([
      api(`/activity?from=${shift(today, -366)}&to=${today}`),
      api(`/activity?from=${shift(today, 1)}&to=${shift(today, 366)}`),
    ]);
    setTasks(past.tasks);
    setRecords([...past.records, ...future.records]);
  }
  useEffect(() => {
    api("/auth/me")
      .then(setUser)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    if (user) load().catch((e) => setError(e.message));
  }, [user, today]);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function formatDate(value: string) {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(value + "T12:00:00Z"));
  }
  const record = (t: Task, d: string) =>
    records.find((r) => r.taskId === t.id && r.date === d);
  const scheduled = (d: string) =>
    tasks.filter((t) => !t.archived && occurs(t, d));
  const todays = scheduled(today),
    done = todays.filter((t) => record(t, today)?.done).length;
  let streak = 0;
  for (
    let i = records.some((r) => r.date === today && r.done) ? 0 : 1;
    i < 367;
    i++
  ) {
    const d = shift(today, -i);
    if (records.some((r) => r.date === d && r.done)) streak++;
    else break;
  }
  function openEditor(t?: Task) {
    setEditId(t?.id || null);
    setEditor(
      t
        ? {
            ...t,
            dueDate: t.dueDate || "",
            checklist: JSON.parse(t.checklist).join("\n"),
          }
        : {
            title: "",
            notes: "",
            category: tr("Personal"),
            priority: 1,
            startDate: today,
            dueDate: "",
            recurrence: "none",
            checklist: "",
          },
    );
  }
  async function complete(
    t: Task,
    d: string,
    done: boolean,
    checked?: number[],
  ) {
    await api(`/tasks/${t.id}/completion/${d}`, "PUT", {
      done,
      checkedItems: checked || JSON.parse(record(t, d)?.checkedItems || "[]"),
    });
    await load();
  }
  function taskCard(t: Task, d: string) {
    const r = record(t, d);
    const items: string[] = JSON.parse(t.checklist);
    const checked: number[] = JSON.parse(r?.checkedItems || "[]");
    return (
      <article className={"task " + (r?.done ? "done" : "")} key={t.id}>
        <div className="task-main">
          <input
            aria-label={tr("Complete {title}", { title: t.title })}
            type="checkbox"
            checked={r?.done || false}
            disabled={busy || d > today}
            onChange={(e) => action(() => complete(t, d, e.target.checked))}
          />
          <div className="task-copy">
            <h3>{t.title}</h3>
            <div className="meta">
              <span className={"priority p" + t.priority}>
                {tr(["Low", "Medium", "High"][t.priority])}
              </span>
              <span>{t.category}</span>
              <span>
                {tr(t.recurrence === "none" ? "One time" : t.recurrence)}
              </span>
              <span>
                {t.dueDate && tr("Due {date}", { date: formatDate(t.dueDate) })}
              </span>
            </div>
            {t.notes && <p>{t.notes}</p>}
          </div>
          <button
            className="quiet"
            onClick={() => openEditor(t)}
            aria-label={tr("Edit {title}", { title: t.title })}
          >
            {tr("Edit")}
          </button>
        </div>
        {items.length > 0 && (
          <div className="checklist">
            {items.map((item, i) => (
              <label key={i}>
                <input
                  type="checkbox"
                  checked={checked.includes(i)}
                  disabled={busy || d > today}
                  onChange={(e) =>
                    action(() =>
                      complete(
                        t,
                        d,
                        r?.done || false,
                        e.target.checked
                          ? [...checked, i]
                          : checked.filter((x) => x !== i),
                      ),
                    )
                  }
                />
                {item}
              </label>
            ))}
          </div>
        )}
      </article>
    );
  }
  if (loading)
    return (
      <main className="login">
        <p>{tr("Opening your hub…")}</p>
      </main>
    );
  if (!user)
    return (
      <main className="login">
        <form
          className="login-card"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            action(async () => {
              setUser(
                await api("/auth/login", "POST", {
                  username: f.get("username"),
                  password: f.get("password"),
                }),
              );
            });
          }}
        >
          <p className="eyebrow">{tr("A LITTLE SPACE FOR YOUR DAY")}</p>
          <h1>My Daily Hub</h1>
          <p>{tr("Make room for what matters.")}</p>
          <label>
            {tr("Username")}
            <input
              name="username"
              autoComplete="username"
              required
              maxLength={80}
            />
          </label>
          <label>
            {tr("Password")}
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={256}
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {tr(error)}
            </p>
          )}
          <button disabled={busy}>{tr("Sign in →")}</button>
          {appearanceControls}
          <small>{tr("Private by design. Hosted on your network.")}</small>
        </form>
      </main>
    );
  const monthStart = date.slice(0, 7) + "-01";
  const weekday = new Date(monthStart + "T12:00:00Z").getUTCDay();
  const gridStart =
    mode === "month"
      ? shift(monthStart, -((weekday + 6) % 7))
      : shift(date, -((new Date(date + "T12:00:00Z").getUTCDay() + 6) % 7));
  return (
    <div className="shell">
      <aside aria-label={tr("Main navigation")}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("Today");
          }}
        >
          <span className="brand-icon">
            <Icon name="hub" />
          </span>
          <span>
            My Daily Hub<small>{tr("Your day. Your pace.")}</small>
          </span>
        </a>
        <p className="eyebrow nav-heading">{tr("YOUR PERSONAL SPACE")}</p>
        <nav aria-label={tr("Pages")}>
          {["Today", "All tasks", "Calendar", "Settings"].map((p, i) => (
            <button
              type="button"
              className={page === p ? "active" : ""}
              key={p}
              aria-current={page === p ? "page" : undefined}
              onClick={() => setPage(p)}
            >
              <Icon name={["home", "list", "calendar", "settings"][i]} />
              <span>{tr(p)}</span>
              {page === p && <span className="nav-marker" aria-hidden="true" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {appearanceControls}
          <div className="profile">
            <span className="avatar" aria-hidden="true">
              {user.username[0].toUpperCase()}
            </span>
            <button
              type="button"
              className="profile-copy"
              aria-label={tr("Account settings")}
              onClick={() => setPage("Settings")}
            >
              <strong title={user.username}>{user.username}</strong>
              <small>
                {user.isAdmin ? tr("Administrator") : tr("Personal workspace")}
              </small>
            </button>
            <button
              type="button"
              className="profile-exit"
              title={tr("Sign out")}
              aria-label={tr("Sign out")}
              disabled={busy}
              onClick={() =>
                action(async () => {
                  await api("/auth/logout", "POST");
                  setUser(null);
                  setTasks([]);
                  setRecords([]);
                  setPage("Today");
                })
              }
            >
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <p className="eyebrow">
              {new Intl.DateTimeFormat(locale, {
                timeZone: user.timezone,
                weekday: "long",
                month: "long",
                day: "numeric",
              })
                .format(new Date())
                .toUpperCase()}
            </p>
            <h1>
              {page === "Today" ? tr("A fresh start, every day.") : tr(page)}
            </h1>
            <p className="subtitle">
              {page === "Today"
                ? tr("Welcome back, {name}. Let’s make today count.", {
                    name: user.username,
                  })
                : tr("Your plans, at your own pace.")}
            </p>
          </div>
          <button onClick={() => openEditor()}>{tr("＋ New task")}</button>
        </header>
        {error && (
          <div className="error" role="alert">
            {tr(error)}
            <button className="quiet" onClick={() => setError("")}>
              {tr("Dismiss")}
            </button>
          </div>
        )}
        {page === "Today" && (
          <>
            <section className="stats">
              <div>
                <span>{tr("Today’s progress")}</span>
                <strong>
                  {todays.length ? Math.round((done / todays.length) * 100) : 0}
                  <em>%</em>
                </strong>
                <progress value={done} max={todays.length || 1} />
                <small>
                  {tr("{done} of {total} tasks complete", {
                    done,
                    total: todays.length,
                  })}
                </small>
              </div>
              <div>
                <span>{tr("On your list")}</span>
                <strong>
                  {todays.length - done}
                  <em>{tr("tasks")}</em>
                </strong>
                <small>{tr("A little focus goes a long way")}</small>
              </div>
              <div className="streak">
                <span>{tr("Current streak")}</span>
                <strong>
                  {streak}
                  <em>{tr("days")}</em>
                </strong>
                <small>{tr("Days with a completed task")}</small>
              </div>
            </section>
            <div className="content-grid">
              <section>
                <div className="section-title">
                  <h2>
                    {tr("Today’s focus")} <span>{todays.length}</span>
                  </h2>
                  <span className="muted">{formatDate(today)}</span>
                </div>
                {todays.length ? (
                  todays
                    .sort((a, b) => b.priority - a.priority)
                    .map((t) => taskCard(t, today))
                ) : (
                  <div className="empty">
                    <h3>{tr("A little breathing room.")}</h3>
                    <p>
                      {tr("Add your first task and give today a direction.")}
                    </p>
                    <button onClick={() => openEditor()}>
                      {tr("Create a task")}
                    </button>
                  </div>
                )}
              </section>
              <section className="activity">
                <h2>{tr("Recent activity")}</h2>
                {records
                  .filter((r) => r.done)
                  .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
                  .slice(0, 8)
                  .map((r) => (
                    <div className="activity-item" key={r.taskId + r.date}>
                      <span>✓</span>
                      <div>
                        <strong>
                          {tasks.find((t) => t.id === r.taskId)?.title ||
                            tr("Task")}
                        </strong>
                        <small>
                          {tr("Completed · {date}", {
                            date: formatDate(r.date),
                          })}
                        </small>
                      </div>
                    </div>
                  ))}
                {!records.some((r) => r.done) && (
                  <p className="muted">
                    {tr("Your small wins will show up here.")}
                  </p>
                )}
                <div className="quote">
                  {tr("“You don’t have to do it all.")}
                  <br />
                  {tr("Just the next right thing.”")}
                </div>
              </section>
            </div>
          </>
        )}
        {page === "All tasks" && (
          <section>
            {tasks
              .filter((t) => !t.archived)
              .map((t) => (
                <div key={t.id}>
                  {taskCard(
                    t,
                    occurs(t, today) ? today : t.dueDate || t.startDate,
                  )}
                  <button
                    disabled={busy}
                    className="quiet danger"
                    onClick={() => {
                      if (
                        confirm(
                          tr(
                            "Archive this task? Completion history will be preserved.",
                          ),
                        )
                      )
                        action(async () => {
                          await api("/tasks/" + t.id, "DELETE");
                          await load();
                        });
                    }}
                  >
                    {tr("Archive task")}
                  </button>
                </div>
              ))}
            {!tasks.some((t) => !t.archived) && (
              <div className="empty">
                {tr("Your task list is clear. Add a task to get started.")}
              </div>
            )}
          </section>
        )}
        {page === "Calendar" && (
          <>
            <div className="calendar-toolbar">
              <button
                className="quiet"
                onClick={() =>
                  setSelected(
                    mode === "month" ? monthOffset(date, -1) : shift(date, -7),
                  )
                }
              >
                {tr("← Previous")}
              </button>
              <h2>
                {new Date(date + "T12:00:00Z").toLocaleDateString(locale, {
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </h2>
              <button className="quiet" onClick={() => setSelected(today)}>
                {tr("Today")}
              </button>
              <select
                aria-label={tr("Calendar view")}
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                <option value="month">{tr("Month")}</option>
                <option value="week">{tr("Week")}</option>
              </select>
              <button
                className="quiet"
                onClick={() =>
                  setSelected(
                    mode === "month" ? monthOffset(date, 1) : shift(date, 7),
                  )
                }
              >
                {tr("Next →")}
              </button>
            </div>
            <div className="calendar">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div className="day-name" key={d}>
                  {tr(d)}
                </div>
              ))}
              {Array.from({ length: mode === "month" ? 42 : 7 }, (_, i) => {
                const d = shift(gridStart, i),
                  list = scheduled(d),
                  completed = records.filter(
                    (r) => r.date === d && r.done,
                  ).length;
                return (
                  <button
                    key={d}
                    className={
                      "day " +
                      (d === date ? "selected " : "") +
                      (d === today ? "today" : "")
                    }
                    onClick={() => setSelected(d)}
                  >
                    <strong>{Number(d.slice(-2))}</strong>
                    <small>
                      {list.length
                        ? tr("{count} planned", { count: list.length })
                        : ""}
                    </small>
                    {completed > 0 && <span>{completed} ✓</span>}
                  </button>
                );
              })}
            </div>
            <h2 className="section-title">
              {tr("{date} · Daily activity", { date: formatDate(date) })}
            </h2>
            {scheduled(date).map((t) => taskCard(t, date))}
            {tasks
              .filter((t) => t.archived && record(t, date))
              .map((t) => (
                <p key={t.id}>
                  {record(t, date)?.done ? "✓" : "○"} {t.title}{" "}
                  <small>{tr("(archived)")}</small>
                </p>
              ))}
            {!scheduled(date).length && (
              <p className="muted">{tr("No tasks scheduled for this date.")}</p>
            )}
          </>
        )}
        {page === "Settings" && (
          <section className="settings">
            <button
              className="quiet"
              disabled={busy}
              onClick={() =>
                action(async () => {
                  await api("/auth/logout", "POST");
                  setUser(null);
                  setTasks([]);
                  setRecords([]);
                  setPage("Today");
                })
              }
            >
              {tr("Sign out")}
            </button>
            <h2>{tr("Your timezone")}</h2>
            <p>{tr("Dates and daily boundaries follow your timezone.")}</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const timezone = String(
                  new FormData(e.currentTarget).get("timezone"),
                );
                action(async () => {
                  await api("/auth/timezone", "PUT", { timezone });
                  setUser({ ...user, timezone });
                });
              }}
            >
              <label>
                {tr("IANA timezone")}
                <input name="timezone" defaultValue={user.timezone} required />
              </label>
              <button disabled={busy}>{tr("Save timezone")}</button>
            </form>
            {user.isAdmin && (
              <>
                <h2>{tr("Create a user")}</h2>
                <p>
                  {tr("New users have their own private tasks and history.")}
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget,
                      f = new FormData(form);
                    action(async () => {
                      await api("/admin/users", "POST", {
                        username: f.get("username"),
                        password: f.get("password"),
                        isAdmin: f.get("admin") === "on",
                      });
                      form.reset();
                      alert(tr("User created."));
                    });
                  }}
                >
                  <label>
                    {tr("Username")}
                    <input
                      name="username"
                      required
                      maxLength={80}
                      autoComplete="off"
                    />
                  </label>
                  <label>
                    {tr("Password")}
                    <input
                      type="password"
                      name="password"
                      minLength={14}
                      maxLength={256}
                      required
                      autoComplete="new-password"
                    />
                  </label>
                  <label className="inline">
                    <input type="checkbox" name="admin" />
                    {tr("Administrator")}
                  </label>
                  <button disabled={busy}>{tr("Create user")}</button>
                </form>
              </>
            )}
          </section>
        )}
        <footer>
          MY DAILY HUB <span>{tr("Your day. Your pace.")}</span>
        </footer>
      </main>
      {editor && (
        <div className="modal-backdrop">
          <form
            className="modal"
            onSubmit={(e) => {
              e.preventDefault();
              action(async () => {
                await api(
                  "/tasks" + (editId ? "/" + editId : ""),
                  editId ? "PUT" : "POST",
                  {
                    ...editor,
                    dueDate: editor.dueDate || null,
                    checklist: editor.checklist
                      .split("\n")
                      .map((x) => x.trim())
                      .filter(Boolean),
                  },
                );
                setEditor(null);
                await load();
              });
            }}
          >
            <div className="section-title">
              <h2>{editId ? tr("Edit task") : tr("A new intention")}</h2>
              <button
                type="button"
                className="quiet"
                onClick={() => setEditor(null)}
              >
                {tr("Close")}
              </button>
            </div>
            {error && (
              <p role="alert" className="error">
                {tr(error)}
              </p>
            )}
            <label>
              {tr("Task title")}
              <input
                required
                maxLength={200}
                value={editor.title}
                onChange={(e) =>
                  setEditor({ ...editor, title: e.target.value })
                }
              />
            </label>
            <div className="form-row">
              <label>
                {tr("Category")}
                <input
                  maxLength={80}
                  value={editor.category}
                  onChange={(e) =>
                    setEditor({ ...editor, category: e.target.value })
                  }
                />
              </label>
              <label>
                {tr("Priority")}
                <select
                  value={editor.priority}
                  onChange={(e) =>
                    setEditor({ ...editor, priority: Number(e.target.value) })
                  }
                >
                  {["Low", "Medium", "High"].map((p, i) => (
                    <option value={i} key={p}>
                      {tr(p)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>
                {tr("Start date")}
                <input
                  type="date"
                  required
                  value={editor.startDate}
                  onChange={(e) =>
                    setEditor({ ...editor, startDate: e.target.value })
                  }
                />
              </label>
              <label>
                {tr("Due date / recurrence end")}
                <input
                  type="date"
                  min={editor.startDate}
                  value={editor.dueDate}
                  onChange={(e) =>
                    setEditor({ ...editor, dueDate: e.target.value })
                  }
                />
              </label>
            </div>
            <label>
              {tr("Repeat")}
              <select
                value={editor.recurrence}
                onChange={(e) =>
                  setEditor({ ...editor, recurrence: e.target.value })
                }
              >
                <option value="none">{tr("Does not repeat")}</option>
                <option value="daily">{tr("Every day")}</option>
                <option value="weekly">
                  {tr("Every week on start weekday")}
                </option>
              </select>
            </label>
            <label>
              {tr("Checklist (one item per line)")}
              <textarea
                value={editor.checklist}
                onChange={(e) =>
                  setEditor({ ...editor, checklist: e.target.value })
                }
              />
            </label>
            <label>
              {tr("Notes")}
              <textarea
                maxLength={10000}
                value={editor.notes}
                onChange={(e) =>
                  setEditor({ ...editor, notes: e.target.value })
                }
              />
            </label>
            <button disabled={busy}>{tr("Save task")}</button>
          </form>
        </div>
      )}
    </div>
  );
}
