// A container the account cannot start right now: recognised, waited for, named.
//
// ── WHY THIS EXISTS ────────────────────────────────────────────────────────
//
// @cloudflare/containers turns a start it cannot make into a RESPONSE — a
// plain-text 503 ("There is no Container instance available…"), a 429 ("too
// many containers per second"), a 500 ("Failed to start container: …") — and
// neither publish path recognised them (the capacity review, 2026-09-04): the
// edit spine JSON-parsed the text, threw, and told the customer their change
// "didn't compile — try describing it differently"; the build path retried
// once with no delay and shipped a placeholder. The first two get better on
// their own, so they are WAITED for inside the caller's own cap, with the
// compile's floor never eaten; all three are named as ours.
//
// The fixtures are the library's OWN words, read out of node_modules rather
// than typed — a reworded library is a wall that stopped matching, and this
// is the read that notices ("derive a fixture from its real producer").
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  containerRoom, roomWaits, roomDelayMs, withRoom, roomSentence,
  RATE_WAIT_MAX_MS, FULL_WAIT_MAX_MS, CONTAINER_FULL_RE, CONTAINER_RATE_RE, CONTAINER_START_RE,
} from "../builder/container-room.mjs";

const LIB = readFileSync(new URL("../node_modules/@cloudflare/containers/dist/lib/container.js", import.meta.url), "utf8");

// The three answers, as the library makes them. The 503 body is a JS string
// literal with `\n` escapes inside it; the regex captures the literal and the
// escapes are turned back into newlines below, so the fixture is the body the
// Worker really receives.
const FULL = (() => {
  const m = /return new Response\('(There is no Container instance available[^']*)', \{ status: 503 \}\)/.exec(LIB);
  return m && m[1].replace(/\\n/g, "\n");
})();
const RATE = (() => { const m = /const RATE_LIMITED_ERROR = '([^']+)'/.exec(LIB); return m && m[1]; })();
const START = "Failed to start container: the image is not provisioned";

