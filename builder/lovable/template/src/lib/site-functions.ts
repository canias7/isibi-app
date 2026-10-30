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

export type FnBucket = {
  get(key: string): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string }; size: number } | null>;
  put(key: string, value: ArrayBuffer | string | ReadableStream, opts?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  delete(key: string): Promise<void>;
  list(opts: { prefix: string; cursor?: string; limit?: number }): Promise<{ objects: { key: string; size: number; uploaded?: Date }[]; truncated: boolean; cursor?: string }>;
};
export type FnEnv = { APP_CONN?: string; OWN_BUCKET?: string; SITES?: FnBucket; [name: string]: unknown };
export const FILES_PREFIX = "fn-files/";
export const MAX_FILE = 25_000_000;
const FILE_NAME = /^[a-z0-9][a-z0-9._-]{0,80}(?:\/[a-z0-9][a-z0-9._-]{0,80}){0,4}$/i;
type Module = { default?: unknown; hosts?: unknown; on?: unknown; visitors?: unknown };

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

function bucketOf(env: FnEnv): FnBucket {
  if (env.OWN_BUCKET !== "1" || !env.SITES) throw new Error("this site has no file storage yet");
  return env.SITES;
}
function fileName(name: string): string {
  const n = String(name || "");
  if (!FILE_NAME.test(n) || n.split("/").some((p) => p === "." || p === "..")) throw new Error("a file name is letters, digits, . _ - and up to 5 folders");
  return n;
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
    /**
     * WHETHER A SIGNATURE IS GENUINE, without the key ever reaching this code
     * (2026-10-29): an outside service (Stripe's "paid", a form service) signs
     * what it sends with a secret the owner holds. HMAC of `payload` with the
     * owner's key `name`, compared in constant time with `signature` (hex or
     * base64). Answers only true or false.
     */
    async verify(name: string, payload: string, signature: string, { algo = "SHA-256", encoding = "hex" }: { algo?: "SHA-256" | "SHA-1" | "SHA-512"; encoding?: "hex" | "base64" } = {}): Promise<boolean> {
      const secret = Object.hasOwn(keys, String(name)) ? keys[String(name)] : "";
      if (!secret || typeof payload !== "string" || typeof signature !== "string" || !signature) return false;
      const enc = new TextEncoder();
      const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: algo }, false, ["sign"]);
      const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(payload)));
      const want = encoding === "base64" ? btoa(String.fromCharCode(...mac)) : Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
      // Constant time, both sides hashed to one length first (no length leak).
      const [a, b] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(want)), crypto.subtle.digest("SHA-256", enc.encode(signature.trim()))]);
      const x = new Uint8Array(a), y = new Uint8Array(b);
      let diff = 0;
      for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
      return diff === 0;
    },
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
    // THE SITE'S OWN FILES (2026-10-28), in its own bucket under `fn-files/`.
    files: {
      async put(name: string, body: ArrayBuffer | string, contentType = "application/octet-stream"): Promise<void> {
        const B = bucketOf(env);
        const size = typeof body === "string" ? new TextEncoder().encode(body).byteLength : body.byteLength;
        if (size > MAX_FILE) throw new Error("a file is at most 25 MB");
        await B.put(FILES_PREFIX + fileName(name), body, { httpMetadata: { contentType: String(contentType).slice(0, 100) } });
      },
      /** The file as a Response (ready to return to a visitor), or null. */
      async get(name: string): Promise<Response | null> {
        const o = await bucketOf(env).get(FILES_PREFIX + fileName(name));
        return o ? new Response(o.body, { headers: { "content-type": o.httpMetadata?.contentType || "application/octet-stream" } }) : null;
      },
      async delete(name: string): Promise<void> { await bucketOf(env).delete(FILES_PREFIX + fileName(name)); },
      async list(prefix = ""): Promise<{ name: string; size: number }[]> {
        const p = prefix ? fileName(prefix.replace(/\/$/, "")) + "/" : "";
        const page = await bucketOf(env).list({ prefix: FILES_PREFIX + p, limit: 1000 });
        return page.objects.map((o) => ({ name: o.key.slice(FILES_PREFIX.length), size: o.size }));
      },
    },
    async sql(text: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
      if (!env.APP_CONN) throw new Error("this site has no database");
      return siteSql(String(env.APP_CONN), String(text), params);
    },
  };
}
export type Site = ReturnType<typeof makeSite>;

