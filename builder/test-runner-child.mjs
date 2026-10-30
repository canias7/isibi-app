// THE SITE'S OWN TESTS, RUN IN THEIR SANDBOX (2026-10-30, `run_tests`).
//
// Started by `test-runner.mjs` with no environment, Node's permission model (it
// reads this file and `test-db.mjs`, nothing else; no child processes, no
// workers) and, from root, an unprivileged user. Nothing here reaches the
// network: `fetch` is gone, server code's `site.fetch` is RECORDED and answered
// from the test's fakes, and the pages are driven by the parent through the
// line protocol below (their requests to the site's functions come back here).
//
// PROTOCOL (one JSON object per line). In: `{ init }` once, then `{ reply }`
// answers to our asks and `{ rpc, op: "fn" }` calls from the browser's pages.
// Out: `{ rpc, op: "page" }` asks, `{ reply }` answers, and `{ done }` last.
import { makeTestDb } from "./test-db.mjs";

const enc = new TextEncoder();
const NO_NET = () => { throw new Error("tests cannot reach the network: server code's site.fetch is recorded and answered by outbound.fake"); };
globalThis.fetch = NO_NET;
try { delete globalThis.WebSocket; } catch { /* absent */ }
const MAX_MSG = 600;
const short = (e) => String((e && e.message) || e).slice(0, MAX_MSG);
const SECRET_HEADER = /authorization|cookie|key|token|secret|signature|password/i;
export const TEST_SECRET = (name) => "test-secret-" + name;

const send = (o) => process.stdout.write(JSON.stringify(o) + "\n");
let seq = 0;
const waiting = new Map();
function ask(op, args) {
  const id = ++seq;
  return new Promise((ok, no) => { waiting.set(id, { ok, no }); send({ rpc: id, op, ...args }); });
}

// ── THE STATE ONE RUN SHARES ────────────────────────────────────────────────
let FNS = new Map();            // name -> { mod, hosts, on }
let DB = makeTestDb();
const FILES = new Map();
let calls = [];
let fakes = [];

function redactHeaders(h) {
  const out = {};
  try { for (const [k, v] of new Headers(h || {})) out[k] = SECRET_HEADER.test(k) ? "[redacted]" : String(v).replace(/@@gfkey:[A-Z0-9_]+@@|test-key-[A-Z0-9_]+/g, "[redacted]").slice(0, 500); } catch { /* unreadable headers */ }
  return out;
}

function siteFor(hosts) {
  return {
    slug: "test-site",
    key(name) {
      if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(String(name))) throw new Error("a key name is uppercase letters, digits and _");
      return "test-key-" + name;
    },
    hasKey(name) { return /^[A-Z][A-Z0-9_]{0,63}$/.test(String(name)); },
    // The real check, with the TEST secret (`test-secret-<NAME>`) the
    // `webhook(…, { sign })` helper signs with; never an owner's key.
    async verify(name, payload, signature, { algo = "SHA-256", encoding = "hex" } = {}) {
      if (!/^[A-Z][A-Z0-9_]{0,63}$/.test(String(name)) || typeof payload !== "string" || typeof signature !== "string" || !signature) return false;
      const want = await hmac(TEST_SECRET(name), payload, { algo, encoding });
      const [a, b] = await Promise.all([crypto.subtle.digest("SHA-256", enc.encode(want)), crypto.subtle.digest("SHA-256", enc.encode(signature.trim()))]);
      const x = new Uint8Array(a), y = new Uint8Array(b);
      let diff = 0;
      for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
      return diff === 0;
    },
    async fetch(url, init = {}) {
      const u = new URL(String(url));
      const method = String((init && init.method) || "GET").toUpperCase();
      let body = init && init.body != null ? init.body : null;
      if (body != null && typeof body !== "string") { try { body = body instanceof URLSearchParams ? body.toString() : JSON.stringify(body); } catch { body = String(body); } }
      const rec = { url: u.href, host: u.hostname.toLowerCase(), method, headers: redactHeaders(init && init.headers), body: body == null ? null : String(body).slice(0, 20000) };
      calls.push(rec);
      if (u.protocol !== "https:") throw new Error("that address is refused: not https");
      if (!hosts.includes(rec.host)) throw new Error("this function did not declare " + rec.host + " in `hosts`");
      const f = fakes.find((x) => x.match(rec));
      const r = f ? (typeof f.response === "function" ? await f.response(rec) : f.response) : null;
      const status = r && Number.isInteger(r.status) ? r.status : 200;
      const headers = { "content-type": "application/json", ...((r && r.headers) || {}) };
      const out = r && Object.hasOwn(r, "body") ? (typeof r.body === "string" ? r.body : JSON.stringify(r.body)) : "{}";
      return new Response(status === 204 ? null : out, { status, headers });
    },
    async sql(text, params = []) { return DB.query(text, params); },
    files: {
      async put(name, body) { FILES.set(String(name), body); },
      async get(name) { return FILES.has(String(name)) ? new Response(FILES.get(String(name))) : null; },
      async delete(name) { FILES.delete(String(name)); },
      async list() { return [...FILES.keys()].map((name) => ({ name, size: 1 })); },
    },
  };
}

