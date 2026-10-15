// THE PAGE'S UPLOADS OVER THE REAL WORKER (2026-10-15): the calls
// `public/site-media.js` makes, answered by the real routes, with a network
// that can lose a chosen answer after the route has run, or never answer.
// Shared by the media cases that drive the real uploader.
import { readFileSync } from "node:fs";
import { makeCtx } from "./worker-harness.mjs";

export const TOKEN = "Bearer some-token";
export const fixture = (n) => new Uint8Array(readFileSync(new URL("./media/" + n, import.meta.url)));
export const noWait = () => Promise.resolve();

export async function call(worker, env, method, path, { body, json, headers = {} } = {}) {
  const init = { method, headers: { Authorization: TOKEN, ...headers } };
  if (json !== undefined) { init.body = JSON.stringify(json); init.headers["content-type"] = "application/json"; }
  if (body !== undefined) { init.body = body; init.headers["content-length"] = String(body.length); }
  const res = await worker.fetch(new Request("https://gofarther.dev" + path, init), env, makeCtx());
  const buf = new Uint8Array(await res.arrayBuffer());
  let parsed = null;
  try { parsed = JSON.parse(new TextDecoder().decode(buf)); } catch { parsed = null; }
  return { status: res.status, headers: res.headers, bytes: buf, body: parsed };
}

/** `lose(kind, nth)`: the route runs, the page sees a dropped connection. `hang(kind, nth)`: never answered. */
export function wireApi(worker, env, base, { lose = () => false, hang = () => false } = {}) {
  const calls = [];
  const go = async (kind, method, path, init) => {
    calls.push(kind);
    const nth = calls.filter((k) => k === kind).length;
    if (hang(kind, nth)) return new Promise(() => {});
    const r = await call(worker, env, method, base + path, init);
    if (lose(kind, nth)) throw new TypeError("Failed to fetch");
    return { status: r.status, body: r.body };
  };
  return {
    calls,
    start: (b) => go("start", "POST", "", { json: b }),
    part: async (sid, n, blob) => go("part", "PUT", "/" + sid + "/" + n, { body: new Uint8Array(await blob.arrayBuffer()) }),
    complete: (sid, parts) => go("complete", "POST", "/" + sid + "/complete", { json: { parts } }),
    abort: (sid) => go("abort", "DELETE", "/" + sid, {}),
    status: (sid) => go("status", "GET", "/" + sid, {}),
  };
}
/** The page's own record of its uploads — a Map, which outlives a "reload". */
export function memoryStore() {
  const m = new Map();
  return { m, get: (k) => m.get(k) || null, put: (k, v) => m.set(k, JSON.parse(JSON.stringify(v))), drop: (k) => m.delete(k) };
}
export const fileOf = (bytes, name, lastModified = 1760000000000) => new File([bytes], name, { lastModified });
export const mediaIn = (bucket, slug) => [...bucket.store.keys()].filter((k) => k.startsWith("uploads/" + slug + "/"));
export const ledgerOf = (bucket, scope) => (bucket.store.has("media-ledger/" + scope + ".json") ? JSON.parse(new TextDecoder().decode(bucket.raw("media-ledger/" + scope + ".json"))) : null);
