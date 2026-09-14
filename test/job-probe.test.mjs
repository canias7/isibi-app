// THE TWO QUESTIONS ONLY THE CONTAINER CAN ANSWER.
//
// Owner, 2026-09-14: *"Test duration and transport separately… Test the long AI
// connection separately so proof doesn't depend on the model randomly answering
// slowly."*
//
// WHAT THIS FILE CAN AND CANNOT DO, said once so nothing here is read as more
// than it is. It proves the probe is WIRED and BOUNDED and says the right thing
// about each outcome. It cannot prove the wall: that reading only exists after a
// real container runs one, which is the whole reason the probe exists.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  PROBE_KIND, PROBE_SHAPES, PROBE_MAX_MS, PROBE_SLICE_MS, PROBE_DEFAULT_MS, WIRE_TRICKLE_MS,
  readProbe, probeHold, probeWire, wireCall, runProbe, holdVerdict, wireVerdict,
  wireCallBoundMs, WIRE_CALL_SLACK_MS,
} from "../builder/job-probe.mjs";
import { JOB_MAX_MS } from "../builder/job-duration.mjs";
import { readLaunch } from "../builder/container-job.mjs";
import { gatewayHandler, readWire, WIRE_MAX_MS, WIRE_DEFAULT_MS, WIRE_MIN_TICK_MS } from "../builder/job-gateway.mjs";
import { laneName } from "../builder/build-lane.mjs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";

