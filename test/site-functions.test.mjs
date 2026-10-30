// THE SITE'S OWN SERVER CODE (2026-10-28): the model writes a `server-<name>`
// part; the site's Worker runs it at /api/db/<site>/fn/<name> through the
// `site` helper; the builder refuses code that reaches around the helper.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTemplate } from "./fixtures/template-ts.mjs";
import { checkServerPart, vetServerCode, importsServer } from "../builder/server-code.mjs";

const KEY = "sk-live-owner-secret-123456";
const env = { OPENAI_KEY: KEY, APP_CONN: "" };
const url = (n) => new URL("https://kiln.gofarther.app/api/db/kiln/fn/" + n);
const req = (n, init) => new Request(url(n), { headers: { "CF-Connecting-IP": "1.2.3." + Math.random() }, ...init });

test("SF1 the key reaches the declared host and never the code", async () => {
  const { makeSite } = await loadTemplate("lib/site-functions.ts");
  const seen = [];
  const site = makeSite(env, "kiln", ["api.openai.com"], async (u, init) => { seen.push([u, init.headers.get("authorization")]); return new Response("{}"); });
  const stand = site.key("OPENAI_KEY");
  assert.ok(!stand.includes(KEY), "the code holds a stand-in, not the key");
  await site.fetch("https://api.openai.com/v1/chat", { method: "POST", headers: { authorization: "Bearer " + stand }, body: "{}" });
  assert.deepEqual(seen, [["https://api.openai.com/v1/chat", "Bearer " + KEY]]);
});

test("SF2 an undeclared host, http, a private address and a missing key are refused", async () => {
  const { makeSite } = await loadTemplate("lib/site-functions.ts");
  let called = 0;
  const site = makeSite(env, "kiln", ["api.openai.com"], async () => { called++; return new Response(""); });
  await assert.rejects(site.fetch("https://evil.example/x", { headers: { a: site.key("OPENAI_KEY") } }), /did not declare/);
  await assert.rejects(site.fetch("http://api.openai.com/x"), /refused/);
  await assert.rejects(site.fetch("https://api.openai.com/x", { headers: { a: site.key("NOT_SET") } }), /not set/);
  assert.equal(called, 0);
});

test("SF3 the call cap holds within one request", async () => {
  const { makeSite, CALLS_PER_REQUEST } = await loadTemplate("lib/site-functions.ts");
  const site = makeSite(env, "kiln", ["api.openai.com"], async () => new Response(""));
  for (let i = 0; i < CALLS_PER_REQUEST; i++) await site.fetch("https://api.openai.com/x");
  await assert.rejects(site.fetch("https://api.openai.com/x"), /too many/);
});

test("SF4 the route runs the module, marks it own, and withholds an answer carrying a key", async () => {
  const { siteFunction } = await loadTemplate("lib/site-functions.ts");
  const mods = {
    "/src/routes/-parts/server-ask.tsx": { hosts: [], default: async (r) => Response.json({ echo: new URL(r.url).pathname }) },
    "/src/routes/-parts/server-leak.tsx": { hosts: [], default: async () => new Response("here: " + KEY) },
    "/src/routes/-parts/server-boom.tsx": { hosts: [], default: async () => { throw new Error("bad " + KEY); } },
  };
  const ok = await siteFunction(req("ask"), env, url("ask"), "kiln", mods);
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("x-site-data"), "own");
  // A text answer is streamed and stopped at the key; never delivered.
  const leak = await siteFunction(req("leak"), env, url("leak"), "kiln", mods);
  let leaked = "";
  try { leaked = await leak.text(); } catch { /* stopped */ }
  assert.ok(!leaked.includes(KEY));
  const binLeak = { "/src/routes/-parts/server-bin.tsx": { hosts: [], default: async () => new Response(new TextEncoder().encode(KEY), { headers: { "content-type": "application/octet-stream" } }) } };
  const bin = await siteFunction(req("bin"), env, url("bin"), "kiln", binLeak);
  assert.equal(bin.status, 500, "anything not text is read whole and withheld");
  const boom = await siteFunction(req("boom"), env, url("boom"), "kiln", mods);
  assert.ok(!(await boom.text()).includes(KEY));
  assert.equal((await siteFunction(req("none"), env, url("none"), "kiln", mods)).status, 404);
  assert.equal(await siteFunction(req("ask"), env, new URL("https://x.gofarther.app/api/db/other/fn/ask"), "kiln", mods), null);
});

