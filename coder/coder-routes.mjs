// CODER'S ROUTES, IN THE WORKER (2026-11-05). Its own file: worker.js only
// hands requests under /api/coder/ here. Off unless CODER_ON is "on" (free while
// testing, owner 2026-11-05: nothing is charged).
//
// Where things are kept (the site bucket, under coder/<user>/):
//   index.json                    the owner's projects: [{ id, name, at }]
//   <project>/meta.json           { id, name, turn, saved, ask, status, at }
//   <project>/messages.json       the conversation as Coder reads it
//   <project>/events.json         what the chat shows: messages, commands, results
//   <project>/files.json          the project's files, { path: base64 }
//
//   GET  /api/coder/projects                       the owner's projects
//   POST /api/coder/projects        { name }       a new project
//   GET  /api/coder/projects/:id                   its meta and chat events
//   POST /api/coder/projects/:id/message { text }  start a turn (the text, or an answer)
//   GET  /api/coder/projects/:id/state?since=n     the turn's new events; saves when it ends
//   POST /api/coder/projects/:id/stop
//   GET  /api/coder/projects/:id/download          the project as a .zip
import { makeZip } from "./coder-zip.mjs";
import { PROJECT_ID } from "./coder-checks.mjs";

const MAX_PROJECTS = 50;
const MAX_TEXT = 20000;
const MAX_EVENTS = 4000;

export function coderOn(env) { return !!env && env.CODER_ON === "on"; }

const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
const keyOf = (uid, ...rest) => ["coder", uid, ...rest].join("/");

async function getJson(bucket, key, fallback) {
  const o = await bucket.get(key);
  if (!o) return fallback;
  try { return JSON.parse(await o.text()); } catch { return fallback; }
}
const putJson = (bucket, key, v) => bucket.put(key, JSON.stringify(v), { httpMetadata: { contentType: "application/json" } });

/** A project id from a name: lowercase words joined by dashes, with a short suffix. */
export function projectIdFor(name, rand = Math.random) {
  const base = String(name || "project").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "project";
  return (base.length < 3 ? "project-" + base : base) + "-" + Math.floor(rand() * 36 ** 4).toString(36).padStart(4, "0");
}

/**
 * Handle one /api/coder/ request. `deps`: `authUser(request) → { id } | null`,
 * `container(name) → { fetch(Request) }` (Coder's container, one per project).
 */
