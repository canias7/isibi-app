// THE SITE'S OWN SERVER CODE, WRITTEN BY THE MODEL (2026-10-28).
//
// Owner: "the model should be able to write everything". A page is code the
// model writes for the visitor's browser; this is code it writes for the site's
// own Worker, where the owner's keys live: a chatbot on their AI key, a payment
// provider, a text message, a capacity check — whatever the site needs.
//
// WHERE IT LIVES: a site part named `server-<name>` (`src/routes/-parts/`, the
// one directory the shared build container wipes between sites, and invisible
// to the route generator). It is reached at `/api/db/<site>/fn/<name>`, any
// method, and has this shape:
//
//   export const hosts = ["api.openai.com"];   // every address it may call
//   export default async function (request: Request, site: Site) { … return new Response(…) }
//
// THE RAILS, which are ours and not the model's:
//   • `site.key("NAME")` is a stand-in, never the value. Only `site.fetch`
//     swaps it for the owner's key, and only on the way out to a declared host.
//   • `site.fetch` calls only the hosts the module declared, over https, past
//     the private-address guard, at most CALLS_PER_REQUEST times, each bounded.
//   • `site.sql` runs on the site's own database login, never shown.
//   • A visitor is limited per minute, per function.
//   • An answer that contains any of the owner's key values is withheld.
// The builder's check (`builder/server-code.mjs`) refuses code that reaches
// around these before the site is published.
import { ownerKeys } from "./owner-keys";
import { siteSql } from "./site-sql";
import { blockedReason } from "./effects/site-ssrf.mjs";
import { tooMany, visitorIp, limited } from "./site-limit";

export type FnEnv = { APP_CONN?: string; [name: string]: unknown };
type Module = { default?: unknown; hosts?: unknown };

export const CALLS_PER_REQUEST = 10;
export const CALL_TIMEOUT_MS = 30_000;
export const PER_MIN = 30;
export const MAX_ANSWER = 1_000_000;
const KEY_MARK = /@@gfkey:([A-Z][A-Z0-9_]{0,63})@@/g;

// Vite turns this call into the site's own modules at build time; outside a
// build (the tests) there is no glob, and the site simply has no functions.
let MODULES: Record<string, Module> = {};
try { MODULES = import.meta.glob("/src/routes/-parts/server-*.tsx", { eager: true }) as Record<string, Module>; } catch { MODULES = {}; }

/** The module for a function name, or null. */
export function moduleFor(name: string, mods: Record<string, Module> = MODULES): Module | null {
  for (const [file, m] of Object.entries(mods)) if (file.endsWith("/server-" + name + ".tsx")) return m;
  return null;
}

/** The hosts a module declared, lower-cased; [] for anything else. */
export function declaredHosts(m: Module | null): string[] {
  const h = m && Array.isArray(m.hosts) ? m.hosts : [];
  return h.filter((x): x is string => typeof x === "string" && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(x)).map((x) => x.toLowerCase());
}

/** Swap every key stand-in in a string for its value; null when one names no key. */
function fill(s: string, keys: Record<string, string>): string | null {
  let missing = false;
  const out = s.replace(KEY_MARK, (_m, k: string) => (Object.hasOwn(keys, k) ? keys[k] : ((missing = true), "")));
  return missing ? null : out;
}

/** The helper handed to the model's code. */
export function makeSite(env: FnEnv, slug: string, hosts: string[], fetcher: typeof fetch = fetch) {
  const keys = ownerKeys(env);
  let calls = 0;
  return {
    slug,
    /** A stand-in for the owner's key: usable only inside `site.fetch`. */
    key(name: string): string {
      if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(String(name))) throw new Error("a key name is uppercase letters, digits and _");
      return "@@gfkey:" + name + "@@";
    },
    /** Whether the owner has set a key, without its value. */
    hasKey(name: string): boolean { return Object.hasOwn(keys, String(name)); },
    async fetch(url: string, init: RequestInit = {}): Promise<Response> {
      if (++calls > CALLS_PER_REQUEST) throw new Error("too many outside calls in one request");
      const blocked = blockedReason(url);
      if (blocked) throw new Error("that address is refused: " + blocked);
      const host = new URL(url).hostname.toLowerCase();
      if (!hosts.includes(host)) throw new Error("this function did not declare " + host + " in `hosts`");
      const u = fill(url, keys);
      const headers = new Headers(init.headers);
      const outH = new Headers();
      for (const [k, v] of headers) { const f = fill(v, keys); if (f === null) throw new Error("a key this function uses is not set"); outH.set(k, f); }
      let body = init.body;
      if (typeof body === "string") { const f = fill(body, keys); if (f === null) throw new Error("a key this function uses is not set"); body = f; }
      if (u === null) throw new Error("a key this function uses is not set");
      return fetcher(u, { ...init, headers: outH, body, redirect: "manual", signal: AbortSignal.timeout(CALL_TIMEOUT_MS) });
    },
    async sql(text: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
      if (!env.APP_CONN) throw new Error("this site has no database");
      return siteSql(String(env.APP_CONN), String(text), params);
    },
  };
}
export type Site = ReturnType<typeof makeSite>;

/** True when any of the owner's key values (8+ characters) appears in the text. */
export function leaksKey(text: string, env: FnEnv): boolean {
  for (const v of Object.values(ownerKeys(env))) if (v.length >= 8 && text.includes(v)) return true;
  return false;
}

const own = { "x-site-data": "own" };
const fail = (status: number, error: string) => Response.json({ error }, { status, headers: own });

export async function siteFunction(request: Request, env: FnEnv, url: URL, slug: string, mods: Record<string, Module> = MODULES): Promise<Response | null> {
  const m = url.pathname.match(/^\/api\/db\/([a-z0-9][a-z0-9-]{0,80})\/fn\/([a-z][a-z0-9]*(?:-[a-z0-9]+)*)$/);
  if (!m || m[1] !== slug) return null;
  const mod = moduleFor(m[2], mods);
  if (!mod || typeof mod.default !== "function") return fail(404, "no such function");
  const wait = tooMany("fn|" + m[2] + "|" + visitorIp(request), PER_MIN);
  if (wait) return limited(wait);
  let res: unknown;
  try {
    res = await (mod.default as (r: Request, s: Site) => unknown)(request, makeSite(env, slug, declaredHosts(mod)));
  } catch (e) {
    const msg = String((e as Error)?.message || e).slice(0, 300);
    return fail(500, leaksKey(msg, env) ? "the function failed" : "the function failed: " + msg);
  }
  if (!(res instanceof Response)) return fail(500, "the function did not answer with a Response");
  // READ WHOLE, SO IT CAN BE CHECKED: an answer carrying a key is withheld.
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_ANSWER) return fail(500, "the function's answer is too large");
  if (leaksKey(new TextDecoder().decode(buf), env)) return fail(500, "the function's answer was withheld: it contained one of the owner's keys");
  const headers = new Headers(res.headers);
  for (const [, v] of headers) if (leaksKey(v, env)) return fail(500, "the function's answer was withheld: it contained one of the owner's keys");
  headers.set("x-site-data", "own");
  headers.delete("set-cookie");
  return new Response(buf, { status: res.status, headers });
}