test("SF5 the checker passes the right shape and refuses each way around the helper", () => {
  const good = `export const hosts = ["api.openai.com"];
export default async function (request: Request, site: any) {
  const r = await site.fetch(\`https://api.openai.com/v1/x\`, { headers: { authorization: "Bearer " + site.key("OPENAI_KEY") } });
  return new Response(await r.text());
}`;
  assert.deepEqual(checkServerPart({ name: "server-ask", source: good }), { ok: true });
  const bad = (s) => checkServerPart({ name: "server-x", source: `export const hosts = [];\nexport default async function () { ${s}; return new Response("") }` });
  for (const s of ["const k = env.OPENAI_KEY", "fetch('https://x.com')", "eval('1')", "new Function('x')", "await import('x')", "globalThis.fetch", "new WebSocket('wss://x')", "site['fetch']('x')", "process.env.X", `const u = \`\${fetch("x")}\``]) {
    assert.equal(bad(s).ok, false, s);
  }
  assert.equal(checkServerPart({ name: "server-x", source: "export default async function(){ return new Response('') }" }).ok, false, "no hosts");
  assert.equal(checkServerPart({ name: "server-x", source: "import x from 'y';\nexport const hosts = [];\nexport default async function(){ return new Response('') }" }).ok, false, "an import");
  assert.equal(checkServerPart({ name: "server-x", source: "export const hosts = [];\n// fetch( in a comment\nexport default async function(){ return new Response('fetch(') }" }).ok, true, "prose is not code");
});

test("SF6 a failing server part is left out; a browser file importing server code is named", () => {
  const r = vetServerCode({
    pages: [{ path: "index.tsx", source: 'import ask from "@/routes/-parts/server-ask";' }],
    parts: [{ name: "band-a", source: "x" }, { name: "server-ask", source: "export default 1" }],
  });
  assert.deepEqual(r.parts.map((p) => p.name), ["band-a"]);
  assert.ok(r.problems.some((p) => p.includes("server-ask") && p.includes("left out")));
  assert.deepEqual(r.leaking, ["index.tsx"]);
  assert.equal(importsServer('import a from "./-parts/band-a"'), false);
});

test("SF7 wiring: the site's Worker routes functions; publish vets parts before the build", () => {
  const server = readFileSync(new URL("../builder/lovable/template/src/server.ts", import.meta.url), "utf8");
  assert.match(server, /await siteFunction\(request, env as unknown as FnEnv, url, SITE_SLUG\)/);
  const pub = readFileSync(new URL("../builder/publish-pages.mjs", import.meta.url), "utf8");
  const at = pub.indexOf("vetServerCode({ pages: v.pages, parts: v.parts })");
  assert.ok(at > 0 && at < pub.indexOf("deps.images(v.pages"), "vetted before photographs and the compile");
  assert.match(pub.slice(at, pub.indexOf("lintPages(v.pages, spec)", at)), /v\.parts = vetted\.parts;\n\s*sitePartsForBuild = v\.parts;/);
});

test("SF8 hooks run on their event only, never for a visitor unless allowed", async () => {
  const { fireHooks, siteFunction } = await loadTemplate("lib/site-functions.ts");
  const got = [];
  const mods = {
    "/src/routes/-parts/server-text-owner.tsx": { hosts: [], on: ["created:bookings"], default: async (r) => { got.push(await r.json()); return new Response(""); } },
    "/src/routes/-parts/server-receipt.tsx": { hosts: [], on: ["paid:bookings"], visitors: true, default: async () => new Response("ok") },
  };
  assert.equal(await fireHooks(env, "kiln", "created:bookings", { table: "bookings", row: { id: 7 } }, mods), 1);
  assert.deepEqual(got, [{ event: "created:bookings", table: "bookings", row: { id: 7 } }]);
  assert.equal(await fireHooks(env, "kiln", "created:orders", {}, mods), 0);
  assert.equal((await siteFunction(req("text-owner"), env, url("text-owner"), "kiln", mods)).status, 404, "a hook is not callable from outside");
  assert.equal((await siteFunction(req("receipt"), env, url("receipt"), "kiln", mods)).status, 200, "unless it says visitors = true");
  const boom = { "/src/routes/-parts/server-x.tsx": { on: ["tick"], default: async () => { throw new Error("x"); } } };
  assert.equal(await fireHooks(env, "kiln", "tick", {}, boom), 1, "a failing hook never throws");
});