const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
// Prose about a route names the route — the recorded own-goal. Line comments
// first, and the landmarks asserted to have survived.
const NO_COMMENTS = WORKER.split("\n").map((l) => (/^\s*\/\//.test(l) ? "" : l)).join("\n");

test("the probe's bound is DERIVED from the job's own setting and sits under it", () => {
  // An instrument that can hold a lane longer than the work it measures is a way
  // to starve the platform; one that cannot outlast the wall it measures answers
  // nothing. Both directions, and neither is a typed number.
  assert.ok(PROBE_MAX_MS < JOB_MAX_MS, "a probe may occupy a lane longer than a real job can run");
  assert.ok(PROBE_MAX_MS > 15 * 60_000, "the probe cannot reach past fifteen minutes, which is the number in question");
  assert.equal(PROBE_MAX_MS, JOB_MAX_MS - 5 * 60_000, "the bound stopped being derived from the setting");
  // And the DEFAULT ask is past fifteen minutes, because a probe whose default
  // lands under the number in question proves nothing by being run.
  assert.ok(PROBE_DEFAULT_MS > 15 * 60_000, "the default probe does not reach past fifteen minutes");
  assert.ok(PROBE_DEFAULT_MS <= PROBE_MAX_MS);
  // The wire op's own ceiling is ABOVE the 270-second wall it exists to measure.
  assert.ok(WIRE_MAX_MS > 270_000, "the wire probe cannot be asked to outlast the wall it measures");
  assert.ok(WIRE_MAX_MS < PROBE_MAX_MS, "one wire call may outlast the job holding it");
});

test("readProbe REFUSES an unknown shape by name and CLAMPS a duration — the two must not be the same answer", () => {
  assert.deepEqual(readProbe({}), { shape: "hold", ms: PROBE_DEFAULT_MS, everyMs: WIRE_TRICKLE_MS });
  assert.equal(readProbe({ probe: "wire" }).shape, "wire");
  // A shape nobody recognises must never fall to `hold`: that would report a
  // duration answer to somebody who asked about the transport.
  assert.throws(() => readProbe({ probe: "nonsense" }), /not one this runner runs/);
  // AN ABSENT SHAPE IS NOT AN UNKNOWN ONE. `""`, null and undefined all mean
  // "the caller said nothing", which is the default; only a name nobody
  // recognises is a refusal. Stated as a case because the two look alike from
  // one line of code and mean opposite things to whoever is running the probe.
  for (const nothing of ["", null, undefined]) assert.equal(readProbe({ probe: nothing }).shape, "hold");
  // CLAMPED rather than refused — an instrument that errors on a too-big
  // argument is one somebody re-runs smaller and mis-reads.
  assert.equal(readProbe({ ms: 99 * 60_000 }).ms, PROBE_MAX_MS);
  assert.equal(readProbe({ ms: 1 }).ms, 1000);
  assert.equal(readProbe({ ms: -5 }).ms, 1000);
  // NON-NUMBERS FALL TO THE DEFAULT, NEVER COERCED — `Number(["600000"])` is
  // 600000, shipped in this repository as a real bug three times.
  for (const junk of [["600000"], "600000", {}, null, undefined, true, NaN, Infinity]) {
    assert.equal(readProbe({ ms: junk }).ms, PROBE_DEFAULT_MS, "a non-number duration was taken: " + JSON.stringify(junk));
  }
  // The tick can never outrun the call it ticks inside.
  assert.equal(readProbe({ ms: 5000, everyMs: 60_000 }).everyMs, 5000);
  assert.equal(readProbe({ ms: 60_000, everyMs: ["20000"] }).everyMs, WIRE_TRICKLE_MS);
});

test("probeHold occupies a child for the time asked and PULSES, so a kill is told from a crash — DRIVEN", async () => {
  let t = 1_000_000;
  const lines = [];
  const out = await probeHold(20 * 60_000, {
    now: () => t, sleep: async (ms) => { t += ms; }, log: (l) => lines.push(l),
  });
  assert.equal(out.ok, true);
  assert.equal(out.ranMs, 20 * 60_000);
  assert.equal(out.slices, 20, "the pulse is not one line a minute: " + out.slices);
  // THE PULSE IS THE READING. The build service keeps the last five stdout lines
  // on a job's record, so a probe killed at minute fourteen and one that ran to
  // twenty are told apart by what the tail SAYS — an absent final line is also
  // what a crash produces, and cannot-tell must not read as an answer.
  assert.equal(lines.length, 20);
  assert.deepEqual(lines[0], { probe: "hold", slice: 1, elapsedMs: PROBE_SLICE_MS, askedMs: 20 * 60_000 });
  assert.equal(lines.at(-1).elapsedMs, 20 * 60_000);
  // A SHORT ASK STILL PULSES ONCE AND DOES NOT OVERSHOOT.
  t = 0;
  const short = await probeHold(25_000, { now: () => t, sleep: async (ms) => { t += ms; }, log: () => {} });
  assert.equal(short.ranMs, 25_000, "a hold shorter than one slice overshot to a whole slice");
  assert.equal(short.slices, 1);
});

test("probeHold honours the stop signal, and says it was stopped rather than answering ok", async () => {
  let t = 0;
  const stop = { aborted: false };
  const out = await probeHold(20 * 60_000, {
    now: () => t,
    sleep: async (ms) => { t += ms; if (t >= 3 * PROBE_SLICE_MS) stop.aborted = true; },
    log: () => {}, stop,
  });
  assert.equal(out.ok, false, "a stopped probe reported success");
  assert.equal(out.stopped, true);
  assert.ok(out.ranMs < 20 * 60_000, "a stopped probe claimed the whole run");
});

test("wireCall reports a REFUSAL as a survived connection and a THROW with the wire's own account — DRIVEN", async () => {
  // ANY STATUS AT ALL MEANS THE CONNECTION LIVED, which is the question. Reading
  // a 403 as a failed wire would report a working egress as a dead one — the
  // recorded inversion the egress probe next door exists to avoid.
  const refused = await wireCall(async () => ({ status: 403, text: async () => "nope" }), "https://x/wire", "t", {});
  assert.equal(refused.ok, true, "a refused request was read as a dead wire");
  assert.equal(refused.status, 403);

  // A THROW CARRIES THE FALSIFIER. `headersMs: -1, chars: 0` is a death before
  // any byte moved (an idle kill, which streaming fixes); `chars > 0` is a death
  // with the stream open (a lifetime cap, which it cannot).
  const quietDeath = Object.assign(new TypeError("fetch failed"), {
    cause: { code: "ECONNRESET" }, wire: { headersMs: -1, chars: 0 },
  });
  const a = await wireCall(async () => { throw quietDeath; }, "https://x/wire", "t", {});
  assert.equal(a.ok, false);
  assert.equal(a.cause, "ECONNRESET");
  assert.equal(a.headersMs, -1);
  assert.equal(a.chars, 0);
  const lateDeath = Object.assign(new Error("socket hang up"), { wire: { headersMs: 120, chars: 4096 } });
  const b = await wireCall(async () => { throw lateDeath; }, "https://x/wire", "t", {});
  assert.equal(b.headersMs, 120);
  assert.equal(b.chars, 4096, "a death with bytes moving is indistinguishable from a quiet one");

  // THE TOKEN AND THE BODY REALLY GO OUT — the wiring trap, in the one call the
  // whole probe is.
  let seen = null;
  await wireCall(async (u, init) => { seen = { u, init }; return { status: 200, text: async () => "" }; },
    "https://x/api/job/j1/wire", "tok-9", { mode: "quiet", ms: 300000 });
  assert.equal(seen.u, "https://x/api/job/j1/wire");
  assert.equal(seen.init.headers.authorization, "Bearer tok-9");
  assert.deepEqual(JSON.parse(seen.init.body), { mode: "quiet", ms: 300000 });
});

test("probeWire runs quiet FIRST, never races the two, and NAMES the reading — DRIVEN over all four outcomes", async () => {
  const run = async (quietOk, trickleOk) => {
    const order = [];
    let live = 0, maxLive = 0;
    const send = async (_u, init) => {
      const body = JSON.parse(init.body);
      order.push(body.mode);
      live++; maxLive = Math.max(maxLive, live);
      await new Promise((r) => setTimeout(r, 1));
      live--;
      const ok = body.mode === "quiet" ? quietOk : trickleOk;
      if (!ok) throw Object.assign(new Error("dead"), { wire: { headersMs: -1, chars: 0 } });
      if (init.onData) init.onData("   ");
      return { status: 200, text: async () => "ok" };
    };
    const out = await probeWire({ url: "https://x/api/job/j1/", token: "t" }, { ms: 1000, everyMs: 500 }, { send });
    return { out, order, maxLive };
  };

  const idle = await run(false, true);
  assert.deepEqual(idle.order, ["quiet", "trickle"], "quiet is not asked first");
  assert.equal(idle.maxLive, 1, "the two calls were raced — one could have kept the other's path warm");
  assert.equal(idle.out.reading, "idle-kill");
  assert.equal(idle.out.ok, true, "a probe that learned something reported failure");

  assert.equal((await run(true, true)).out.reading, "no-wall");
  assert.equal((await run(false, false)).out.reading, "lifetime-cap");
  assert.equal((await run(true, false)).out.reading, "quiet-survived-trickle-did-not");
  // The trailing slash on the gateway url is not doubled into the path.
  const seen = [];
  await probeWire({ url: "https://x/api/job/j1/", token: "t" }, { ms: 1000, everyMs: 500 },
    { send: async (u) => { seen.push(u); return { status: 200, text: async () => "" }; } });
  assert.deepEqual(seen, ["https://x/api/job/j1/wire", "https://x/api/job/j1/wire"]);
});

test("the reading gets a LINE OF ITS OWN, because the only place it can be read truncates at 300", async () => {
  // THE FLOOR IS DERIVED FROM THE CONSUMER, never retyped — the tail is
  // `build-server.mjs`'s and a second copy of its number here is two lists of
  // the same thing with a container between them.
  const server = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
  const m = server.match(/tail\.push\(line\.slice\(0,\s*(\d+)\)\)/);
  assert.ok(m, "build-server no longer slices its tail the way this guard reads it — re-derive the floor");
  const SLICE = Number(m[1]);
  assert.ok(Number.isFinite(SLICE) && SLICE > 0, "the tail floor did not read as a number");

  // THE WORST CASE THE PROBE CAN REALLY PRODUCE: `wireCall` slices a provider's
  // message at 200, so that is the longest `error` a reading can sit behind.
  const long = "x".repeat(200);
  const lines = [];
  const out = await probeWire({ url: "https://x/api/job/j1/", token: "t" }, { ms: 300000, everyMs: 20000 }, {
    log: (o) => lines.push(o),
    send: async (_u, init) => {
      const body = JSON.parse(init.body);
      if (body.mode === "quiet") throw Object.assign(new Error(long), { wire: { headersMs: -1, chars: 0 } });
      if (init.onData) init.onData("   ");
      return { status: 200, text: async () => "ok" };
    },
  });
  assert.equal(out.reading, "idle-kill");

  // TWO DEFENCES, AND THE OBSERVER IS PROVED ALIVE OFF THE SHAPE THAT REALLY
  // TRUNCATED — not off today's, which both walls already save.
  //
  // (1) THE DEDICATED LINE. Independent of the answer object's shape.
  const own = lines.filter((o) => o.probe === "wire" && typeof o.reading === "string");
  assert.equal(own.length, 1, "the reading is not emitted on exactly one line of its own");
  const line = JSON.stringify(own[0]);
  assert.ok(line.length <= SLICE, "the reading's own line is over the tail's floor: " + line.length);
  assert.ok(line.slice(0, SLICE).includes("idle-kill"), "the reading did not survive its own line");

  // (2) THE FIELD ORDER. `reading` sits ahead of `quiet`/`trickle`, so the
  // whole-answer line `runJob` emits carries it early enough to survive too.
  const whole = JSON.stringify({ job: "j1", kind: "probe", ...out });
  assert.ok(whole.slice(0, SLICE).includes("idle-kill"),
    "the verdict fell out of the whole-answer line's first " + SLICE + " characters");

  // (3) THE ALIVE OBSERVER: the PRE-FIX shape — verdict last, no line of its
  // own — really is truncated away by this same floor. Without this the two
  // assertions above would pass over a tail that had never been at risk, which
  // is this repository's own "a negative assertion must prove its observer is
  // alive" pointed at a redundancy. MEASURED at 300 exactly on the first read,
  // which is no margin at all.
  const { reading: verdict, ...rest } = out;
  const before = JSON.stringify({ job: "j1", kind: "probe", ...rest, reading: verdict });
  assert.ok(!before.slice(0, SLICE).includes("idle-kill"),
    "the pre-fix shape now survives the slice, so neither defence is load-bearing — re-measure before keeping them");
});

test("both verdicts FAIL CLOSED, and the runner re-derives neither — DRIVEN", () => {
  // THE DURATION ANSWER. `pastMin` is handed in so the case can prove the
  // boundary rather than only the default, and every cannot-tell shape has to
  // land on NOT PROVEN: an instrument that reports success it did not earn is
  // worse than one that goes quiet.
  assert.equal(holdVerdict({ ms: 20 * 60_000, code: 0 }).proven, true);
  assert.equal(holdVerdict({ ms: 15 * 60_000, code: 0 }).proven, false, "exactly fifteen is not PAST fifteen");
  assert.equal(holdVerdict({ ms: 15 * 60_000 + 1, code: 0 }).proven, true, "one millisecond past fifteen is past it");
  assert.equal(holdVerdict({ ms: 20 * 60_000, code: 1 }).proven, false, "a failed exit read as proven");
  assert.equal(holdVerdict({ ms: 20 * 60_000, code: 0, signal: "SIGTERM" }).proven, false, "a killed child read as proven");
  assert.equal(holdVerdict({ ms: 20 * 60_000, code: null }).proven, false, "a missing exit code read as clean");
  assert.equal(holdVerdict({ code: 0 }).proven, false, "a record with no elapsed time read as proven");
  for (const junk of [null, undefined, {}, { ms: "20 minutes", code: "0" }, { ms: NaN, code: 0 }]) {
    assert.equal(holdVerdict(junk).proven, false, "an unreadable record read as proven: " + JSON.stringify(junk));
  }
  // The sentence names which of the two halves failed, because they need
  // different next moves — one is the clock, the other is the child.
  assert.match(holdVerdict({ ms: 20 * 60_000, code: 1 }).why, /past 15 minutes but did not end cleanly/);
  assert.match(holdVerdict({ ms: 60_000, code: 0 }).why, /did not reach 15 minutes/);

  // THE WIRE READING. A tail with no reading answers null, never a default —
  // a shape nobody recognised silently becoming one of the four would report a
  // wall that was never measured.
  assert.equal(wireVerdict(['{"probe":"wire","reading":"idle-kill","quiet":false,"trickle":true}']).reading, "idle-kill");
  assert.equal(wireVerdict(["not json at all", '{"probe":"wire","reading":"no-wall"}']).reading, "no-wall");
  assert.equal(wireVerdict([]).reading, null);
  assert.equal(wireVerdict(null).reading, null);
  assert.equal(wireVerdict(['{"probe":"hold","slice":3}']).reading, null, "a hold pulse read as a wire reading");
  // A TRUNCATED line is the case this whole fix exists for: it CONTAINS
  // `"reading"` and does not parse, and must answer null rather than throwing.
  assert.equal(wireVerdict(['{"probe":"wire","reading":"idle-ki']).reading, null);
  assert.equal(wireVerdict(['{"probe":"wire","reading":""}']).reading, null, "an empty reading read as an answer");
  assert.equal(wireVerdict(['{"probe":"wire","reading":123}']).reading, null, "a non-string reading read as an answer");

  // AND THE RUNNER ASKS THEM RATHER THAN CARRYING ITS OWN COPY. The old shape
  // was a `tail.find(...)` plus a `JSON.parse` in `scripts/`, which is a second
  // reader of a log line this module writes.
  const runner = fs.readFileSync(new URL("../scripts/job-probe.mjs", import.meta.url), "utf8");
  // MEMBERSHIP, NEVER THE WHOLE LINE. This pinned the import list verbatim and
  // went red the moment an honest third name arrived — the recorded "pinning a
  // list by its last element"; being last is never the property.
  assert.match(runner, /import \{[^}]*\bholdVerdict\b[^}]*\} from "\.\.\/builder\/job-probe\.mjs"/, "the runner does not import holdVerdict");
  assert.match(runner, /import \{[^}]*\bwireVerdict\b[^}]*\} from "\.\.\/builder\/job-probe\.mjs"/, "the runner does not import wireVerdict");
  assert.ok(!/tail\.find\(/.test(runner), "the runner still finds the reading line itself");
  assert.ok(!/JSON\.parse\(readingLine\)/.test(runner), "the runner still parses the reading itself");
});