async function hmac(secret, payload, { algo = "SHA-256", encoding = "hex" } = {}) {
  const k = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: algo }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(payload)));
  return encoding === "base64" ? btoa(String.fromCharCode(...mac)) : Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
}

const FN_MS = 10000;
/** One function, one request, the fake site; an uncaught error is a 500 with its message (as the Worker records it). */
async function callFn(name, req) {
  const fn = FNS.get(String(name).replace(/^server-/, ""));
  if (!fn) throw new Error("no server function named " + name + " (have: " + [...FNS.keys()].join(", ") + ")");
  let res;
  try {
    res = await Promise.race([fn.mod.default(req, siteFor(fn.hosts)), new Promise((_, no) => setTimeout(() => no(new Error("the function did not answer within " + FN_MS / 1000 + " seconds")), FN_MS))]);
  } catch (e) {
    try { DB.query("INSERT INTO _errors (at, message, route, source) VALUES (now(), ?, ?, 'server')", [short(e), "fn/" + name]); } catch { /* never */ }
    return { status: 500, headers: { "content-type": "application/json" }, text: JSON.stringify({ error: short(e) }), threw: short(e) };
  }
  if (!(res instanceof Response)) return { status: 500, headers: {}, text: "", threw: "the function answered with something other than a Response" };
  const text = (await res.text()).slice(0, 200000);
  return { status: res.status, headers: Object.fromEntries(res.headers), text };
}

function requestOf(name, r = {}) {
  const u = new URL("https://test-site.example/api/db/test-site/fn/" + name);
  for (const [k, v] of Object.entries(r.query || {})) u.searchParams.set(String(k), String(v));
  const method = String(r.method || (r.body === undefined ? "GET" : "POST")).toUpperCase();
  const headers = new Headers({ "cf-connecting-ip": "203.0.113.7", ...(r.headers || {}) });
  let body;
  if (method !== "GET" && method !== "HEAD" && r.body !== undefined) {
    body = typeof r.body === "string" ? r.body : JSON.stringify(r.body);
    if (!headers.has("content-type")) headers.set("content-type", typeof r.body === "string" ? "text/plain" : "application/json");
  }
  return new Request(u, { method, headers, body });
}

const answerOf = (a) => {
  let json;
  try { json = JSON.parse(a.text); } catch { json = undefined; }
  return { status: a.status, ok: a.status >= 200 && a.status < 300, headers: a.headers, text: a.text, json, ...(a.threw ? { threw: a.threw } : {}) };
};

