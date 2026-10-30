/** @typedef {"light" | "dark" | "system"} Theme */

/** @param {string} [username] @returns {Theme | null} */
export function savedTheme(username) {
  try {
    const value = localStorage.getItem(
      username ? "hub.theme.user." + username : "hub.theme",
    );
    return value === "light" || value === "dark" || value === "system"
      ? value
      : null;
  } catch {
    return null;
  }
}

/** @returns {Theme} */
export function initialTheme() {
  return savedTheme() || "system";
}

/** @param {Theme} theme @param {string} [username] */
export function saveTheme(theme, username) {
  try {
    localStorage.setItem(
      username ? "hub.theme.user." + username : "hub.theme",
      theme,
    );
  } catch {
    /* Theme switching works even without browser storage. */
  }
}

/** @param {Theme} theme @param {boolean} systemDark @returns {"light" | "dark"} */
export function resolveTheme(theme, systemDark) {
  return theme === "system" ? (systemDark ? "dark" : "light") : theme;
}

/** Apply once before React renders, then subscribe while the app is mounted.
 * @param {Theme} theme @returns {() => void}
 */
export function applyTheme(theme) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const update = () => {
    const resolved = resolveTheme(theme, media.matches);
    document.documentElement.dataset.theme = resolved;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", resolved === "dark" ? "#141c18" : "#f6f7f2");
  };
  update();
  if (theme !== "system") return () => {};
  media.addEventListener("change", update);
  return () => media.removeEventListener("change", update);
}