test("the fixtures are read out of the library, and the library answers the three statuses this module keys on", () => {
  assert.ok(FULL && FULL.startsWith("There is no Container instance available"), "the library's 503 body could not be read");
  assert.ok(RATE && /too many containers per second/.test(RATE), "the library's rate-limit message could not be read");
  // The STATUSES are the library's too: the 429 carries the error's message and
  // the 500 carries "Failed to start container", each read where it is made.
  assert.match(LIB, /isRateLimitedError\(e\)\)\s*\{\s*return new Response\(e instanceof Error \? e\.message : String\(e\), \{ status: 429 \}\)/);
  assert.match(LIB, /`Failed to start container: \$\{[^`]*`, \{\s*status: 500,/);
  // And the three regexes match the three bodies, which is the wall itself.
  assert.match(FULL, CONTAINER_FULL_RE);
  assert.match(RATE, CONTAINER_RATE_RE);
  assert.match(START, CONTAINER_START_RE);
});

test("each of the three answers is classified, and only under its own status", () => {
  assert.deepEqual(containerRoom(503, FULL), { kind: "full", status: 503 });
  assert.deepEqual(containerRoom(429, RATE), { kind: "rate", status: 429 });
  assert.deepEqual(containerRoom(500, START), { kind: "start", status: 500 });
  assert.deepEqual(containerRoom("503", FULL), { kind: "full", status: 503 }, "a string status is a status");
  // THE STATUS AND THE WORDS TOGETHER. The words under another status are a
  // page that quotes them; the status with other words is the build server's
  // own 500 or a runtime answer this module knows nothing about.
  assert.equal(containerRoom(200, FULL), null);
  assert.equal(containerRoom(503, RATE), null);
  assert.equal(containerRoom(429, FULL), null);
  assert.equal(containerRoom(500, FULL), null);
  assert.equal(containerRoom(503, "Service Unavailable"), null, "unknown text is not waited on");
  assert.equal(containerRoom(500, "TypeError: cannot read properties of undefined\n    at build"), null, "a crash is not a start failure");
  assert.equal(containerRoom(503, ""), null);
  assert.equal(containerRoom(0, FULL), null);
  assert.equal(containerRoom(undefined, undefined), null);
});

test("a JSON body is never a room problem, whatever the status", () => {
  // The instance was reached and the build server judged something. A refusal
  // it wrote is the customer's page, not our capacity, and must parse as before.
  assert.equal(containerRoom(503, '{"ok":false,"stage":"build","error":"vite exited 1"}'), null);
  assert.equal(containerRoom(429, "[]"), null);
  assert.equal(containerRoom(500, '  {"ok":false,"error":"Failed to start container: quoted"}'), null);
  assert.equal(containerRoom(200, '{"ok":true}'), null);
  // THE WORDS INSIDE JSON ARE THE BUILD SERVER QUOTING THEM. This is the one
  // case the JSON rule decides on its own: under the right status, with the
  // library's own words, only the shape says the instance was reached. A
  // sweep found the rule inert against every fixture above (each lacked the
  // words as well), which is the recorded "inert mutant" trap — these two are
  // what make it load-bearing.
  assert.equal(containerRoom(503, '{"ok":false,"error":"' + FULL.split("\n")[0] + '"}'), null,
    "a JSON 503 carrying the library's words is read as the library's refusal");
  assert.equal(containerRoom(429, '{"error":"' + RATE + '"}'), null,
    "a JSON 429 carrying the library's words is read as the library's refusal");
});

test("only full and rate are waited for; a start failure is named and returned at once", () => {
  assert.equal(roomWaits({ kind: "full" }), true);
  assert.equal(roomWaits({ kind: "rate" }), true);
  assert.equal(roomWaits({ kind: "start" }), false);
  assert.equal(roomWaits(null), false);
  assert.equal(roomWaits(undefined), false);
});

test("the delay grows, is capped per kind, and jitters within a quarter either way", () => {
  const mid = () => 0.5, low = () => 0, high = () => 1;
  // rate: seconds, not tens — a burst passes in a second
  assert.equal(roomDelayMs("rate", 0, mid), 1000);
  assert.equal(roomDelayMs("rate", 1, mid), 2000);
  assert.equal(roomDelayMs("rate", 2, mid), 4000);
  assert.equal(roomDelayMs("rate", 3, mid), 8000);
  assert.equal(roomDelayMs("rate", 10, mid), RATE_WAIT_MAX_MS, "the rate ceiling holds");
  // full: an instance frees when a build ends — polled in seconds, capped at 30
  assert.equal(roomDelayMs("full", 0, mid), 5000);
  assert.equal(roomDelayMs("full", 1, mid), 10000);
  assert.equal(roomDelayMs("full", 2, mid), 20000);
  assert.equal(roomDelayMs("full", 3, mid), FULL_WAIT_MAX_MS);
  assert.equal(roomDelayMs("full", 30, mid), FULL_WAIT_MAX_MS, "the full ceiling holds");
  // never faster than the cold start it waits to make
  assert.ok(roomDelayMs("full", 0, low) >= 2453, "a full wait is shorter than a cold start");
  // jitter: ±25%, and a broken random source is a mid one
  assert.equal(roomDelayMs("full", 0, low), 3750);
  assert.equal(roomDelayMs("full", 0, high), 6250);
  assert.equal(roomDelayMs("full", 0, () => NaN), 5000);
  assert.equal(roomDelayMs("full", 0, () => 7), 6250, "a source over 1 is clamped");
  assert.equal(roomDelayMs("full", -3, mid), 5000, "a negative attempt is the first");
  // monotone in the attempt at a fixed source
  let prev = 0;
  for (let n = 0; n < 8; n++) { const d = roomDelayMs("full", n, mid); assert.ok(d >= prev); prev = d; }
});

/** A fake clock that the fake sleep advances, so `now` and `waited` agree. */
function clock(start = 1_000_000) {
  let t = start;
  const slept = [];
  return {
    now: () => t,
    sleep: async (ms) => { slept.push(ms); t += ms; },
    slept,
    tick: (ms) => { t += ms; },
  };
}

test("withRoom returns a non-room answer at once, with nothing slept", async () => {
  const c = clock();
  let calls = 0;
  const out = await withRoom(async () => { calls++; return { status: 200, text: '{"ok":true}' }; },
    { deadline: c.now() + 600_000, floorMs: 180_000, now: c.now, sleep: c.sleep, rand: () => 0.5 });
  assert.equal(calls, 1);
  assert.deepEqual(out, { answer: { status: 200, text: '{"ok":true}' }, room: null, attempts: 0, waited: 0 });
  assert.deepEqual(c.slept, []);
  // A refusal the build server wrote is returned the same way: its body is the
  // caller's to parse, not this loop's to retry.
  const out2 = await withRoom(async () => ({ status: 500, text: '{"ok":false,"stage":"build"}' }),
    { deadline: c.now() + 600_000, floorMs: 180_000, now: c.now, sleep: c.sleep });
  assert.equal(out2.room, null);
  assert.deepEqual(c.slept, []);
});

test("withRoom waits out a full instance and hands back the eventual answer", async () => {
  const c = clock();
  const answers = [{ status: 503, text: FULL }, { status: 503, text: FULL }, { status: 200, text: '{"ok":true,"files":{}}' }];
  const waits = [];
  const out = await withRoom(async () => answers.shift(),
    { deadline: c.now() + 600_000, floorMs: 180_000, now: c.now, sleep: c.sleep, rand: () => 0.5, onWait: (w) => waits.push(w) });
  assert.equal(out.room, null, "the eventual answer is not a room problem");
  assert.equal(out.answer.text, '{"ok":true,"files":{}}');
  assert.equal(out.attempts, 2);
  assert.deepEqual(c.slept, [5000, 10000], "the second wait is longer than the first");
  assert.equal(out.waited, 15000);
  assert.deepEqual(waits, [
    { kind: "full", attempt: 0, delayMs: 5000, status: 503 },
    { kind: "full", attempt: 1, delayMs: 10000, status: 503 },
  ]);
});

test("a rate limit is waited in seconds, and the burst is over by the second try", async () => {
  const c = clock();
  const answers = [{ status: 429, text: RATE }, { status: 200, text: '{"ok":true}' }];
  const out = await withRoom(async () => answers.shift(),
    { deadline: c.now() + 600_000, floorMs: 180_000, now: c.now, sleep: c.sleep, rand: () => 0.5 });
  assert.equal(out.room, null);
  assert.deepEqual(c.slept, [1000]);
  assert.ok(c.slept[0] <= RATE_WAIT_MAX_MS);
});

test("the wait never eats the floor: it stops when the next wait plus the compile would pass the deadline", async () => {
  // Exactly the floor left after the first wait fits; one more does not.
  const c = clock();
  const answers = [{ status: 503, text: FULL }, { status: 503, text: FULL }, { status: 503, text: FULL }];
  const out = await withRoom(async () => answers.shift(),
    { deadline: c.now() + 5000 + 180_000 + 1, floorMs: 180_000, now: c.now, sleep: c.sleep, rand: () => 0.5 });
  assert.deepEqual(out.room, { kind: "full", status: 503 }, "the wait ran out on a full instance and says so");
  assert.equal(out.attempts, 1, "one wait fitted");
  assert.deepEqual(c.slept, [5000]);
  assert.equal(out.waited, 5000);
  assert.equal(out.answer.status, 503, "the last answer comes back for the caller to name");
  // With no room for even the first wait, nothing is slept at all.
  const c2 = clock();
  const out2 = await withRoom(async () => ({ status: 503, text: FULL }),
    { deadline: c2.now() + 180_000 + 4999, floorMs: 180_000, now: c2.now, sleep: c2.sleep, rand: () => 0.5 });
  assert.equal(out2.attempts, 0);
  assert.deepEqual(c2.slept, []);
  assert.equal(out2.room.kind, "full");
  // And a deadline already passed is a wait of zero, not a negative one.
  const c3 = clock();
  const out3 = await withRoom(async () => ({ status: 429, text: RATE }),
    { deadline: c3.now() - 1, floorMs: 0, now: c3.now, sleep: c3.sleep });
  assert.equal(out3.attempts, 0);
  assert.equal(out3.room.kind, "rate");
});

test("a start failure is returned at once, named, never waited for", async () => {
  const c = clock();
  let calls = 0;
  const out = await withRoom(async () => { calls++; return { status: 500, text: START }; },
    { deadline: c.now() + 600_000, floorMs: 0, now: c.now, sleep: c.sleep });
  assert.equal(calls, 1);
  assert.deepEqual(out.room, { kind: "start", status: 500 });
  assert.deepEqual(c.slept, []);
});

test("a listener that throws does not break the wait, and the loop needs no options at all", async () => {
  const c = clock();
  const answers = [{ status: 503, text: FULL }, { status: 200, text: "{}" }];
  const out = await withRoom(async () => answers.shift(),
    { deadline: c.now() + 600_000, now: c.now, sleep: c.sleep, rand: () => 0.5, onWait: () => { throw new Error("listener"); } });
  assert.equal(out.room, null);
  assert.equal(out.attempts, 1);
  // No options: a non-room answer needs no clock and no sleep.
  const bare = await withRoom(async () => ({ status: 200, text: "{}" }));
  assert.equal(bare.room, null);
});

test("the customer's sentence says ours, says nothing was charged, and says which of the three", () => {
  const s = ["full", "rate", "start"].map(roomSentence);
  assert.equal(new Set(s).size, 3, "the three kinds read as one sentence");
  for (const x of s) {
    assert.match(x, /our build service/);
    assert.match(x, /Nothing was charged/);
    assert.doesNotMatch(x, /describ/, "the customer's words are not blamed");
  }
  assert.match(roomSentence("full"), /full right now/);
  assert.match(roomSentence("rate"), /too many sites at once/);
  assert.match(roomSentence("start"), /could not start/);
  assert.equal(roomSentence(undefined), roomSentence("full"), "an unknown kind reads as full, the common one");
});

// ── THE WIRE ─────────────────────────────────────────────────────────────────
//
// The module above is correct on its own and was dead until both container
// call sites went through it — the recorded wiring trap. These read the Worker
// for the property (the fetch inside the loop, the floor, one clock for the
// wait and the call, the failure named as ours) and DRIVE the one sentence a
// customer reads.

const WORKER = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const PP = readFileSync(new URL("../builder/publish-pages.mjs", import.meta.url), "utf8");
// Whole-line comments blanked, length-preserving, so prose about the thing
// cannot stand in for the thing (the "prose contains the thing it forbids" trap).
const CODE = WORKER.replace(/^(\s*)\/\/.*$/gm, (m) => " ".repeat(m.length));

test("both compile call sites fetch INSIDE the room loop, with the compile's floor and one clock", () => {
  // The endpoint is also hit by two SMOKE probes (`smoke: true` on the same
  // line), which compile a fixture and are not publish paths; the two that
  // publish a customer's site are the ones that must wait for room.
  const sites = [];
  for (let i = CODE.indexOf('"http://build/build"'); i >= 0; i = CODE.indexOf('"http://build/build"', i + 1)) {
    const line = CODE.slice(CODE.lastIndexOf("\n", i) + 1, CODE.indexOf("\n", i));
    if (!/smoke: true/.test(line)) sites.push(i);
  }
  assert.equal(sites.length, 2, "the compile endpoint is called from " + sites.length + " publish paths — re-anchor this guard");
  for (const i of sites) {
    // The container handle is taken, THEN the loop opens, THEN the fetch — so
    // the loop wraps the call and not the other way round.
    const handle = CODE.lastIndexOf("getContainer(env.SITE_BUILD_CONTAINER", i);
    const loop = CODE.lastIndexOf("await withRoom(async () =>", i);
    assert.ok(handle > 0 && loop > handle, "the compile fetch at " + i + " is not inside withRoom");
    // The call's own answer line is the last line of the window: the status
    // and the body-as-text are read on it.
    const call = CODE.slice(loop, CODE.indexOf("\n", CODE.indexOf("return { status:", i)));
    // Each attempt is bounded by what is LEFT of the cap, never a fresh cap.
    assert.match(call, /signal: AbortSignal\.timeout\(Math\.max\(1000, \w+Deadline - Date\.now\(\)\)\)/,
      "an attempt at " + i + " does not share the wait's clock");
    assert.match(call, /text: await \w+\.text\(\)\.catch\(\(\) => ""\)/, "the body is not read as text for the classifier");
    // The options: the deadline and the compile's floor, read from where it lives.
    const opts = CODE.slice(CODE.indexOf("return { status:", i), CODE.indexOf("});", CODE.indexOf("floorMs:", i)) + 3);
    assert.match(opts, /deadline: \w+Deadline, floorMs: MIN_BUILD_MS/, "the loop at " + i + " does not hold the compile's floor back");
  }
  assert.match(CODE, /^import \{ withRoom, roomSentence \} from "\.\/builder\/container-room\.mjs";/m);
  assert.match(CODE, /^\s+MIN_BUILD_MS,\n\} from "\.\/builder\/edit-job\.mjs";/m, "MIN_BUILD_MS is not read from edit-job.mjs");
});

test("the spine names a room failure as ours, and the build path as a free build-stage failure", () => {
  // The spine: the loop's answer is returned with `room`, and the failure shape
  // marks `ours` on it — the gate `compileMsg` opens with.
  const spine = CODE.slice(CODE.indexOf("async function recompileAndPublish"), CODE.indexOf("async function siteRedirectFor"));
  assert.ok(spine.length > 1000, "the spine moved");
  assert.match(spine, /if \(cRoom\) \{[\s\S]{0,600}return \{ ok: false, error: "the build service had no room: " \+ cRoom\.kind, room: cRoom\.kind \};/);
  assert.match(spine, /ours: \(killed && wasKilled\(built && built\.error\)\) \|\| timedOut \|\| !!room, timedOut, room,/,
    "a room failure is not marked as ours on the spine's failure shape");
  assert.match(spine, /const body = JSON\.parse\(rr\.text\) \|\| \{\};/, "the spine no longer parses the loop's answer");
  // The build path: stage "build" (free, `ourFault`) with the kind, and the
  // parse reads the loop's text.
  // The build path sits AFTER the spine in the file, so its window runs to the
  // next top-level declaration rather than to the spine.
  const bStart = CODE.indexOf("async function buildAndPublishPages");
  const nextTop = /\n(?:async function |function |export |const [a-zA-Z_$]+ = )/g;
  nextTop.lastIndex = bStart + 1;
  const m = nextTop.exec(CODE);
  const build = CODE.slice(bStart, m ? m.index : CODE.length);
  assert.ok(bStart > 0 && build.length > 1000, "the build path moved");
  assert.match(build, /if \(bRoom\) \{[\s\S]{0,400}ok: false, stage: "build", room: bRoom\.kind,/);
  assert.match(build, /const raw = r\.text;/, "the build path reads the body a second time");
  // publish-pages: no immediate retry after a wait that ran out, and the note
  // names our capacity rather than the pages.
  assert.match(PP, /if \(!bd\.ok && bd\.stage === "build" && !bd\.room\) \{/);
  assert.match(PP, /if \(built\.room\) out\.room = String\(built\.room\);/);
  assert.match(PP, /built\.room\n\s+\? "Our build service had no room to compile the pages/);
});

test("compileMsg says which room problem it was, before the clock and before the restarting sentence", () => {
  const start = CODE.indexOf("function compileMsg(");
  const end = CODE.indexOf("\n}\n", start);
  assert.ok(start > 0 && end > start, "compileMsg moved");
  const src = CODE.slice(start, end) + "\n}";
  // ORDER, read: the room branch sits before the clock's and the generic tail.
  assert.ok(src.indexOf("pub.room") > 0 && src.indexOf("pub.room") < src.indexOf("pub.timedOut"), "the room branch is after the clock's");
  // DRIVEN, with the module's own sentence handed in.
  const compileMsg = new Function("roomSentence", src + "\nreturn compileMsg;")(roomSentence);
  const theirs = "That didn't compile — try describing it differently.";
  assert.equal(compileMsg({ ours: true, room: "full" }, theirs), roomSentence("full"));
  assert.equal(compileMsg({ ours: true, room: "rate" }, theirs), roomSentence("rate"));
  assert.equal(compileMsg({ ours: true, room: "start" }, theirs), roomSentence("start"));
  // A room failure that also timed out is a room failure: the more specific cause wins.
  assert.equal(compileMsg({ ours: true, room: "full", timedOut: true }, theirs), roomSentence("full"));
  // Without `ours` the gate holds — which is why the spine sets it.
  assert.equal(compileMsg({ ours: false, room: "full" }, theirs), theirs);
  // And the sentences it already had are untouched.
  assert.match(compileMsg({ ours: true, timedOut: true }, theirs), /longer than the time we allow/);
  assert.match(compileMsg({ ours: true, error: "compile" }, theirs), /restarting/);
  assert.match(compileMsg({ ours: true, error: "read" }, theirs), /saved design/);
  assert.match(compileMsg({ ours: true, error: "not-granted", detail: "unbilled" }, theirs), /unbilled/);
});
