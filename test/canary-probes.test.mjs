// THE ROUTING-ONLY BATCH: EACH MESSAGE ROUTED ONCE BY THE REAL ROUTER, AND
// NOTHING EVER ACTED ON (the router audit, 2026-10-02, on the owner's word).
//
// What the owner asked for: a mode that cannot submit edits, add-ons, builds
// or publishes; all the audit's probes prepared for one batch; and the batch's
// own runtime checks before it spends, instead of a separate free press.
//
// WHAT THIS ESTABLISHES, AND WHAT IT CANNOT. The module's readers, its wall
// and its verdicts are driven directly; the real `scripts/edit-canary.mjs` is
// run end to end under the in-process network stub, with the committed batch,
// and every request it made is read back from the stub's log. It cannot show
// what a real router answers: the stub answers whatever the case supplies, and
// those answers prove the harness, never the model.
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import {
  readProbeBox, batchPath, readProbeBatch, probeCallAllowed, assertProbeCall, probeFetchAllowed, guardFetch,
  decisionReadable, probeVerdict, probeBody, readProbePages, routeProbes, probesCost, probesReport, answerSaid,
  MAX_PROBES, PROBE_DIR, PROBE_COST_MAX, ROUTE_PATH,
} from "../scripts/canary-probes.mjs";
import { MAX_MESSAGE } from "../builder/site-ask.mjs";

const REPO = path.resolve(new URL("..", import.meta.url).pathname);
const BATCH = "router-audit-1";
const BATCH_TEXT = readFileSync(path.join(REPO, batchPath(BATCH)), "utf8");
const CANARY_SRC = readFileSync(path.join(REPO, "scripts/edit-canary.mjs"), "utf8");
const FLOW = readFileSync(path.join(REPO, ".github/workflows/edit-canary.yml"), "utf8");
const OWN = (intent, layer) => ({ source: "model", reasons: [], raw: { intent, layer: layer || "none" } });

// ── THE BOX AND THE BATCH ──────────────────────────────────────────────────

test("the box takes a committed batch's name and nothing that could name another path", () => {
  assert.deepEqual(readProbeBox(undefined), { ok: true, name: null });
  assert.deepEqual(readProbeBox("   "), { ok: true, name: null });
  assert.deepEqual(readProbeBox(" router-audit-1 "), { ok: true, name: "router-audit-1" });
  for (const bad of ["../secrets", "router audit", "Router-Audit", "a/b", "x.json", "-x", "a".repeat(42)]) {
    assert.equal(readProbeBox(bad).ok, false, `"${bad}" was accepted`);
  }
  assert.equal(readProbeBox(["router-audit-1"]).ok, false, "a non-string was read as a name");
  assert.equal(batchPath("router-audit-1"), `${PROBE_DIR}/router-audit-1.json`);
});

