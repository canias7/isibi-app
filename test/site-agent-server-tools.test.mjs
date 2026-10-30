// The site agent's server tools (2026-10-30, the owner approved five):
// call_function, read_errors, list_keys, change_schema, read_docs, and the
// owner's five rules for server code. Every dependency is stubbed: no network,
// no model, no database.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { runSiteAgent, toolsFor, toolCounts, roundFacts, agentSystem, AGENT_TOOLS, TOOL_NEEDS, SERVER_RULES } from "../builder/site-agent.mjs";
import {
  docsAllowed, docsText, readDocs, redactSecrets, errorLines, keyNames, schemaChange, mergeSchemaOps, keepsEverything,
  callRequest, callAnswer, DOCS_HOSTS, DOCS_MAX_CHARS,
} from "../builder/agent-server-tools.mjs";
import { dryRunServerParts } from "../builder/server-dryrun.mjs";

const PAGES = [{ path: "index.tsx", source: "export default function Home(){return <h1>Home</h1>}" }];
const FN = `export const hosts = [];
export default async function (request: Request, site: any) {
  const u = new URL(request.url);
  const b = request.method === "GET" ? {} : await request.json();
  if (!b.email && !u.searchParams.get("email")) return Response.json({ error: "email is required" }, { status: 400 });
  const rows = await site.sql("insert into signups (email) values (?)", [b.email]);
  return Response.json({ ok: true, email: b.email || u.searchParams.get("email"), rows: rows.length });
}`;
const PARTS = [{ name: "site-footer", source: "export default function F(){return <footer/>}" }, { name: "server-signup", source: FN }];
const SPEC = { tables: [{ name: "signups", columns: [{ name: "email", type: "text" }, { name: "name", type: "text" }] }] };
const use = (name, input, id) => ({ type: "tool_use", name, input, ...(id ? { id } : {}) });
const answer = (...uses) => ({ content: uses, usage: { input_tokens: 100, output_tokens: 20 }, stop_reason: "tool_use" });
function scripted(rounds) {
  const sent = []; let i = 0;
  return { sent, send: async (req) => { sent.push(JSON.parse(JSON.stringify(req))); return rounds[Math.min(i++, rounds.length - 1)]; } };
}
const results = (sent) => sent.at(-1).messages.flatMap((m) => (Array.isArray(m.content) ? m.content : [])).filter((b) => b.type === "tool_result");
const NAMES = ["call_function", "read_errors", "list_keys", "change_schema", "read_docs"];

// ── gating ───────────────────────────────────────────────────────────────────
test("ST1 each server tool is offered only when its dependency is wired", () => {
  for (const n of NAMES) assert.ok(AGENT_TOOLS.some((t) => t.name === n), n + " is defined");
  const none = toolsFor({}).map((t) => t.name);
  for (const n of NAMES) assert.ok(!none.includes(n), n + " not offered unwired");
  const deps = { callFunction() {}, readErrors() {}, listKeys() {}, applySchema() {}, fetchDocs() {} };
  const all = toolsFor(deps).map((t) => t.name);
  for (const n of NAMES) assert.ok(all.includes(n), n + " offered when wired");
  for (const n of NAMES) {
    const one = { [TOOL_NEEDS[n]]: () => {} };
    assert.deepEqual(toolsFor(one).map((t) => t.name).filter((x) => NAMES.includes(x)), [n]);
  }
  assert.ok(Object.isFrozen(AGENT_TOOLS));
});

test("ST2 the tools a run offers are the same every round (frozen per caller)", async () => {
  const s = scripted([answer(use("list_keys", {})), answer(use("finish", { summary: "keys read" }))]);
  await runSiteAgent({ send: s.send, build: async () => ({ ok: true }), listKeys: async () => [{ name: "STRIPE_KEY" }] }, { request: "r", pages: PAGES, parts: PARTS });
  const names = s.sent.map((r) => JSON.stringify(r.tools.map((t) => t.name)));
  assert.equal(new Set(names).size, 1);
  assert.ok(names[0].includes("list_keys") && !names[0].includes("read_errors"));
});