test("the probe has a DOOR the owner can press: dispatch-only, every input wired, no secret printed", () => {
  const wf = fs.readFileSync(new URL("../.github/workflows/job-probe.yml", import.meta.url), "utf8");
  const runner = fs.readFileSync(new URL("../scripts/job-probe.mjs", import.meta.url), "utf8");

  // DISPATCH ONLY. A push trigger here holds a build lane on every typo fix, and
  // `merge-triggers` is a census over pushes to MAIN — it could not see a
  // `branches-ignore` one. Both halves: no live trigger, and no parked block
  // somebody uncomments without re-reading why it is not there.
  assert.match(wf, /^on:\n\s+workflow_dispatch:/m, "the probe is no longer dispatch-only");
  assert.ok(!/^\s*push:/m.test(wf), "a push trigger reached the probe workflow");
  assert.ok(!/#\s*push:/m.test(wf), "a parked push block reached the probe workflow");

  // EVERY ENVIRONMENT NAME THE SCRIPT READS IS SUPPLIED, DERIVED FROM THE SCRIPT
  // rather than listed here — two lists of the same thing with a runner between
  // them is how a probe fires with a shape nobody asked for. `SUPABASE_URL`,
  // `SUPABASE_ANON_KEY` and `PROBE_LOG` are the three with real defaults in the
  // script and are deliberately not passed, so the set is filtered by that.
  const reads = [...new Set([...runner.matchAll(/process\.env\.([A-Z_]+)/g)].map((m) => m[1]))];
  assert.ok(reads.length >= 6, "the env reader found almost nothing — re-anchor it");
  const OPTIONAL = new Set(["SUPABASE_URL", "SUPABASE_ANON_KEY", "PROBE_LOG"]);
  for (const name of reads) {
    if (OPTIONAL.has(name)) continue;
    assert.match(wf, new RegExp("^\\s+" + name + ":", "m"), name + " is read by the script and set by nothing");
  }
  // …and the four dispatch inputs really reach it, by name.
  for (const input of ["probe", "ms", "everyMs", "site"]) {
    assert.ok(wf.includes("github.event.inputs." + input), "input " + input + " is declared and never forwarded");
  }
  assert.match(wf, /run: node scripts\/job-probe\.mjs/, "the workflow no longer runs the probe script");

  // THE FAILED RUN'S LOG IS THE ONE WORTH HAVING: NOT PROVEN and CANNOT TELL are
  // both readings, and the script exits non-zero for each.
  assert.match(wf, /if: always\(\)/, "the log is only kept when the probe passes");

  // A CANNOT-TELL NEVER EXITS GREEN. There are exactly two ways this run can
  // succeed — a hold that really ran past fifteen minutes, and a wire reading
  // that was really read — and four ways it can fail, of which two (the bound
  // and a vanished record) are cannot-tells rather than negatives. Counted
  // rather than positioned, because a count is what sees the vanished-record
  // branch being turned green, which is the one way this instrument can lie.
  const greens = (runner.match(/process\.exit\(0\)/g) || []).length;
  const reds = (runner.match(/process\.exit\(1\)/g) || []).length;
  assert.equal(greens, 2, "the runner has " + greens + " ways to exit green, not the two earned ones");
  assert.ok(reds >= 4, "the runner has only " + reds + " non-zero exits — a cannot-tell has become a pass");
  assert.match(runner, /ended\.gone[\s\S]{0,400}?CANNOT TELL[\s\S]{0,200}?process\.exit\(1\)/,
    "a job whose record vanished no longer reports CANNOT TELL and fails");

  // NO SECRET IS PRINTED. The script describes one by length and never shows it;
  // asserted over the producer, with the redactor's presence as the live observer.
  assert.match(runner, /const desc = \(v\) =>/, "the length-only redactor is gone");
  assert.ok(!/console\.log\([^)]*SERVICE_KEY/.test(runner), "the service key reaches a log line");
  assert.ok(!/log\([^)]*\bjwt\b[^)]*\)/.test(runner.replace(/desc\(jwt\)/g, "")), "the session token reaches a log line");
});

