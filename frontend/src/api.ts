export async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch("/api" + path, {
    method,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", "X-Hub-Request": "1" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) {
    let message =
      r.status === 401 ? "Please sign in." : `Request failed (${r.status})`;
    try {
      const e = await r.json();
      message = e.detail || message;
    } catch {}
    throw Error(message);
  }
  return r.status === 204 ? undefined : r.json();
}