// ── list_keys ────────────────────────────────────────────────────────────────
test("ST3 list_keys answers names only: a value the reader hands back never reaches the model", async () => {
  const secret = ["sk", "live", "51HxYzVerySecretValue000"].join("_");
  const s = scripted([answer(use("list_keys", {})), answer(use("finish", { summary: "ok" }))]);
  const r = await runSiteAgent({ send: s.send, build: async () => ({ ok: true }),
    listKeys: async () => [{ name: "STRIPE_SECRET_KEY", value: secret, cipher: secret, hint: { last4: "0000" } }, secret, { name: "lower" }, "RESEND_KEY"] }, { request: "r", pages: PAGES, parts: PARTS });
  const res = results(s.sent).find((b) => /names only/.test(b.content));
  assert.ok(res, "the list came back");
  assert.match(res.content, /RESEND_KEY, STRIPE_SECRET_KEY/);
  assert.ok(!JSON.stringify(s.sent).includes(secret), "no value anywhere in what was sent");
  assert.ok(!JSON.stringify(s.sent).includes("0000"));
  assert.equal(r.ok, true);
  assert.deepEqual(keyNames([]), []);
});

test("ST4 list_keys with none set, and a failing reader, answer in words", async () => {
  const s = scripted([answer(use("list_keys", {}), use("list_keys", {}, "b")), answer(use("finish", { summary: "ok" }))]);
  let n = 0;
  await runSiteAgent({ send: s.send, build: async () => ({ ok: true }), listKeys: async () => { if (n++) throw new Error("boom"); return []; } }, { request: "r", pages: PAGES, parts: PARTS });
  const rs = results(s.sent);
  assert.match(rs[0].content, /no keys/);
  assert.equal(rs[1].is_error, true);
});

// ── read_errors ──────────────────────────────────────────────────────────────
test("ST5 read_errors: newest first, capped, cut, key-shaped text hidden, the limit passed on", async () => {
  const rows = Array.from({ length: 60 }, (_, i) => ({ id: i + 1, at: "2026-10-30 10:00:" + i, message: "fail " + (i + 1) + " " + "x".repeat(500), route: "fn/pay", source: "server" }));
  rows[59].message = "stripe said " + ["sk", "live", "51HabcdefghijklmnopQRS"].join("_") + " and Bearer abcdefghijkl12345";
  let asked = 0;
  const s = scripted([answer(use("read_errors", { limit: 999 })), answer(use("finish", { summary: "ok" }))]);
  await runSiteAgent({ send: s.send, build: async () => ({ ok: true }), readErrors: async (n) => { asked = n; return rows; } }, { request: "r", pages: PAGES, parts: PARTS });
  assert.equal(asked, 50);
  const t = results(s.sent)[0].content;
  assert.match(t, /newest first \(50\)/);
  assert.ok(t.indexOf("stripe said") < t.indexOf("fail 59"), "newest first");
  assert.ok(!t.includes(["sk", "live", "51Habc"].join("_")) && !/Bearer abcdef/.test(t));
  assert.ok(!t.includes("x".repeat(400)), "messages are cut");
  assert.match(errorLines([]), /empty/);
});

// ── read_docs ────────────────────────────────────────────────────────────────
test("ST6 read_docs refuses every host off the list, before any fetch", async () => {
  let fetched = 0;
  const f = async () => { fetched++; return { status: 200, body: "<p>x</p>" }; };
  for (const u of ["https://evil.example/docs", "http://docs.stripe.com/api", "https://stripe.com/blog", "https://docs.stripe.com.evil.example/", "https://evildocs.stripe.com/x", "https://xstripe.com/docs/x", "https://user:pw@docs.stripe.com/", "https://supabase.com/docsx", "file:///etc/passwd", "not a url", "https://docs.stripe.com:8443/"]) {
    const r = await readDocs(f, u);
    assert.ok(r.error, u + " refused");
  }
  assert.equal(fetched, 0);
  for (const h of DOCS_HOSTS) assert.ok(docsAllowed("https://" + h.host + (h.prefix || "") + "/x").ok, h.host);
});

test("ST7 read_docs: readable text, scripts out, cut at the limit, a redirect off the list refused", async () => {
  const html = "<html><head><style>p{}</style><script>alert('x')</script></head><body><h1>Webhooks</h1><p>Verify the &quot;Stripe-Signature&quot; header &amp; more.</p>" + "<p>word</p>".repeat(10000) + "</body></html>";
  const ok = await readDocs(async (url) => ({ status: 200, url, body: html }), "https://docs.stripe.com/webhooks");
  assert.ok(ok.text.includes("Verify the \"Stripe-Signature\" header & more."));
  assert.ok(!/alert|<p>|p\{\}/.test(ok.text));
  assert.ok(ok.text.length <= DOCS_MAX_CHARS + 200);
  assert.equal(ok.host, "docs.stripe.com");
  const moved = await readDocs(async () => ({ status: 200, url: "https://evil.example/", body: "<p>x</p>" }), "https://docs.stripe.com/x");
  assert.ok(moved.error);
  const notFound = await readDocs(async (url) => ({ status: 404, url, body: "" }), "https://docs.stripe.com/x");
  assert.match(notFound.error, /404/);
  assert.equal(docsText("<p>a</p><script>b</script>"), "a");
});