test("a probe launch is admitted by name, and runJob answers it WITHOUT importing the Worker tree", async () => {
  const launch = {
    v: 2, kind: PROBE_KIND, id: "probe-abcd1234", probe: "hold", ms: 3000,
    gateway: { url: "https://gofarther.dev/api/job/probe-abcd1234", token: "t" },
    sb: { url: "https://x.supabase.co" }, secrets: {}, buildPort: 8080,
  };
  const read = readLaunch(JSON.stringify(launch));
  assert.equal(read.kind, PROBE_KIND, "the runner refuses a probe launch");
  assert.ok(PROBE_SHAPES.includes("hold") && PROBE_SHAPES.includes("wire"));
  // AND A SHAPE IT CANNOT RUN IS STILL REFUSED, so the kind list did not become
  // a hole — the alive observer for the case above.
  assert.throws(() => readLaunch(JSON.stringify({ ...launch, kind: "whatever" })), /not one this runner runs/);

  // THE IMPORT IS THE PROPERTY. A probe measures this process and its socket, so
  // putting several hundred modules and a Supabase shim in front of it would put
  // the thing being measured behind a large pile of the thing that is not — and
  // a positional read cannot see whether the branch really runs.
  const { runJob } = await import("../builder/container-job.mjs");
  let imported = 0;
  const out = await runJob({ ...read, probe: "hold", ms: 2000 }, {
    importWorker: async () => { imported++; return {}; },
    log: () => {},
  });
  assert.equal(imported, 0, "a probe imported the whole Worker tree before measuring this process");
  assert.equal(out.ok, true);
  assert.equal(out.kind, PROBE_KIND);
  assert.equal(out.probe.shape, "hold");
  assert.ok(out.probe.ranMs >= 2000, "the probe did not really hold");
});

test("runProbe never throws, and names the reason — an instrument that dies silently is no instrument", async () => {
  const bad = await runProbe({ id: "j1", probe: "nonsense" }, { send: async () => ({ status: 200, text: async () => "" }) });
  assert.equal(bad.ok, false);
  assert.match(String(bad.error), /not one this runner runs/);
  assert.equal(bad.job, "j1");
  // A wire probe whose gateway is missing answers rather than throwing.
  const noGateway = await runProbe({ id: "j2", probe: "wire", ms: 1000 }, { send: async () => ({ status: 200, text: async () => "" }) });
  assert.equal(noGateway.ok, false);
  assert.equal(noGateway.job, "j2");
});

