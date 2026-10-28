// THIS SITE'S OWN CONNECTIONS (2026-10-27): reading an outside service, and an
// outside service posting in, with the owner's own keys and nothing of ours.
//
// `GET /api/db/<this site>/api/<name>`: a connection the site declared, called
// with the key its owner keeps, answered from a short cache. `POST
// /api/db/<this site>/hook/<name>`: an outside service posting to the site,
// checked against the owner's shared secret, handed to the site's own database
// function. The platform's own modules, copied byte for byte into ./effects.
import { apiFor, takeParams, callApi } from "./effects/site-apis.mjs";
import { missingRequired } from "./effects/site-api-shape.mjs";
import { handleInbound } from "./effects/site-inbound.mjs";
import { blockedReason } from "./effects/site-ssrf.mjs";
import { siteSql } from "./site-effects";
import { ownerKeys } from "./owner-keys";

export type ConnectEnv = { APP_CONN?: string; SITE_TABLES?: string; SITE_SPEC?: string; [name: string]: unknown };
const own = { "x-site-data": "own" };
const answer = (body: unknown, status = 200, extra: Record<string, string> = {}) => Response.json(body, { status, headers: { ...own, ...extra } });

/** The site's schema as given at publish: its tables, its connections and its hooks. */
function specOf(env: ConnectEnv): Record<string, unknown> | null {
  try { return JSON.parse(String(env.SITE_SPEC || "null")); } catch { return null; }
}

// Per-isolate guards and cache: the platform's own limits, kept here.
const SITE_API_PER_MIN = 60;
const INBOUND_PER_MIN = 30;
const hits = new Map<string, { n: number; until: number }>();
function hit(key: string, max: number): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const b = hits.get(key);
  if (!b || now >= b.until) { hits.set(key, { n: 1, until: now + 60_000 }); if (hits.size > 5000) hits.clear(); return { ok: true }; }
  return ++b.n > max ? { ok: false, retryAfter: Math.ceil((b.until - now) / 1000) } : { ok: true };
}
const cache = new Map<string, { v: unknown; until: number }>();

export async function siteApi(request: Request, env: ConnectEnv, url: URL, slug: string): Promise<Response | null> {
  const m = url.pathname.match(/^\/api\/db\/([a-z0-9][a-z0-9-]{0,80})\/api\/([a-z][a-z0-9_-]{0,40})$/i);
  if (!m || m[1].toLowerCase() !== slug || !env.SITE_SPEC) return null;
  if (request.method !== "GET") return answer({ error: "method not allowed" }, 405);
  if (!hit("api|" + (request.headers.get("CF-Connecting-IP") || ""), SITE_API_PER_MIN).ok) return answer({ error: "too many requests" }, 429);
  const api = apiFor(specOf(env), m[2].toLowerCase().replace(/-/g, "_"));
  if (!api) return answer({ error: "no such connection" }, 404);
  const params = takeParams(api, url.searchParams);
  const miss = missingRequired(api, params);
  if (miss.length) return answer({ error: "this connection needs " + miss.join(", "), missing: miss }, 400);
  const out = await callApi({
    // The OWNER's keys only: never the site's database login or its addresses.
    secrets: ownerKeys(env),
    fetch: (u: string, init: RequestInit) => fetch(u, init),
    blockedReason: (u: string) => blockedReason(u),
    cacheGet: async (k: string) => { const e = cache.get(k); return e && e.until > Date.now() ? e.v : null; },
    cacheSet: async (k: string, v: unknown, ms: number) => { cache.set(k, { v, until: Date.now() + ms }); if (cache.size > 500) cache.clear(); },
  }, { ownerId: slug, slug, api, params });
  return answer(out.body, out.status);
}

export async function siteHook(request: Request, env: ConnectEnv, url: URL, slug: string): Promise<Response | null> {
  const m = url.pathname.match(/^\/api\/db\/([a-z0-9][a-z0-9-]{0,80})\/hook\/([a-z][a-z0-9_-]{0,40})$/i);
  if (!m || m[1].toLowerCase() !== slug || !env.SITE_SPEC || !env.APP_CONN) return null;
  if (request.method !== "POST") return answer({ error: "method not allowed" }, 405);
  const conn = env.APP_CONN as string;
  const out = await handleInbound({
    loadSchema: async () => specOf(env),
    loadSecrets: async (names: string[]) => ownerKeys(env, names),
    callFn: async (name: string, payload: unknown) => {
      if (!/^[a-z][a-z0-9_]{0,40}$/.test(String(name))) return null;
      const rows = await siteSql(conn, `SELECT "${name}"(?::jsonb) AS out`, [JSON.stringify(payload)]);
      const o = rows && rows[0] && rows[0].out;
      return typeof o === "string" ? JSON.parse(o) : (o ?? null);
    },
    throttle: async (key: string) => hit("inbound|" + key, INBOUND_PER_MIN),
    log: () => {},
  }, { slug, name: m[2].toLowerCase().replace(/-/g, "_"), headers: request.headers, body: await request.text(), ip: request.headers.get("CF-Connecting-IP") || "" });
  return answer(out.body, out.status, out.retryAfter ? { "retry-after": String(out.retryAfter) } : {});
}