// 2026-10-29: the prebuilt follow-ups (and with them `paid:`) were deleted; the
// model's server code hangs on lib/site-row-hooks.ts alone.
test("SF9 the hooks are wired: a visitor's write fires created/updated/deleted, the platform's clock fires tick and the schedules", async () => {
  const { rowHooks, siteTick, TICK_HEADER } = await loadTemplate("lib/site-row-hooks.ts");
  // The wiring in the site's Worker: a successful write calls rowHooks, the router serves siteTick.
  const server = readFileSync(new URL("../builder/lovable/template/src/server.ts", import.meta.url), "utf8");
  const ok = server.indexOf("if (r.status >= 200 && r.status < 300) {");
  const hooked = server.indexOf("const follow = rowHooks(env as unknown as FnEnv, ctx, { slug: SITE_SLUG, method: request.method, path,", ok);
  assert.ok(ok > 0 && hooked > ok && hooked - ok < 800, "rowHooks runs after a successful write");
  assert.match(server, /\(await siteTick\(request, env as unknown as FnEnv, url, SITE_SLUG, TICK_HEADER\)\)/);
  // The platform's clock posts /__gf/tick with that same header.
  const w = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.equal(TICK_HEADER, "x-gf-site-job");
  assert.match(w, /const SITE_JOB_HEADER = "x-gf-site-job";/);
  assert.match(w, /\/__gf\/tick", \{ method: "POST", headers: \{ \[SITE_JOB_HEADER\]: "1" \} \}/);
  // Driven: each write method fires its own event with the row.
  const B = memBucket();
  const e = { ...env, OWN_BUCKET: "1", SITES: B };
  const got = [];
  const mods = { "/src/routes/-parts/server-follow.tsx": { hosts: [], on: ["created:bookings", "updated:bookings", "deleted:bookings", "tick", "cron:*/5 * * * *"],
    default: async (r) => { got.push(await r.json()); return new Response(""); } } };
  const { fireHooks } = await loadTemplate("lib/site-functions.ts");
  // rowHooks fires through the site's own parts (import.meta.glob, empty
  // here), so the event it names is read from its source and driven through
  // fireHooks with these parts.
  const rh = readFileSync(new URL("../builder/lovable/template/src/lib/site-row-hooks.ts", import.meta.url), "utf8");
  assert.match(rh, /const ACTIONS: Record<string, string> = \{ POST: "created", PATCH: "updated", PUT: "updated", DELETE: "deleted" \};/);
  assert.match(rh, /fireHooks\(env, slug, action \+ ":" \+ table, \{ table, row: row \|\| \{\} \}\)/);
  const waited = [];
  const ctx = { waitUntil: (p) => waited.push(p) };
  for (const [method, event] of [["POST", "created:bookings"], ["PATCH", "updated:bookings"], ["PUT", "updated:bookings"], ["DELETE", "deleted:bookings"]]) {
    await rowHooks(e, ctx, { slug: "kiln", method, path: "bookings", search: "?id=eq.7", sent: '{"who":"Ada"}', body: '[{"id":7,"who":"Ada"}]' });
    assert.equal(await fireHooks(e, "kiln", event, { table: "bookings", row: { id: 7 } }, mods), 1, event);
  }
  assert.ok(waited.length === 4, "every write's hooks are kept alive past the answer");
  assert.equal(await rowHooks(e, ctx, { slug: "kiln", method: "GET", path: "bookings", search: "", sent: "", body: "[]" }), 0, "a read fires nothing");
  assert.equal(await rowHooks(e, ctx, { slug: "kiln", method: "POST", path: "Bad-Name", search: "", sent: "", body: "{}" }), 0, "not a table name");
  assert.deepEqual(got.map((g) => g.event), ["created:bookings", "updated:bookings", "updated:bookings", "deleted:bookings"]);
  // The tick: only a POST to /__gf/tick carrying the header; it answers hooks and schedules.
  const tick = (init, path = "/__gf/tick") => { const u = new URL("https://kiln.gofarther.app" + path); return siteTick(new Request(u, init), e, u, "kiln", TICK_HEADER); };
  assert.equal(await tick({ method: "POST" }), null, "no header, no tick");
  assert.equal(await tick({ method: "GET", headers: { [TICK_HEADER]: "1" } }), null, "a GET is not a tick");
  assert.equal(await tick({ method: "POST", headers: { [TICK_HEADER]: "1" } }, "/__gf/other"), null);
  const r = await tick({ method: "POST", headers: { [TICK_HEADER]: "1" } });
  assert.equal(r.headers.get("x-site-data"), "own");
  const j = await r.json();
  assert.equal(j.ok, true);
  assert.ok("hooks" in j && "schedules" in j, "the tick fires both the tick hooks and the schedules");
  const src = readFileSync(new URL("../builder/lovable/template/src/lib/site-row-hooks.ts", import.meta.url), "utf8");
  assert.match(src, /const hooks = await fireHooks\(env, slug, "tick"\)/);
  assert.match(src, /const schedules = await fireSchedules\(env, slug\)/);
  assert.doesNotMatch(src, /paid/, "a payment event is back");
});

test("SF10 the checker reads hook lists; paid: is no longer an event", () => {
  const base = (on) => checkServerPart({ name: "server-x", source: `export const hosts = [];\nexport const on = ${on};\nexport default async function () { return new Response("") }` });
  assert.equal(base('["created:bookings", "updated:orders", "deleted:orders", "tick", "cron:0 9 * * 1"]').ok, true);
  assert.equal(base('["paid:orders"]').ok, false);
  assert.equal(base('["whenever"]').ok, false);
  assert.equal(base("events()").ok, false);
});

test("SF11 the model's `server` field becomes server parts", async () => {
  const { validatePages } = await import("../builder/page-gen.mjs");
  const r = validatePages({ pages: [], server: [{ name: "chat", source: "x" }, { name: "server-chat", source: "y" }, { name: "Bad Name", source: "z" }, { name: "empty", source: " " }] }, { partial: true });
  assert.deepEqual(r.parts, [{ name: "server-chat", source: "x" }]);
  assert.equal(r.problems.length, 3);
});

test("SF12 the fix loop: a refused part goes back once, kept and charged only if it then passes", () => {
  const pub = readFileSync(new URL("../builder/publish-pages.mjs", import.meta.url), "utf8");
  const a = pub.indexOf("let vetted = vetServerCode(");
  const b = pub.indexOf("v.parts = vetted.parts;", a);
  assert.ok(a > 0 && b > a);
  const body = pub.slice(a, b);
  assert.match(body, /send: deps\.compileRepair/);
  assert.match(body, /if \(next && checkServerPart\(next\)\.ok\) \{ fixedParts\.push\(next\); if \(res\.usage\) repairUsage\.push\(res\.usage\); \}/);
  assert.match(body, /deps\.compileRepairRoom/);
});

function memBucket() {
  const m = new Map();
  return {
    m,
    async get(k) { const v = m.get(k); return v ? { body: new Response(v.body).body, httpMetadata: v.meta, size: String(v.body).length } : null; },
    async put(k, body, o = {}) { m.set(k, { body: typeof body === "string" ? body : new TextDecoder().decode(body), meta: o.httpMetadata }); },
    async delete(k) { m.delete(k); },
    async list({ prefix }) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key, size: 1 })), truncated: false }; },
  };
}

