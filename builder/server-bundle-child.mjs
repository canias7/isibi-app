// THE SITE'S SERVER CODE, ASKED THROUGH THE BUILT SITE ITSELF (2026-10-30).
//
// The dry run (`server-dryrun-child.mjs`) runs each `server-<name>` part on its
// own, transpiled alone, against a fake `site`. This asks the SAME bundle the
// site will run (`dist/server/server.js`): its real route, its real `site`
// helper (`site-functions.ts`), its real key filling and answer guard. What
// would leave is answered here instead: every network call goes to the fake
// `fetch` below (the outside services, the site's database over Neon's HTTP
// endpoint, its Data API), the owner's keys are made-up values, the files are
// in memory. Started by `server-bundle-check.mjs` with no environment, Node's
// permission model (reads of this file and the bundle's folder only) and, from
// root, an unprivileged user.
//
//   node server-bundle-child.mjs <dist/server/server.js>
//     stdin:  { slug, fns: [{ name, keys, hooks, visitors }] }
//     stdout: { results: [{ name, ok, ran, status?, error?, kind? }] }
//
// A visitor-callable function gets one POST at /api/db/<slug>/fn/<name>; a
// `tick` hook the clock's own request; a `created:`/`updated:`/`deleted:<table>`
// hook a visitor's write to that table. A hook's failure is read where the site
// writes it: its own error log (`_errors`), here the fake database.

import { pathToFileURL } from "node:url";

const enc = new TextEncoder();
const DB_HOST = "db.check.invalid";
const DATA_HOST = "data.check.invalid";
const SAMPLE_ROW = { id: 1, name: "Test Visitor", customer_name: "Test Visitor", email: "test@example.com", phone: "+440000000000", created_at: "2026-01-01 10:00:00", payment_status: "paid", amount: 15, total: 15, quantity: 1, places: 1 };

// What the site's own error log received: `[name, message]`.
const logged = [];