// ── THE TEST API ────────────────────────────────────────────────────────────
const TESTS = [];
const deepEqual = (a, b) => { try { return JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b)); } catch { return false; } };
const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v);
const show = (v) => { try { return JSON.stringify(v).slice(0, 200); } catch { return String(v).slice(0, 200); } };
function expect(actual) {
  const make = (neg) => {
    const check = (pass, what) => { if (pass === neg) throw new Error("expected " + show(actual) + (neg ? " not " : " ") + what); };
    return {
      toBe: (x) => check(Object.is(actual, x), "to be " + show(x)),
      toEqual: (x) => check(deepEqual(actual, x), "to equal " + show(x)),
      toContain: (x) => check(actual != null && typeof actual.includes === "function" && actual.includes(x), "to contain " + show(x)),
      toMatch: (re) => check((re instanceof RegExp ? re : new RegExp(String(re), "i")).test(String(actual)), "to match " + String(re)),
      toBeTruthy: () => check(!!actual, "to be truthy"),
      toBeFalsy: () => check(!actual, "to be falsy"),
      toBeDefined: () => check(actual !== undefined, "to be defined"),
      toBeGreaterThan: (x) => check(actual > x, "to be greater than " + show(x)),
      toBeLessThan: (x) => check(actual < x, "to be less than " + show(x)),
      toHaveLength: (n) => check(actual != null && actual.length === n, "to have length " + n),
      toHaveProperty: (k) => check(actual != null && Object.hasOwn(Object(actual), k), "to have property " + show(k)),
    };
  };
  return { ...make(false), not: make(true) };
}

const site = {
  call: async (name, r = {}) => answerOf(await callFn(name, requestOf(String(name), r))),
  functions: () => [...FNS.keys()],
};
const outbound = {
  calls: (match) => calls.filter((c) => !match || (match instanceof RegExp ? match.test(c.url) : c.url.includes(String(match)))).map((c) => ({ ...c })),
  fake(match, response) {
    const m = typeof match === "function" ? match : match instanceof RegExp ? (c) => match.test(c.url) : (c) => c.url.includes(String(match));
    fakes.unshift({ match: m, response: response || {} });
  },
  clear() { calls = []; fakes = []; },
};
async function webhook(name, body, { sign = "", header = "x-signature", algo = "SHA-256", encoding = "hex", headers = {}, signed = null, format = null } = {}) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  const h = { "content-type": "application/json", ...headers };
  if (sign) {
    const payload = typeof signed === "function" ? signed(raw) : raw;
    const sig = await hmac(TEST_SECRET(sign), payload, { algo, encoding });
    h[header] = typeof format === "function" ? String(format(sig)) : sig;
  }
  return site.call(name, { method: "POST", body: raw, headers: h });
}
webhook.sign = (name, payload, opts) => hmac(TEST_SECRET(name), String(payload), opts);
webhook.secret = (name) => TEST_SECRET(name);

/** Run the schedule: every function whose `on` holds it ("tick", "cron:…", or a function's name for all its schedules). */
async function runSchedule(which = "tick") {
  const w = String(which);
  const out = [];
  for (const [name, fn] of FNS) {
    const evs = fn.on.filter((e) => e === "tick" || e.startsWith("cron:"));
    const hit = evs.filter((e) => e === w || name === w.replace(/^server-/, "") || (w === "cron" && e.startsWith("cron:")));
    for (const event of hit) {
      const a = await callFn(name, requestOf(name, { method: "POST", body: { event, table: null, row: null } }));
      out.push({ fn: name, event, ...answerOf(a) });
    }
  }
  if (!out.length) throw new Error("no function runs on " + w + " (schedules: " + [...FNS].flatMap(([n, f]) => f.on.filter((e) => e === "tick" || e.startsWith("cron:")).map((e) => n + ":" + e)).join(", ") + ")");
  return out;
}

let pageCount = 0;
async function page(url = "/") {
  const id = ++pageCount;
  await ask("page", { id, act: "open", args: [String(url)] });
  const act = (a) => (...args) => ask("page", { id, act: a, args });
  return { goto: act("goto"), click: act("click"), fill: act("fill"), text: act("text"), screenshot: act("screenshot"), url: act("url"), waitFor: act("waitFor"), select: act("select"), check: act("check"), count: act("count"), close: act("close") };
}

