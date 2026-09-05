// The trace module, driven with literal objects.
//
// WHY THIS FILE IS WHERE THE CARE GOES. `builder/edit-trace.mjs` is a leaf with
// no I/O precisely so the dangerous half — deciding what may be stored — can be
// tested without a Worker, a network or a database. A redaction that is subtly
// wrong writes a service key into a table, and no integration test would notice
// because the value would look like what it is: a string that was there anyway.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { newTrace, traceRow, redact, newCid, MAX_EVENTS, MAX_MSG, MAX_STACK } from "../builder/edit-trace.mjs";

/** A clock the test drives, so nothing here waits on real time. */
const clock = (start = 1000) => { let t = start; return { now: () => t, at: (v) => { t = start + v; } }; };

// REAL-SHAPED, NOT REAL. Each of these is the shape of a secret this platform
// actually holds, assembled here rather than copied from anywhere live — a test
// that pastes a working key has published it to the repository.
const FAKE = {
  jwt: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzc4Nzg1MjU1fQ.7cWq2LmXbN4pR8vT1zYkAeGhJdFsQoUiCxMnBvZrPlk",
  anthropic: "sk-ant-api03-9fKq2mXbN4pR8vT1zYkAeGhJdFsQoUiCxMnBvZrPlkTyRw",
  xai: "xai-9fKq2mXbN4pR8vT1zYkAeGhJdFsQoUiCxMnBvZrPlk",
  neon: "postgresql://neondb_owner:npg_7cWq2LmXbN4p@ep-cool-sun-123.eu-central-1.aws.neon.tech/neondb",
  opaque: "Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MGFiY2RlZmdoaWprbG1ub3A",
  // SHORT KEYS, AND THE SWEEP IS WHY THEY EXIST. Deleting the provider-key
  // rule entirely SURVIVED: every fixture above is 46+ characters, so the
  // catch-all (`[A-Za-z0-9_-]{40,}`) covered them all and the named rule was
  // never the thing under test. A 12-character key is below that floor and
  // only the named rule can catch it — measured, not assumed.
  shortAnthropic: "sk-ant-abc12345",
  shortXai: "xai-Kq2mXbN4",
};

test("every secret shape this platform holds is removed", () => {
  // ASSERTED AS ABSENCE OF THE SECRET, never as presence of the marker. A
  // redaction that appended "[redacted]" while leaving the key in place would
  // pass a marker test and leak — the failure mode that matters is the one a
  // sloppy assertion cannot see.
  const cases = [
    ["a PostgREST error quoting the service key", `permission denied; apikey=${FAKE.jwt}`, FAKE.jwt],
    ["an Anthropic refusal", `401 from provider, x-api-key: ${FAKE.anthropic}`, FAKE.anthropic],
    ["an xAI refusal", `xai 400 {"error":"bad key ${FAKE.xai}"}`, FAKE.xai],
    ["a Neon connection failure", `could not connect to ${FAKE.neon}`, "npg_7cWq2LmXbN4p"],
    ["an authorization header", `sent Bearer ${FAKE.jwt} and got 403`, FAKE.jwt],
    ["an unrecognised long token", `upload failed for ${FAKE.opaque}`, FAKE.opaque],
    ["a SHORT Anthropic key, under the catch-all's floor", `401: ${FAKE.shortAnthropic}`, FAKE.shortAnthropic],
    ["a SHORT xAI key, under the catch-all's floor", `xai 400 ${FAKE.shortXai}`, FAKE.shortXai],
  ];
  for (const [what, text, secret] of cases) {
    const out = redact(text, 4000);
    assert.ok(!out.includes(secret), `${what}: the secret survived redaction — ${out}`);
  }
});

test("…and the host survives a connection string, because that is the diagnosis", () => {
  // The credentials are the secret; WHICH database a failure touched is the
  // whole reason a reader opens the row. Cutting both would make the redaction
  // safe and useless.
  const out = redact(`could not connect to ${FAKE.neon}`, 4000);
  assert.ok(!out.includes("npg_7cWq2LmXbN4p"), "the password survived");
  assert.match(out, /ep-cool-sun-123/, "the host was redacted too, so the row cannot say which database");
});

test("ordinary text is not mangled — the false-alarm direction", () => {
  // A redaction that eats real diagnostics is the mirror failure: the row is
  // safe and says nothing. This repo rates a false alarm worse than a miss.
  const plain = "Network connection lost. writeSiteDistToR2 failed after 12 objects on fretwork-1";
  assert.equal(redact(plain, 4000), plain, "a plain error message was altered");
  assert.equal(redact("at recompileAndPublish (worker.js:9732:15)", 4000),
    "at recompileAndPublish (worker.js:9732:15)", "a stack frame was altered");
});

