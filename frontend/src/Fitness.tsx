import React, { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { localDate, shift } from "./schedule.mjs";
import "./fitness.css";
import { translate } from "./i18n.mjs";

export type FitnessEvent = {
  planId: string;
  versionId: string;
  date: string;
  planName: string;
  title: string | null;
  status: string;
  sessionId: string | null;
  canStart: boolean;
};
type Exercise = {
  id: string;
  name: string;
  sets: number;
  repetitions?: { min: number | null; max: number | null } | null;
  duration_seconds?: { min: number | null; max: number | null } | null;
  suggested_weight?: { value: number | null; unit: string | null } | null;
  per_side?: boolean | null;
  notes?: string | null;
};
type Day = {
  weekday: number;
  title?: string | null;
  notes?: string | null;
  exercises: Exercise[];
};
type Document = {
  schema_version: number | string;
  import_mode: string;
  plan: {
    external_id: string;
    name: string;
    version: string;
    language: string;
    timezone: string;
    start_date: string | null;
    description: string | null;
    general_rest_seconds: number | null;
    days: Day[];
  };
};
type Version = {
  id: string;
  planId: string;
  version: string;
  hash: string;
  effectiveFrom: string;
  document: Document;
};
type Plan = { id: string; externalId: string; versions: Version[] };
type Actual = {
  exerciseId: string;
  set: number;
  completed: boolean;
  skipped: boolean;
  repetitions: number | null;
  weight: number | null;
  unit: string | null;
  durationSeconds: number | null;
  notes: string | null;
};
type Session = {
  id: string;
  planId: string;
  versionId: string;
  date: string;
  status: string;
  notes: string;
  revision: number;
  planned: Day;
  sets: Actual[];
};
type Stats = {
  totalCompleted: number;
  activeDays: number;
  performance: {
    id: string;
    planId: string;
    versionId: string;
    date: string;
    set: Actual;
  }[];
};
type Preview = {
  document: Document;
  current: Version | null;
  expectedHash: string | null;
  effectiveFrom: string;
};

const es: Record<string, string> = {
  "Invalid workout JSON. Check field types, dates and weekday values.":
    "JSON de entrenamiento no válido. Revisa los tipos de datos, las fechas y los días de la semana.",
  "Unsupported schema_version. Use version 1.":
    "Versión de esquema no compatible. Usa schema_version 1.",
  "import_mode must be create, update or upsert.":
    "import_mode debe ser create, update o upsert.",
  "plan is required.": "El campo plan es obligatorio.",
  "Plan external_id, name and version are required (100/200/50 characters maximum).":
    "external_id, name y version son obligatorios (máximo 100/200/50 caracteres).",
  "Unknown plan timezone.": "Zona horaria del plan desconocida.",
  "Invalid plan language, description, timezone or rest interval.":
    "Idioma, descripción, zona horaria o intervalo de descanso no válido.",
  "Include 1–7 unique workout days.":
    "Incluye entre 1 y 7 días de entrenamiento sin repetir.",
  "Invalid day weekday, title or notes.":
    "Día de la semana, título o notas no válidos.",
  "Each day supports up to 40 exercises with unique IDs.":
    "Cada día admite hasta 40 ejercicios con identificadores únicos.",
  "Exercise id/name are required; sets must be 1–30 and text must fit its limits.":
    "El identificador y nombre del ejercicio son obligatorios; las series deben ser de 1 a 30 y el texto no debe superar sus límites.",
  "Invalid repetition or duration range (min must not exceed max).":
    "Rango de repeticiones o duración no válido (min no puede superar max).",
  "Weight must be 0–10000 and use kg or lb.":
    "El peso debe estar entre 0 y 10000, en kg o lb.",
  "Plan supports at most 500 sets per week.":
    "El plan admite como máximo 500 series semanales.",
  "This plan exists. Use import_mode update or upsert.":
    "El plan ya existe. Usa import_mode update o upsert.",
  "This plan does not exist in your account. Use create or upsert.":
    "Este plan no existe en tu cuenta. Usa create o upsert.",
  "This plan version was already imported. Give the updated plan a new version.":
    "Esta versión ya se importó. Asigna una versión nueva al plan actualizado.",
  "Confirm the import after reviewing the preview.":
    "Confirma la importación después de revisar la vista previa.",
  "Invalid confirmation request.": "Solicitud de confirmación no válida.",
  "The plan changed since preview. Preview the file again.":
    "El plan cambió desde la vista previa. Previsualiza el archivo de nuevo.",
  "Another import occurred. Preview and retry.":
    "Se realizó otra importación. Previsualiza el archivo y vuelve a intentarlo.",
  "Select at most 93 fitness days.":
    "Selecciona como máximo 93 días de Fitness.",
  "No plan version is scheduled for this date.":
    "No hay ninguna versión del plan programada para esta fecha.",
  "Start workouts only on their scheduled day. Rest days cannot be started.":
    "Inicia el entrenamiento en su día programado. No se puede iniciar un día de descanso.",
  "The session was already started. Refresh and retry.":
    "La sesión ya se inició. Actualiza y vuelve a intentarlo.",
  "Finished sessions are immutable.":
    "No se pueden modificar las sesiones finalizadas.",
  "The session changed. Refresh before saving.":
    "La sesión cambió. Actualiza antes de guardar.",
  "Invalid workout status, notes or sets.":
    "Estado, notas o series no válidos.",
  "Duplicate exercise sets are not allowed.":
    "No se permiten series de ejercicio duplicadas.",
  "Invalid exercise ID, set number, repetitions, weight, duration or notes.":
    "Identificador de ejercicio, número de serie, repeticiones, peso, duración o notas no válidos.",
  "Complete or skip every planned set before finishing.":
    "Completa u omite todas las series planificadas antes de finalizar.",
  "My Fitness Hub": "My Fitness Hub",
  Workout: "Entrenamiento",
  Overview: "Resumen",
  "My plans": "Mis planes",
  "Weekly schedule": "Agenda semanal",
  History: "Historial",
  "Import Workout Plan": "Importar plan de entrenamiento",
  "Choose a JSON file": "Seleccionar archivo JSON",
  "Preview import": "Previsualizar importación",
  "Current version": "Versión actual",
  "Incoming version": "Versión entrante",
  "Confirm import": "Confirmar importación",
  Cancel: "Cancelar",
  "Effective from": "Vigente desde",
  "No plan yet. Import a JSON workout plan to begin.":
    "Aún no hay planes. Importa un plan JSON para comenzar.",
  "Completed workouts": "Entrenamientos completados",
  "Active days": "Días activos",
  "Weekly completion": "Cumplimiento semanal",
  "Workout consistency": "Constancia de entrenamiento",
  "No recorded performance yet.": "Todavía no hay resultados registrados.",
  "Exercise performance": "Rendimiento por ejercicio",
  Date: "Fecha",
  Exercise: "Ejercicio",
  Repetitions: "Repeticiones",
  Weight: "Peso",
  "Duration (seconds)": "Duración (segundos)",
  Set: "Serie",
  Notes: "Notas",
  Rest: "Descanso",
  "Start Workout": "Iniciar entrenamiento",
  "Resume Workout": "Continuar entrenamiento",
  "View session": "Ver sesión",
  "View exercises": "Ver ejercicios",
  "Save progress": "Guardar progreso",
  "Finish session": "Finalizar sesión",
  "Skip workout": "Omitir entrenamiento",
  Back: "Volver",
  Complete: "Completar",
  "Skip exercise": "Omitir ejercicio",
  Planned: "Planificado",
  "Actual performance": "Resultado real",
  "Per side": "Por lado",
  "General rest (seconds)": "Descanso general (segundos)",
  Version: "Versión",
  "No workouts this week.": "No hay entrenamientos esta semana.",
  "No workout history yet.": "Todavía no hay entrenamientos registrados.",
  scheduled: "Programado",
  in_progress: "En curso",
  completed: "Completado",
  missed: "No realizado",
  skipped: "Omitido",
  rest: "Descanso",
  Previous: "Anterior",
  Next: "Siguiente",
  Today: "Hoy",
  "Workout saved.": "Entrenamiento guardado.",
  "Plan imported.": "Plan importado.",
  "The JSON file exceeds 96 KiB.": "El archivo JSON supera los 96 KiB.",
  "Select a .json file.": "Selecciona un archivo .json.",
  "Unknown values are left blank. Planned values are never saved as actual performance.":
    "Los resultados desconocidos se dejan vacíos. Los valores planificados nunca se guardan como resultados reales.",
  "Compare both versions before confirming. History will be preserved.":
    "Compara ambas versiones antes de confirmar. Se conservará el historial.",
  "All sets must be completed or skipped before finishing.":
    "Completa u omite todas las series antes de finalizar.",
  "Finished sessions are read-only.":
    "Las sesiones finalizadas son de solo lectura.",
  "Skip the remaining exercises and finish this session?":
    "¿Omitir los ejercicios restantes y finalizar esta sesión?",
  "This workout day is not today.": "Este entrenamiento no corresponde a hoy.",
};
export default function Fitness({
  language,
  timezone,
  focus,
  onSaved,
}: {
  language: string;
  timezone: string;
  focus: FitnessEvent | null;
  onSaved: () => void;
}) {
  const tr = (key: string) =>
    language === "es" ? es[key] || translate("es", key) : key;
  const today = localDate(timezone),
    [tab, setTab] = useState("Overview"),
    [anchor, setAnchor] = useState(today);
  const [plans, setPlans] = useState<Plan[]>([]),
    [events, setEvents] = useState<FitnessEvent[]>([]),
    [sessions, setSessions] = useState<Session[]>([]),
    [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  const [importing, setImporting] = useState(false),
    [preview, setPreview] = useState<Preview | null>(null),
    [selected, setSelected] = useState<Version | null>(null),
    [session, setSession] = useState<Session | null>(null),
    [exerciseFilter, setExerciseFilter] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const handledFocus = useRef("");
  const monday = shift(
    anchor,
    -((new Date(anchor + "T12:00:00Z").getUTCDay() + 6) % 7),
  );
  const weekdays =
    language === "es"
      ? [
          "lunes",
          "martes",
          "miércoles",
          "jueves",
          "viernes",
          "sábado",
          "domingo",
        ]
      : [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ];
  const formatDate = (date: string) =>
    new Intl.DateTimeFormat(language === "es" ? "es-CR" : "en-US", {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(date + "T12:00:00Z"));
  async function load() {
    const [p, e, s, t] = await Promise.all([
      api("/fitness/plans"),
      api(`/fitness/schedule?from=${monday}&to=${shift(monday, 6)}`),
      api("/fitness/sessions"),
      api("/fitness/statistics"),
    ]);
    setPlans(p);
    setEvents(e);
    setSessions(s);
    setStats(t);
    setLoaded(true);
  }
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    action(load);
  }, [monday]);
  useEffect(() => {
    if (!focus || handledFocus.current === focus.planId + focus.date) return;
    setAnchor(focus.date);
    setTab("Weekly schedule");
    if (focus.sessionId) {
      handledFocus.current = focus.planId + focus.date;
      action(async () =>
        setSession(await api("/fitness/sessions/" + focus.sessionId)),
      );
    } else {
      const version = plans
        .find((p) => p.id === focus.planId)
        ?.versions.find((v) => v.id === focus.versionId);
      if (version) {
        handledFocus.current = focus.planId + focus.date;
        setSelected(version);
      }
    }
  }, [focus, plans]);
  const range = (r?: { min: number | null; max: number | null } | null) =>
    !r
      ? "—"
      : r.min === r.max
        ? String(r.min ?? "—")
        : `${r.min ?? "—"}–${r.max ?? "—"}`;
  function dayDetails(day: Day) {
    return (
      <div className="fitness-day-details">
        <h4>
          {weekdays[day.weekday - 1]} ·{" "}
          {day.title || tr(day.exercises.length ? "Workout" : "Rest")}
        </h4>
        {day.notes && <p>{day.notes}</p>}
        {!day.exercises.length ? (
          <p>{tr("Rest")}</p>
        ) : (
          day.exercises.map((e) => (
            <article className="fitness-exercise" key={e.id}>
              <strong>{e.name}</strong>
              <dl>
                <div>
                  <dt>{tr("Set")}</dt>
                  <dd>{e.sets}</dd>
                </div>
                <div>
                  <dt>{tr("Repetitions")}</dt>
                  <dd>{range(e.repetitions)}</dd>
                </div>
                <div>
                  <dt>{tr("Duration (seconds)")}</dt>
                  <dd>{range(e.duration_seconds)}</dd>
                </div>
                <div>
                  <dt>{tr("Weight")}</dt>
                  <dd>
                    {e.suggested_weight?.value ?? "—"}{" "}
                    {e.suggested_weight?.unit}
                  </dd>
                </div>
              </dl>
              {e.per_side && <p>{tr("Per side")}</p>}
              {e.notes && <p>{e.notes}</p>}
            </article>
          ))
        )}
      </div>
    );
  }
  function planDetails(
    v: Version | { document: Document; effectiveFrom: string },
  ) {
    const p = v.document.plan;
    return (
      <>
        <h3>
          {p.name} · {tr("Version")} {p.version}
        </h3>
        <p>{p.description}</p>
        <p className="muted">
          {p.timezone} · {tr("Effective from")}: {formatDate(v.effectiveFrom)}
        </p>
        <p>
          {tr("General rest (seconds)")}: {p.general_rest_seconds ?? "—"}
        </p>
        {p.days.map((d) => (
          <React.Fragment key={d.weekday}>{dayDetails(d)}</React.Fragment>
        ))}
      </>
    );
  }
  async function openEvent(e: FitnessEvent) {
    if (e.sessionId) {
      setSession(await api("/fitness/sessions/" + e.sessionId));
      return;
    }
    if (e.canStart) {
      setSession(
        await api("/fitness/sessions", "POST", {
          planId: e.planId,
          date: e.date,
        }),
      );
      await load();
      onSaved();
      return;
    }
    const v = plans
      .find((p) => p.id === e.planId)
      ?.versions.find((v) => v.id === e.versionId);
    if (v) setSelected(v);
  }
  function eventCards(list: FitnessEvent[]) {
    return list.map((e) => (
      <article
        className={"fitness-schedule-item status-" + e.status}
        key={e.planId + e.date}
      >
        <div>
          <small>{formatDate(e.date)}</small>
          <h3>{e.title || e.planName}</h3>
          <p>
            {e.planName} · {tr(e.status)}
          </p>
        </div>
        {e.status !== "rest" && (
          <button
            type="button"
            className="quiet"
            disabled={busy}
            onClick={() => action(() => openEvent(e))}
          >
            {tr(
              e.sessionId
                ? e.status === "in_progress"
                  ? "Resume Workout"
                  : "View session"
                : e.canStart
                  ? "Start Workout"
                  : "View exercises",
            )}
          </button>
        )}
      </article>
    ));
  }
  function allSets(s: Session): Actual[] {
    return s.planned.exercises.flatMap((e) =>
      Array.from(
        { length: e.sets },
        (_, i) =>
          s.sets.find((x) => x.exerciseId === e.id && x.set === i + 1) || {
            exerciseId: e.id,
            set: i + 1,
            completed: false,
            skipped: false,
            repetitions: null,
            weight: null,
            unit: e.suggested_weight?.unit || "kg",
            durationSeconds: null,
            notes: null,
          },
      ),
    );
  }
  function changeSet(exerciseId: string, n: number, patch: Partial<Actual>) {
    if (!session) return;
    setSession({
      ...session,
      sets: allSets(session).map((x) =>
        x.exerciseId === exerciseId && x.set === n ? { ...x, ...patch } : x,
      ),
    });
  }
  async function saveSession(status: string) {
    if (!session) return;
    const saved = await api("/fitness/sessions/" + session.id, "PUT", {
      revision: session.revision,
      status,
      notes: session.notes,
      sets:
        status === "skipped"
          ? allSets(session).map((x) =>
              x.completed ? x : { ...x, skipped: true },
            )
          : allSets(session),
    });
    setSession(saved);
    await load();
    onSaved();
    setNotice(tr("Workout saved."));
  }
  const completed = events.filter((e) => e.status === "completed").length,
    scheduled = events.filter((e) => e.status !== "rest").length;
  const performance = (stats?.performance || []).filter(
    (p) =>
      !exerciseFilter || `${p.planId}:${p.set.exerciseId}` === exerciseFilter,
  );
  return (
    <section className="fitness-hub" aria-label="My Fitness Hub">
      <div className="fitness-toolbar">
        <h2>My Fitness Hub</h2>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setImporting(true);
            setPreview(null);
            setSelected(null);
            setSession(null);
            setError("");
          }}
        >
          {tr("Import Workout Plan")}
        </button>
      </div>
      <nav className="fitness-tabs" aria-label="Fitness">
        <>
          {["Overview", "My plans", "Weekly schedule", "History"].map((t) => (
            <button
              type="button"
              key={t}
              aria-current={t === tab ? "page" : undefined}
              className={t === tab ? "active" : ""}
              onClick={() => {
                setTab(t);
                setSession(null);
                setSelected(null);
              }}
            >
              {tr(t)}
            </button>
          ))}
        </>
      </nav>
      {error && (
        <p className="error" role="alert">
          {tr(error)}
        </p>
      )}
      {notice && (
        <p className="fitness-notice" role="status">
          {notice}
        </p>
      )}
      {importing && (
        <section className="fitness-panel" aria-label={tr("Preview import")}>
          <div className="section-title">
            <h3>{tr("Import Workout Plan")}</h3>
            <button
              type="button"
              className="quiet"
              disabled={busy}
              onClick={() => {
                setImporting(false);
                setPreview(null);
              }}
            >
              {tr("Cancel")}
            </button>
          </div>
          <label>
            {tr("Choose a JSON file")}
            <input
              ref={fileInput}
              type="file"
              accept=".json,application/json"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                setPreview(null);
                if (!file) return;
                action(async () => {
                  if (!file.name.toLowerCase().endsWith(".json"))
                    throw Error("Select a .json file.");
                  if (file.size > 96 * 1024)
                    throw Error("The JSON file exceeds 96 KiB.");
                  const raw = await file.text();
                  let document;
                  try {
                    document = JSON.parse(raw);
                  } catch {
                    throw Error(
                      "Invalid workout JSON. Check field types, dates and weekday values.",
                    );
                  }
                  setPreview(
                    await api("/fitness/import/preview", "POST", document),
                  );
                });
                e.currentTarget.value = "";
              }}
            />
          </label>
          {preview && (
            <>
              <p>
                {tr(
                  "Compare both versions before confirming. History will be preserved.",
                )}
              </p>
              <div className="fitness-comparison">
                {preview.current && (
                  <div>
                    <h3>{tr("Current version")}</h3>
                    {planDetails(preview.current)}
                  </div>
                )}
                <div>
                  <h3>{tr("Incoming version")}</h3>
                  {planDetails(preview)}
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  action(async () => {
                    await api("/fitness/import/confirm", "POST", {
                      document: preview.document,
                      expectedHash: preview.expectedHash,
                      confirm: true,
                    });
                    setPreview(null);
                    setImporting(false);
                    await load();
                    onSaved();
                    setNotice(tr("Plan imported."));
                  })
                }
              >
                {tr("Confirm import")}
              </button>
            </>
          )}
        </section>
      )}
      {selected && (
        <section className="fitness-panel">
          <button
            type="button"
            className="quiet"
            onClick={() => setSelected(null)}
          >
            {tr("Back")}
          </button>
          {planDetails(selected)}
        </section>
      )}
      {session && (
        <section className="fitness-panel">
          <button
            type="button"
            className="quiet"
            onClick={() => setSession(null)}
          >
            {tr("Back")}
          </button>
          <h2>
            {session.planned.title} · {formatDate(session.date)}
          </h2>
          <p>{tr(session.status)}</p>
          <p className="muted">
            {tr(
              session.status === "in_progress"
                ? "Unknown values are left blank. Planned values are never saved as actual performance."
                : "Finished sessions are read-only.",
            )}
          </p>
          {session.planned.exercises.map((e) => (
            <article className="fitness-exercise" key={e.id}>
              <h3>{e.name}</h3>
              <p>
                {tr("Planned")}: {e.sets} × {range(e.repetitions)} ·{" "}
                {range(e.duration_seconds)} s ·{" "}
                {e.suggested_weight?.value ?? "—"} {e.suggested_weight?.unit}{" "}
                {e.per_side ? tr("Per side") : ""}
              </p>
              {e.notes && <p>{e.notes}</p>}
              {session.status === "in_progress" && (
                <button
                  type="button"
                  className="quiet"
                  onClick={() =>
                    setSession({
                      ...session,
                      sets: allSets(session).map((x) =>
                        x.exerciseId === e.id && !x.completed
                          ? { ...x, skipped: true }
                          : x,
                      ),
                    })
                  }
                >
                  {tr("Skip exercise")}
                </button>
              )}
              {allSets(session)
                .filter((x) => x.exerciseId === e.id)
                .map((x) => (
                  <fieldset
                    className="fitness-set"
                    key={x.set}
                    disabled={session.status !== "in_progress" || busy}
                  >
                    <legend>
                      {tr("Set")} {x.set}
                    </legend>
                    <label className="inline">
                      <input
                        type="checkbox"
                        checked={x.completed}
                        onChange={(ev) =>
                          changeSet(e.id, x.set, {
                            completed: ev.target.checked,
                            skipped: false,
                          })
                        }
                      />
                      {tr("Complete")}
                    </label>
                    <label className="inline">
                      <input
                        type="checkbox"
                        checked={x.skipped}
                        onChange={(ev) =>
                          changeSet(e.id, x.set, {
                            skipped: ev.target.checked,
                            completed: false,
                          })
                        }
                      />
                      {tr("skipped")}
                    </label>
                    <label>
                      {tr("Repetitions")}
                      <input
                        type="number"
                        min="0"
                        max="10000"
                        value={x.repetitions ?? ""}
                        onChange={(ev) =>
                          changeSet(e.id, x.set, {
                            repetitions:
                              ev.target.value === ""
                                ? null
                                : Number(ev.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      {tr("Weight")}
                      <input
                        type="number"
                        min="0"
                        max="10000"
                        step="0.1"
                        value={x.weight ?? ""}
                        onChange={(ev) =>
                          changeSet(e.id, x.set, {
                            weight:
                              ev.target.value === ""
                                ? null
                                : Number(ev.target.value),
                          })
                        }
                      />
                    </label>
                    <label>
                      kg / lb
                      <select
                        value={x.unit || "kg"}
                        onChange={(ev) =>
                          changeSet(e.id, x.set, { unit: ev.target.value })
                        }
                      >
                        <option>kg</option>
                        <option>lb</option>
                      </select>
                    </label>
                    <label>
                      {tr("Duration (seconds)")}
                      <input
                        type="number"
                        min="0"
                        max="86400"
                        value={x.durationSeconds ?? ""}
                        onChange={(ev) =>
                          changeSet(e.id, x.set, {
                            durationSeconds:
                              ev.target.value === ""
                                ? null
                                : Number(ev.target.value),
                          })
                        }
                      />
                    </label>
                    <label className="fitness-set-notes">
                      {tr("Notes")}
                      <input
                        maxLength={2000}
                        value={x.notes || ""}
                        onChange={(ev) =>
                          changeSet(e.id, x.set, { notes: ev.target.value })
                        }
                      />
                    </label>
                  </fieldset>
                ))}
            </article>
          ))}
          <label>
            {tr("Notes")}
            <textarea
              maxLength={10000}
              disabled={session.status !== "in_progress" || busy}
              value={session.notes}
              onChange={(e) =>
                setSession({ ...session, notes: e.target.value })
              }
            />
          </label>
          {session.status === "in_progress" && (
            <div className="fitness-actions">
              <button
                disabled={busy}
                onClick={() => action(() => saveSession("in_progress"))}
              >
                {tr("Save progress")}
              </button>
              <button
                disabled={busy}
                onClick={() => action(() => saveSession("completed"))}
              >
                {tr("Finish session")}
              </button>
              <button
                className="quiet danger"
                disabled={busy}
                onClick={() => {
                  if (
                    confirm(
                      tr(
                        "Skip the remaining exercises and finish this session?",
                      ),
                    )
                  )
                    action(() => saveSession("skipped"));
                }}
              >
                {tr("Skip workout")}
              </button>
            </div>
          )}
        </section>
      )}
      {!selected && !session && loaded && (
        <>
          {tab === "Overview" && (
            <>
              <div className="stats">
                <div>
                  <span>{tr("Completed workouts")}</span>
                  <strong>{stats?.totalCompleted || 0}</strong>
                </div>
                <div>
                  <span>{tr("Active days")}</span>
                  <strong>{stats?.activeDays || 0}</strong>
                </div>
                <div>
                  <span>{tr("Weekly completion")}</span>
                  <strong>
                    {completed}/{scheduled}
                  </strong>
                  <small>
                    {tr("Workout consistency")}:{" "}
                    {scheduled ? Math.round((100 * completed) / scheduled) : 0}%
                  </small>
                </div>
              </div>
              <h3>{tr("Weekly schedule")}</h3>
              {eventCards(events.filter((e) => e.date === anchor))}
              <h3>{tr("Exercise performance")}</h3>
              {!stats?.performance.length ? (
                <p>{tr("No recorded performance yet.")}</p>
              ) : (
                <>
                  <label>
                    {tr("Exercise")}
                    <select
                      value={exerciseFilter}
                      onChange={(e) => setExerciseFilter(e.target.value)}
                    >
                      <option value="">
                        {tr("Exercise")} — {language === "es" ? "todos" : "all"}
                      </option>
                      {Array.from(
                        new Set(
                          stats.performance.map(
                            (p) => `${p.planId}:${p.set.exerciseId}`,
                          ),
                        ),
                      ).map((id) => (
                        <option key={id} value={id}>
                          {id.split(":")[1]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="fitness-table-wrap">
                    <table>
                      <thead>
                        <tr>
                          {[
                            "Date",
                            "Exercise",
                            "Set",
                            "Repetitions",
                            "Weight",
                            "Duration (seconds)",
                          ].map((x) => (
                            <th key={x}>{tr(x)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {performance
                          .slice()
                          .reverse()
                          .map((p, i) => (
                            <tr key={p.id + ":" + i}>
                              <td>{formatDate(p.date)}</td>
                              <td>{p.set.exerciseId}</td>
                              <td>{p.set.set}</td>
                              <td>{p.set.repetitions ?? "—"}</td>
                              <td>
                                {p.set.weight ?? "—"}{" "}
                                {p.set.weight !== null ? p.set.unit : ""}
                              </td>
                              <td>{p.set.durationSeconds ?? "—"}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
          {tab === "My plans" &&
            plans.map((p) => (
              <article className="fitness-panel" key={p.id}>
                <h3>{p.versions[0]?.document.plan.name}</h3>
                <small>{p.externalId}</small>
                <div className="fitness-actions">
                  {p.versions.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className="quiet"
                      onClick={() => setSelected(v)}
                    >
                      {tr("Version")} {v.version} · {tr("Effective from")}{" "}
                      {formatDate(v.effectiveFrom)}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          {tab === "Weekly schedule" && (
            <>
              <div className="fitness-week-navigation">
                <button
                  type="button"
                  className="quiet"
                  onClick={() => setAnchor(shift(anchor, -7))}
                >
                  {tr("Previous")}
                </button>
                <label>
                  {tr("Date")}
                  <input
                    type="date"
                    value={anchor}
                    onChange={(e) => {
                      if (e.target.value) setAnchor(e.target.value);
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="quiet"
                  onClick={() => setAnchor(today)}
                >
                  {tr("Today")}
                </button>
                <button
                  type="button"
                  className="quiet"
                  onClick={() => setAnchor(shift(anchor, 7))}
                >
                  {tr("Next")}
                </button>
              </div>
              {events.length ? (
                eventCards(events)
              ) : (
                <p>{tr("No workouts this week.")}</p>
              )}
            </>
          )}
          {tab === "History" &&
            (sessions.length ? (
              sessions.map((s) => (
                <article className="fitness-schedule-item" key={s.id}>
                  <div>
                    <h3>{s.planned.title}</h3>
                    <small>
                      {formatDate(s.date)} · {tr(s.status)}
                    </small>
                  </div>
                  <button
                    type="button"
                    className="quiet"
                    onClick={() =>
                      action(async () =>
                        setSession(await api("/fitness/sessions/" + s.id)),
                      )
                    }
                  >
                    {tr(
                      s.status === "in_progress"
                        ? "Resume Workout"
                        : "View session",
                    )}
                  </button>
                </article>
              ))
            ) : (
              <p>{tr("No workout history yet.")}</p>
            ))}
          {!plans.length && (
            <div className="empty">
              {tr("No plan yet. Import a JSON workout plan to begin.")}
            </div>
          )}
        </>
      )}
    </section>
  );
}
