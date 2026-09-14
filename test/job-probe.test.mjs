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
} from "../builder/job-probe.mjs";
import { JOB_MAX_MS } from "../builder/job-duration.mjs";
import { readLaunch } from "../builder/container-job.mjs";
import { gatewayHandler, readWire, WIRE_MAX_MS, WIRE_DEFAULT_MS, WIRE_MIN_TICK_MS } from "../builder/job-gateway.mjs";

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
  assert.match(runner, /import \{ holdVerdict, wireVerdict \} from "\.\.\/builder\/job-probe\.mjs"/);
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
  // it is a source read rather than a drive because the route is owner-gated and
  // no session token exists here; the observer is alive because the block is
  // non-empty and really does carry the empty object.
  assert.match(block, /secrets: \{\}/, "a probe launch carries secrets");
  assert.doesNotMatch(block, /jobSecrets/, "the probe route reaches for the platform's secrets — nothing a probe runs needs one");
  assert.match(block, /kind: "probe"/, "the launch is not a probe");
  // AND READING ONE BACK IS THE SAME DOOR — a fire nobody can read is an
  // instrument with no dial.
  assert.match(block, /request\.method === "GET"/, "a fired probe cannot be read back");
  assert.match(block, /"http:\/\/build\/job\/" \+ encodeURIComponent\(pid\)/, "the read does not ask the build service for the job");
});
