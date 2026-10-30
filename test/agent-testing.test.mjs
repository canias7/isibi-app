// THE SITE AGENT'S TESTING (2026-10-30, `run_tests`): the tool is offered only
// when wired, test files live under "-tests/" and are never published, a real
// run executes an agent-written test in the sandboxed child (a function, a page
// in real Chromium, outbound interception, a signed webhook, a schedule),
// failures come back by name, and existing tests run again before finish.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import { toolsFor, writableKey, makeWorkspace, runSiteAgent, agentSystem, AGENT_TOOLS, TOOL_NEEDS } from "../builder/site-agent.mjs";
import { isTestKey, cleanTests, testRefusal, testReport, TESTING_RULES, TESTS_KEY } from "../builder/site-tests.mjs";
import { runSiteTests } from "../builder/test-runner.mjs";
import { makeTestDb } from "../builder/test-db.mjs";

const EXE = "/opt/pw-browsers/chromium";
const BROWSER = !!process.env.CHROMIUM_PATH || fs.existsSync(EXE);
if (!process.env.CHROMIUM_PATH && fs.existsSync(EXE)) process.env.CHROMIUM_PATH = EXE;

// ── 1. GATING ────────────────────────────────────────────────────────────────
test("run_tests is offered only when the caller wires runTests", () => {
  assert.ok(AGENT_TOOLS.some((t) => t.name === "run_tests"), "the tool exists");
  assert.equal(TOOL_NEEDS.run_tests, "runTests");
  assert.ok(!toolsFor({}).some((t) => t.name === "run_tests"));
  assert.ok(toolsFor({ runTests: () => ({}) }).some((t) => t.name === "run_tests"));
});

test("the testing rules join the agent's rules only when tests can run", () => {
  assert.ok(!agentSystem(null, "", {}).includes("TESTING WHAT YOU BUILD"));
  assert.ok(agentSystem(null, "", { testing: true }).includes(TESTING_RULES.trim().slice(0, 40)));
  for (const name of ["site.call", "page(", "db.query", "outbound.calls", "outbound.fake", "webhook(", "runSchedule("]) assert.ok(TESTING_RULES.includes(name), name);
});

// ── 2. KEYS AND THE PUBLISH ──────────────────────────────────────────────────
test("writableKey accepts -tests files and nothing like them", () => {
  assert.equal(writableKey("-tests/booking.test.ts").ok, true);
  assert.equal(writableKey("-tests/booking.test.js").ok, true);
  for (const bad of ["-tests/booking.ts", "-tests/../x.test.ts", "-tests/a/b.test.ts", "-tests/.test.ts", "tests/booking.test.ts"]) assert.equal(writableKey(bad).ok, false, bad);
  assert.ok(isTestKey("-tests/x.test.ts") && !isTestKey("-parts/x"));
});

test("a workspace keeps tests apart: never a page or a part, so never published", () => {
  const ws = makeWorkspace([{ path: "index.tsx", source: "x" }], [{ name: "hero", source: "y" }], null, [{ name: "-tests/a.test.ts", source: "test('a', () => {})" }]);
  ws.set("-tests/b.test.js", "test('b', () => {})");
  assert.deepEqual(ws.pages().map((p) => p.path), ["index.tsx"]);
  assert.deepEqual(ws.parts().map((p) => p.name), ["hero"]);
  assert.deepEqual(ws.tests().map((t) => t.name).sort(), ["-tests/a.test.ts", "-tests/b.test.js"]);
  assert.equal(TESTS_KEY("Foo"), "source/foo/tests.json");
  // The shell writes only pages and parts into the build's routes.
  const shell = fs.readFileSync(new URL("../builder/agent-shell.mjs", import.meta.url), "utf8");
  assert.ok(!/-tests/.test(shell.slice(shell.indexOf("export function writeSiteFiles"), shell.indexOf("export function readSiteFiles"))));
});

