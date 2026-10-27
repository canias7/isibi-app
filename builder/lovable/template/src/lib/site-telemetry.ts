// THIS SITE'S OWN ERROR REPORTS AND VISIT COUNT (2026-10-27), written into its
// own database by its own Worker as its limited login. The owner reads both in
// their panel; nothing passes through the platform.
import { siteSql } from "./site-effects";

type Ctx = { waitUntil(p: Promise<unknown>): void };
export type TelemetryEnv = { APP_CONN?: string; [name: string]: unknown };
const own = { "x-site-data": "own" };

// Reports per visitor per minute, per isolate: the platform's own limit, kept here.
const ERRORS_PER_MIN = 6;
const hits = new Map<string, { n: number; until: number }>();
function limited(ip: string): boolean {
  const now = Date.now();
  const b = hits.get(ip);
  if (!b || now >= b.until) { hits.set(ip, { n: 1, until: now + 60_000 }); if (hits.size > 5000) hits.clear(); return false; }
  return ++b.n > ERRORS_PER_MIN;
}
const SOURCES = ["error_boundary", "onerror", "unhandledrejection"];

/** `POST /api/db/<this site>/error`: always 204, whatever happened (no probing, no second console error). */
export async function siteError(request: Request, env: TelemetryEnv, url: URL, slug: string, ctx?: Ctx): Promise<Response | null> {
  if (url.pathname.toLowerCase() !== "/api/db/" + slug + "/error" || !env.APP_CONN) return null;
  if (request.method !== "POST") return Response.json({ error: "method not allowed" }, { status: 405, headers: own });
  const done = new Response(null, { status: 204, headers: own });
  if (limited(request.headers.get("CF-Connecting-IP") || "")) return done;
  let body: Record<string, unknown> = {};
  try {
    const raw = await request.text();
    if (raw.length <= 16 * 1024) body = (JSON.parse(raw) || {}) as Record<string, unknown>;
  } catch { /* not JSON: nothing to store */ }
  const msg = String(body.message || "").slice(0, 300).trim();
  if (!msg) return done;
  const src = SOURCES.includes(String(body.source)) ? String(body.source) : "onerror";
  const stack = typeof body.stack === "string" ? body.stack.slice(0, 2000) : null;
  const route = String(body.route || "").slice(0, 200);
  const conn = env.APP_CONN as string;
  const write = (async () => {
    await siteSql(conn, "INSERT INTO _errors (at, message, stack, route, source) VALUES (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), ?, ?, ?, ?)", [msg, stack, route, src]);
    // Trimmed on the write, one in twenty, so an unwatched site does not grow without bound.
    if (Math.random() < 0.05) await siteSql(conn, "DELETE FROM _errors WHERE id NOT IN (SELECT id FROM _errors ORDER BY id DESC LIMIT 500)", []);
  })().catch(() => {});
  if (ctx) ctx.waitUntil(write); else await write;
  return done;
}

const BOTS = /bot|crawl|spider|slurp|facebookexternalhit|bingpreview|headless|monitor|uptime|curl|wget/i;

/** One page view, counted after the page is answered: real pages only, never a bot, an asset, a 404 or a preview. */
export function countVisit(request: Request, env: TelemetryEnv, res: Response, url: URL, slug: string, ctx?: Ctx): void {
  if (!env.APP_CONN || !ctx || request.method !== "GET" || res.status !== 200) return;
  if (!/text\/html/i.test(res.headers.get("content-type") || "")) return;
  if (BOTS.test(request.headers.get("User-Agent") || "")) return;
  const ip = request.headers.get("CF-Connecting-IP") || "0";
  const conn = env.APP_CONN as string;
  ctx.waitUntil((async () => {
    const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip + "|" + slug + "|isibi-analytics-v1"));
    const ipHash = [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
    await siteSql(conn, "INSERT INTO _hits (ip_hash, path) VALUES (?, ?)", [ipHash, (url.pathname || "/").slice(0, 200)]);
  })().catch(() => {}));
}
