export function shift(date, days) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function occurs(t, date) {
  return (
    date >= t.startDate &&
    (t.recurrence === "none"
      ? date === (t.dueDate || t.startDate)
      : (!t.dueDate || date <= t.dueDate) &&
        (t.recurrence === "daily" ||
          new Date(date + "T12:00:00Z").getUTCDay() ===
            new Date(t.startDate + "T12:00:00Z").getUTCDay()))
  );
}
export function localDate(timezone, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  return ["year", "month", "day"]
    .map((k) => parts.find((p) => p.type === k).value)
    .join("-");
}