test("ST8 read_docs through the agent: wired fetch called with the judged URL", async () => {
  const seen = [];
  const s = scripted([answer(use("read_docs", { url: "https://resend.com/docs/api-reference/emails/send-email#x" }), use("read_docs", { url: "https://example.com/" }, "b")), answer(use("finish", { summary: "ok" }))]);
  await runSiteAgent({ send: s.send, build: async () => ({ ok: true }), fetchDocs: async (u) => { seen.push(u); return { status: 200, url: u, body: "<p>Send an email</p>" }; } }, { request: "r", pages: PAGES, parts: PARTS });
  assert.deepEqual(seen, ["https://resend.com/docs/api-reference/emails/send-email"]);
  const rs = results(s.sent);
  assert.match(rs[0].content, /Send an email/);
  assert.equal(rs[1].is_error, true);
});

// ── change_schema ────────────────────────────────────────────────────────────
test("ST9 change_schema refuses destructive input in code", () => {
  const t = SPEC.tables.map((x) => ({ name: x.name, columns: x.columns.map((c) => c.name) }));
  for (const bad of [
    { table: "signups", drop: ["email"] }, { table: "signups", drop_columns: ["email"] }, { table: "signups", rename: { email: "mail" } },
    { table: "signups", alter_columns: [{ name: "email", type: "int" }] }, { table: "signups", change_type: {} }, { table: "signups", truncate: true }, { table: "signups", add_columns: [{ name: "x" }], drop: ["email"] }, { table: "signups", add_columns: [{ name: "x" }], rename_columns: { name: "n" } },
    { table: "signups", add_columns: [{ name: "email", type: "int" }] }, // an existing column's type
    { table: "signups", create: { columns: [{ name: "a" }] } }, // replacing an existing table
    { table: "signups", add_columns: [{ name: "x", type: "text", drop: true }] },
    { table: "signups", add_columns: [{ name: "x; drop table signups", type: "text" }] },
    { table: "signups", add_columns: [{ name: "x", type: "text references users" }] },
    { table: "signups", add_columns: [{ name: "id", type: "text" }] },
    { table: "nope", add_columns: [{ name: "x" }] },
    { table: "signups" },
    { table: "Bad-Name", create: { columns: [{ name: "a" }] } },
  ]) assert.equal(schemaChange(bad, t).ok, false, JSON.stringify(bad));
  const ok = schemaChange({ table: "signups", add_columns: [{ name: "source", type: "text" }, { name: "count", type: "INT" }] }, t);
  assert.deepEqual(ok, { ok: true, op: { table: "signups", add: [{ name: "source", type: "text" }, { name: "count", type: "int" }] } });
  const mk = schemaChange({ table: "webhook_events", create: { columns: [{ name: "event_id", type: "text" }] } }, t);
  assert.deepEqual(mk.op.create, { columns: [{ name: "event_id", type: "text" }], access: "owner" });
});

test("ST10 the merged schema keeps every stored table and column, and its guard catches a loss", () => {
  const m = mergeSchemaOps(SPEC, [{ table: "signups", add: [{ name: "source", type: "text" }] }, { table: "events", create: { columns: [{ name: "event_id", type: "text" }], access: "owner" } }, { table: "signups", add: [{ name: "email", type: "int" }] }]);
  assert.deepEqual(m.spec.tables.find((t) => t.name === "signups").columns.map((c) => c.name), ["email", "name", "source"]);
  assert.equal(m.spec.tables.find((t) => t.name === "signups").columns[0].type, "text");
  assert.ok(m.spec.tables.some((t) => t.name === "events"));
  assert.ok(keepsEverything(SPEC, m.spec));
  assert.deepEqual(m.skipped, ["signups"], "the colliding addition is named, not made");
  assert.deepEqual(m.added, ["signups(source)", "events"]);
  assert.equal(keepsEverything(SPEC, { tables: [] }), false);
  assert.equal(keepsEverything(SPEC, { tables: [{ name: "signups", columns: [{ name: "email", type: "text" }] }] }), false);
  assert.equal(keepsEverything(SPEC, { tables: [{ name: "signups", columns: [{ name: "email", type: "int" }, { name: "name", type: "text" }] }] }), false);
  assert.deepEqual(SPEC.tables[0].columns.length, 2, "the stored spec is not mutated");
});