test("the gateway's /wire op: token-gated, both shapes, bounded, and an unknown mode refused — DRIVEN", async () => {
  const who = { id: "j1", slug: "p-j1", uid: "probe", pre: true };
  const held = [];
  const handle = gatewayHandler({
    bucket: null, verify: async (t) => (t === "good" ? who : null),
    waitUntil: (p) => { held.push(p); },
  });
  const post = (token, body) => new Request("https://gofarther.dev/api/job/j1/wire", {
    method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  assert.equal((await handle(post("bad", { mode: "quiet", ms: 1000 }), "j1")).status, 401, "an unsigned caller opened the wire op");
  assert.equal((await handle(post("good", { mode: "sideways", ms: 1000 }), "j1")).status, 400, "an unknown wire mode was taken");

  const t0 = Date.now();
  const quiet = await handle(post("good", { mode: "quiet", ms: 1200 }), "j1");
  assert.equal(quiet.status, 200);
  assert.deepEqual(await quiet.json(), { wire: "quiet", ms: 1200, everyMs: 0 });
  assert.ok(Date.now() - t0 >= 1100, "the quiet op answered at once, so it holds no connection at all");

  // THE TICK HAS A FLOOR OF A SECOND, HERE AND IN `readProbe`, and this case
  // asked for 300 ms on its first run and got 1000 — the recorded "a fixture in
  // a different shape from reality", where the product was right: a sub-second
  // tick measures nothing about a 270-second wall and is a way to make a Worker
  // do work. So the ask is a real cadence and the assertion is the PROPERTY —
  // bytes moved while the caller waited — not a count.
  const trickle = await handle(post("good", { mode: "trickle", ms: 3000, everyMs: 1000 }), "j1");
  assert.equal(trickle.status, 200);
  const text = await trickle.text();
  assert.ok(text.includes('"wire":"trickle"'), "the trickle op never said what it was: " + JSON.stringify(text.slice(0, 80)));
  assert.equal(JSON.parse(text.split("\n")[1]).everyMs, 1000, "the tick's floor stopped applying");
  assert.ok(text.split("\n")[0].length >= 2, "no bytes moved during the wait, which is the quiet shape wearing another name");
  // THE PUMP IS HELD. A Worker tears its context down once the response is
  // returned, so an unheld writer is cancelled mid-flight and the trickle stops
  // after one byte — this repository has already lost an audit log to exactly
  // that.
  assert.equal(held.length, 1, "the trickle's writer is not held past the return");

});

test("readWire is the op's own bound, and it is READ rather than WAITED FOR", () => {
  // THE GUARD'S FIRST DRAFT DROVE THE OP WITH A NINE-HOUR ASK TO PROVE THE
  // CEILING AND HUNG THE SUITE FOR EIGHT MINUTES — the only way to observe a
  // clamp by running it is to wait for it. So the clamp is its own function, and
  // it is bounded HERE and not only at the caller: a bound that lives in the
  // caller is one the next caller forgets, which is `/hold`'s own rule one
  // process over.
  assert.deepEqual(readWire({}), { mode: "quiet", ms: WIRE_DEFAULT_MS, everyMs: 20_000 });
  assert.equal(readWire({ mode: "quiet", ms: 99 * 60_000 }).ms, WIRE_MAX_MS, "a caller's oversized wait was taken");
  assert.equal(readWire({ mode: "trickle", ms: 1 }).ms, 1000);
  // A MODE NOBODY RECOGNISES IS NULL, NEVER A DEFAULT — a `trickle` silently
  // answered as `quiet` would report a wall that was never measured, which is
  // the one way this instrument can lie rather than go quiet.
  assert.equal(readWire({ mode: "sideways" }), null);
  assert.equal(readWire({ mode: "" }).mode, "quiet", "an absent mode is not an unknown one");
  for (const junk of [["600000"], "600000", {}, null, true, NaN, Infinity]) {
    assert.equal(readWire({ mode: "quiet", ms: junk }).ms, WIRE_DEFAULT_MS, "a non-number wait was coerced: " + JSON.stringify(junk));
  }
  // The tick has a floor and can never outrun the call it ticks inside.
  assert.equal(readWire({ mode: "trickle", ms: 60_000, everyMs: 1 }).everyMs, WIRE_MIN_TICK_MS);
  assert.equal(readWire({ mode: "trickle", ms: 3000, everyMs: 60_000 }).everyMs, 3000);
});

test("the Worker's probe route: owner-gated, pre-scoped, its own lane, and the job's own clock", () => {
  // The blanker's own landmarks first — a scan over text that was blanked away
  // passes every assertion in it.
  assert.match(NO_COMMENTS, /"\/api\/site\/job-probe"/, "the probe route is gone, or the blanker ate it");
  const at = NO_COMMENTS.indexOf('url.pathname === "/api/site/job-probe"');
  const end = NO_COMMENTS.indexOf('url.pathname === "/api/_egress"', at);
  assert.ok(at > 0 && end > at, "the probe route's window has no end — rescope this guard");
  const block = NO_COMMENTS.slice(at, end);

  assert.match(block, /if \(!\(await authUser\(request\)\)\) return UNAUTHED\(\);/, "the probe route is not owner-gated");
  assert.match(block, /laneName\("hold-probe"\)/, "a probe can be pointed at a customer's own lane");
  assert.doesNotMatch(block, /laneName\(slug/, "the caller chooses the lane");
  // PRE-SCOPED ALWAYS: the token opens nothing in R2.
  assert.match(block, /slug: preScopeSlug\(id\)/, "the probe's token is not pre-scoped");
  assert.match(block, /pre: true/, "the launch is not pre-scoped");
  // THE SETTING'S OWN READER, not a literal and not a probe-only number.
  assert.match(block, /const budgetMs = readJobMaxMs\(env\)\.ms;/, "the probe is given a clock nothing else uses");
  assert.match(block, /deadlineAt: Date\.now\(\) \+ budgetMs/, "the launch carries no deadline");
  assert.match(block, /exp: Math\.floor\(\(Date\.now\(\) \+ budgetMs\) \/ 1000\)/, "the token's expiry is not the job's clock");
  // ONE READER FOR THE BOUNDS, shared with the runner.
  assert.match(block, /readProbe\(body \|\| \{\}\)/, "the route clamps with a second copy of the probe's own rule");
  // IT CARRIES NO SECRET AT ALL: a probe runs no customer code and needs none.
  //
  // TWO HALVES, AND THE SECOND WAS A SWEEP SURVIVOR. Asserting `secrets: {}` is
  // present cannot see a secret smuggled onto the launch under ANOTHER key —
  // the mutant that added `extra: jobSecrets(env)` left `secrets: {}` exactly
  // where this check looks. The absence of the producer is what closes it, and
  // the observer is alive because the block is non-empty and really does carry
  // the empty object.
  //
  // THIS USED TO SAY A DRIVE WAS IMPOSSIBLE "because the route is owner-gated
  // and no session token exists here". That was wrong, and it is why the route
  // shipped throwing: `authUser` asks `/auth/v1/user`, so a stubbed global fetch
  // is the whole of what an owner-gated drive costs. The driven case is below,
  // and these text reads are kept for what a drive cannot see — the absence of a
  // producer anywhere in the block.
  assert.match(block, /secrets: \{\}/, "a probe launch carries secrets");
  assert.doesNotMatch(block, /jobSecrets/, "the probe route reaches for the platform's secrets — nothing a probe runs needs one");
  assert.match(block, /kind: "probe"/, "the launch is not a probe");
  // AND READING ONE BACK IS THE SAME DOOR — a fire nobody can read is an
  // instrument with no dial.
  assert.match(block, /request\.method === "GET"/, "a fired probe cannot be read back");
  assert.match(block, /"http:\/\/build\/job\/" \+ encodeURIComponent\(pid\)/, "the read does not ask the build service for the job");
});

// ── THE DEFECT THE FIRST REAL PRESS FOUND, AND THE TWO WALLS OVER IT ──────────
//
// 2026-09-14, job-probe run 1: the route answered Cloudflare's HTML error page
// and the runner reported `Unexpected token '<'`. The cause was one missing
// argument — `newJobId()` where every other call site writes
// `newJobId((b) => crypto.getRandomValues(b))`.
//
// WHY NOTHING HERE SAW IT, which is the part worth keeping. `newJobId` takes its
// randomness as a REQUIRED parameter (the module is pure on purpose, so there is
// no default behind it), a bare call parses perfectly, and the guard above reads
// the route as TEXT — every landmark it looks for was exactly where it looks.
// The recorded trap, in full: *a text read certifies at the layer below the
// break, and the honest check is a drive.* The comment beside the `secrets: {}`
// assertion said a drive was impossible "because the route is owner-gated and no
// session token exists here", and that was simply wrong: `authUser` asks
// `/auth/v1/user`, so stubbing global fetch is all it takes, which is how
// `test/site-head-edit.test.mjs` has driven eleven owner-gated cases for days.

test("every newJobId call is handed a randomness source — a bare one throws at runtime", () => {
  // DEPTH-AWARE, BECAUSE THE ARGUMENT IS ITSELF A FUNCTION. The first draft of
  // this census read `newJobId\(([^)]*)\)` and answered `"(b"` for the two
  // CORRECT call sites — `[^)]*` stops at the `)` inside `(b) =>`. That is this
  // file's own recorded "flat scans where depth matters" trap, met in a guard
  // written to catch a bare call, and it would have reported the two working
  // sites as broken while saying nothing about the one that was.
  const args = [];
  const NEEDLE = "newJobId(";
  for (let i = NO_COMMENTS.indexOf(NEEDLE); i >= 0; i = NO_COMMENTS.indexOf(NEEDLE, i + 1)) {
    // Skip the declaration itself: `export function newJobId(fill)`.
    if (/function\s+$/.test(NO_COMMENTS.slice(Math.max(0, i - 20), i))) continue;
    let depth = 0, j = i + NEEDLE.length - 1;
    for (; j < NO_COMMENTS.length; j++) {
      const ch = NO_COMMENTS[j];
      if (ch === "(") depth++;
      else if (ch === ")" && --depth === 0) break;
    }
    args.push(NO_COMMENTS.slice(i + NEEDLE.length, j));
  }
  // DERIVED, so a fourth call site fails by existing rather than by being fired
  // — and the floor keeps the reader honest, since a walker that matched nothing
  // satisfies every assertion in the loop below.
  assert.ok(args.length >= 3, `the newJobId census found ${args.length} calls — its reader has gone blind`);
  for (const a of args) {
    assert.notEqual(a.trim(), "", "newJobId() is called with no randomness source: `fill` is a required parameter with no default, so this throws TypeError the first time the route runs");
    assert.match(a, /getRandomValues/, `newJobId is handed ${JSON.stringify(a)}, which is not the platform's generator`);
  }
});

test("the probe route is DRIVEN, not read: a real POST mints a job and reaches the container", async () => {
  const worker = await loadWorker();

  // Everything the route reaches, answered in shape. `authUser` asks Supabase
  // for the bearer's user; nothing else on this path touches the network.
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String((input && input.url) || input || "");
    if (url.includes("/auth/v1/user")) {
      return new Response(JSON.stringify({ id: "00000000-0000-4000-8000-000000000001", email: "owner@example.com" }),
        { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response("unavailable", { status: 503 });
  };

  // The container binding as a Durable Object namespace, which is all
  // `getContainer` asks for. The instance RECORDS what it was sent, because the
  // launch payload is the thing this case exists to read.
  const sent = [], lanes = [];
  const instance = {
    async fetch(req) {
      sent.push({ url: req.url, body: await req.text() });
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "content-type": "application/json" } });
    },
  };
  const env = {
    SITE_BUILD_CONTAINER: {
      idFromName: (n) => { lanes.push(n); return { name: n, toString: () => n }; },
      get: () => instance,
    },
    SITE_SECRETS_KEY: "a-test-secrets-key",
    SUPABASE_SERVICE_KEY: "a-test-service-key",
  };
  const ctx = makeCtx();

  let res;
  try {
    res = await worker.fetch(new Request("https://gofarther.dev/api/site/job-probe", {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: "Bearer some-token" },
      body: JSON.stringify({ probe: "hold", ms: 1_200_000, everyMs: 20_000 }),
    }), env, ctx);
  } finally { globalThis.fetch = realFetch; }

  // THE HALF THAT FAILED LIVE: the route answered at all, in JSON, without
  // throwing. A throw here is Cloudflare's HTML page in production, which is
  // exactly what a caller doing `.json()` cannot read.
  const ctype = String(res.headers.get("content-type") || "");
  const text = await res.text();
  assert.match(ctype, /application\/json/, `the probe route answered ${res.status} ${ctype}: ${text.slice(0, 200)}`);
  const body = JSON.parse(text);
  assert.equal(res.status, 200, `the probe route answered ${res.status}: ${text.slice(0, 200)}`);
  assert.equal(body.ok, true, `the probe route refused: ${text.slice(0, 200)}`);
  assert.match(String(body.id), /^[0-9a-f]{32}$/, "the minted id is not a job id");

  // AND IT REALLY REACHED THE CONTAINER with a launch the runner admits — the
  // hop no assertion about spelling can prove.
  assert.equal(sent.length, 1, "the route did not reach the container exactly once");
  assert.match(sent[0].url, /\/job\/run$/, "the route did not post to the build service's run door");
  const launch = JSON.parse(sent[0].body);
  assert.equal(launch.kind, "probe");
  assert.equal(launch.id, body.id, "the launch names a different job from the answer");
  assert.deepEqual(launch.secrets, {}, "a probe launch carries secrets");
  // ITS OWN LANE, read off the binding rather than off the source: a probe holds
  // a lane for as long as it is asked, so a customer's lane is a way to starve a
  // real build.
  assert.deepEqual(lanes, [laneName("hold-probe")], `the probe was fired at ${JSON.stringify(lanes)}`);
  // `readLaunch` is the container's ONE reader; a launch it refuses is a probe
  // that dies at the door with no reading at all. It is handed the RAW BODY,
  // because that is what the container receives — parsing first would test a
  // shape the wire never carries.
  assert.ok(readLaunch(sent[0].body), "the container's own reader refuses this launch");
});

test("the runner NAMES a non-JSON answer instead of choking on it — DRIVEN", async () => {
  // CARRIED OUT AND EVALUATED, the way this repo carries functions out of
  // chat.js: `scripts/job-probe.mjs` signs in at import, so it cannot be
  // imported, and a source read of a diagnostic cannot say what the diagnostic
  // SAYS. The window is landmark to landmark and both landmarks are asserted.
  const runner = fs.readFileSync(new URL("../scripts/job-probe.mjs", import.meta.url), "utf8");
  const from = runner.indexOf("async function readJson(res, what) {");
  const to = runner.indexOf("if (!EMAIL) fail(", from);
  assert.ok(from > 0 && to > from, "readJson's window has no end — rescope this guard");
  const block = runner.slice(from, to);
  const { readJson, notJson, sayNotJson } =
    new Function(block + "\nreturn { readJson, notJson, sayNotJson };")();

  // A REAL ANSWER IS UNTOUCHED — the control, without which a reader that
  // reported everything as broken would pass every assertion below.
  const good = await readJson(new Response(JSON.stringify({ ok: true, id: "abc" }),
    { status: 200, headers: { "content-type": "application/json" } }), "x");
  assert.equal(notJson(good), false, "a JSON answer is reported as not JSON");
  assert.equal(good.id, "abc");

  // AND THE SHAPE THAT COST A ROUND: Cloudflare's own error page, which is what
  // an uncaught throw inside a route produces. All three of the status, the
  // content-type and the body have to survive, because each answers a different
  // question — 401 is a bad token, 404 is a Worker without the route, and a 5xx
  // with HTML is the Worker throwing.
  const html = "<!DOCTYPE html><html><head><title>Worker threw an exception</title></head></html>";
  const bad = await readJson(new Response(html, { status: 500, headers: { "content-type": "text/html" } }),
    "POST /api/site/job-probe");
  assert.equal(notJson(bad), true, "an HTML answer is not reported as such");
  const said = sayNotJson(bad);
  assert.match(said, /POST \/api\/site\/job-probe/, "the sentence does not say which call failed");
  assert.match(said, /\b500\b/, "the sentence does not carry the status — the half that separates a bad token from a thrown route");
  assert.match(said, /text\/html/, "the sentence does not carry the content-type");
  assert.match(said, /DOCTYPE/, "the sentence does not carry any of the body, so the cause is unreadable");

  // A body with no content-type at all still names itself rather than reading as
  // an empty answer: cannot-tell must never look like nothing-there.
  const nohdr = await readJson(new Response("", { status: 502 }), "y");
  assert.equal(notJson(nohdr), true);
  assert.match(sayNotJson(nohdr), /502/);
});

test("the runner acts on a non-JSON answer at both places it reads one", () => {
  // A SOURCE READ, and it is the honest instrument here: the two hops are
  // top-level statements in a script that signs in at import, so there is
  // nothing to drive without firing a real probe. What a drive CANNOT be is
  // replaced by naming both call sites exactly.
  const runner = fs.readFileSync(new URL("../scripts/job-probe.mjs", import.meta.url), "utf8");
  const code = runner.split("\n").map((l) => (/^\s*\/\//.test(l) ? "" : l)).join("\n");
  assert.match(code, /async function readJson\(/, "readJson is gone, or the blanker ate it");

  // EVERY response the runner reads goes through it — derived, so a fourth call
  // added next month has to say what it does with a body that is not JSON.
  const reads = [...code.matchAll(/readJson\(r[,)]/g)];
  assert.ok(reads.length >= 3, `only ${reads.length} of the runner's reads go through readJson`);
  assert.doesNotMatch(code, /\.then\(\(r\) => r\.json\(\)\)/, "a response is still read with a bare .json(): a non-JSON body becomes `Unexpected token '<'` and the status is lost");

  // AND THE TWO PLACES IT MATTERS ACT ON IT, each differently and each for a
  // stated reason: the fire STOPS (there is no job to poll), the poll ASKS AGAIN
  // (a blip is not an ending, and reading it as one invents a finished job).
  assert.match(code, /if \(notJson\(fired\)\) fail\(sayNotJson\(fired\)\);/, "a non-JSON answer to the fire is not reported");
  // READ AS A LINE, NOT AS A BRACE SPAN. `[^}]*` cannot cross this statement:
  // it carries a template literal, and `${sayNotJson(j)}` closes with a brace of
  // its own — the recorded "flat scans where depth matters", met for the third
  // time in one sitting, twice of them in guards written this hour.
  const pollGuard = code.split("\n").find((l) => l.includes("notJson(j)"));
  assert.ok(pollGuard, "nothing checks the polled record for a non-JSON body");
  assert.match(pollGuard, /continue;/, "a non-JSON answer mid-poll falls through and is read as the job ending");
  assert.match(pollGuard, /sayNotJson\(j\)/, "the blip is swallowed rather than said");
});

test("reading a probe back is driven too — the runner polls this every 30 seconds", async () => {
  const worker = await loadWorker();
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = String((input && input.url) || input || "");
    if (url.includes("/auth/v1/user")) {
      return new Response(JSON.stringify({ id: "00000000-0000-4000-8000-000000000001" }),
        { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response("unavailable", { status: 503 });
  };
  const asked = [];
  const instance = {
    async fetch(req) {
      asked.push(req.url);
      return new Response(JSON.stringify({ state: "running", kind: "probe", pid: 41 }),
        { status: 200, headers: { "content-type": "application/json" } });
    },
  };
  const env = {
    SITE_BUILD_CONTAINER: { idFromName: (n) => ({ name: n }), get: () => instance },
    SITE_SECRETS_KEY: "a-test-secrets-key",
    SUPABASE_SERVICE_KEY: "a-test-service-key",
  };

  const get = async (qs) => {
    const res = await worker.fetch(new Request("https://gofarther.dev/api/site/job-probe" + qs, {
      headers: { Authorization: "Bearer some-token" },
    }), env, makeCtx());
    return { status: res.status, ctype: String(res.headers.get("content-type") || ""), text: await res.text() };
  };

  try {
    const ok = await get("?id=" + "a".repeat(32));
    assert.equal(ok.status, 200, `the read-back answered ${ok.status}: ${ok.text.slice(0, 200)}`);
    assert.match(ok.ctype, /application\/json/, "the read-back is not JSON — the runner does `.json()` on it");
    assert.equal(JSON.parse(ok.text).state, "running", "the record did not come back");
    assert.equal(asked.length, 1, "the read-back did not ask the build service exactly once");
    assert.match(asked[0], /\/job\/a{32}$/, `the read-back asked for ${asked[0]}`);

    // AND A JUNK ID IS REFUSED IN JSON, never by throwing: the runner reads the
    // status to tell "no such job" from "the Worker fell over", and an HTML
    // error page collapses the two.
    const bad = await get("?id=not-a-job-id");
    assert.equal(bad.status, 400, `a junk id answered ${bad.status}`);
    assert.match(bad.ctype, /application\/json/, "a refused id does not answer in JSON");
    assert.equal(asked.length, 1, "a junk id still reached the build service");
  } finally { globalThis.fetch = realFetch; }
});

// ── A HANG IS ITS OWN ANSWER (2026-09-14, probe run 3) ───────────────────────
//
// The wire probe was fired with `wireCall` passing NO AbortSignal, and
// `long-post.mjs` says in its own comment that `node:https` has no timeout of
// any kind unless one is asked for. A black-holed socket therefore sat there
// until the JOB's deadline: the run gave up at its watcher's bound with the
// child still alive and the verdict unreadable. Three things came out of it —
// the arm has a clock, a hang is named rather than read as a kill, and the
// watcher's bound is DERIVED from that clock instead of guessed.

test("wireCallBoundMs is DERIVED from the ask and refuses junk", () => {
  assert.equal(wireCallBoundMs(300_000), 300_000 + WIRE_CALL_SLACK_MS);
  assert.ok(WIRE_CALL_SLACK_MS >= 30_000, "the slack is too tight to tell a live connection from a hung one");
  // NEVER ZERO AND NEVER NaN: a bound of 0 aborts every arm instantly and would
  // report `hung` for a wire nobody ever tried.
  for (const junk of [null, undefined, "x", -5, 0, NaN, {}, ["300000"]]) {
    const b = wireCallBoundMs(junk);
    assert.ok(Number.isFinite(b) && b > WIRE_CALL_SLACK_MS, `junk ask ${JSON.stringify(junk)} gave a bound of ${b}`);
  }
  // AND IT MUST OUTLAST THE ASK, or the instrument cuts a connection that is
  // genuinely alive at `ms` and calls its own impatience a finding.
  for (const ms of [1000, 60_000, 300_000, WIRE_MAX_MS]) assert.ok(wireCallBoundMs(ms) > ms, "the bound does not outlast the ask at " + ms);
});

test("wireCall tells a HANG from a KILL — driven, with the kill as the control", async () => {
  const url = "https://x/wire";
  // A HANG: the signal aborted, so the throw is the instrument's own clock.
  const ac = new AbortController();
  ac.abort();
  const hung = await wireCall(async () => { throw new Error("The operation was aborted"); }, url, "t", {}, { signal: ac.signal });
  assert.equal(hung.ok, false);
  assert.equal(hung.hung, true, "an aborted arm is not reported as hung");

  // THE CONTROL — an ordinary death with the signal NOT aborted is a kill, and
  // must not wear `hung`. Without this the field could be set unconditionally
  // and every assertion above would still pass.
  const live = new AbortController();
  const killed = await wireCall(async () => {
    throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" }, wire: { headersMs: -1, chars: 0 } });
  }, url, "t", {}, { signal: live.signal });
  assert.equal(killed.ok, false);
  assert.equal(killed.hung, undefined, "a reset connection was reported as a hang");
  assert.equal(killed.cause, "ECONNRESET", "the kill lost its falsifier");

  // AND A SURVIVOR carries no `hung` either.
  const okCall = await wireCall(async () => ({ status: 200, text: async () => "x" }), url, "t", {}, { signal: live.signal });
  assert.equal(okCall.ok, true);
  assert.equal(okCall.hung, undefined);
});

test("probeWire asks `hung` FIRST, because the other readings are unsafe when an arm never answered", async () => {
  const url = { url: "https://x", token: "t" };
  // THE TIMER IS INJECTED so a hang can be driven at all: the real bound is six
  // minutes and a test that waited for it would be the one branch nobody checks.
  // Each call gets a FRESH controller, which is also what proves the module does
  // not share one signal between the two arms.
  const made = [];
  const timer = () => { const c = new AbortController(); made.push(c); return c.signal; };
  const run = async (quietFn, trickleFn) => {
    made.length = 0;
    let n = 0;
    return probeWire(url, { ms: 1000, everyMs: 500 }, {
      now: () => 0, timer,
      send: async (...a) => (n++ === 0 ? quietFn(...a) : trickleFn(...a)),
      log: () => {},
    });
  };
  const ok = async () => ({ status: 200, text: async () => "x" });
  // A HANG is the arm's own clock firing: abort the signal this call was handed,
  // then throw the way an aborted request does.
  const hangs = async () => { made[made.length - 1].abort(); throw new Error("The operation was aborted"); };

  // A quiet hang must NOT read as `idle-kill` — "streaming is the fix" about a
  // socket streaming does nothing for is the one way this can mislead.
  const a = await run(hangs, ok);
  assert.notEqual(a.reading, "idle-kill", "a hung quiet arm was read as an idle kill");

  // The four ordinary readings still hold when nothing hangs.
  const dies = async () => { throw Object.assign(new TypeError("fetch failed"), { wire: { headersMs: -1, chars: 0 } }); };
  assert.equal((await run(ok, ok)).reading, "no-wall");
  assert.equal((await run(dies, ok)).reading, "idle-kill");
  assert.equal((await run(dies, dies)).reading, "lifetime-cap");
  assert.equal((await run(ok, dies)).reading, "quiet-survived-trickle-did-not");
});

test("both arms are BOUNDED, and each gets its own signal", () => {
  const src = fs.readFileSync(new URL("../builder/job-probe.mjs", import.meta.url), "utf8");
  const code = src.split("\n").map((l) => (/^\s*\/\//.test(l) ? "" : l)).join("\n");
  assert.match(code, /const bound = wireCallBoundMs\(ms\)/, "the arms' bound is not derived from the ask");
  // TWO signals, not one shared: an aborted signal STAYS aborted, so a single
  // one would make the second arm report `hung` without ever being tried.
  const signals = [...code.matchAll(/signal: timer\(bound\)/g)];
  assert.equal(signals.length, 2, `${signals.length} arms are bounded — both must be, each with its own signal`);
  assert.doesNotMatch(code, /const sig = timer\(/, "the two arms share one signal");
});

test("the runner's watch bound is DERIVED from the arm's bound, never typed beside it", () => {
  const runner = fs.readFileSync(new URL("../scripts/job-probe.mjs", import.meta.url), "utf8");
  const code = runner.split("\n").map((l) => (/^\s*\/\//.test(l) ? "" : l)).join("\n");
  assert.match(code, /wireCallBoundMs/, "the runner does not import the arm's own bound");
  assert.match(code, /const BOUND_MS = \(SHAPE === "wire" \? 2 \* wireCallBoundMs\(MS\) : MS\)/,
    "the runner guesses its bound again — run 3 gave up at 16 minutes on exactly that");
  // THE ARITHMETIC THAT MATTERS: the watcher must outlast the worst case the
  // probe can legally take, or it reports NOT PROVEN about its own impatience.
  for (const ms of [60_000, 300_000, WIRE_MAX_MS]) {
    assert.ok(2 * wireCallBoundMs(ms) + 6 * 60_000 > 2 * wireCallBoundMs(ms),
      "the watcher does not outlast two bounded arms at ms=" + ms);
  }
});

test("a probe can be READ BACK without firing another — the instrument can re-read its own dial", () => {
  const runner = fs.readFileSync(new URL("../scripts/job-probe.mjs", import.meta.url), "utf8");
  const code = runner.split("\n").map((l) => (/^\s*\/\//.test(l) ? "" : l)).join("\n");
  const wf = fs.readFileSync(new URL("../.github/workflows/job-probe.yml", import.meta.url), "utf8");

  assert.match(code, /const READ_ID = String\(process\.env\.PROBE_JOB_ID \|\| ""\)\.trim\(\)/, "the read-back id is not read, or is coerced");
  // THE FIRE IS SKIPPED, not merely followed by a read: firing anyway would hold
  // a second lane and measure a probe nobody asked about.
  const branch = code.slice(code.indexOf("if (READ_ID)"), code.indexOf("step 5"));
  assert.ok(branch.length > 40, "the read-back branch is gone — rescope this guard");
  assert.doesNotMatch(branch.slice(0, branch.indexOf("} else {")), /\/api\/site\/job-probe"/, "the read-back path still fires a probe");
  assert.match(branch, /} else \{/, "the fire is not the other arm of the read-back branch");
  // ONE POLLING LOOP FOR BOTH, so a re-read says the same things in the same
  // words — a reader of its own would be two lists of the same thing.
  assert.equal([...code.matchAll(/step 5 — running for/g)].length, 1, "the read-back grew a second polling loop");

  // AND THE DOOR CARRIES IT, derived from the WORKFLOW's inputs rather than from
  // the script's env reads. Those are different sets on purpose: `PROBE_LOG` has
  // a default the workflow relies on (the artifact step names the same file), so
  // requiring every env read to be an input would fail on a name nobody types.
  // What must never drift is the other direction — an input the workflow offers
  // and never passes on is a dial wired to nothing.
  const inputs = [...wf.matchAll(/^      ([a-zA-Z]+):\n        description:/gm)].map((m) => m[1]);
  assert.ok(inputs.length >= 5, `the workflow input reader found ${inputs.length} — it has gone blind`);
  for (const name of inputs) {
    assert.match(wf, new RegExp("\\$\\{\\{ github\\.event\\.inputs\\." + name + " \\}\\}"),
      `the workflow offers an input \`${name}\` it never passes to the script`);
  }
  assert.ok(inputs.includes("jobId"), "the workflow has no read-back input");
  // The artifact step and the script must name the same log file.
  const logName = (code.match(/PROBE_LOG \|\| "([^"]+)"/) || [])[1];
  assert.ok(logName, "the script's log filename is gone");
  assert.ok(wf.includes(logName), `the workflow uploads a different file from the ${logName} the script writes`);
});
