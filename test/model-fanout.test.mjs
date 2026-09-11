// ONE JOB, N CALLS, ONE SLOT (2026-09-09, the band split).
//
// `/model/start` took one request and ran it inside `oneAtATime`. A page split
// into bands needs its calls IN FLIGHT AT ONCE, and firing N separate
// `/model/start` calls cannot do that — `oneAtATime` would run them one after
// another, which is the opposite of the feature. Its own comment calls that
// serialisation harmless, and it was, right up until something needed two calls
// at once.
//
// So a fan-out is ONE job holding N calls. Every property of the single path is
// kept by construction: one slot held for the whole thing (so `_busy` is right
// and the container is not stopped mid-generation), one id (so the store stays
// bounded), one report (so the lease chain is unchanged).
//
// WHAT THESE READ AND WHAT THEY CANNOT. These are source guards, which is the
// house pattern for this file and is also the layer below the break — the
// recorded trap. They can prove the branch exists, that it is fenced, and that
// the compatibility path is untouched. They CANNOT prove the container really
// runs eight calls at once and hands back eight answers; only `site build`,
// which starts the real service, can. That case is the proof and this is the
// scaffolding under it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { runFanout, allFailed, fanoutTally } from "../builder/model-fanout.mjs";

const SRC = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
// Whole-line comments blanked, length preserved. This file explains the
// fan-out at length and names every spelling below while doing it — the
// recorded "prose contains the thing it forbids".
const bare = SRC.split("\n").map((l) => (/^\s*\/\//.test(l) ? " ".repeat(l.length) : l)).join("\n");

/** From a landmark to the next one, searched FROM the opening one, both asserted. */
const between = (from, to) => {
  const at = bare.indexOf(from);
  assert.ok(at > 0, "landmark is gone: " + from);
  const end = bare.indexOf(to, at);
  assert.ok(end > at, "closing landmark is gone or precedes the opening one: " + to);
  return bare.slice(at, end);
};

test("the fan-out runs inside ONE oneAtATime slot — never as N starts", () => {
  // THE PROPERTY THIS WHOLE CHANGE EXISTS FOR. If the list were fired as
  // separate `/model/start` requests they would queue behind each other and the
  // page would take exactly as long as it does today, while looking parallel
  // from the outside — a change that ships, measures the same, and nobody can
  // say why.
  const start = between('req.url === "/model/start"', 'req.url.startsWith("/model/result")');
  const slot = start.indexOf("oneAtATime(async () => {");
  const fan = start.indexOf("if (mReqs) {");
  assert.ok(slot > 0, "the start handler no longer takes a slot");
  assert.ok(fan > slot, "the fan-out runs outside the slot — the busy counter cannot see it");
  // THE CALLS THEMSELVES ARE `runFanout`'s, and that they really run together is
  // proved by DRIVING it below rather than by matching a spelling here. This
  // asserts only what this file is responsible for: that the fan-out happens
  // inside the slot, and that it is awaited — a slot released before the calls
  // settle is a container stopped mid-generation.
  assert.match(start.slice(fan, fan + 900), /const results = await runFanout\(/, "the calls are not made, or not awaited, inside the slot");
});

// ── THE TWO PROPERTIES A SOURCE READ CANNOT MAKE ────────────────────────────
//
// Both of these were asserted by reading, and BOTH SURVIVED A SWEEP:
//
//   * "each call catches its own failure" scanned for `catch (e) {` — and a
//     catch that RETHROWS still contains that text, so a fan-out where the
//     first failure destroyed every other band passed;
//   * "an entry carries its index" scanned for `{ i,` — and the done branch
//     still had one, so a failed entry could lose its index and pass.
//
// They are not claims about text and never were. `runFanout` exists so they can
// be run, which is the whole reason it is a module rather than four lines in a
// handler.

test("DRIVEN: one failed call does NOT take the ones that worked with it", () => {
  // The defect this exists to stop: eight bands, the fourth throws, and
  // `Promise.all` rejects — seven good sections lost, after paying for all
  // eight, with nothing to publish.
  const reqs = [{ n: 0 }, { n: 1 }, { n: 2 }, { n: 3 }];
  return runFanout(reqs, async (r, i) => {
    if (i === 1) throw Object.assign(new Error("upstream said no"), { status: 429, name: "HttpError", detail: "rate_limit" });
    return "answer " + i;
  }).then((out) => {
    assert.equal(out.length, 4, "the fan-out did not answer once per request");
    assert.deepEqual(out.map((r) => r.state), ["done", "failed", "done", "done"]);
    assert.deepEqual(out.filter((r) => r.state === "done").map((r) => r.answer),
      ["answer 0", "answer 2", "answer 3"], "a band that worked lost its answer");
    // THE SHAPE OF A FAILURE IS PRESERVED, exactly as the single-call path
    // preserves it — flattened to a message, a real 429 arrives wearing a
    // container fault and the retry logic reads it as our own.
    assert.equal(out[1].status, 429);
    assert.equal(out[1].detail, "rate_limit");
    assert.equal(out[1].kind, "HttpError");
    assert.match(out[1].message, /upstream said no/);
  });
});

// NOT ONE `setTimeout` IN EITHER OF THE TWO BELOW, and that is the second
// lesson of this change's sweep rather than a style choice. The first drafts
// staged "finishes out of order" and "five at once" with timers — and under a
// sweep, where the machine is running a whole suite per mutant, the timers
// drifted and a COMMENT-ONLY CONTROL came back killed. A control that fails is
// supposed to mean the sweep is unsound; here it meant my own guards were
// flaky, which is strictly worse than not having them: the recorded "a false
// alarm is worse than a miss", found by the one instrument built to notice.
//
// Both are staged with GATES instead. `list.map(async …)` invokes every
// callback synchronously as far as its first `await`, so by the time
// `runFanout` has returned its promise every call has started and parked on
// its own gate. Releasing them by hand is what makes the finishing order a
// FACT rather than a race.

test("DRIVEN: EVERY entry carries its index, however the calls finish", () => {
  // Calls finish out of order — that is the point of running them together — so
  // the index is the only thing tying an answer back to the band it was asked
  // for. Without it the caller has N answers and no idea which is the hero.
  const gates = [];
  const order = [];
  const p = runFanout([{}, {}, {}, {}], (r, i) =>
    new Promise((res, rej) => { gates[i] = () => { order.push(i); return i === 2 ? rej(new Error("no")) : res(i); }; }));
  assert.equal(gates.filter(Boolean).length, 4, "not every call had started — the case cannot prove anything");
  // Finish BACKWARDS, by hand.
  for (let i = 3; i >= 0; i--) gates[i]();
  return p.then((out) => {
    assert.deepEqual(order, [3, 2, 1, 0], "the calls did not finish backwards — the case proves nothing");
    assert.deepEqual(out.map((r) => r.i), [0, 1, 2, 3], "an entry lost its index");
    assert.equal(out[2].state, "failed", "the failing call is not where its index says");
    assert.equal(out[3].answer, 3, "an answer landed against the wrong index");
    assert.equal(out[0].answer, 0);
  });
});

test("DRIVEN: the calls really are in flight together, not one after another", () => {
  // If these ran in sequence the page would take exactly as long as it does
  // today while looking parallel from outside — a change that ships, measures
  // the same, and nobody can say why.
  let live = 0, peak = 0;
  const gates = [];
  const p = runFanout([{}, {}, {}, {}, {}], () => {
    live++; peak = Math.max(peak, live);
    return new Promise((res) => gates.push(() => { live--; res("x"); }));
  });
  // Every callback has run as far as its first await by now — no timer, so no
  // load can move this. Serial, only the first would have started.
  assert.equal(peak, 5, "only " + peak + " call(s) were ever in flight at once — the fan-out is serial");
  gates.forEach((g) => g());
  return p.then((out) => assert.equal(out.length, 5));
});

test("DRIVEN: junk in, no throw out", () => {
  return Promise.all([
    runFanout(null, async () => "x").then((r) => assert.deepEqual(r, [])),
    runFanout(undefined, async () => "x").then((r) => assert.deepEqual(r, [])),
    runFanout([], async () => "x").then((r) => assert.deepEqual(r, [])),
    // A caller that throws SYNCHRONOUSLY is still one failed entry, not a
    // rejected fan-out — the same property as an async throw, and easy to lose.
    runFanout([{}], () => { throw new Error("sync"); }).then((r) => {
      assert.equal(r.length, 1);
      assert.equal(r[0].state, "failed");
      assert.match(r[0].message, /sync/);
    }),
  ]);
});

test("DRIVEN: allFailed and the tally read the outcome", () => {
  const ok = [{ state: "done" }, { state: "failed" }];
  const bad = [{ state: "failed" }, { state: "failed" }];
  assert.equal(allFailed(bad), true);
  assert.equal(allFailed(ok), false, "a fan-out with one good band read as a total failure");
  // NOTHING ASKED IS NOT EVERYTHING FAILED. An empty list answering `true` would
  // turn "there was nothing to do" into "buy it all again".
  assert.equal(allFailed([]), false);
  assert.equal(allFailed(null), false);
  assert.deepEqual(fanoutTally(ok), { done: 1, of: 2 });
  assert.deepEqual(fanoutTally([]), { done: 0, of: 0 });
  assert.deepEqual(fanoutTally(null), { done: 0, of: 0 });
});

test("the container calls runFanout rather than keeping its own copy", () => {
  // The wiring hop: a module nobody calls is this repository's most-shipped
  // failure, and the two properties above are only guarded where they are RUN.
  // RE-ANCHORED 2026-09-11, NOT APPEASED: this pinned the import LIST as exactly
  // two names, so it went red the day an honest third arrived — the recorded
  // "assert the property, not the spelling", in its quietest form. Membership is
  // the property; being the whole list never was.
  const fanImport = bare.match(/import \{([^}]*)\} from "\.\/model-fanout\.mjs";/);
  assert.ok(fanImport, "the container does not import the fan-out");
  for (const name of ["runFanout", "fanoutTally"]) {
    assert.ok(fanImport[1].includes(name), "the container stopped importing " + name);
  }
  const start = between("if (mReqs) {", "MODEL_JOBS.set(id, { state: \"done\", answers");
  assert.match(start, /const results = await runFanout\(mReqs, \(r\) =>/,
    "the container does not use runFanout — a second copy of the per-call catch is two things that drift");
  assert.ok(!/Promise\.all\(mReqs\.map\(/.test(bare), "the container kept its own fan-out beside the module's");
});

test("A FAN-OUT WHERE EVERY CALL FAILED IS STILL `done`, not `failed`", () => {
  // These need OPPOSITE moves and must stay distinguishable: `done` with failed
  // entries means "stub what is missing and publish", `failed` means the
  // container lost the work and the only way back is to buy it again. Collapsed
  // into one state, a page with one bad band would be re-bought whole.
  const start = between("if (mReqs) {", 'req.url.startsWith("/model/result")');
  assert.match(start, /MODEL_JOBS\.set\(id, \{ state: "done", answers: results/,
    "the fan-out does not settle as done with its list");
  assert.ok(!/MODEL_JOBS\.set\(id, \{\s*state: "failed"[\s\S]{0,200}answers/.test(start),
    "the fan-out can settle as failed, which reads as a lost container");
});

test("the beat is cleared whatever the report does", () => {
  // A report that throws would otherwise leave the heartbeat running for a job
  // that has finished — a container kept alive renewing a lease on work nobody
  // is waiting for. The single-call path has exactly this in a `finally`.
  const fan = between("if (mReqs) {", "return;\n        }");
  assert.match(fan, /finally \{\s*\n\s*if \(beat\) clearInterval\(beat\);/,
    "the fan-out's beat is not cleared in a finally");
});

test("the list is REFUSED rather than truncated, and its bounds are its own", () => {
  const start = between('req.url === "/model/start"', "oneAtATime(async () => {");
  assert.match(start, /mReqs\.length > MAX_MODEL_FANOUT/, "the list has no ceiling");
  assert.match(start, /too many reqs/, "an over-long list is not refused by name");
  assert.match(start, /reqs is empty/, "an empty list is not refused by name");
  assert.match(start, /a req in reqs is not an object/, "junk inside the list is not refused by name");
  // Silently dropping the ninth band is a page missing a section with nothing
  // anywhere saying so, and whoever planned that band planned it for a reason.
  assert.ok(!/mReqs\.slice\(0, MAX_MODEL_FANOUT\)/.test(bare), "the list is truncated instead of refused");
});

test("MAX_MODEL_FANOUT is the CONTAINER's bound, deliberately not the design's", () => {
  // It is tempting to derive this from `MAX_SECTIONS` and it would be the wrong
  // list: that answers "how many bands may a page have" — about the product —
  // and this answers "how many calls may one container hold open" — about this
  // process's memory and its sockets. They agree at 8 today by coincidence.
  // RE-ANCHORED 2026-09-11, NOT APPEASED. This pinned the bound as a `const`
  // DECLARED IN build-server.mjs, and it moved into `model-fanout.mjs` when the
  // Worker started needing the same number — it composes a fan-out of bands AND
  // parts now, and has to know what will fit before it sends one. Where it is
  // declared was never the property; the properties are that it EXISTS as one
  // number, that the container enforces it, and that it is not the design's cap.
  const fanoutMod = fs.readFileSync(new URL("../builder/model-fanout.mjs", import.meta.url), "utf8");
  assert.match(fanoutMod, /export const MAX_MODEL_FANOUT = \d+;/, "the fan-out bound is gone");
  assert.ok(!/const MAX_MODEL_FANOUT = \d+;/.test(bare),
    "the container declares its own copy of the bound again — two lists of the same thing, and the two sides can now disagree");
  assert.match(bare, /import \{[^}]*MAX_MODEL_FANOUT[^}]*\} from "\.\/model-fanout\.mjs";/,
    "the container no longer reads the shared bound");
  for (const src of [bare, fanoutMod]) {
    assert.ok(!/MAX_MODEL_FANOUT = MAX_SECTIONS/.test(src),
      "the container's resource bound was tied to the design's band cap");
    assert.ok(!/import .*MAX_SECTIONS.*site-plan/.test(src),
      "the fan-out bound imported the design's cap to bound its own sockets");
  }
});

test("A CALLER THAT SENDS `req` IS UNTOUCHED — every existing one does", () => {
  // This is what makes the change safe to land before anything asks for the new
  // path: the single-call branch is reached exactly as it was, and `no req` is
  // still the answer when neither shape is sent.
  const start = between('req.url === "/model/start"', "oneAtATime(async () => {");
  assert.match(start, /if \(!mReqs && \(!mReq \|\| typeof mReq !== "object"\)\) return send\(res, 400, \{ ok: false, error: "no req" \}\)/,
    "a body with neither shape is no longer refused");
  const slot = between("oneAtATime(async () => {", 'req.url.startsWith("/model/result")');
  assert.match(slot, /const answer = await callBuilderModel\(keysFrom\(BUILD_KEYS\), mReq, budget, longPost,/,
    "the single-call path no longer makes its own call");
  assert.match(slot, /code \? \{ stream: true, onPartial: code \} : \{ stream: true \}/,
    "the single call lost its partial-code stream");
});

test("NO onPartial ON A FAN-OUT, but every call still streams", () => {
  // The code stream shows the customer one file being written; eight bands
  // interleaving into it is not a file. `stream: true` still rides on every
  // call, because that is what keeps the wire from being idle — the reason
  // streaming exists here, not the reason the customer sees anything.
  const fan = between("if (mReqs) {", "MODEL_JOBS.set(id, { state: \"done\", answers");
  assert.match(fan, /callBuilderModel\(keysFrom\(BUILD_KEYS\), r, budget, longPost, \{ stream: true \}\)/,
    "a fan-out call does not stream, or was given the partial hook");
  assert.ok(!/onPartial/.test(fan), "the fan-out sends partial code, which interleaves into gibberish");
});

test("/model/result answers `answers` for a list and `answer` for one, never both", () => {
  // Reading the list into `answer` would hand every existing caller an array
  // where it expects a message, and the parse that follows would fail somewhere
  // far from here.
  const result = between('req.url.startsWith("/model/result")', 'req.url === "/model"');
  const many = result.indexOf("job.answers");
  const one = result.indexOf("answer: job.answer");
  assert.ok(many > 0, "a fan-out's answers cannot be read back");
  assert.ok(one > 0, "a single answer cannot be read back");
  assert.ok(many < one, "the list branch sits after the single one, so a fan-out reads back as one answer");
  assert.match(result, /state === "done" && job\.answers/, "the list branch is not gated on there being a list");
});