// THE `site` HELPER'S TYPE, FOR THE SERVER CODE THE MODEL WRITES (2026-10-30).
// A server part writes `export default async function (request: Request, site:
// SiteHelper)` and imports nothing: the name is declared globally here, in the
// one file every site's program holds (`server.ts` imports it), so `tsc` sees a
// wrong method or a wrong argument as an error instead of reading `any`. It is
// exactly what the route hands the code: `makeSite`'s own return type.
export type SiteHelper = Site;
declare global {
  type SiteHelper = Site;
}

/** A text stream that stops at the first owner's key it meets, even split across pieces. */
export function keyGuard(env: FnEnv): TransformStream<Uint8Array, Uint8Array> {
  const keys = Object.values(ownerKeys(env)).filter((v) => v.length >= 8);
  const hold = keys.reduce((n, k) => Math.max(n, k.length - 1), 0);
  const dec = new TextDecoder(), enc = new TextEncoder();
  let tail = "", total = 0;
  return new TransformStream({
    transform(chunk, ctl) {
      total += chunk.byteLength;
      if (total > MAX_STREAM) { ctl.error(new Error("the answer is too large")); return; }
      const text = tail + dec.decode(chunk, { stream: true });
      if (keys.some((k) => text.includes(k))) { ctl.error(new Error("withheld: the answer contained one of the owner's keys")); return; }
      const cut = Math.max(0, text.length - hold);
      if (cut) ctl.enqueue(enc.encode(text.slice(0, cut)));
      tail = text.slice(cut);
    },
    flush(ctl) {
      const text = tail + dec.decode();
      if (keys.some((k) => text.includes(k))) { ctl.error(new Error("withheld: the answer contained one of the owner's keys")); return; }
      if (text) ctl.enqueue(enc.encode(text));
    },
  });
}
export const MAX_STREAM = 20_000_000;

/** True when any of the owner's key values (8+ characters) appears in the text. */
export function leaksKey(text: string, env: FnEnv): boolean {
  for (const v of Object.values(ownerKeys(env))) if (v.length >= 8 && text.includes(v)) return true;
  return false;
}

// A FAILURE ON THE LIVE SITE IS WRITTEN DOWN (2026-10-28), in the site's own
// error log (`_errors`, source `server`), so the owner — and the builder on their
// next request — can see what went wrong. A key's value is never written.
export async function logFnError(env: FnEnv, name: string, what: string, message: string): Promise<void> {
  if (!env.APP_CONN) return;
  let msg = String(message || "").slice(0, 300);
  for (const v of Object.values(ownerKeys(env))) if (v.length >= 8) msg = msg.split(v).join("[key]");
  try {
    await siteSql(String(env.APP_CONN), "INSERT INTO _errors (at, message, stack, route, source) VALUES (to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'), ?, ?, ?, ?)",
      ["server code `" + name + "` failed " + what + ": " + msg, null, "fn/" + name, "server"]);
  } catch { /* the log is best effort */ }
}

const own = { "x-site-data": "own" };
const fail = (status: number, error: string) => Response.json({ error }, { status, headers: own });