test("the committed batch reads whole: all eighteen probes, each id once, and its sha256", () => {
  const r = readProbeBatch(BATCH_TEXT, BATCH);
  assert.ok(r.ok, r.msg);
  assert.equal(r.batch.probes.length, 18);
  assert.ok(r.batch.probes.length <= MAX_PROBES);
  assert.equal(new Set(r.batch.probes.map((p) => p.id)).size, 18);
  assert.match(r.sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual([...new Set(r.batch.probes.map((p) => p.site))].sort(), ["fold-lane-bakery", "fretwork-1"]);
  assert.equal(r.batch.probes.filter((p) => p.attached).map((p) => p.id).join(), "F1", "only F1 carries the attached flag");
});

test("the batch follows the owner's policy: an addition's intended answer is the add-on path, or holds the addition back", () => {
  // "all new additions belong to the add-on path, including new menu links,
  // footer links and header buttons" — so no alternative under that basis may
  // name an edit unless it holds a part back, and nothing anywhere expects nav.
  const { batch } = readProbeBatch(BATCH_TEXT, BATCH);
  const policy = batch.probes.filter((p) => p.basis.startsWith("owner policy"));
  assert.ok(policy.length >= 8, "the policy probes are gone, so this would pass on nothing");
  for (const p of policy) {
    assert.ok(Array.isArray(p.intended) && p.intended.length, `${p.id} has no intended outcome under the policy`);
    for (const alt of p.intended) {
      assert.ok(alt.intent === "addon" || alt.alsoAsked === "some", `${p.id} expects ${JSON.stringify(alt)}: an edit for an addition`);
    }
  }
  for (const id of ["A1", "A2", "A3", "A4", "A5", "B1", "B2"]) {
    const p = batch.probes.find((x) => x.id === id);
    assert.deepEqual(p.intended, [{ intent: "addon", alsoAsked: "none" }], `${id} is not intended for the add-on path alone`);
  }
  for (const p of batch.probes) for (const alt of p.intended || []) assert.notEqual(alt.layer, "nav", `${p.id} expects nav`);
  for (const id of ["E1", "E2", "G1", "G2"]) assert.equal(batch.probes.find((x) => x.id === id).intended, null, `${id} has an outcome the owner has not set`);
});

test("a batch that is not exactly right refuses, whole", () => {
  const base = JSON.parse(BATCH_TEXT);
  const probe = base.probes[0];
  const bad = (mut) => { const j = JSON.parse(JSON.stringify(base)); mut(j); return readProbeBatch(JSON.stringify(j), BATCH); };
  assert.equal(readProbeBatch("not json", BATCH).ok, false);
  assert.equal(readProbeBatch(BATCH_TEXT, "another-name").ok, false, "a file naming another batch was read");
  const cases = {
    "no probes": (j) => { j.probes = []; },
    "too many probes": (j) => { j.probes = Array.from({ length: MAX_PROBES + 1 }, (_, i) => ({ ...probe, id: "X" + i })); },
    "an id twice": (j) => { j.probes[1].id = j.probes[0].id; },
    "an unknown field": (j) => { j.probes[0].layer = "nav"; },
    "a lowercase id": (j) => { j.probes[0].id = "p0"; },
    "a bad slug": (j) => { j.probes[0].site = "Fold Lane"; },
    "an empty message": (j) => { j.probes[0].message = "  "; },
    "a message too long": (j) => { j.probes[0].message = "x".repeat(MAX_MESSAGE + 1); },
    "attached as text": (j) => { j.probes[0].attached = "yes"; },
    "no basis": (j) => { delete j.probes[0].basis; },
    "intended neither null nor a list": (j) => { j.probes[0].intended = { intent: "addon" }; },
    "an empty list of answers": (j) => { j.probes[0].intended = []; },
    "five answers": (j) => { j.probes[0].intended = Array.from({ length: 5 }, () => ({ intent: "addon" })); },
    "an unknown answer field": (j) => { j.probes[0].intended = [{ intent: "addon", kind: "row" }]; },
    "an unknown intent": (j) => { j.probes[0].intended = [{ intent: "redesign" }]; },
    "a layer without an edit": (j) => { j.probes[0].intended = [{ intent: "addon", layer: "data" }]; },
    "an unknown layer": (j) => { j.probes[0].intended = [{ intent: "edit", layer: "menu" }]; },
    "a page that is not a path": (j) => { j.probes[0].intended = [{ intent: "edit", layer: "look", page: "gallery" }]; },
    "remove as text": (j) => { j.probes[0].intended = [{ intent: "edit", layer: "page", remove: "true" }]; },
    "held back as a word": (j) => { j.probes[0].intended = [{ intent: "addon", alsoAsked: "yes" }]; },
    "an answer naming nothing": (j) => { j.probes[0].intended = [{}]; },
  };
  for (const [what, mut] of Object.entries(cases)) assert.equal(bad(mut).ok, false, `${what} was accepted`);
});

// ── THE WALL ───────────────────────────────────────────────────────────────

test("the wall allows the runtime reads, a page list and the routing call, and nothing else", () => {
  for (const [m, p] of [["GET", "/api/site/build-health"], ["GET", "/api/site/runtime?slug=fretwork-1"], ["GET", "/api/site/routes?slug=fold-lane-bakery"], ["POST", "/api/site/route"], ["post", ROUTE_PATH]]) {
    assert.equal(probeCallAllowed(m, p), true, `${m} ${p} was refused`);
  }
  const forbidden = [
    ["POST", "/api/site/fold-lane-bakery/edit"], ["POST", "/api/site/fold-lane-bakery/addon"], ["POST", "/api/site/react-build"],
    ["POST", "/api/site/fold-lane-bakery/versions/restore"], ["POST", "/api/site/fold-lane-bakery/rename"], ["POST", "/api/site/fold-lane-bakery/publish"],
    ["GET", "/api/site/edit/" + "a".repeat(32)], ["GET", "/api/site/source?slug=x"], ["GET", "/api/site/fold-lane-bakery/versions"],
    ["PATCH", "/api/db/fold-lane-bakery/rows/loaves"], ["DELETE", "/api/site/route"], ["PUT", "/api/site/route"],
    ["GET", "/api/site/route"], ["POST", "/api/site/route?x=1"], ["POST", "/api/site/route/"], ["GET", "/api/site/routes?slug=../x"],
    ["GET", "/api/site/runtime?slug=a&next=/edit"], ["GET", "/api/site/build-health?x"], [undefined, "/api/site/route"], ["POST", null],
  ];
  for (const [m, p] of forbidden) assert.equal(probeCallAllowed(m, p), false, `${m} ${p} was allowed`);
  assert.throws(() => assertProbeCall("POST", "/api/site/fold-lane-bakery/edit"), /routing-only mode refused/);
  assert.doesNotThrow(() => assertProbeCall("POST", ROUTE_PATH));
  assert.equal(ROUTE_PATH, "/api/site/route");
});

test("the fetch wall allows the balance read alone, and refuses before the fetch is made", async () => {
  const SB = "https://stub.supabase.test";
  assert.equal(probeFetchAllowed(`${SB}/rest/v1/credits?user_id=eq.u&select=balance`, "GET", SB), true);
  for (const [u, m] of [[`${SB}/rest/v1/credits?user_id=eq.u`, "POST"], [`${SB}/rest/v1/site_backends?select=*`, "GET"], [`${SB}.evil/rest/v1/credits?x`, "GET"], ["https://fold-lane-bakery.gofarther.app/", "GET"], [`${SB}/auth/v1/verify`, "POST"]]) {
    assert.equal(probeFetchAllowed(u, m, SB), false, `${m} ${u} was allowed`);
  }
  assert.equal(probeFetchAllowed(`${SB}/rest/v1/credits?x`, "GET", ""), false, "no Supabase address allowed everything that starts with nothing");
  let made = 0;
  const walled = guardFetch(async () => { made++; return new Response("[]"); }, (u, m) => probeFetchAllowed(u, m, SB));
  await walled(`${SB}/rest/v1/credits?user_id=eq.u&select=balance`);
  assert.equal(made, 1);
  assert.throws(() => walled("https://fold-lane-bakery.gofarther.app/api/db/x/data/loaves", { method: "GET" }), /routing-only mode refused/);
  assert.throws(() => walled(new Request(`${SB}/rest/v1/credits?x`, { method: "POST" })), /routing-only mode refused/, "a Request's own method was not read");
  assert.equal(made, 1, "a refused fetch was made anyway");
});

test("the canary's one request helper asks the wall first, and the fetch wall rises with the session", () => {
  const at = CANARY_SRC.indexOf("function call(method, path");
  assert.ok(at > 0, "the request helper is gone — the observer is alive");
  const promise = CANARY_SRC.indexOf("return new Promise(", at);
  assert.ok(promise > at, "the helper's request landmark is gone");
  assert.match(CANARY_SRC.slice(at, promise), /if \(PROBES\) assertProbeCall\(method, path\);/, "the wall is not the helper's first step");
  assert.equal(CANARY_SRC.split("https.request(").length - 1, 1, "a second raw request bypasses the helper");
  const session = CANARY_SRC.indexOf("const TOKEN = session.access_token");
  const wall = CANARY_SRC.indexOf("if (PROBES) globalThis.fetch = guardFetch(");
  const firstRead = CANARY_SRC.indexOf('await call("GET", "/api/site/build-health")');
  assert.ok(session > 0 && wall > session && firstRead > wall, "the fetch wall rises after the first app read, or before the session exists");
});

test("the mode exits above the free edit checks, the inventory and the paid edit, and posts only through its two functions", () => {
  const branch = CANARY_SRC.indexOf("if (PROBES) {\n  const probes = PROBES.batch.probes;");
  const preflight = CANARY_SRC.indexOf("a cold container gets the expected image");
  const free = CANARY_SRC.indexOf("ZERO-COST CONFIRMATIONS");
  const paid = CANARY_SRC.indexOf("PAID CANARY EDIT");
  assert.ok(branch > 0 && free > 0 && paid > 0 && preflight > 0, "a landmark moved — the observer is alive");
  assert.ok(branch > preflight, "the batch routes before its runtime check");
  assert.ok(branch < free && free < paid, "the batch runs below the free edit checks or the paid edit");
  const end = CANARY_SRC.indexOf("\n}\n", branch);
  const block = CANARY_SRC.slice(branch, end);
  const exits = block.match(/process\.exit\(/g) || [];
  assert.ok(exits.length >= 5, "the block's exits are gone");
  assert.match(block.slice(block.lastIndexOf("process.exit(")), /^process\.exit\(RUN\.stopped \? 1 : 0\);/, "the block does not end by exiting");
  const calls = block.match(/call\("(GET|POST)", [^)]*\)/g) || [];
  assert.deepEqual(calls.map((c) => c.split(",")[0]).sort(), ['call("GET"', 'call("POST"'].sort(), "the block makes a request other than a page list and the routing call");
  assert.match(block, /call\("POST", ROUTE_PATH, \{ body \}\)/);
  assert.match(block, /if \(failed\) \{[^}]*REFUSING TO ROUTE[^}]*process\.exit\(1\)/s, "a failed runtime check does not stop the batch");
});

