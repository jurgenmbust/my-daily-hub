import React, { useEffect, useState } from "react";
import { api } from "./api";
import type { User, Task, RecordDay, Draft } from "./types";
import { shift, occurs, localDate } from "./schedule.mjs";
import "./style.css";
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
            category: "Personal",
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
            aria-label={"Complete " + t.title}
            type="checkbox"
            checked={r?.done || false}
            disabled={busy || d > today}
            onChange={(e) => action(() => complete(t, d, e.target.checked))}
          />
          <div className="task-copy">
            <h3>{t.title}</h3>
            <div className="meta">
              <span className={"priority p" + t.priority}>
                {["Low", "Medium", "High"][t.priority]}
              </span>
              <span>{t.category}</span>
              <span>{t.recurrence === "none" ? "One time" : t.recurrence}</span>
              <span>{t.dueDate && `Due ${t.dueDate}`}</span>
            </div>
            {t.notes && <p>{t.notes}</p>}
          </div>
          <button
            className="quiet"
            onClick={() => openEditor(t)}
            aria-label={"Edit " + t.title}
          >
            Edit
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
        <p>Opening your hub…</p>
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
          <div className="brand-icon">◈</div>
          <p className="eyebrow">A LITTLE SPACE FOR YOUR DAY</p>
          <h1>My Daily Hub</h1>
          <p>Make room for what matters.</p>
          <label>
            Username
            <input
              name="username"
              autoComplete="username"
              required
              maxLength={80}
            />
          </label>
          <label>
            Password
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
              {error}
            </p>
          )}
          <button disabled={busy}>Sign in →</button>
          <small>Private by design. Hosted on your network.</small>
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
      <aside>
        <a className="brand" href="#" onClick={() => setPage("Today")}>
          <span className="brand-icon">◈</span> My Daily Hub
        </a>
        <p className="eyebrow">YOUR PERSONAL SPACE</p>
        <nav>
          {["Today", "All tasks", "Calendar", "Settings"].map((p, i) => (
            <button
              className={page === p ? "active" : ""}
              key={p}
              onClick={() => setPage(p)}
            >
              <span>{["◉", "☷", "▦", "⚙"][i]}</span>
              {p}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span>
            Small steps.
            <br />
            Meaningful days.
          </span>
          <p>One thing at a time is enough.</p>
        </div>
        <div className="profile">
          <span className="avatar">{user.username[0].toUpperCase()}</span>
          <div>
            <strong>{user.username}</strong>
            <small>
              {user.isAdmin ? "Administrator" : "Personal workspace"}
            </small>
          </div>
          <button
            className="quiet"
            onClick={() =>
              action(async () => {
                await api("/auth/logout", "POST");
                setUser(null);
                setTasks([]);
                setRecords([]);
              })
            }
          >
            Exit
          </button>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <p className="eyebrow">
              {new Intl.DateTimeFormat("en", {
                timeZone: user.timezone,
                weekday: "long",
                month: "long",
                day: "numeric",
              })
                .format(new Date())
                .toUpperCase()}
            </p>
            <h1>{page === "Today" ? "A fresh start, every day." : page}</h1>
            <p className="subtitle">
              {page === "Today"
                ? `Welcome back, ${user.username}. Let’s make today count.`
                : "Your plans, at your own pace."}
            </p>
          </div>
          <button onClick={() => openEditor()}>＋ New task</button>
        </header>
        {error && (
          <div className="error" role="alert">
            {error}
            <button className="quiet" onClick={() => setError("")}>
              Dismiss
            </button>
          </div>
        )}
        {page === "Today" && (
          <>
            <section className="stats">
              <div>
                <span>Today’s progress</span>
                <strong>
                  {todays.length ? Math.round((done / todays.length) * 100) : 0}
                  <em>%</em>
                </strong>
                <progress value={done} max={todays.length || 1} />
                <small>
                  {done} of {todays.length} tasks complete
                </small>
              </div>
              <div>
                <span>On your list</span>
                <strong>
                  {todays.length - done}
                  <em>tasks</em>
                </strong>
                <small>A little focus goes a long way</small>
              </div>
              <div className="streak">
                <span>Current streak</span>
                <strong>
                  {streak}
                  <em>days</em>
                </strong>
                <small>Days with a completed task</small>
              </div>
            </section>
            <div className="content-grid">
              <section>
                <div className="section-title">
                  <h2>
                    Today’s focus <span>{todays.length}</span>
                  </h2>
                  <span className="muted">{today}</span>
                </div>
                {todays.length ? (
                  todays
                    .sort((a, b) => b.priority - a.priority)
                    .map((t) => taskCard(t, today))
                ) : (
                  <div className="empty">
                    <h3>A little breathing room.</h3>
                    <p>Add your first task and give today a direction.</p>
                    <button onClick={() => openEditor()}>Create a task</button>
                  </div>
                )}
              </section>
              <section className="activity">
                <h2>Recent activity</h2>
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
                            "Task"}
                        </strong>
                        <small>Completed · {r.date}</small>
                      </div>
                    </div>
                  ))}
                {!records.some((r) => r.done) && (
                  <p className="muted">Your small wins will show up here.</p>
                )}
                <div className="quote">
                  “You don’t have to do it all.
                  <br />
                  Just the next right thing.”
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
                          "Archive this task? Completion history will be preserved.",
                        )
                      )
                        action(async () => {
                          await api("/tasks/" + t.id, "DELETE");
                          await load();
                        });
                    }}
                  >
                    Archive task
                  </button>
                </div>
              ))}
            {!tasks.some((t) => !t.archived) && (
              <div className="empty">
                Your task list is clear. Add a task to get started.
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
                ← Previous
              </button>
              <h2>
                {new Date(date + "T12:00:00Z").toLocaleDateString("en", {
                  month: "long",
                  year: "numeric",
                  timeZone: "UTC",
                })}
              </h2>
              <button className="quiet" onClick={() => setSelected(today)}>
                Today
              </button>
              <select
                aria-label="Calendar view"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                <option value="month">Month</option>
                <option value="week">Week</option>
              </select>
              <button
                className="quiet"
                onClick={() =>
                  setSelected(
                    mode === "month" ? monthOffset(date, 1) : shift(date, 7),
                  )
                }
              >
                Next →
              </button>
            </div>
            <div className="calendar">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div className="day-name" key={d}>
                  {d}
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
                    <small>{list.length ? `${list.length} planned` : ""}</small>
                    {completed > 0 && <span>{completed} ✓</span>}
                  </button>
                );
              })}
            </div>
            <h2 className="section-title">{date} · Daily activity</h2>
            {scheduled(date).map((t) => taskCard(t, date))}
            {tasks
              .filter((t) => t.archived && record(t, date))
              .map((t) => (
                <p key={t.id}>
                  {record(t, date)?.done ? "✓" : "○"} {t.title}{" "}
                  <small>(archived)</small>
                </p>
              ))}
            {!scheduled(date).length && (
              <p className="muted">No tasks scheduled for this date.</p>
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
              Sign out
            </button>
            <h2>Your timezone</h2>
            <p>Dates and daily boundaries follow your timezone.</p>
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
                IANA timezone
                <input name="timezone" defaultValue={user.timezone} required />
              </label>
              <button disabled={busy}>Save timezone</button>
            </form>
            {user.isAdmin && (
              <>
                <h2>Create a user</h2>
                <p>New users have their own private tasks and history.</p>
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
                      alert("User created.");
                    });
                  }}
                >
                  <label>
                    Username
                    <input
                      name="username"
                      required
                      maxLength={80}
                      autoComplete="off"
                    />
                  </label>
                  <label>
                    Password
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
                    Administrator
                  </label>
                  <button disabled={busy}>Create user</button>
                </form>
              </>
            )}
          </section>
        )}
        <footer>
          MY DAILY HUB <span>Your day. Your pace.</span>
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
              <h2>{editId ? "Edit task" : "A new intention"}</h2>
              <button
                type="button"
                className="quiet"
                onClick={() => setEditor(null)}
              >
                Close
              </button>
            </div>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            <label>
              Task title
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
                Category
                <input
                  maxLength={80}
                  value={editor.category}
                  onChange={(e) =>
                    setEditor({ ...editor, category: e.target.value })
                  }
                />
              </label>
              <label>
                Priority
                <select
                  value={editor.priority}
                  onChange={(e) =>
                    setEditor({ ...editor, priority: Number(e.target.value) })
                  }
                >
                  {["Low", "Medium", "High"].map((p, i) => (
                    <option value={i} key={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>
                Start date
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
                Due date / recurrence end
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
              Repeat
              <select
                value={editor.recurrence}
                onChange={(e) =>
                  setEditor({ ...editor, recurrence: e.target.value })
                }
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Every day</option>
                <option value="weekly">Every week on start weekday</option>
              </select>
            </label>
            <label>
              Checklist (one item per line)
              <textarea
                value={editor.checklist}
                onChange={(e) =>
                  setEditor({ ...editor, checklist: e.target.value })
                }
              />
            </label>
            <label>
              Notes
              <textarea
                maxLength={10000}
                value={editor.notes}
                onChange={(e) =>
                  setEditor({ ...editor, notes: e.target.value })
                }
              />
            </label>
            <button disabled={busy}>Save task</button>
          </form>
        </div>
      )}
    </div>
  );
}
