import test from "node:test";
import assert from "node:assert/strict";
import {
  initialTheme,
  savedTheme,
  saveTheme,
  resolveTheme,
  applyTheme,
} from "../src/theme.mjs";

test("theme defaults follow the system and stored user choices stay independent", () => {
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  const values = new Map();
  try {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
      },
    });
    assert.equal(initialTheme(), "system");
    saveTheme("dark");
    saveTheme("light", "ana");
    saveTheme("dark", "jurgen");
    assert.equal(initialTheme(), "dark");
    assert.equal(savedTheme("ana"), "light");
    assert.equal(savedTheme("jurgen"), "dark");
    assert.equal(savedTheme("new-user"), null);
    values.set("hub.theme", "invalid");
    assert.equal(initialTheme(), "system");
    assert.equal(resolveTheme("system", true), "dark");
    assert.equal(resolveTheme("system", false), "light");
    assert.equal(resolveTheme("light", true), "light");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw Error("Blocked");
      },
    });
    assert.equal(initialTheme(), "system");
    assert.doesNotThrow(() => saveTheme("dark"));
  } finally {
    if (descriptor)
      Object.defineProperty(globalThis, "localStorage", descriptor);
    else delete globalThis.localStorage;
  }
});

test("system changes update the document and explicit choices remove listeners", () => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const listeners = new Set();
  const media = {
    matches: true,
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
  };
  const html = { dataset: {} };
  try {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { matchMedia: () => media },
    });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: { documentElement: html, querySelector: () => null },
    });
    const cleanup = applyTheme("system");
    assert.equal(html.dataset.theme, "dark");
    media.matches = false;
    listeners.forEach((fn) => fn());
    assert.equal(html.dataset.theme, "light");
    cleanup();
    assert.equal(listeners.size, 0);
    applyTheme("dark")();
    assert.equal(html.dataset.theme, "dark");
    assert.equal(listeners.size, 0);
  } finally {
    if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
    else delete globalThis.window;
    if (oldDocument) Object.defineProperty(globalThis, "document", oldDocument);
    else delete globalThis.document;
  }
});