test("ST11 change_schema through the agent: queued, handed back, and change_rows may then use the new column", async () => {
  const s = scripted([
    answer(use("change_schema", { table: "signups", add_columns: [{ name: "source", type: "text" }] }), use("change_schema", { table: "signups", drop: ["name"] }, "b")),
    answer(use("change_rows", { table: "signups", add: [{ email: "a@b.c", source: "web" }] })),
    answer(use("finish", { summary: "added source" })),
  ]);
  let applied = 0;
  const r = await runSiteAgent({ send: s.send, build: async () => ({ ok: true }), applySchema: async () => { applied++; } }, { request: "r", pages: PAGES, parts: PARTS, spec: SPEC });
  assert.equal(r.ok, true);
  assert.deepEqual(r.schema, [{ table: "signups", add: [{ name: "source", type: "text" }] }]);
  assert.equal(r.rows.length, 1);
  assert.equal(applied, 0, "applied by the caller after finish, never mid-run");
  const rs = results(s.sent);
  assert.equal(rs.find((b) => b.tool_use_id === "b").is_error, true);
  // unwired: refused
  const s2 = scripted([answer(use("change_schema", { table: "signups", add_columns: [{ name: "x" }] })), answer(use("finish", { summary: "x" }))]);
  const r2 = await runSiteAgent({ send: s2.send, build: async () => ({ ok: true }) }, { request: "r", pages: PAGES, parts: PARTS, spec: SPEC });
  assert.deepEqual(r2.schema, []);
});

// ── call_function ────────────────────────────────────────────────────────────
test("ST12 call_function judges the call: a function in the workspace, a method, no body on GET", () => {
  const names = PARTS.map((p) => p.name);
  assert.equal(callRequest({ name: "nope" }, names).ok, false);
  assert.equal(callRequest({ name: "site-footer" }, names).ok, false);
  assert.equal(callRequest({ name: "signup", method: "TRACE" }, names).ok, false);
  assert.equal(callRequest({ name: "signup", method: "GET", body: {} }, names).ok, false);
  const ok = callRequest({ name: "server-signup", body: { email: "a@b.c" }, query: { x: 1 } }, names);
  assert.deepEqual(ok.call, { name: "signup", method: "POST", body: "{\"email\":\"a@b.c\"}", query: { x: "1" }, json: true });
});

test("ST13 call_function through the agent hands the server parts and the call to the wired runner", async () => {
  const seen = [];
  const s = scripted([answer(use("call_function", { name: "signup", body: { email: "a@b.c" } }), use("call_function", { name: "ghost" }, "b")), answer(use("finish", { summary: "tried" }))]);
  await runSiteAgent({ send: s.send, build: async () => ({ ok: true }), callFunction: async (parts, call) => { seen.push({ parts: parts.map((p) => p.name), call }); return { ran: true, results: [{ name: "signup", ok: true, status: 200, body: "{\"ok\":true}", sql: ["insert"] }] }; } }, { request: "r", pages: PAGES, parts: PARTS });
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0].parts, ["server-signup"]);
  const rs = results(s.sent);
  assert.match(rs[0].content, /Status 200/);
  assert.match(rs[0].content, /test sandbox/);
  assert.equal(rs[1].is_error, true);
  assert.match(callAnswer({ ran: false, why: "timed out" }).error, /timed out/);
});

test("ST14 call_function on the real server-test sandbox returns the function's own response", async (t) => {
  let ts;
  try { ts = (await import("typescript")).default; } catch { t.skip("no typescript"); return; }
  const two = [...PARTS, { name: "server-other", source: "export const hosts = [];\nexport default async function () { return new Response('other'); }" }];
  const good = await dryRunServerParts(two, { ts, call: { name: "signup", method: "POST", body: JSON.stringify({ email: "a@b.c" }), query: {}, json: true } });
  assert.equal(good.ran, true);
  assert.equal(good.results.length, 1, "only the called function ran");
  const x = good.results[0];
  assert.equal(x.status, 200);
  assert.deepEqual(JSON.parse(x.body), { ok: true, email: "a@b.c", rows: 0 });
  assert.equal(x.sql.length, 1, "the write went to the stand-in database");
  const bad = await dryRunServerParts(PARTS, { ts, call: { name: "signup", method: "GET", body: null, query: {}, json: true } });
  assert.equal(bad.results[0].status, 400);
  const a = callAnswer(good);
  assert.match(a.text, /Status 200/);
  assert.match(a.text, /a@b\.c/);
});