test("SF13 a text answer streams, and stops at a key even split across pieces", async () => {
  const { siteFunction } = await loadTemplate("lib/site-functions.ts");
  const stream = (pieces) => new ReadableStream({ start(c) { for (const p of pieces) c.enqueue(new TextEncoder().encode(p)); c.close(); } });
  const mods = {
    "/src/routes/-parts/server-chat.tsx": { hosts: [], default: async () => new Response(stream(["Hello, ", "the class ", "is at 10."]), { headers: { "content-type": "text/event-stream" } }) },
    "/src/routes/-parts/server-sneak.tsx": { hosts: [], default: async () => new Response(stream(["ok ", KEY.slice(0, 9), KEY.slice(9), " bye"]), { headers: { "content-type": "text/plain" } }) },
  };
  const ok = await siteFunction(req("chat"), env, url("chat"), "kiln", mods);
  assert.equal(ok.headers.get("x-site-data"), "own");
  assert.equal(await ok.text(), "Hello, the class is at 10.");
  const sneak = await siteFunction(req("sneak"), env, url("sneak"), "kiln", mods);
  let got = "";
  try { const r = sneak.body.getReader(); for (;;) { const { done, value } = await r.read(); if (done) break; got += new TextDecoder().decode(value); } } catch { /* stopped */ }
  assert.ok(!got.includes(KEY), "the key never reached the visitor");
});

