import { test } from "node:test";
import assert from "node:assert/strict";
import { occurs, shift, localDate } from "../src/schedule.mjs";
const task = { startDate: "2026-10-26", dueDate: null, recurrence: "daily" };
test("recurrence begins on start and respects inclusive end", () => {
  assert.equal(occurs(task, "2026-10-25"), false);
  assert.equal(occurs(task, "2026-10-27"), true);
  assert.equal(occurs({ ...task, dueDate: "2026-10-27" }, "2026-10-28"), false);
});
test("weekly recurrence uses start weekday", () => {
  assert.equal(occurs({ ...task, recurrence: "weekly" }, "2026-11-02"), true);
  assert.equal(occurs({ ...task, recurrence: "weekly" }, "2026-11-03"), false);
});
test("one-time occurrence uses due date", () => {
  assert.equal(
    occurs(
      { ...task, recurrence: "none", dueDate: "2026-10-28" },
      "2026-10-26",
    ),
    false,
  );
  assert.equal(
    occurs(
      { ...task, recurrence: "none", dueDate: "2026-10-28" },
      "2026-10-28",
    ),
    true,
  );
});
test("Costa Rica date crosses UTC midnight correctly", () => {
  assert.equal(
    localDate("America/Costa_Rica", new Date("2026-10-27T03:00:00Z")),
    "2026-10-26",
  );
  assert.equal(shift("2028-02-28", 1), "2028-02-29");
});