test("the box is read before the sign-in, with its file, and refuses beside every other mode and without an expected deploy", () => {
  const ask = CANARY_SRC.indexOf("readProbeBox(process.env.CANARY_PROBES)");
  const signIn = CANARY_SRC.indexOf("auth/v1/admin/generate_link");
  assert.ok(ask > 0 && signIn > ask, "the box is read after the sign-in");
  const win = CANARY_SRC.slice(ask, signIn);
  for (const box of ["READ_JOB", "RESTORE", "UI", "ALLOW_RAW", "EXPECT_ROUTE.expect", "EXPECT_ROWS.expect", "instructionGiven"]) assert.ok(win.includes(box), `${box} is not refused beside the batch`);
  assert.match(win, /SPEND && \(!EXPECT_DEPLOY \|\| !EXPECT_IMAGE\)/, "a paid batch can spend without naming its deploy");
  assert.match(win, /readFileSync\(batchPath\(PROBES_ASK\.name\)/, "the batch file is not read before the sign-in");
  assert.ok((win.match(/process\.exit\(2\)/g) || []).length >= 4, "a refusal does not stop the run");
});

test("the workflow carries the batch's name to the script as its own box, and arms nothing", () => {
  assert.match(FLOW, /\n {6}route_probes:\n {8}description: 'ROUTING-ONLY BATCH:/, "the box is gone");
  assert.match(FLOW, /CANARY_PROBES:\s*\$\{\{\s*github\.event\.inputs\.route_probes\s*\}\}/, "the box does not reach the script");
  assert.doesNotMatch(FLOW, /CANARY_SPEND:[^\n]*route_probes/, "the box arms the spend switch");
  const inputs = FLOW.slice(FLOW.indexOf("inputs:"), FLOW.indexOf("\njobs:")).match(/\n {6}[a-z_]+:\n/g) || [];
  assert.ok(inputs.length >= 13 && inputs.length <= 25, `the form has ${inputs.length} boxes; GitHub takes at most 25`);
});

// ── READING ANSWERS ────────────────────────────────────────────────────────

test("a decision is readable only from the fixed lists", () => {
  assert.equal(decisionReadable(OWN("addon")), true);
  assert.equal(decisionReadable({ source: "rule", reasons: ["no-credits"] }), true);
  for (const bad of [undefined, null, [], "model", { source: "guess", reasons: [] }, { source: "model" }, { source: "model", reasons: ["invented"] },
    { source: "model", reasons: "page-unknown" }, { source: "model", reasons: [], raw: { intent: "edit; x", layer: "none" } },
    { source: "model", reasons: [], raw: { intent: "edit", layer: "colours" } }, { source: "model", reasons: [], raw: null }, { source: "model", reasons: [7] }]) {
    assert.equal(decisionReadable(bad), false, `${JSON.stringify(bad)} was read`);
  }
});

test("an answer is matched, differs, or is only recorded — and a match a fallback made is never a match", () => {
  const addon = [{ intent: "addon", alsoAsked: "none" }];
  assert.deepEqual(probeVerdict(addon, { intent: "addon", decision: OWN("addon") }), { kind: "matches", alt: 0 });
  assert.deepEqual(probeVerdict(addon, { intent: "addon", decision: { source: "fallback", reasons: ["page-unknown"], raw: { intent: "edit", layer: "page" } } }), { kind: "matches-not-model", alt: 0 });
  assert.deepEqual(probeVerdict(addon, { intent: "addon", decision: { source: "rule", reasons: ["no-credits"] } }).kind, "matches-not-model");
  const nav = probeVerdict(addon, { intent: "edit", layer: "nav", decision: OWN("edit", "nav") });
  assert.equal(nav.kind, "differs");
  assert.deepEqual(nav.diffs, [{ key: "intent", want: "addon", got: "edit" }]);
  assert.deepEqual(probeVerdict(null, { intent: "edit", layer: "nav" }), { kind: "recorded" });
  assert.deepEqual(probeVerdict(addon, { intent: "addon", failed: true }), { kind: "failed" }, "a failed call's fallback was judged");
  const held = [{ intent: "edit", layer: "data", alsoAsked: "some" }, { intent: "addon", alsoAsked: "some" }];
  assert.equal(probeVerdict(held, { intent: "addon", alsoAsked: "add a Seeded Spelt at £4.80", decision: OWN("addon") }).alt, 1);
  assert.equal(probeVerdict(held, { intent: "addon", decision: OWN("addon") }).kind, "differs", "nothing held back read as held back");
  assert.equal(probeVerdict(held, { intent: "addon", alsoAsked: "  ", decision: OWN("addon") }).kind, "differs", "a blank part read as held back");
  // CANNOT-TELL MATCHES NOTHING: a field that is not the shape it should be.
  assert.equal(probeVerdict([{ intent: "edit", layer: "data" }], { intent: "edit", layer: ["data"], decision: OWN("edit", "data") }).diffs[0].got, "unreadable");
  assert.equal(probeVerdict([{ intent: "edit", layer: "page", remove: true }], { intent: "edit", layer: "page", remove: "true", decision: OWN("edit", "page") }).kind, "differs");
  assert.equal(probeVerdict([{ intent: "edit", layer: "look", page: "none" }], { intent: "edit", layer: "look", decision: OWN("edit", "look") }).kind, "matches");
  assert.equal(probeVerdict([{ intent: "edit", layer: "look", page: "none" }], { intent: "edit", layer: "look", page: "/visit", decision: OWN("edit", "look") }).kind, "differs");
  assert.equal(probeVerdict([{ intent: "edit", layer: "page", remove: false }], { intent: "edit", layer: "page", decision: OWN("edit", "page") }).kind, "matches", "an absent removal is not a removal");
});

test("each probe is posted as the browser posts it, with the site's real page list", () => {
  const body = probeBody({ id: "A1", site: "fold-lane-bakery", name: "Harbour Loaf", message: "Add our Instagram to the footer.", attached: false }, ["/", "/visit"]);
  assert.deepEqual(body, {
    message: "Add our Instagram to the footer.", site: { name: "Harbour Loaf", url: "https://fold-lane-bakery.gofarther.app", pages: ["/", "/visit"], tables: [] },
    firstBuild: false, brief: "Add our Instagram to the footer.", qa: [], answering: false, attached: false, slug: "fold-lane-bakery", hasSite: true,
  });
  assert.equal(probeBody({ site: "x", message: "m", attached: true }, ["/"]).attached, true);
  // THE BROWSER'S OWN FIELDS: what `siteRoute` posts, less the picked model (the route's default, as the canary has always routed).
  const chat = readFileSync(path.join(REPO, "public/chat.js"), "utf8");
  const at = chat.indexOf("apiFetch('/api/site/route'");
  const open = chat.indexOf("body: JSON.stringify({", at) + "body: JSON.stringify({".length;
  const line = chat.slice(open, chat.indexOf("}),", open));
  assert.ok(at > 0 && line.length > 20, "the browser's routing call moved — the observer is alive");
  const fields = [...line.matchAll(/([a-zA-Z]+):/g)].map((m) => m[1]).filter((k) => k !== "picker");
  assert.deepEqual(Object.keys(body).sort(), [...new Set(fields)].sort(), "the probe does not post the fields the browser posts");
});

// ── THE FLOW ───────────────────────────────────────────────────────────────

const PROBES = readProbeBatch(BATCH_TEXT, BATCH).batch.probes;

test("every site's page list is read once, before any routing call, and one that cannot be read stops the batch at no cost", async () => {
  const order = [];
  const pg = await readProbePages({ probes: PROBES, readPages: async (s) => { order.push("pages:" + s); return { ok: true, pages: ["/", "/visit"] }; } });
  assert.ok(pg.ok);
  assert.deepEqual(order, ["pages:fold-lane-bakery", "pages:fretwork-1"], "a site's list was read twice, or not at all");
  const down = await readProbePages({ probes: PROBES, readPages: async (s) => (s === "fretwork-1" ? { ok: false, why: "status 503" } : { ok: true, pages: ["/"] }) });
  assert.equal(down.ok, false);
  assert.match(down.why, /fretwork-1.*status 503/);
});

test("every probe is routed once, and the batch stops only on an answer it cannot read honestly", async () => {
  const pages = { "fold-lane-bakery": ["/"], "fretwork-1": ["/"] };
  const posted = [];
  const ok = await routeProbes({ probes: PROBES, pages, postRoute: async (b) => { posted.push(b); return { status: 200, ms: 5, json: { ok: true, intent: "addon", cost: 2, decision: OWN("addon") } }; } });
  assert.equal(ok.stopped, null);
  assert.equal(posted.length, 18);
  assert.equal(ok.records.length, 18);
  assert.deepEqual(posted.map((b) => b.message), PROBES.map((p) => p.message), "a probe was skipped, repeated or reordered");
  assert.equal(probesCost(ok.records), 36);

  const failing = await routeProbes({ probes: PROBES.slice(0, 3), pages, postRoute: async () => ({ status: 200, json: { ok: true, intent: "addon", failed: true, failure: { kind: "provider" }, cost: 0, decision: { source: "fallback", reasons: ["send-failed"] } } }) });
  assert.equal(failing.stopped, null, "a failed routing call stopped the batch");
  assert.ok(failing.records.every((r) => r.verdict.kind === "failed"));

  for (const [what, answer, at] of [
    ["signed out", { status: 401, json: { ok: false } }, "signed out"],
    ["a 500", { status: 500, json: { error: "x" } }, "answered 500"],
    ["no decision", { status: 200, json: { ok: true, intent: "addon", cost: 2 } }, "no readable decision"],
    ["a made-up decision", { status: 200, json: { ok: true, intent: "addon", cost: 2, decision: { source: "model", reasons: ["sure"] } } }, "no readable decision"],
  ]) {
    let n = 0;
    const r = await routeProbes({ probes: PROBES, pages, postRoute: async () => { n++; return answer; } });
    assert.equal(n, 1, `${what}: the batch went on past it`);
    assert.equal(r.stopped.at, PROBES[0].id);
    assert.match(r.stopped.why, new RegExp(at));
    assert.equal(r.records[0].verdict.kind, "stopped");
  }
});

test("the report names each probe's answer, decision and verdict, and sums what was reported", () => {
  const records = [
    { id: "A1", message: "m", attached: false, intended: [{ intent: "addon" }], basis: "b", body: { intent: "addon", cost: 2, decision: OWN("addon") }, verdict: { kind: "matches", alt: 0 } },
    { id: "B1", message: "m", attached: false, intended: [{ intent: "addon" }], basis: "b", body: { intent: "addon", cost: "3", decision: { source: "fallback", reasons: ["page-unknown"], raw: { intent: "edit", layer: "page" } } }, verdict: { kind: "matches-not-model", alt: 0 } },
    { id: "E1", message: "m", attached: true, intended: null, basis: "not set", body: { intent: "edit", layer: "nav", alsoAsked: "the rest", cost: 2, decision: OWN("edit", "nav") }, verdict: { kind: "recorded" } },
  ];
  assert.equal(probesCost(records), 4, "a cost that is not a number was summed");
  const text = probesReport({ name: BATCH, sha256: "ab".repeat(32), records, stopped: null, cost: 4 });
  for (const s of ["A1", "B1", "E1", "fallback: page-unknown", "the model said intent=edit layer=page", "1 match (the model's own), 1 match only through a fallback or rule", "1 recorded only", "(file attached)"]) {
    assert.ok(text.includes(s), `the report does not say ${s}`);
  }
  assert.equal(answerSaid({ intent: "edit", layer: "page", page: "/blog", remove: true }), "edit · page · /blog · remove");
});

// ── THE REAL SCRIPT, END TO END ────────────────────────────────────────────

const answers = (n, a) => Array.from({ length: n }, () => a);
const ADDON = { ok: true, intent: "addon", cost: 2, decision: OWN("addon") };

function runCanary(name, { probes = BATCH, spend = "1", deploy = "0123456", image = "0123456789abcdef", balance = "96", routes = answers(18, ADDON), extra = {} } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "canary-probes-" + name + "-"));
  const logFile = path.join(dir, "wire.jsonl");
  writeFileSync(logFile, "");
  const env = {
    PATH: process.env.PATH, HOME: process.env.HOME,
    OWNER_EMAIL: "owner@example.com", SUPABASE_SERVICE_KEY: "stub-key", SUPABASE_URL: "https://stub.supabase.test",
    OWNER_BASE_URL: "https://stub.worker.test", CANARY_SLUG: "stub-site", CONTROL_SLUG: "",
    CANARY_SPEND: spend, EXPECT_DEPLOY: deploy, EXPECT_IMAGE: image, CANARY_PROBES: probes,
    CANARY_EVIDENCE_DIR: path.join(dir, "evidence"), STUB_LOG: logFile, STUB_BALANCE: balance,
    STUB_ROUTES: JSON.stringify(routes), STUB_ROUTE: JSON.stringify({ ok: true, intent: "ask", answer: "past the list", cost: 2, decision: OWN("ask") }),
    ...extra,
  };
  return new Promise((resolve) => {
    const p = spawn(process.execPath, ["--import", path.join(REPO, "test/fixtures/canary-stub.mjs"), "scripts/edit-canary.mjs"], { cwd: REPO, env });
    let out = "", err = "";
    const kill = setTimeout(() => p.kill("SIGKILL"), 90_000);
    p.stdout.on("data", (c) => { out += c; });
    p.stderr.on("data", (c) => { err += c; });
    p.on("close", (code) => {
      clearTimeout(kill);
      const wire = readFileSync(logFile, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
      const ev = path.join(dir, "evidence", "routing-probes.json");
      const to = (w) => `${w.method} ${(w.path || w.url || "").split("?")[0]}`;
      resolve({
        code, out, err, wire, to: wire.map(to),
        routed: wire.filter((w) => w.path === "/api/site/route").length,
        evidence: existsSync(ev) ? JSON.parse(readFileSync(ev, "utf8")) : null,
      });
    });
  });
}

/** Nothing that edits, adds, builds, publishes, restores, polls a job or reads a site's pages was asked of anything. */
function assertRoutedOnly(r, what) {
  const allowed = new Set([
    "POST https://stub.supabase.test/auth/v1/admin/generate_link", "POST https://stub.supabase.test/auth/v1/verify",
    "GET https://stub.supabase.test/rest/v1/credits", "GET /api/site/build-health", "GET /api/site/runtime", "GET /api/site/routes", "POST /api/site/route",
  ]);
  for (const t of r.to) assert.ok(allowed.has(t), `${what}: the run asked for ${t}`);
  assert.equal(r.wire.filter((w) => w.status === 599).length, 0, `${what}: the run made a request the stub has no answer for`);
}

test("END TO END: one paid press routes all eighteen probes and makes no other request that could change anything", async () => {
  const r = await runCanary("paid");
  assert.equal(r.code, 0, r.err + r.out.slice(-2000));
  assert.equal(r.routed, 18, "not every probe was routed exactly once");
  assertRoutedOnly(r, "the paid batch");
  assert.ok(r.to.indexOf("GET /api/site/build-health") < r.to.indexOf("POST /api/site/route"), "a probe was routed before the runtime check");
  assert.ok(r.to.lastIndexOf("GET /api/site/routes") < r.to.indexOf("POST /api/site/route"), "a page list was read after routing began");
  assert.equal(r.evidence.records.length, 18);
  assert.equal(r.evidence.batch, BATCH);
  assert.match(r.evidence.sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(r.evidence.balance, { before: 96, after: 96 });
  assert.equal(r.evidence.cost, 36);
  const bodies = r.wire.filter((w) => w.path === "/api/site/route").map((w) => JSON.parse(w.body));
  assert.deepEqual(bodies.map((b) => b.message), PROBES.map((p) => p.message), "the posted messages are not the batch's");
  assert.ok(bodies.every((b) => b.hasSite === true && Array.isArray(b.site.pages) && b.site.pages.length), "a probe went without its site's pages");
  assert.match(r.out, /SUMMARY {2}\d+ match/);
});

test("END TO END: without spend it reads, checks and stops, and routes nothing", async () => {
  const r = await runCanary("rehearsal", { spend: "0", deploy: "", image: "" });
  assert.equal(r.code, 0, r.err);
  assert.equal(r.routed, 0, "a rehearsal routed a message");
  assertRoutedOnly(r, "the rehearsal");
  assert.match(r.out, /REHEARSAL/);
  assert.equal(r.evidence.rehearsal, true);
});

test("END TO END: a bad box, a missing batch, another mode beside it, or a paid press with no expected deploy refuses before any request", async () => {
  for (const [what, opts] of [
    ["a path in the box", { probes: "../secrets" }],
    ["no such batch", { probes: "no-such-batch" }],
    ["an instruction beside it", { extra: { CANARY_INSTRUCTION: "Make the Country White £4.90." } }],
    ["an expected route beside it", { extra: { CANARY_EXPECT_ROUTE: "intent=addon" } }],
    ["a restore beside it", { extra: { CANARY_RESTORE: "01790468089054-8btpep" } }],
    ["no expected deploy", { deploy: "" }],
    ["no expected image", { image: "" }],
  ]) {
    const r = await runCanary("refuse", opts);
    assert.equal(r.code, 2, `${what}: exit ${r.code}\n${r.err}`);
    assert.equal(r.wire.length, 0, `${what}: a request was made before the refusal`);
  }
});

test("END TO END: a runtime check that fails, a page list that cannot be read, or a balance below the estimate stops before the first routing call", async () => {
  for (const [what, opts, said] of [
    ["the wrong deploy", { deploy: "fedcba9876" }, /REFUSING TO ROUTE: a runtime check failed/],
    ["the wrong image", { image: "ffffffffffffffff" }, /REFUSING TO ROUTE: a runtime check failed/],
    ["a page list down", { extra: { STUB_PAGES_DOWN: "fretwork-1" } }, /REFUSING TO ROUTE: the page list of fretwork-1/],
    ["a short balance", { balance: String(PROBE_COST_MAX * 18 - 1) }, /below the batch's upper estimate of 54/],
  ]) {
    const r = await runCanary("stop", opts);
    assert.equal(r.code, 1, `${what}: exit ${r.code}`);
    assert.equal(r.routed, 0, `${what}: a probe was routed`);
    assert.match(r.out + r.err, said, what);
    assertRoutedOnly(r, what);
  }
});

test("END TO END: a Worker that does not report its decisions stops the batch at the first answer, at the cost of one routing call", async () => {
  const r = await runCanary("blind", { routes: [{ ok: true, intent: "addon", cost: 2 }] });
  assert.equal(r.code, 1);
  assert.equal(r.routed, 1, "the batch went on reading answers it could not attribute");
  assert.equal(r.evidence.records.length, 1);
  assert.equal(r.evidence.records[0].verdict.kind, "stopped");
  assert.match(r.evidence.stopped.why, /no readable decision/);
  assertRoutedOnly(r, "the blind batch");
});

test("END TO END: different answers are recorded as findings, and the batch goes on", async () => {
  const routes = answers(18, { ok: true, intent: "edit", layer: "nav", cost: 2, decision: OWN("edit", "nav") });
  routes[6] = { ok: true, intent: "addon", cost: 3, decision: { source: "fallback", reasons: ["page-unknown"], raw: { intent: "edit", layer: "page" } } };
  routes[7] = { status: 200, ok: true, intent: "addon", failed: true, failure: { kind: "provider" }, cost: 0, decision: { source: "fallback", reasons: ["send-failed"] } };
  const r = await runCanary("findings", { routes });
  assert.equal(r.code, 0, "a finding stopped the batch");
  assert.equal(r.routed, 18);
  const kinds = Object.fromEntries(r.evidence.records.map((x) => [x.id, x.verdict.kind]));
  assert.equal(kinds.A1, "differs");
  assert.equal(kinds.B1, "matches-not-model", "a fallback's addon was counted as the model's");
  assert.equal(kinds.B2, "failed");
  assert.equal(kinds.E1, "recorded");
  assertRoutedOnly(r, "the findings batch");
});