test("the publish path is handed pages and parts only: tests never reach the served bundle", () => {
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const a = src.indexOf("async function runAgentChange("), b = src.indexOf("\n}\n", a);
  assert.ok(a > 0 && b > a);
  const body = src.slice(a, b);
  assert.ok(/saveSiteTests\(/.test(body), "tests are stored with the site");
  assert.ok(!/recompileAndPublish\([^)]*tests/.test(body), "the publish never carries tests");
  // The test-runner's private copy is written with pages and parts only.
  const r = fs.readFileSync(new URL("../builder/test-runner.mjs", import.meta.url), "utf8");
  assert.match(r, /writeSiteFiles\(dir, \{ pages, parts, css \}/);
});

test("the container answers /agent-tests with the runner over a private copy, and the image carries the modules", () => {
  const bs = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
  const a = bs.indexOf('req.url === "/agent-tests"');
  assert.ok(a > 0);
  const body = bs.slice(a, bs.indexOf("return;\n  }", a));
  assert.match(body, /makePrivateSite\(/);
  assert.match(body, /runSiteTests\(\{[^\n]*tests: p\.tests[^\n]*serve \}\)/);
  const docker = fs.readFileSync(new URL("../Dockerfile", import.meta.url), "utf8").split("\n");
  const container = docker.find((l) => l.startsWith("COPY builder/build-server.mjs"));
  for (const f of ["test-runner.mjs", "test-runner-child.mjs", "test-db.mjs", "site-tests.mjs"]) assert.ok(container.includes("builder/" + f), f);
  assert.ok(docker.find((l) => l.includes("./worker/builder/") && l.includes("builder/site-agent.mjs")).includes("builder/site-tests.mjs"));
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(w, /new Request\("http:\/\/build\/agent-tests"/);
});

test("cleanTests keeps valid stored tests only; refusal stops imports and the process", () => {
  assert.deepEqual(cleanTests([{ name: "-tests/a.test.ts", source: "x" }, { name: "pages/a.tsx", source: "x" }, { name: "-tests/b.test.ts", source: " " }]).map((t) => t.name), ["-tests/a.test.ts"]);
  assert.ok(testRefusal("import fs from 'node:fs'"));
  assert.ok(testRefusal("const x = await import('node:net')"));
  assert.ok(testRefusal("require('fs')"));
  assert.ok(testRefusal("process.env.X"));
  assert.equal(testRefusal("test('important', () => {})"), "");
});

// ── 3. THE THROWAWAY DATABASE ────────────────────────────────────────────────
test("the test database answers the common SQL by meaning and refuses what it cannot", () => {
  const db = makeTestDb({ tables: [{ name: "bookings", columns: [{ name: "id", type: "serial" }, { name: "email", type: "text" }, { name: "places", type: "int" }] }] });
  const [row] = db.query("INSERT INTO bookings (email, places) VALUES (?, ?) RETURNING id, email", ["a@b.co", 2]);
  assert.equal(row.email, "a@b.co");
  assert.ok(row.id >= 1);
  db.query("INSERT INTO bookings (email, places) VALUES ($1, $2)", ["c@d.co", 5]);
  assert.equal(db.query("SELECT count(*) AS n FROM bookings WHERE places > ?", [1])[0].n, 2);
  assert.deepEqual(db.query("SELECT email FROM bookings ORDER BY places DESC LIMIT 1"), [{ email: "c@d.co" }]);
  db.query("UPDATE bookings SET places = ? WHERE email = ?", [9, "a@b.co"]);
  assert.equal(db.rows("bookings").find((r) => r.email === "a@b.co").places, 9);
  db.query("DELETE FROM bookings WHERE email = ?", ["c@d.co"]);
  assert.equal(db.rows("bookings").length, 1);
  assert.throws(() => db.query("SELECT a FROM bookings JOIN x ON true WHERE a ~ 'x'"), /does not understand|does not exist/);
  db.on(/JOIN/, [{ a: 1 }]);
  assert.deepEqual(db.query("SELECT a FROM bookings JOIN x ON true"), [{ a: 1 }]);
});

// ── 4. A REAL RUN ────────────────────────────────────────────────────────────
const BOOK = `
export const hosts = ["api.resend.com"];
export default async function (request, site) {
  if (request.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405 });
  const b = await request.json().catch(() => null);
  if (!b || typeof b.email !== "string" || !b.email.includes("@")) return new Response(JSON.stringify({ error: "email" }), { status: 400 });
  const [row] = await site.sql("INSERT INTO bookings (email, places) VALUES (?, ?) RETURNING id", [b.email, Number(b.places) || 1]);
  const r = await site.fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: "Bearer " + site.key("RESEND_API_KEY"), "content-type": "application/json" }, body: JSON.stringify({ to: b.email, subject: "Booked" }) });
  if (!r.ok) return new Response(JSON.stringify({ error: "mail" }), { status: 502 });
  return new Response(JSON.stringify({ ok: true, id: row.id }), { status: 200, headers: { "content-type": "application/json" } });
}`;
const HOOK = `
export default async function (request, site) {
  const raw = await request.text();
  const ok = await site.verify("PAY_SECRET", raw, request.headers.get("x-signature") || "");
  if (!ok) return new Response("bad signature", { status: 400 });
  const ev = JSON.parse(raw);
  await site.sql("UPDATE bookings SET paid = ? WHERE id = ?", [true, ev.id]);
  return new Response("ok");
}`;
const TICK = `
export const on = ["tick"];
export default async function (request, site) {
  await site.sql("DELETE FROM bookings WHERE paid IS NULL");
  return new Response("swept");
}`;
const PARTS = [{ name: "server-book", source: BOOK }, { name: "server-paid", source: HOOK }, { name: "server-sweep", source: TICK }];
const TABLES = [{ name: "bookings", columns: [{ name: "id", type: "serial" }, { name: "email", type: "text" }, { name: "places", type: "int" }, { name: "paid", type: "boolean" }] }];
const AGENT_TEST = `
test("a booking is stored and confirmed by email", async () => {
  outbound.fake("api.resend.com", { status: 200, body: { id: "em_1" } });
  const r = await site.call("book", { method: "POST", body: { email: "ann@example.com", places: 2 } });
  expect(r.status).toBe(200);
  expect(r.json.ok).toBe(true);
  expect(db.rows("bookings")).toHaveLength(1);
  const sent = outbound.calls("resend");
  expect(sent).toHaveLength(1);
  expect(JSON.parse(sent[0].body).to).toBe("ann@example.com");
  expect(sent[0].headers.authorization).toBe("[redacted]");
});
test("a bad email is refused and nothing is sent", async () => {
  const r = await site.call("book", { method: "POST", body: { email: "nope" } });
  expect(r.status).toBe(400);
  expect(outbound.calls()).toHaveLength(0);
});
test("the mail service failing answers 502", async () => {
  outbound.fake(/resend/, { status: 500, body: { error: "down" } });
  const r = await site.call("book", { method: "POST", body: { email: "a@b.co" } });
  expect(r.status).toBe(502);
});
test("a signed webhook marks it paid; an unsigned one is refused", async () => {
  db.seed("bookings", [{ id: 7, email: "x@y.z" }]);
  const bad = await webhook("paid", { id: 7 });
  expect(bad.status).toBe(400);
  const forged = await webhook("paid", { id: 7 }, { headers: { "x-signature": "00ff" } });
  expect(forged.status).toBe(400);
  const good = await webhook("paid", { id: 7 }, { sign: "PAY_SECRET" });
  expect(good.status).toBe(200);
  expect(db.rows("bookings")[0].paid).toBe(true);
});
test("the tick sweeps unpaid bookings", async () => {
  db.seed("bookings", [{ id: 1, email: "a@b.co" }, { id: 2, email: "c@d.co", paid: true }]);
  const ran = await runSchedule("tick");
  expect(ran[0].status).toBe(200);
  expect(db.rows("bookings").map((r) => r.id)).toEqual([2]);
});
test("server code cannot reach the network itself", async () => {
  let threw = false;
  try { await fetch("https://example.com"); } catch { threw = true; }
  expect(threw).toBe(true);
});
`;
const PAGE_TEST = `
test("the form books through the page", async () => {
  outbound.fake("api.resend.com", { status: 200, body: {} });
  const p = await page("/");
  await p.fill("#email", "page@example.com");
  await p.click("#go");
  await p.waitFor("#done");
  expect(await p.text("#done")).toMatch(/booked/i);
  expect(db.rows("bookings").map((r) => r.email)).toContain("page@example.com");
  expect(outbound.calls("resend")).toHaveLength(1);
  const shot = await p.screenshot();
  expect(shot.bytes).toBeGreaterThan(100);
  expect(await p.count("img.outside")).toBe(1);
});
`;
const HTML = `<!doctype html><html><body><input id="email"><button id="go">Book</button><img class="outside" src="https://example.com/x.png"><div id="out"></div>
<script>document.getElementById("go").onclick = async () => {
  const r = await fetch("/api/db/test-site/fn/book", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: document.getElementById("email").value }) });
  if (r.ok) document.getElementById("out").innerHTML = '<p id="done">Booked!</p>';
};</script></body></html>`;

function staticServe() {
  return async () => {
    const s = http.createServer((q, a) => { a.writeHead(200, { "content-type": "text/html" }); a.end(HTML); });
    await new Promise((ok) => s.listen(0, "127.0.0.1", ok));
    return { base: "http://127.0.0.1:" + s.address().port + "/", close: () => s.close() };
  };
}

test("a real run: functions, outbound interception, webhook, schedule, all in the sandbox", async () => {
  const r = await runSiteTests({ parts: PARTS, tables: TABLES, tests: [{ name: "-tests/booking.test.ts", source: AGENT_TEST }] });
  assert.equal(r.ran, true, r.why);
  const bad = r.results.filter((x) => !x.ok);
  assert.deepEqual(bad, [], JSON.stringify(bad));
  assert.equal(r.results.length, 6);
  assert.match(testReport(r), /All 6 passed/);
});

test("a real run drives a page in Chromium; its function calls reach the sandbox; other hosts are blocked", { skip: !BROWSER && "no Chromium here" }, async () => {
  const r = await runSiteTests({ parts: PARTS, tables: TABLES, tests: [{ name: "-tests/page.test.js", source: PAGE_TEST }], serve: staticServe() });
  assert.equal(r.ran, true, r.why);
  assert.deepEqual(r.results.filter((x) => !x.ok), []);
  assert.equal(r.results.length, 1);
  assert.ok(r.blocked.includes("example.com"), "the outside image was blocked, not fetched");
  assert.equal(r.shots.length, 1);
});

test("failures come back by test, with their message; a broken file and an import are reported", async () => {
  const src = `test("wrong status", async () => { const r = await site.call("book", { method: "POST", body: { email: "a@b.co" } }); expect(r.status).toBe(201); });
test("fine", () => { expect(1).toBe(1); });`;
  const r = await runSiteTests({ parts: PARTS, tables: TABLES, tests: [{ name: "-tests/a.test.ts", source: src }, { name: "-tests/b.test.js", source: "import fs from 'node:fs'; test('x', () => fs.readFileSync)" }] });
  assert.equal(r.ran, true);
  const wrong = r.results.find((x) => x.name === "wrong status");
  assert.equal(wrong.ok, false);
  assert.match(wrong.error, /200.*201/);
  assert.equal(r.results.find((x) => x.name === "fine").ok, true);
  assert.ok(r.results.some((x) => x.file === "-tests/b.test.js" && !x.ok && /imports nothing/.test(x.error)));
  assert.match(testReport(r), /2 of 3 FAILED/);
  const only = await runSiteTests({ parts: PARTS, tables: TABLES, tests: [{ name: "-tests/a.test.ts", source: src }], only: "fine" });
  assert.deepEqual(only.results.map((x) => [x.name, x.ok]), [["fine", true]]);
});

test("a run is capped: a test that never ends is stopped and reported", async () => {
  const r = await runSiteTests({ tests: [{ name: "-tests/hang.test.js", source: "test('hang', () => new Promise(() => {}));" }], testMs: 500, timeoutMs: 10000 });
  assert.equal(r.ran, true);
  assert.match(r.results[0].error, /did not end/);
  const r2 = await runSiteTests({ tests: [{ name: "-tests/spin.test.js", source: "test('spin', () => { for (;;) {} });" }], timeoutMs: 1500 });
  assert.equal(r2.timedOut, true);
  assert.ok(r2.results.some((x) => !x.ok && /cap/.test(x.error)));
});

// ── 5. THE AGENT LOOP: run_tests, and existing tests again before finish ─────
function scripted(rounds) {
  let i = 0;
  const seen = [];
  return { seen, send: async (req) => { seen.push(JSON.parse(JSON.stringify(req))); const c = rounds[Math.min(i++, rounds.length - 1)]; return { content: c.map((u, k) => ({ type: "tool_use", id: "u" + i + k, name: u[0], input: u[1] })), stop_reason: "tool_use", usage: {} }; } };
}
const buildOk = async () => ({ ok: true, text: "The build passed." });

test("run_tests hands the workspace's tests and server parts to the runner", async () => {
  const calls = [];
  const s = scripted([[["write_file", { file: "-tests/a.test.ts", source: "test('a', () => {})" }]], [["run_tests", {}]], [["finish", { summary: "ok" }]]]);
  const r = await runSiteAgent({ send: s.send, build: buildOk, runTests: async (w, o) => { calls.push({ w, o }); return { ran: true, ms: 1, results: [{ file: "-tests/a.test.ts", name: "a", ok: true, ms: 1 }] }; } },
    { request: "x", pages: [{ path: "index.tsx", source: "p" }], parts: [{ name: "server-book", source: BOOK }], model: "m" });
  assert.equal(r.ok, true, r.stopped);
  assert.equal(calls.length, 1, "run_tests ran once; finish did not re-run unchanged tests");
  assert.deepEqual(calls[0].w.tests.map((t) => t.name), ["-tests/a.test.ts"]);
  assert.ok(calls[0].w.parts.some((p) => p.name === "server-book"));
  assert.equal(calls[0].o.only, "");
  assert.deepEqual(r.tests.map((t) => t.name), ["-tests/a.test.ts"]);
  assert.equal(r.pages.length, 1, "a test is not a page");
  assert.match(s.seen[0].system.map((b) => b.text).join(""), /TESTING WHAT YOU BUILD/);
});

test("a later edit re-runs the site's existing tests before finish; a regression holds the finish once", async () => {
  const calls = [];
  const stored = [{ name: "-tests/booking.test.ts", source: "test('books', () => {})" }];
  const s = scripted([[["write_file", { file: "-parts/server-book", source: BOOK + "\n// changed" }]], [["build", {}]], [["finish", { summary: "changed" }]], [["finish", { summary: "changed; the booking test fails because …" }]]]);
  const r = await runSiteAgent({ send: s.send, build: buildOk, runTests: async (w) => { calls.push(w); return { ran: true, ms: 1, results: [{ file: "-tests/booking.test.ts", name: "books", ok: false, error: "expected 400 to be 200" }] }; } },
    { request: "x", pages: [{ path: "index.tsx", source: "p" }], parts: [{ name: "server-book", source: BOOK }], tests: stored, model: "m" });
  assert.equal(calls.length, 1, "the existing tests ran automatically at finish");
  assert.equal(calls[0].tests[0].name, "-tests/booking.test.ts");
  const held = s.seen[3].messages.at(-1).content.find((b) => b.type === "tool_result");
  assert.equal(held.is_error, true);
  assert.match(held.content, /FAIL .*books/);
  assert.match(held.content, /expected 400 to be 200/);
  assert.equal(r.ok, true, "finishing again is the agent's answer (it must explain)");
  assert.deepEqual(r.testRun && r.testRun.failed, 1);
});

test("no tests and no change to test: finish is not held and nothing runs", async () => {
  let n = 0;
  const s = scripted([[["finish", { summary: "nothing" }]]]);
  const r = await runSiteAgent({ send: s.send, build: buildOk, runTests: async () => { n++; return { ran: true, results: [] }; } }, { request: "x", pages: [{ path: "index.tsx", source: "p" }], parts: [], model: "m" });
  assert.equal(r.ok, true);
  assert.equal(n, 0);
});