test("a non-string is refused rather than coerced", () => {
  // `String(["sk-ant-x"])` is `"sk-ant-x"` — a real secret out of a shape
  // mistake, and this repo has shipped that coercion three times. Here the
  // direction of the mistake is a leak.
  for (const bad of [["sk-ant-leak"], null, undefined, 42, {}, { toString: () => FAKE.jwt }]) {
    assert.equal(redact(bad), "", `redact(${JSON.stringify(bad)}) did not refuse`);
  }
});

test("both caps hold, and they differ because a stack is not a message", () => {
  assert.ok(redact("x".repeat(5000), MAX_MSG).length <= MAX_MSG + 1);
  assert.ok(redact("x".repeat(5000), MAX_STACK).length <= MAX_STACK + 1);
  assert.ok(MAX_STACK > MAX_MSG, "a stack was capped as tightly as a message, so it names no frames");
});

test("a correlation id is short, unique and greppable", () => {
  const ids = new Set();
  for (let i = 0; i < 500; i++) ids.add(newCid());
  assert.equal(ids.size, 500, "correlation ids collided");
  // LENGTH IS FIXED, not a range: the random half is padded precisely so the
  // id cannot come out short — which is what made the first draft collide.
  for (const id of ids) assert.match(id, /^e_[a-z0-9]{14,18}$/, "id is not greppable: " + id);
});

test("marks are ordered, timed against the request start, and never throw", () => {
  const c = clock();
  const t = newTrace({ slug: "fretwork-1", now: c.now });
  t.mark("pick_lanes", "start");
  c.at(31000);
  t.mark("pick_lanes", "ok", { fields: ["css"] });
  c.at(109000);
  t.mark("lane:css", "ok", { chars: 1204 });
  const ev = t.events();
  assert.deepEqual(ev.map((e) => e.p), ["pick_lanes", "pick_lanes", "lane:css"]);
  assert.deepEqual(ev.map((e) => e.ms), [0, 31000, 109000]);
  assert.deepEqual(ev[1].d, { fields: ["css"] });
  // NOTHING IT DOES CAN THROW — the same rule `build-budget.mjs` lives under.
  assert.doesNotThrow(() => {
    t.mark(null, null, null); t.mark({}, "ok", "not an object"); t.mark("x", "ok", { bad: Symbol("s") });
  });
});

test("detail is an allow-shape, so a call site cannot store a provider body", () => {
  // The marking call sites are spread across an 800-line route. A passthrough
  // would let one of them store `{ ...response }` — headers, echoed request,
  // key — and the rule would be un-testable. So it is enforced here.
  const t = newTrace({});
  t.mark("container", "ok", {
    status: 200, dead: true, note: "fine",
    headers: { authorization: "Bearer " + FAKE.jwt },     // object — dropped
    body: { key: FAKE.anthropic },                        // object — dropped
    "not a key!": "x",                                    // bad name — dropped
  });
  const d = t.events()[0].d;
  assert.deepEqual(Object.keys(d).sort(), ["dead", "note", "status"]);
  assert.ok(!JSON.stringify(d).includes(FAKE.jwt), "a nested provider body reached the trace");
  assert.ok(!JSON.stringify(d).includes(FAKE.anthropic), "a nested key reached the trace");
});

test("…and a string detail is redacted too, not just refused by shape", () => {
  const t = newTrace({});
  t.mark("lane", "fail", { why: "x-api-key: " + FAKE.anthropic });
  assert.ok(!JSON.stringify(t.events()).includes(FAKE.anthropic), "a key in a string detail survived");
});

test("the failing phase is DERIVED from the timeline, never passed in", () => {
  // The question run 101 could not answer. A caller naming the phase is a second
  // opinion that can disagree with the timeline; the timeline already knows.
  const c = clock();
  const t = newTrace({ slug: "s", now: c.now });
  t.mark("lane:css", "ok");
  c.at(1000); t.mark("container", "start");
  c.at(2000); t.mark("container", "ok");
  c.at(2100); t.mark("r2:dist", "start");          // starts and never finishes
  c.at(3000);
  const row = traceRow(t, { ok: false, error: new Error("Network connection lost."), now: c.now });
  assert.equal(row.failed_phase, "r2:dist", "the phase left open was not identified as the failing one");
  assert.equal(row.ok, false);
  assert.equal(row.err_name, "Error");
  assert.equal(row.ms, 3000);
});

test("an explicit failure outranks an open phase", () => {
  const t = newTrace({});
  t.mark("container", "start");
  t.mark("verify", "fail", { dead: 1 });
  t.mark("r2:dist", "start");
  assert.equal(traceRow(t, { ok: false, error: new Error("x") }).failed_phase, "verify");
});

