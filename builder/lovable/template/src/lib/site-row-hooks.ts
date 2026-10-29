// WHAT A VISITOR'S WRITE AND THE CLOCK START (2026-10-29). The site's prebuilt
// follow-ups (payments, emails and texts, connections and webhooks, scheduled
// jobs, the spam check) are gone on the owner's word: "let the model just make
// it when asked". What stays is the wiring the model's own server code hangs on:
// a visitor's write fires `created:` / `updated:` / `deleted:<table>` hooks, and
// the platform's clock fires `tick` and the `cron:` schedules.
import { fireHooks, fireSchedules, type FnEnv } from "./site-functions";

type Ctx = { waitUntil(p: Promise<unknown>): void };
const ACTIONS: Record<string, string> = { POST: "created", PATCH: "updated", PUT: "updated", DELETE: "deleted" };

/** After a visitor's write: the model's hooks for it, with the row as written. */
export function rowHooks(env: FnEnv, ctx: Ctx | undefined, { slug, method, path, search, sent, body }:
  { slug: string; method: string; path: string; search: string; sent: string; body: string }): Promise<number> {
  const action = ACTIONS[method];
  const table = path.split("/")[0].toLowerCase();
  if (!action || !/^[a-z][a-z0-9_]{0,62}$/.test(table)) return Promise.resolve(0);
  let row: unknown = null;
  if (action === "deleted") row = { filter: String(search || "").replace(/^\?/, "").slice(0, 500) };
  else {
    try { const j = JSON.parse(body); row = Array.isArray(j) ? j[0] : j; } catch { /* not json */ }
    if (!row) { try { row = JSON.parse(sent || "null"); } catch { row = null; } }
  }
  const p = fireHooks(env, slug, action + ":" + table, { table, row: row || {} }).catch(() => 0);
  if (ctx) ctx.waitUntil(p);
  return p;
}

/** `POST /__gf/tick`, sent only by the platform's clock: the model's `tick` hooks and `cron:` schedules. */
export async function siteTick(request: Request, env: FnEnv, url: URL, slug: string, header: string): Promise<Response | null> {
  if (url.pathname !== "/__gf/tick" || request.method !== "POST" || request.headers.get(header) !== "1") return null;
  const hooks = await fireHooks(env, slug, "tick").catch(() => 0);
  const schedules = await fireSchedules(env, slug).catch(() => 0);
  return Response.json({ ok: true, hooks, schedules }, { headers: { "x-site-data": "own" } });
}

/** The header the platform's clock sends; nothing else may start a tick. */
export const TICK_HEADER = "x-gf-site-job";
