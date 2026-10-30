import test from "node:test";
import assert from "node:assert/strict";
import {
  initialLanguage,
  savedLanguage,
  saveLanguage,
  translate,
} from "../src/i18n.mjs";

test("browser defaults and independent user choices survive reloads", () => {
  const storage = new Map();
  const originalStorage = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  const originalNavigator = Object.getOwnPropertyDescriptor(
    globalThis,
    "navigator",
  );
  try {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => storage.set(key, value),
      },
    });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { language: "es-CR" },
    });
    assert.equal(initialLanguage(), "es");
    saveLanguage("en");
    assert.equal(initialLanguage(), "en");
    saveLanguage("es", "ana");
    saveLanguage("en", "jurgen");
    assert.equal(savedLanguage("ana"), "es");
    assert.equal(savedLanguage("jurgen"), "en");
    assert.equal(savedLanguage("new-user"), null);
    assert.equal(initialLanguage(), "en");
    storage.set("hub.language", "fr");
    assert.equal(initialLanguage(), "es");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw Error("Blocked");
      },
    });
    assert.equal(initialLanguage(), "es");
    assert.doesNotThrow(() => saveLanguage("en", "ana"));
  } finally {
    if (originalStorage)
      Object.defineProperty(globalThis, "localStorage", originalStorage);
    else delete globalThis.localStorage;
    if (originalNavigator)
      Object.defineProperty(globalThis, "navigator", originalNavigator);
    else delete globalThis.navigator;
  }
});

test("counts, user text and server errors switch between languages", () => {
  const title = "<Mi tarea>";
  assert.equal(
    translate("es", "Complete {title}", { title }),
    "Completar <Mi tarea>",
  );
  assert.equal(
    translate("en", "Complete {title}", { title }),
    "Complete <Mi tarea>",
  );
  assert.equal(
    translate("es", "{done} of {total} tasks complete", { done: 2, total: 5 }),
    "2 de 5 tareas completadas",
  );
  assert.equal(
    translate("es", "Request failed (429)"),
    "La solicitud falló (429)",
  );
  assert.equal(
    translate("es", "Username already exists."),
    "Ese nombre de usuario ya existe.",
  );
  assert.equal(
    translate("en", "Username already exists."),
    "Username already exists.",
  );
  assert.equal(translate("es", "unrecognized error"), "unrecognized error");
});