const db = {
  query: (sql, params = []) => DB.query(sql, params),
  seed: (t, rows) => DB.seed(t, rows),
  rows: (t) => DB.rows(t),
  tables: () => DB.tables(),
  on: (p, a) => DB.on(p, a),
  log: () => DB.log(),
};

Object.assign(globalThis, { test: (name, fn) => TESTS.push({ name: String(name), fn, file: CURRENT }), it: (name, fn) => TESTS.push({ name: String(name), fn, file: CURRENT }), expect, site, page, db, outbound, webhook, runSchedule });
let CURRENT = "";

// ── THE RUN ─────────────────────────────────────────────────────────────────
async function init({ parts = [], tests = [], tables = [], only = "", testMs = 30000 }) {
  const loadErrors = [];
  for (const p of parts) {
    try {
      const mod = await import("data:text/javascript;base64," + Buffer.from(p.js).toString("base64"));
      if (typeof mod.default !== "function") { loadErrors.push({ file: "-parts/server-" + p.name, name: "(load)", ok: false, error: "the server function has no function as its default export" }); continue; }
      FNS.set(p.name, { mod, hosts: Array.isArray(mod.hosts) ? mod.hosts.filter((h) => typeof h === "string").map((h) => h.toLowerCase()) : [], on: Array.isArray(mod.on) ? mod.on.filter((e) => typeof e === "string") : [] });
    } catch (e) { loadErrors.push({ file: "-parts/server-" + p.name, name: "(load)", ok: false, error: "the server function does not load: " + short(e) }); }
  }
  const results = [...loadErrors];
  for (const t of tests) {
    CURRENT = t.file;
    try { await import("data:text/javascript;base64," + Buffer.from(t.js).toString("base64")); }
    catch (e) { results.push({ file: t.file, name: "(load)", ok: false, error: "the test file does not load: " + short(e) }); }
  }
  const chosen = TESTS.filter((x) => !only || x.name === only || x.name.includes(only));
  if (!chosen.length) results.push({ file: "", name: "(none)", ok: false, error: only ? "no test is named " + only : "no test() was declared" });
  for (const x of chosen) {
    // EVERY TEST STARTS CLEAN: a fresh database seeded from the spec, no
    // recorded calls, no fakes, no files. One test cannot pass on another's leftovers.
    DB = makeTestDb({ tables }); FILES.clear(); calls = []; fakes = [];
    const t0 = Date.now();
    try {
      await Promise.race([Promise.resolve().then(() => x.fn()), new Promise((_, no) => setTimeout(() => no(new Error("the test did not end within " + testMs / 1000 + " seconds")), testMs))]);
      results.push({ file: x.file, name: x.name, ok: true, ms: Date.now() - t0 });
    } catch (e) {
      results.push({ file: x.file, name: x.name, ok: false, ms: Date.now() - t0, error: short(e) });
    }
  }
  send({ done: { results } });
  setTimeout(() => process.exit(0), 50);
}

let buf = "";
process.stdin.on("data", (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i); buf = buf.slice(i + 1);
    let m; try { m = JSON.parse(line); } catch { continue; }
    if (m.init) { init(m.init); continue; }
    if (m.reply) { const w = waiting.get(m.reply); if (w) { waiting.delete(m.reply); if (m.error) w.no(new Error(String(m.error))); else w.ok(m.value); } continue; }
    if (m.rpc && m.op === "fn") {
      const req = new Request(m.url, { method: m.method, headers: m.headers || {}, body: m.method === "GET" || m.method === "HEAD" || m.body == null ? undefined : m.body });
      callFn(m.name, req).then((a) => send({ reply: m.rpc, value: { status: a.status, headers: a.headers, body: a.text } }), (e) => send({ reply: m.rpc, error: short(e) }));
    }
  }
});