test("SF14 the site's own files: put, get, list, delete, under fn-files/ only; bad names refused", async () => {
  const { makeSite } = await loadTemplate("lib/site-functions.ts");
  const B = memBucket();
  const site = makeSite({ ...env, OWN_BUCKET: "1", SITES: B }, "kiln", []);
  await site.files.put("invoices/7.txt", "Invoice 7", "text/plain");
  assert.deepEqual([...B.m.keys()], ["fn-files/invoices/7.txt"]);
  const r = await site.files.get("invoices/7.txt");
  assert.equal(r.headers.get("content-type"), "text/plain");
  assert.equal(await r.text(), "Invoice 7");
  assert.deepEqual(await site.files.list("invoices"), [{ name: "invoices/7.txt", size: 1 }]);
  await site.files.delete("invoices/7.txt");
  assert.equal(await site.files.get("invoices/7.txt"), null);
  await assert.rejects(site.files.put("../x", "a"), /file name/);
  await assert.rejects(site.files.put("/etc/x", "a"), /file name/);
  await assert.rejects(makeSite(env, "kiln", []).files.put("a.txt", "a"), /no file storage/);
});

test("SF15 exact schedules: once per due time, caught up once, first wake only starts the count", async () => {
  const { parseCron, cronMatches, cronDue, fireSchedules } = await loadTemplate("lib/site-functions.ts");
  const mon9 = parseCron("cron:TZ=Europe/London 0 9 * * 1");
  assert.ok(mon9);
  assert.equal(cronMatches(mon9, Date.parse("2026-11-02T09:00:00Z")), true, "Monday 9:00 London is 9:00 UTC in November");
  assert.equal(cronMatches(mon9, Date.parse("2026-10-19T08:00:00Z")), true, "8:00 UTC while London is on summer time");
  assert.equal(cronMatches(mon9, Date.parse("2026-11-02T08:00:00Z")), false);
  assert.equal(cronMatches(parseCron("cron:0 9,17 * * *"), Date.parse("2026-11-02T17:00:00Z")), true);
  assert.equal(cronMatches(parseCron("cron:*/15 * * * *"), Date.parse("2026-11-02T17:30:00Z")), true);
  assert.equal(cronMatches(parseCron("cron:*/15 * * * *"), Date.parse("2026-11-02T17:31:00Z")), false);
  assert.equal(parseCron("cron:hello"), null);
  assert.equal(cronDue(mon9, Date.parse("2026-11-02T08:55:00Z"), Date.parse("2026-11-02T09:04:00Z")), true);
  assert.equal(cronDue(mon9, Date.parse("2026-11-02T09:01:00Z"), Date.parse("2026-11-02T09:06:00Z")), false);
  const ran = [];
  const B = memBucket();
  const e = { ...env, OWN_BUCKET: "1", SITES: B };
  const mods = { "/src/routes/-parts/server-weekly.tsx": { hosts: [], on: ["cron:0 9 * * 1"], default: async (r) => { ran.push((await r.json()).event); return new Response(""); } } };
  assert.equal(await fireSchedules(e, "kiln", Date.parse("2026-11-02T08:50:00Z"), mods), 0, "first wake starts the count");
  assert.equal(await fireSchedules(e, "kiln", Date.parse("2026-11-02T08:58:00Z"), mods), 0);
  assert.equal(await fireSchedules(e, "kiln", Date.parse("2026-11-02T09:02:00Z"), mods), 1, "due");
  assert.equal(await fireSchedules(e, "kiln", Date.parse("2026-11-02T09:04:00Z"), mods), 0, "never twice");
  assert.deepEqual(ran, ["cron:0 9 * * 1"]);
});