test("a clean run names no failing phase", () => {
  const t = newTrace({});
  t.mark("container", "start"); t.mark("container", "ok");
  const row = traceRow(t, { ok: true });
  assert.equal(row.ok, true);
  assert.equal(row.failed_phase, null);
  assert.equal(row.err_name, null);
  assert.equal(row.err_stack, null);
});

test("the stored row carries no secret from an error, however it arrived", () => {
  // THE WHOLE POINT OF THE MODULE, asserted end to end: an error whose message
  // AND stack both quote the service key must land in storage carrying neither.
  const t = newTrace({ slug: "fretwork-1" });
  t.mark("r2:dist", "start");
  const e = new Error(`PostgREST said no: apikey=${FAKE.jwt}`);
  e.stack = `Error: apikey=${FAKE.jwt}\n    at writeSiteDistToR2 (worker.js:8946:9)`;
  const row = traceRow(t, { ok: false, error: e });
  const whole = JSON.stringify(row);
  assert.ok(!whole.includes(FAKE.jwt), "the service key reached the stored row");
  // AND THE DIAGNOSIS SURVIVED, or the row is safe and worthless.
  assert.match(row.err_stack, /writeSiteDistToR2 \(worker\.js:8946/, "the stack frame was lost");
  assert.equal(row.failed_phase, "r2:dist");
});

test("the event list is bounded, and says so rather than truncating in silence", () => {
  const t = newTrace({});
  for (let i = 0; i < MAX_EVENTS + 25; i++) t.mark("p" + i, "ok");
  const row = traceRow(t, { ok: true });
  assert.equal(row.events.length, MAX_EVENTS + 1, "the cap did not hold, or the marker is missing");
  assert.equal(row.events[row.events.length - 1].d.dropped, 25,
    "events were dropped without the row saying how many — a silently short timeline reads as a short request");
});

test("traceRow refuses anything that is not a trace", () => {
  for (const bad of [null, undefined, {}, "trace", 5]) assert.equal(traceRow(bad, {}), null);
});

test("it is a leaf: no imports, so all of it is testable outside the Worker", () => {
  const src = fs.readFileSync(new URL("../builder/edit-trace.mjs", import.meta.url), "utf8");
  assert.ok(!/^\s*import\s/m.test(src),
    "edit-trace.mjs grew an import — the module whose redaction must be testable without infrastructure");
});

// ── AND THE WIRING: A TRACE CHANGES NOTHING (2026-09-01) ────────────────────
//
// The owner's condition was "confirmation that application behavior remains
// unchanged". That is a claim about worker.js, not about this module, so it is
// asserted against worker.js — and on the PROPERTY rather than the spelling,
// because three spelling-pinned guards went red for honest changes this week.

test("the spine's trace parameter defaults to null, so every existing caller is unchanged", () => {
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(src, /async function recompileAndPublish\(env, \{[^}]*trace = null[^}]*\}\)/,
    "the spine's trace parameter is no longer optional — existing callers would change behaviour");
  // AND A NULL TRACE IS A NO-OP AT EVERY MARK, which is what makes that true.
  assert.match(src, /const tm = \([^)]*\) => \{ try \{ if \(trace\) trace\.mark/,
    "the spine's mark helper no longer guards on the trace being present");
});