export async function handleCoder(request, env, ctx, deps) {
  if (!coderOn(env)) return json({ error: "Coder is not switched on yet." }, 404);
  const bucket = env.SITES_BUCKET;
  if (!bucket) return json({ error: "storage is not available" }, 503);
  const user = await deps.authUser(request);
  if (!user || typeof user.id !== "string") return json({ error: "sign in first" }, 401);
  const uid = user.id;
  const url = new URL(request.url);
  const parts = url.pathname.replace(/^\/api\/coder\/?/, "").split("/").filter(Boolean);

  if (parts[0] !== "projects") return json({ error: "not found" }, 404);
  const indexKey = keyOf(uid, "index.json");

  if (parts.length === 1) {
    const index = await getJson(bucket, indexKey, []);
    if (request.method === "GET") return json({ ok: true, projects: index });
    if (request.method !== "POST") return json({ error: "method" }, 405);
    if (index.length >= MAX_PROJECTS) return json({ error: "at most " + MAX_PROJECTS + " projects" }, 409);
    let body = {}; try { body = await request.json(); } catch { body = {}; }
    const name = String(body.name || "New project").trim().slice(0, 80) || "New project";
    const id = projectIdFor(name);
    const meta = { id, name, turn: 0, saved: 0, ask: null, status: "idle", at: Date.now() };
    await putJson(bucket, keyOf(uid, id, "meta.json"), meta);
    await putJson(bucket, indexKey, [{ id, name, at: meta.at }, ...index]);
    return json({ ok: true, project: meta });
  }

  const id = parts[1];
  if (!PROJECT_ID.test(id)) return json({ error: "bad project" }, 400);
  const metaKey = keyOf(uid, id, "meta.json");
  const meta = await getJson(bucket, metaKey, null);
  if (!meta) return json({ error: "no such project" }, 404);
  const box = () => deps.container(uid.slice(0, 12) + "-" + id);
  const call = (path, init) => box().fetch(new Request("http://coder" + path, init));
  const action = parts[2] || "";

  if (!action && request.method === "GET") {
    return json({ ok: true, project: meta, events: await getJson(bucket, keyOf(uid, id, "events.json"), []) });
  }

  if (action === "message" && request.method === "POST") {
    let body = {}; try { body = await request.json(); } catch { body = {}; }
    const text = String(body.text || "").trim();
    if (!text) return json({ error: "write something first" }, 400);
    if (text.length > MAX_TEXT) return json({ error: "the message is over " + MAX_TEXT + " characters" }, 413);
    if (meta.status === "running") return json({ error: "Coder is still working on the last message" }, 409);
    const [messages, files] = await Promise.all([getJson(bucket, keyOf(uid, id, "messages.json"), []), getJson(bucket, keyOf(uid, id, "files.json"), {})]);
    const r = await call("/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: id, text, messages, files }) });
    if (!r.ok) return json({ error: r.status === 409 ? "Coder is still working on the last message" : "Coder's machine could not start the work" }, r.status === 409 ? 409 : 502);
    const next = { ...meta, turn: meta.turn + 1, status: "running", ask: null, at: Date.now(), base: 0 };
    await putJson(bucket, metaKey, next);
    return json({ ok: true, project: next });
  }

  if (action === "state" && request.method === "GET") {
    const since = Math.max(0, Number(url.searchParams.get("since")) || 0);
    let s = null;
    try { const r = await call("/state?project=" + id + "&since=" + since, { method: "GET" }); s = r.ok ? await r.json() : null; } catch { s = null; }
    if (!s) return json({ ok: false, error: "Coder's machine could not be reached", project: meta }, 502);
    // THE TURN ENDED: its conversation, its chat lines and its files are kept, once per turn.
    if (s.result && meta.status === "running" && meta.saved < meta.turn) {
      const all = await call("/state?project=" + id + "&since=0", { method: "GET" }).then((r) => r.json()).catch(() => ({ events: [] }));
      const old = await getJson(bucket, keyOf(uid, id, "events.json"), []);
      const exp = await call("/export", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: id }) }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      await putJson(bucket, keyOf(uid, id, "messages.json"), Array.isArray(s.result.messages) ? s.result.messages : []);
      await putJson(bucket, keyOf(uid, id, "events.json"), [...old, ...(Array.isArray(all.events) ? all.events : [])].slice(-MAX_EVENTS));
      if (exp && exp.files) await putJson(bucket, keyOf(uid, id, "files.json"), exp.files);
      const ended = { ...meta, saved: meta.turn, status: s.result.status === "ask" ? "waiting" : s.result.status === "done" ? "idle" : s.result.status, ask: s.result.ask || null, at: Date.now(), ...(exp && exp.truncated ? { truncated: true } : {}) };
      await putJson(bucket, metaKey, ended);
      return json({ ok: true, events: s.events || [], next: s.next || since, running: false, project: ended });
    }
    return json({ ok: true, events: s.events || [], next: s.next || since, running: !!s.running, project: meta });
  }

  if (action === "stop" && request.method === "POST") {
    try { await call("/stop", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: id }) }); } catch { /* the next look says */ }
    return json({ ok: true });
  }

  if (action === "download" && request.method === "GET") {
    const files = await getJson(bucket, keyOf(uid, id, "files.json"), {});
    const bytes = {};
    for (const [p, b64] of Object.entries(files)) if (typeof b64 === "string") bytes[p] = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const zip = makeZip(bytes, id);
    return new Response(zip, { headers: { "content-type": "application/zip", "content-disposition": "attachment; filename=\"" + id + ".zip\"", "cache-control": "no-store" } });
  }

  return json({ error: "not found" }, 404);
}