globalThis.fetch = async (input, init = {}) => {
  const req = input instanceof Request ? input : null;
  const url = new URL(String(req ? req.url : input));
  const body = init && typeof init.body === "string" ? init.body : "";
  if (url.hostname === DB_HOST) {
    let q = {};
    try { q = JSON.parse(body); } catch { q = {}; }
    if (/^\s*INSERT\s+INTO\s+_errors\b/i.test(String(q.query || "")) && Array.isArray(q.params)) {
      const m = /^server code `([^`]+)` failed (.*)$/s.exec(String(q.params[0] || ""));
      if (m) logged.push([m[1], m[2]]);
    }
    return Response.json({ rows: [] });
  }
  if (url.hostname === DATA_HOST) return Response.json([SAMPLE_ROW], { status: 201 });
  // AN OUTSIDE SERVICE: the dry run's plausible empty answer.
  return Response.json({ ok: true, id: "test", data: [], choices: [{ message: { content: "test" } }], content: [{ type: "text", text: "test" }] });
};

function memBucket() {
  const m = new Map();
  const obj = (v) => ({ body: new Response(v).body, size: typeof v === "string" ? enc.encode(v).byteLength : 0, httpMetadata: {}, text: async () => String(v), writeHttpMetadata() {} });
  return {
    async get(k) { return m.has(k) ? obj(m.get(k)) : null; },
    async head(k) { return m.has(k) ? {} : null; },
    async put(k, v) { m.set(k, typeof v === "string" ? v : ""); },
    async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key, size: 1 })), truncated: false }; },
  };
}

// A CODE MISTAKE (a name that does not exist, a call on nothing, a host it never
// listed, an answer that is not a Response) is the code's; any other stop may
// only be our sample input. Read from the message: the route answers the text.
const CODE = /is not a function|is not defined|Cannot read propert|Cannot set propert|is not iterable|is not a constructor|undefined is not|null is not|did not declare|called fetch directly|not https|too many outside calls|did not answer with a Response|answer is too large|answer was withheld/;

const within = (p) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error("it did not answer within 8 seconds")), 8000))]);

async function main() {
  let input = "";
  for await (const d of process.stdin) input += d;
  let job = {};
  try { job = JSON.parse(input); } catch { job = {}; }
  const slug = String(job.slug || "");
  const fns = Array.isArray(job.fns) ? job.fns : [];
  const env = { APP_CONN: "postgres://check:check@" + DB_HOST + "/site", OWN_BUCKET: "1", SITES: memBucket(),
    DATA_API_BASE: "https://" + DATA_HOST, AUTH_BASE: "https://auth.check.invalid", SITE_TABLES: "{}" };
  for (const f of fns) for (const k of Array.isArray(f.keys) ? f.keys : []) if (/^[A-Z][A-Z0-9_]{0,63}$/.test(k)) env[k] = "check-key-" + k.toLowerCase();

  let app;
  try { const mod = await import(pathToFileURL(String(process.argv[2] || "")).href); app = mod && mod.default; }
  catch (e) { return out({ fatal: "the built site would not load: " + String((e && e.message) || e).slice(0, 200) }); }
  if (!app || typeof app.fetch !== "function") return out({ fatal: "the built site has no fetch handler" });

  const results = new Map(fns.map((f) => [f.name, { name: f.name, ok: true, ran: [] }]));
  const fail = (name, error, kind, status) => {
    const r = results.get(name);
    if (r && r.ok) Object.assign(r, { ok: false, error: String(error).slice(0, 200), kind, ...(status ? { status } : {}) });
  };

  // VISITORS' FUNCTIONS: one request each, through the site's own route.
  for (const f of fns) {
    if (Array.isArray(f.hooks) && f.hooks.length && f.visitors !== true) continue;
    const req = new Request("https://" + slug + ".check.invalid/api/db/" + slug + "/fn/" + f.name, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "Hello", messages: [{ role: "user", content: "Hello" }] }),
    });
    try {
      const res = await within(app.fetch(req, env));
      if (!(res instanceof Response)) { fail(f.name, "the built site answered with something other than a Response", "code"); continue; }
      const text = await within(res.text());
      results.get(f.name).ran.push("request");
      results.get(f.name).status = res.status;
      if (res.status === 404) fail(f.name, "the built site does not have it (404)", "shape", 404);
      else if (res.status >= 500) {
        let msg = text;
        try { msg = JSON.parse(text).error || text; } catch { /* the text */ }
        fail(f.name, msg || "status " + res.status, CODE.test(msg) ? "code" : "input", res.status);
      }
    } catch (e) {
      const msg = String((e && e.message) || e);
      fail(f.name, msg, e instanceof TypeError || e instanceof ReferenceError || CODE.test(msg) ? "code" : "input");
    }
  }

  // HOOKS: the event the site itself sends, once per event.
  const events = [...new Set(fns.flatMap((f) => (Array.isArray(f.hooks) ? f.hooks : []).filter((h) => h === "tick" || /^(?:created|updated|deleted):[a-z][a-z0-9_]{0,62}$/.test(h))))];
  for (const ev of events) {
    let req;
    if (ev === "tick") req = new Request("https://" + slug + ".check.invalid/__gf/tick", { method: "POST", headers: { "x-gf-site-job": "1" } });
    else {
      const [act, table] = ev.split(":");
      const method = { created: "POST", updated: "PATCH", deleted: "DELETE" }[act];
      req = new Request("https://" + slug + ".check.invalid/api/db/" + slug + "/data/" + table + (act === "created" ? "" : "?id=eq.1"), {
        method, headers: { "content-type": "application/json", authorization: "Bearer check" }, ...(act === "deleted" ? {} : { body: JSON.stringify(SAMPLE_ROW) }),
      });
    }
    const before = logged.length;
    try { const res = await within(app.fetch(req, env)); if (res instanceof Response) await within(res.text()); }
    catch (e) { for (const f of fns) if ((f.hooks || []).includes(ev)) fail(f.name, String((e && e.message) || e), "input"); continue; }
    for (const [name, what] of logged.slice(before)) {
      const msg = what.replace(/^on [^:]+: /, "");
      fail(name, msg, CODE.test(msg) ? "code" : "input");
    }
    for (const f of fns) if ((f.hooks || []).includes(ev) && results.get(f.name)) results.get(f.name).ran.push(ev);
  }
  out({ results: [...results.values()] });
}

function out(obj) { process.stdout.write(JSON.stringify(obj), () => process.exit(0)); }
main().catch((e) => out({ fatal: String((e && e.message) || e).slice(0, 200) }));