test("marks never await, so they cannot add a subrequest to the request they measure", () => {
  // THE ONE WAY THIS INSTRUMENTATION COULD CHANGE TIMING. A per-phase write
  // would add ~20 round trips to the request being measured — the instrument
  // altering the thing, which this repo has been bitten by twice.
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const marks = [...src.matchAll(/\b(?:editTrace\.mark|tm)\(/g)];
  assert.ok(marks.length >= 15, "the edit path lost its marks; found " + marks.length);
  for (const m of marks) {
    const before = src.slice(Math.max(0, m.index - 12), m.index);
    assert.ok(!/await\s*$/.test(before),
      "a mark is awaited, so it can add latency to the request it is measuring: " + src.slice(m.index - 40, m.index + 40));
  }
});

test("the trace is flushed through waitUntil, off the response path", () => {
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const i = src.indexOf("function flushEditTrace(");
  assert.ok(i > 0, "the flush helper is gone");
  const body = src.slice(i, src.indexOf("\nasync function", i));
  assert.match(body, /ctx\.waitUntil\(/, "the trace write is on the response path and adds latency");
  assert.match(body, /catch/, "the flush can throw, and it runs on a request that is already doing real work");
});

test("the 500 reply gains only the correlation id — no secret, no new surface", () => {
  // Sanitisation of the PUBLIC response, which the owner listed separately from
  // the stored row. `cid` is ours and names nothing; the error's message stays
  // discarded here exactly as before.
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const i = src.indexOf('error: "Something went wrong reaching your site\'s data."');
  assert.ok(i > 0, "the owner-route reply moved");
  const reply = src.slice(src.lastIndexOf("return Response.json({", i), src.indexOf("}, { status: 500 })", i));
  assert.match(reply, /cid:/, "the reply does not carry the correlation id, so nothing can be correlated");
  assert.doesNotMatch(reply, /e\.message|error\.message|err_msg|stack/,
    "the reply started carrying the error's message or stack — the thing this catch exists not to do");
});

test("a null trace is exactly what a non-edit route has", () => {
  // The declaration sits outside the try so the catch can reach it; every route
  // that is not an edit leaves it null and flushes nothing.
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  // THE PROPERTY IS "OUTSIDE THE TRY", not "on the line before it" — this
  // pinned adjacency and went red when `cidForReply` was declared between
  // them, reporting the declaration as moved when it had not.
  const decl = src.indexOf("let editTrace = null;");
  assert.ok(decl > 0, "the trace declaration is gone");
  const tryAfter = src.indexOf("try {", decl);
  const routeAfter = src.indexOf("editTrace = newTrace(", decl);
  assert.ok(tryAfter > decl && tryAfter < routeAfter,
    "the trace is no longer declared outside the try that encloses the route, so the catch cannot see it");
  // GUARDED, NOT ADJACENT (re-anchored 2026-09-01). This pinned
  // `if (editTrace) flushEditTrace(` as one string and went red when the branch
  // grew a body — capturing the events for the durations write before letting
  // the trace go. The flush had not moved and the guard was still there; the
  // spelling between them had. Second time on this assertion, which is the tell.
  //
  // What must hold is that the flush is REACHED ONLY WHEN A TRACE EXISTS, so a
  // route that is not an edit writes no empty row. Whatever else the branch does
  // is free to change.
  // CALL SITES ONLY. The first draft of this scan matched the DECLARATION too
  // — `function flushEditTrace(env, ...)` — which has no guard in front of it
  // and never could, so the guard flagged the function's own definition.
  const calls = [...src.matchAll(/(?<!function )flushEditTrace\(env/g)].map((m) => m.index);
  assert.ok(calls.length >= 2, `only ${calls.length} flush call sites — the catch and the finally are both needed`);
  for (const at of calls) {
    assert.match(src.slice(Math.max(0, at - 200), at), /if \(editTrace\)/,
      "a flush is reached without checking that a trace exists — a non-edit route would write an empty row");
  }
});

test("the trace is flushed on EVERY exit, not only the throwing one", () => {
  // RUN 102 IS WHY. The first cut flushed in the catch alone, so a trace was
  // written only when the request threw. Run 102 completed normally and wrote
  // nothing — the recorder built to explain run 101 recorded nothing on the run
  // that reproduced it, and `edit_traces` came back empty.
  //
  // The same shape as the bug it exists to find: an instrument attached to one
  // path while the work has many. This route has dozens of returns, and
  // enumerating them is what guarantees the next one is missed.
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const i = src.indexOf("flushEditTrace(env");
  assert.ok(i > 0, "nothing flushes the trace");
  // A `finally` ON THE TRY THAT ENCLOSES THE EDIT ROUTE — the only construct
  // that covers every return by construction rather than by enumeration.
  assert.match(src, /\} finally \{[\s\S]{0,2000}?if \(editTrace\) \{?[\s\S]{0,200}?flushEditTrace\(/,
    "the trace is not flushed in a finally, so a normal return writes nothing");
  // AND EXACTLY ONCE: the catch clears the trace after flushing, or a throwing
  // request writes its row twice and the second overwrites the first.
  assert.match(src, /flushEditTrace\(env, ctx, editTrace, \{ ok: false, error: e \}\); editTrace = null;/,
    "the catch does not clear the trace, so a throwing request flushes twice");
});

test("the stage mark reports the number the writer returns", () => {
  // `writeSiteDistToR2` ended `return wrote.size` - a number - and the mark read
  // it with Array.isArray, so every publish traced 0 objects written. Found on
  // 2026-09-01 while a theme edit that had shipped was being read as a lie;
  // the trace said nothing had been written and the site said otherwise.
  // SINCE STAGE 7 (2026-09-05) the writer is `stageBuild`, which answers
  // `{ files }` — a count — and the `stage` mark carries that count and the
  // script's presence; the `r2:dist` mark went with the live-prefix writer.
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const mark = w.indexOf('tm("stage", "ok", {');
  assert.ok(mark > 0, "the stage mark is gone");
  const line = w.slice(mark, w.indexOf("\n", mark));
  assert.match(line, /files: staged\.files, worker: staged\.worker/, "the mark does not report what the writer answered");
  const builds = fs.readFileSync(new URL("../site-builds.mjs", import.meta.url), "utf8");
  assert.match(builds, /return \{ ok: true, version, files: names\.length, worker: hasWorker \};/, "the writer no longer answers a count");
});