test("SF16 every path's publish checks server code: a refused rewrite keeps the stored copy", () => {
  const w = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const a = w.indexOf("let siteParts = Array.isArray(parts) ? parts : await loadSiteParts(env, slug);");
  assert.ok(a > 0 && a > w.indexOf("async function recompileAndPublish("));
  const block = w.slice(a, w.indexOf("// A PART THE COMPILE REPAIR FIXED", a));
  assert.match(block, /vetServerCode\(\{ pages: Array\.isArray\(pages\) \? pages : \[\], parts \}\)/);
  assert.match(block, /siteParts = vet\.parts\.concat\(vet\.failed\.map\(\(f\) => keep\.get\(f\.part\.name\)\)\.filter\(Boolean\)\)/);
});

test("SF17 the router and the add-on step send 'the site should DO something' to the writer with server code", async () => {
  const { ASK_TOOL } = await import("../builder/site-ask.mjs");
  assert.match(JSON.stringify(ASK_TOOL), /SOMETHING THE SITE DOES that it does not do yet is an addition too/);
  const add = readFileSync(new URL("../builder/site-add.mjs", import.meta.url), "utf8");
  // The api kind that used to point here went with the prebuilt features (2026-10-29).
  assert.doesNotMatch(add, /An OUTSIDE service a page reads live/);
  assert.match(add, /WITH the site's own server code when it needs one/);
});

test("SF-verify site.verify checks an outside service's signature with the owner's key, never showing it; constant-time; false when the key is unset", async () => {
  const { makeSite } = await loadTemplate("lib/site-functions.ts");
  const { createHmac } = await import("node:crypto");
  const secret = "whsec_test_123";
  const site = makeSite({ OWNER_KEYS: JSON.stringify(["STRIPE_WEBHOOK_SECRET"]), STRIPE_WEBHOOK_SECRET: secret }, "s", []);
  const signed = "1700000000.{\"id\":\"evt_1\"}";
  const hex = createHmac("sha256", secret).update(signed).digest("hex");
  assert.equal(await site.verify("STRIPE_WEBHOOK_SECRET", signed, hex), true);
  assert.equal(await site.verify("STRIPE_WEBHOOK_SECRET", signed + "x", hex), false, "a changed body fails");
  assert.equal(await site.verify("STRIPE_WEBHOOK_SECRET", signed, hex.slice(0, -1) + (hex.endsWith("0") ? "1" : "0")), false);
  assert.equal(await site.verify("STRIPE_WEBHOOK_SECRET", signed, createHmac("sha256", secret).update(signed).digest("base64"), { encoding: "base64" }), true);
  assert.equal(await site.verify("NOT_SET", signed, hex), false);
  assert.equal(await site.verify("STRIPE_WEBHOOK_SECRET", signed, ""), false);
});

test("SF-practices the agent is told the Workers practices, credited, with site.verify", async () => {
  const { agentSystem } = await import("../builder/site-agent.mjs");
  const sys = agentSystem(null, "");
  assert.match(sys, /adapted from Cloudflare's Workers best practices/);
  assert.match(sys, /site\.verify\("KEY_NAME", signedText, signature\)/);
  assert.match(sys, /never Math\.random\(\)/);
  assert.match(sys, /Await every outside call/);
  const src = readFileSync(new URL("../builder/site-agent.mjs", import.meta.url), "utf8");
  assert.match(src, /Apache License 2\.0, © Cloudflare, Inc\./);
});

// THE `site` HELPER IS TYPED (2026-10-30): a server part's `site: SiteHelper`
// is the route's own `makeSite` return type, declared globally by
// `site-functions.ts`, so `tsc` reads a wrong call as an error, not as `any`.
// Typechecked as the template's program would: `site-functions.ts` and the
// part, with the template's compiler options; only the part's own diagnostics
// are read (the template's other imports are not this test's).
async function typecheckPart(source) {
  const { createRequire } = await import("node:module");
  const { existsSync } = await import("node:fs");
  const path = await import("node:path");
  const tpl = new URL("../builder/lovable/template/", import.meta.url).pathname;
  const tsLocal = path.join(tpl, "node_modules/typescript/lib/typescript.js");
  const ts = existsSync(tsLocal) ? createRequire(import.meta.url)(tsLocal) : createRequire(import.meta.url)("typescript");
  const cfg = ts.parseJsonConfigFileContent(ts.readConfigFile(path.join(tpl, "tsconfig.json"), ts.sys.readFile).config, ts.sys, tpl);
  const part = path.join(tpl, "src/routes/-parts/server-typed-check.tsx");
  const host = ts.createCompilerHost({ ...cfg.options, types: [] });
  const getSourceFile = host.getSourceFile.bind(host);
  host.getSourceFile = (f, lang, ...rest) => (path.resolve(f) === part ? ts.createSourceFile(f, source, lang, true) : getSourceFile(f, lang, ...rest));
  const fileExists = host.fileExists.bind(host);
  host.fileExists = (f) => path.resolve(f) === part || fileExists(f);
  const program = ts.createProgram([path.join(tpl, "src/lib/site-functions.ts"), part], { ...cfg.options, types: [], noEmit: true }, host);
  const sf = program.getSourceFile(part);
  assert.ok(sf, "the part is in the program");
  return [...program.getSemanticDiagnostics(sf), ...program.getSyntacticDiagnostics(sf)].map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"));
}

test("SF-typed a server part's `site` is the real helper's type: the prompt's own example checks clean, a wrong call is a type error", async () => {
  const { SITE_PAGES_TOOL } = await import("../builder/page-gen.mjs");
  const said = SITE_PAGES_TOOL.input_schema.properties.server;
  const example = (said.description.split("Example — a chatbot:\n")[1] || "").split("\nTO RUN WHEN")[0];
  assert.match(example, /^export const hosts = \["api\.openai\.com"\];\nexport default async function \(request: Request, site: SiteHelper\) \{/, "the example the writer is shown uses the type");
  assert.match(said.items.properties.source.description, /site: SiteHelper\): Promise<Response>/);
  const { SERVER_REPAIR_RULES } = await import("../builder/server-code.mjs");
  assert.match(SERVER_REPAIR_RULES, /site: SiteHelper\): Promise<Response>/);
  assert.deepEqual(await typecheckPart(example), [], "the writer's own example typechecks");
  const webhook = `export const hosts = [];
export default async function (request: Request, site: SiteHelper): Promise<Response> {
  const raw = await request.text();
  if (!(await site.verify("STRIPE_WEBHOOK_SECRET", raw, request.headers.get("stripe-signature") || "", { encoding: "hex" }))) return new Response("not signed", { status: 400 });
  const rows = await site.sql("select id from orders where ref = ?", ["x"]);
  await site.files.put("receipts/" + rows.length + ".txt", raw, "text/plain");
  const f = await site.files.get("receipts/1.txt");
  return f || Response.json({ ok: site.hasKey("STRIPE_WEBHOOK_SECRET"), slug: site.slug });
}`;
  assert.deepEqual(await typecheckPart(webhook), [], "every helper method, used rightly, typechecks");
  for (const [wrong, why] of [
    ["await site.fecth(\"https://x.example\")", /fecth/],
    ["await site.sql(42)", /number.*string|string.*number/],
    ["site.key(5)", /number.*string|string.*number/],
    ["await site.verify(\"K\", \"x\")", /argument|Expected/i],
    ["await site.files.put(\"a\", 1)", /number/],
    ["await site.verify(\"K\", \"x\", \"y\", { algo: \"MD5\" })", /MD5/],
  ]) {
    const errs = await typecheckPart(`export const hosts = [];\nexport default async function (request: Request, site: SiteHelper): Promise<Response> {\n  ${wrong};\n  return new Response("");\n}`);
    assert.ok(errs.some((e) => why.test(e)), wrong + " is a type error: " + JSON.stringify(errs));
  }
});