export async function siteFunction(request: Request, env: FnEnv, url: URL, slug: string, mods: Record<string, Module> = MODULES): Promise<Response | null> {
  const m = url.pathname.match(/^\/api\/db\/([a-z0-9][a-z0-9-]{0,80})\/fn\/([a-z][a-z0-9]*(?:-[a-z0-9]+)*)$/);
  if (!m || m[1] !== slug) return null;
  const mod = moduleFor(m[2], mods);
  if (!mod || typeof mod.default !== "function") return fail(404, "no such function");
  // A HOOK IS NOT A VISITOR'S TO CALL: a function that runs on an event (a new
  // row, the clock) is reachable from outside only when it also
  // says `export const visitors = true`, so nobody can fake the event.
  if (hooksOf(mod).length && mod.visitors !== true) return fail(404, "no such function");
  const wait = tooMany("fn|" + m[2] + "|" + visitorIp(request), PER_MIN);
  if (wait) return limited(wait);
  let res: unknown;
  try {
    res = await (mod.default as (r: Request, s: Site) => unknown)(request, makeSite(env, slug, declaredHosts(mod)));
  } catch (e) {
    const msg = String((e as Error)?.message || e).slice(0, 300);
    await logFnError(env, m[2], "answering a visitor", msg);
    return fail(500, leaksKey(msg, env) ? "the function failed" : "the function failed: " + msg);
  }
  if (!(res instanceof Response)) return fail(500, "the function did not answer with a Response");
  for (const [, v] of res.headers) if (leaksKey(v, env)) return fail(500, "the function's answer was withheld: it contained one of the owner's keys");
  // TEXT IS STREAMED AS IT COMES (2026-10-28): a chat's words reach the visitor
  // while the AI is still writing. Each piece is scanned, holding back the last
  // few characters so a key split across two pieces is still caught; on a key,
  // the stream stops there.
  const ct = res.headers.get("content-type") || "";
  if (res.body && /^(?:text\/|application\/(?:json|x-ndjson))/i.test(ct)) {
    const headers = new Headers(res.headers);
    headers.set("x-site-data", "own");
    headers.delete("set-cookie");
    headers.delete("content-length");
    return new Response(res.body.pipeThrough(keyGuard(env)), { status: res.status, headers });
  }
  // ANYTHING ELSE IS READ WHOLE, SO IT CAN BE CHECKED.
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_ANSWER) return fail(500, "the function's answer is too large");
  if (leaksKey(new TextDecoder().decode(buf), env)) return fail(500, "the function's answer was withheld: it contained one of the owner's keys");
  const headers = new Headers(res.headers);
  for (const [, v] of headers) if (leaksKey(v, env)) return fail(500, "the function's answer was withheld: it contained one of the owner's keys");
  headers.set("x-site-data", "own");
  headers.delete("set-cookie");
  return new Response(buf, { status: res.status, headers });
}

// HOOKS (2026-10-28): server code that runs when something happens, declared
// `export const on = ["created:bookings", "tick"]`.
//   created:<table> / updated:<table> / deleted:<table>  a visitor's write
//   tick                                                 the site's clock (every few minutes)
// The function gets a POST whose JSON body is { event, table, row }; its answer
// is not shown to anyone. At most MAX_HOOKS run for one event.
export const MAX_HOOKS = 5;
const HOOK = /^(?:(?:created|updated|deleted):[a-z][a-z0-9_]{0,62}|tick|cron:.{9,80})$/;

function nameOf(m: Module, mods: Record<string, Module>): string {
  for (const [file, x] of Object.entries(mods)) if (x === m) return file.replace(/^.*\/server-/, "").replace(/\.tsx$/, "");
  return "unknown";
}

export function hooksOf(m: Module | null): string[] {
  const on = m && Array.isArray(m.on) ? m.on : [];
  return on.filter((x): x is string => typeof x === "string" && HOOK.test(x));
}

/** Run every function hooked to this event; never throws, answers how many ran. */
export async function fireHooks(env: FnEnv, slug: string, event: string, data: { table?: string; row?: unknown } = {},
  mods: Record<string, Module> = MODULES): Promise<number> {
  const due = Object.values(mods).filter((m) => typeof m.default === "function" && hooksOf(m).includes(event)).slice(0, MAX_HOOKS);
  await Promise.all(due.map(async (m) => {
    try {
      const req = new Request("https://" + slug + ".hook/__gf/hook", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ event, table: data.table || null, row: data.row ?? null }),
      });
      await (m.default as (r: Request, s: Site) => unknown)(req, makeSite(env, slug, declaredHosts(m)));
    } catch (e) { await logFnError(env, nameOf(m, mods), "on " + event, String((e as Error)?.message || e)); }
  }));
  return due.length;
}

// EXACT SCHEDULES (2026-10-28): `cron:<minute> <hour> <day> <month> <weekday>`,
// optionally `cron:TZ=Europe/London 0 9 * * 1` (every Monday 9:00 in London;
// UTC when no zone). The site's clock wakes it every few minutes; at each wake
// a schedule fires ONCE if a time it names has passed since it last fired — so
// it runs within minutes of the time, never twice, and a missed time is caught
// up once. The first wake after it is published only starts the count.
export const CRON_STAMP = "fn-cron/";