// ── counting and facts ───────────────────────────────────────────────────────
test("ST15 each server tool is counted under its own key, numbers only, and named in the round's facts", () => {
  const c = toolCounts(NAMES.map((n) => ({ name: n, input: {} })));
  assert.deepEqual(c, { fnCalls: 1, errorReads: 1, keyLists: 1, schemaChanges: 1, docReads: 1 });
  const f = roundFacts([
    { use: { name: "call_function", input: { name: "signup" } }, r: { text: "x" } },
    { use: { name: "read_errors", input: {} }, r: { text: "x" } },
    { use: { name: "list_keys", input: {} }, r: { text: "x" } },
    { use: { name: "read_docs", input: { url: "u" } }, r: { text: "x", host: "docs.stripe.com" } },
    { use: { name: "change_schema", input: { table: "signups" } }, r: { text: "x" } },
  ]).map((x) => x.text).join(" ");
  for (const w of ["signup", "error log", "keys", "docs.stripe.com", "signups"]) assert.ok(f.includes(w), w);
});

// ── the owner's five rules ───────────────────────────────────────────────────
test("ST16 the server-code rules are in every agent's opening, saying each of the five things", () => {
  const sys = agentSystem(null, "");
  assert.ok(sys.includes(SERVER_RULES), "the rules reach the system text");
  const r = SERVER_RULES;
  // 1. security: who is calling, validation, no key in page code, rate limit
  assert.match(r, /who is calling/i); assert.match(r, /validate every input/i); assert.match(r, /never put a key[^.]*page code/i); assert.match(r, /429/);
  // 2. keys: owner's key from the site's secrets; name the missing one in finish
  assert.match(r, /owner's own key/i); assert.match(r, /missing[\s\S]{0,200}finish names exactly which key/i); assert.match(r, /never build something that fails silently/i);
  // 3. webhooks: verify; idempotent by event id
  assert.match(r, /site\.verify/); assert.match(r, /event's id[\s\S]{0,120}(already stored|never done twice)/i);
  // 4. schema: add, never destroy; say what is needed
  assert.match(r, /add, never destroy/i); assert.match(r, /never drop, rename or change the type/i); assert.match(r, /could lose data is not made/i);
  // 5. errors: clear error + logged to the site's error log (_errors)
  assert.match(r, /clear status/i); assert.match(r, /_errors/);
});

test("ST17 the worker wires each tool to its dependency, and the container answers /agent-call", () => {
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const start = w.indexOf("async function runAgentChange(");
  const end = w.indexOf("\n}\n", start);
  assert.ok(start > 0 && end > start);
  const body = w.slice(start, end);
  for (const k of ["callFunction: agentCall(env, slug)", "fetchDocs: agentFetchDocs", "readErrors: agentReadErrors", "listKeys: agentListKeys", "applySchema:"]) assert.ok(body.includes(k), k);
  assert.match(body, /applyAgentSchema\(env, slug, conn, schemaOps, job\)/);
  const keys = w.slice(w.indexOf("function agentListKeys("), w.indexOf("function agentListKeys(") + 600);
  assert.match(keys, /SELECT name FROM _secrets/);
  assert.ok(!/cipher|hint/.test(keys.replace(/\/\*\*[\s\S]*?\*\//, "")), "only the name column is selected");
  const fb = w.slice(w.indexOf("agentWrite: agentTakes()"), w.indexOf("generate: async () =>", w.indexOf("agentWrite: agentTakes()")));
  assert.ok(fb.includes("callFunction: agentCall(env, slug)") && fb.includes("fetchDocs: agentFetchDocs"));
  const bs = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
  const at = bs.indexOf('req.url === "/agent-call"');
  assert.ok(at > 0 && /dryRunServerParts\(sp,[\s\S]{0,120}call:/.test(bs.slice(at, at + 1500)));
});