function fieldMatch(field: string, v: number, lo: number, hi: number): boolean {
  return field.split(",").some((part) => {
    const [range, stepS] = part.split("/");
    const step = stepS ? parseInt(stepS, 10) : 1;
    if (!(step >= 1)) return false;
    let a = lo, b = hi;
    if (range !== "*") {
      const [x, y] = range.split("-").map((n) => parseInt(n, 10));
      if (!Number.isInteger(x)) return false;
      a = x; b = Number.isInteger(y) ? y : (stepS ? hi : x);
    }
    return v >= a && v <= b && (v - a) % step === 0;
  });
}

/** Parse a `cron:` hook; null when it is not one this runs. */
export function parseCron(hook: string): { tz: string; f: string[] } | null {
  const m = /^cron:(?:TZ=([A-Za-z_]+(?:\/[A-Za-z_+-]+){0,2})\s+)?(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)$/.exec(hook);
  if (!m) return null;
  const f = m.slice(2, 7);
  if (!f.every((x) => /^[0-9*,/-]+$/.test(x))) return null;
  const tz = m[1] || "UTC";
  try { new Intl.DateTimeFormat("en-GB", { timeZone: tz }); } catch { return null; }
  return { tz, f };
}

/** Whether the minute starting at `t` (ms) matches the schedule. */
export function cronMatches(c: { tz: string; f: string[] }, t: number): boolean {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: c.tz, hour12: false, minute: "numeric", hour: "numeric", day: "numeric", month: "numeric", weekday: "short",
  }).formatToParts(new Date(t)).map((p) => [p.type, p.value]));
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(String(parts.weekday));
  const [mi, ho, da, mo, we] = c.f;
  return fieldMatch(mi, +parts.minute, 0, 59) && fieldMatch(ho, +parts.hour % 24, 0, 23) && fieldMatch(da, +parts.day, 1, 31)
    && fieldMatch(mo, +parts.month, 1, 12) && (fieldMatch(we, wd, 0, 6) || (wd === 0 && fieldMatch(we, 7, 0, 7)));
}

/** Whether any minute in (since, now] matches; scans at most a day back. */
export function cronDue(c: { tz: string; f: string[] }, since: number, now: number): boolean {
  const start = Math.max(since, now - 24 * 3600_000);
  for (let t = Math.floor(start / 60_000) * 60_000 + 60_000; t <= now; t += 60_000) if (cronMatches(c, t)) return true;
  return false;
}

/** On the site's tick: fire each schedule that came due since it last fired. */
export async function fireSchedules(env: FnEnv, slug: string, now = Date.now(), mods: Record<string, Module> = MODULES): Promise<number> {
  if (env.OWN_BUCKET !== "1" || !env.SITES) return 0;
  const B = env.SITES;
  let fired = 0;
  for (const [file, m] of Object.entries(mods)) {
    if (typeof m.default !== "function") continue;
    for (const hook of hooksOf(m)) {
      const c = hook.startsWith("cron:") ? parseCron(hook) : null;
      if (!c) continue;
      const stampKey = CRON_STAMP + file.replace(/^.*\/server-/, "").replace(/\.tsx$/, "") + "/" + encodeURIComponent(hook);
      let last = 0;
      try { const o = await B.get(stampKey); last = o ? Number(await new Response(o.body).text()) || 0 : 0; } catch { last = 0; }
      if (!last) { await B.put(stampKey, String(now)).catch(() => {}); continue; }
      if (!cronDue(c, last, now)) continue;
      await B.put(stampKey, String(now)).catch(() => {});
      fired++;
      try {
        const req = new Request("https://" + slug + ".hook/__gf/hook", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: hook, table: null, row: null }) });
        await (m.default as (r: Request, s: Site) => unknown)(req, makeSite(env, slug, declaredHosts(m)));
      } catch (e) { await logFnError(env, nameOf(m, mods), "on its schedule", String((e as Error)?.message || e)); }
    }
  }
  return fired;
}
