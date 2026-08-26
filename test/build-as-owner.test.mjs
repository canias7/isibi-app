// The owner-build harness spends REAL money on a REAL account, so the two
// properties that stop it losing a paid build are asserted here rather than
// remembered. Both were learned by losing one.
//
// It is a manual script, not product code — and it still earns a guard, because
// each of these failures cost credits: run 2 painted a red X on a green build
// (the probe), and run 3 KILLED a build mid-flight (the timeout), leaving a
// claimed slug, a live Neon project and a 20-credit charge with no site.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const SRC = fs.readFileSync(new URL("../scripts/build-as-owner.mjs", import.meta.url), "utf8");
// Comments explain both hazards at length and therefore SPELL both hazards, so
// an absence check on the raw text matches the explanation and passes against
// broken code. Blanked length-preservingly, the trick this repo has now recorded
// ten-plus times — a lint, a router guard, an absence check, a scope scan.
// BLOCK COMMENTS TOO, since 2026-08-24: `postLong`'s own docstring argues the
// ceiling at length and therefore spells `POST_CEILING_MS` and `destroy`, so a
// line-only blanker leaves the guard below matching prose. Length-preserving and
// asserted so, because a blanker that ate too much would report a clean file.
const blank = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
  .replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));
const CODE = blank(SRC);
assert.equal(CODE.length, SRC.length, "the blanker moved a byte");

test("the build POST does not go through fetch — undici gives up at 300s", () => {
  // fetch's headers timeout is 300s and is NOT raisable from the fetch options,
  // so a build slower than that is not merely unlogged: the client hangs up,
  // Cloudflare cancels the Worker, and the build dies with the customer charged
  // for the schema. GatherHire returned at 272.2s; the run after it did not.
  assert.doesNotMatch(CODE, /await fetch\(`\$\{BASE\}\/api\/site\/react-build/,
    "the build POST is back on fetch — a build over 300s will be killed mid-flight");
  assert.match(CODE, /await postLong\(`\$\{BASE\}\/api\/site\/react-build/,
    "the build POST must use postLong, which has no headers timeout");
  // And postLong must be the node:https one rather than a fetch wrapper wearing
  // the name — a rename is the cheap way to reintroduce exactly the ceiling.
  assert.match(CODE, /import https from "node:https"/);
  const body = CODE.slice(CODE.indexOf("function postLong"), CODE.indexOf("if (!EMAIL)"));
  assert.ok(body.length > 100, "could not find postLong's body — this check would be vacuous");
  assert.match(body, /https\.request\(/, "postLong must issue a real node:https request");
  assert.doesNotMatch(body, /fetch\(/, "postLong must not be a fetch wrapper");
});

test("the after-the-build probe cannot fail the run", () => {
  // By step 7 the money is spent and the site is published. An exception there
  // reports a successful, paid-for build as a failure — which is what run 2 did,
  // on a relative URL that fetch refuses.
  const step7 = CODE.slice(CODE.indexOf("step 7"));
  assert.ok(step7.length > 200, "could not find step 7 — this check would be vacuous");
  const probe = CODE.slice(CODE.indexOf("const siteUrl ="));
  assert.match(probe, /try \{[\s\S]*\} catch/, "the probe must be inside a try");
  // The response's `url` is the INTERNAL relative path, so it has to be resolved
  // before anything fetches it. An absolute answer passes through unchanged.
  assert.match(probe, /new URL\(d\.url, BASE\)/,
    "the site URL must be resolved against BASE — d.url can be relative");
});

test("a reset with no slug recovers the name instead of giving up", () => {
  // ARM C (2026-08-23) LOST A PAID BUILD TO THIS. The connection died at 264.8s
  // — the ordinary, expected, six-times-measured reset — and the harness exited
  // because the only copy of the designer-chosen slug was in the answer that
  // went with the socket. Arms A and B survived the identical reset purely
  // because they had been handed explicit names, so "the designer names the
  // site" and "a reset is survivable" were mutually exclusive.
  // BOUNDED ON THE WATCH'S FIRST STATEMENT, NOT ON ITS GATE. This read
  // `indexOf("if (disconnected) {")` until 2026-08-26, when the gate correctly
  // became `if (disconnected || firedJob)` — stage 2 made the fired build the
  // ordinary path, so a watch that only ran on a reset would have been skipped
  // on every build. `indexOf` then answered -1 and `slice(start, -1)` widened
  // this window to the whole rest of the file, which every assertion below
  // still passes: the SILENT direction of the spelling-pin own-goal rather than
  // the red one. `let slug = SLUG` is a property — the watch resolves a name
  // before it can watch anything — and it survives the condition changing.
  const WATCH_AT = CODE.indexOf("let slug = SLUG");
  assert.ok(WATCH_AT > 0, "could not find the start of the watch — every window here would be wrong");
  const disc = CODE.slice(CODE.indexOf("async function discoverSlug"), WATCH_AT);
  assert.ok(disc.length > 200, "could not find discoverSlug — this check would be vacuous");
  assert.ok(disc.length < 4000,
    "the discoverSlug window ran past its end — an over-wide window passes every check below " +
    "against text from somewhere else, which is how this guard went quietly vacuous once already");
  assert.match(disc, /site_backends\?/, "the recovery must read site_backends, where the claim is recorded");

  // THE TWO FILTERS ARE THE WHOLE CORRECTNESS ARGUMENT, and dropping either one
  // is the same failure: the query answers with a site published hours ago,
  // which is already 200, so the watch reports a SUCCESS THAT DID NOT HAPPEN on
  // a build that never got as far as provisioning. Asserted apart, because each
  // alone leaves the other looking sufficient.
  assert.match(disc, /uid=eq\./, "the recovery must be scoped to this account");
  assert.match(disc, /created_at=gte\./,
    "the recovery must be scoped to sites claimed by THIS build — without the window it can " +
    "return a site published hours ago and report it as this run's");
  assert.match(disc, /new Date\(bt\b/,
    "the window must be measured from the build's own POST, not from a constant");

  // Finding nothing is an honest answer, not a reason to guess. A build that
  // never claimed a slug has no address and never will.
  const watch = CODE.slice(WATCH_AT);
  // ANCHORED AFTER THE DISCOVERY, because there are TWO `if (!slug)` in a row —
  // the one that triggers the lookup and the one that gives up — and a window
  // opened at the first reaches the second's `fail(` inside 200 characters. So
  // the obvious spelling passes with the fatal deleted, which is what the sweep
  // caught: the overlapping-window own-goal this repo has now recorded four
  // times. The slice starts past the lookup so only the gate is in view.
  const gate = watch.slice(watch.indexOf("slug = await discoverSlug()"),
    watch.indexOf("const watch ="));
  assert.ok(gate.length > 40, "could not isolate the give-up gate — this check would be vacuous");
  assert.match(gate, /if \(!slug\)/,
    "an unrecoverable slug must still fail rather than watching something arbitrary");
  assert.match(gate, /fail\(/, "…and it must be fatal, not a warning");

  // AND THE DISCOVERED NAME HAS TO BE THE ONE EVERYTHING DOWNSTREAM USES. With
  // the trace still keyed on the empty OWNER_SLUG the poll prints "no trace row
  // yet" forever — which is precisely the silence arm C's watch would have had.
  //
  // ANCHORED ON THE ARGUMENT, NOT THE READER'S NAME. This said `traceLine(slug)`
  // and went red on 2026-08-25 when the reader was split into `readTrace` +
  // `traceText` so the watch could see `done` as well as print it — a correct
  // change, failing a test about a spelling. This repo's most repeated own-goal.
  // What has to hold is WHICH SLUG is read, whatever the function is called.
  assert.match(watch, /(traceLine|readTrace)\(slug\)/,
    "the trace must be read for the discovered slug, not the unset OWNER_SLUG");
  assert.doesNotMatch(watch, /(traceLine|readTrace)\(SLUG\)/,
    "the watch must never key the trace on OWNER_SLUG — on a discovered slug that is unset");
  assert.doesNotMatch(watch, /slug: SLUG/,
    "the synthesised response must carry the discovered slug");
});

test("NEITHER HARNESS WAITS FOR EVER — a silently dead socket has a ceiling", () => {
  // MEASURED, NOT FEARED (2026-08-24). `build as owner` run 32723813218: the
  // build FINISHED at 12:02:02Z — `site_builds` says `done: true, ok: true,
  // total_ms: 528542`, and the site answered 200 — and the step was still
  // running SEVENTY-FIVE MINUTES later. `req.on("error")` fires only on a real
  // socket error, so a connection that dies silently (no FIN, no RST, which is
  // what a middlebox dropping state on a long-idle connection produces) hangs
  // until the 350-minute job cap.
  //
  // IT SURVIVED BECAUSE ITS JUSTIFICATION WENT STALE A DAY BEFORE IT BIT. While
  // hanging up really did kill the build, having no ceiling was correct and
  // there was nothing to weigh. The queue reversed that on 2026-08-23 and
  // nobody re-asked the question — a rule true because of something one layer
  // down expires when that layer moves, and nothing announces it.
  //
  // ASSERTED FOR BOTH, because `build smoke` has the identical hole and runs on
  // every push rather than once a day. Comments are blanked first in each: the
  // docstrings argue the ceiling at length and therefore spell it.
  const smokeSrc = fs.readFileSync(new URL("./integration/build-smoke.mjs", import.meta.url), "utf8");
  const smoke = blank(smokeSrc);
  assert.equal(smoke.length, smokeSrc.length, "the blanker moved a byte");

  for (const [name, code] of [["build-as-owner", CODE], ["build-smoke", smoke]]) {
    const at = code.indexOf("function postLong(");
    assert.ok(at > 0, `${name}: postLong is gone — this guard is watching nothing`);
    const fn = code.slice(at, code.indexOf("\n}\n", at));
    assert.ok(fn.length > 200, `${name}: could not isolate postLong — this check would be vacuous`);

    // THE PROPERTY: the request is torn down on a timer it did not have to be
    // asked for. Not "a timeout exists somewhere in the file" — a per-call
    // ceiling inside the function every build POST goes through.
    assert.match(fn, /POST_CEILING_MS/,
      `${name}: postLong has no ceiling — a silently dead socket hangs the run for ever`);
    assert.match(fn, /setTimeout\(\s*\(\)\s*=>\s*req\.destroy\(/,
      `${name}: the ceiling must DESTROY the request; a timer that only logs changes nothing`);
    // AND IT MUST BE CLEARED, or a healthy run holds the process open past its
    // own exit on a timer with nothing left to bound.
    assert.match(fn, /clearTimeout\(/, `${name}: the ceiling timer is never cleared`);
    assert.match(fn, /req\.on\("response"/, `${name}: nothing clears the ceiling on a real answer`);
  }

  // THE NUMBER IS THE WORKER'S OWN AND NOT A SECOND GUESS AT BUILD LENGTH.
  // `QUEUE_WAIT_MS` is 16 minutes: past it the Worker stops waiting on the
  // consumer and answers, so a reply that has not arrived by 18 has no path
  // left to arrive by. Read out of worker.js rather than restated, since the
  // whole point is that there is one meaning.
  const workerSrc = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const qm = workerSrc.match(/const QUEUE_WAIT_MS = (\d+) \* 60 \* 1000;/);
  assert.ok(qm, "QUEUE_WAIT_MS is no longer a minutes literal — re-anchor this check");
  const queueMinutes = Number(qm[1]);
  assert.match(CODE, new RegExp(`QUEUE_WAIT_MINUTES = ${queueMinutes};`),
    "the harness's copy of the Worker's queue wait has drifted from worker.js");
  const cm = CODE.match(/POST_CEILING_MS = \(QUEUE_WAIT_MINUTES \+ (\d+)\)/);
  assert.ok(cm, "the ceiling must be derived from the queue wait, not a bare literal");
  assert.ok(Number(cm[1]) >= 1,
    "the ceiling must leave slack for the answer to travel, or it fires on a healthy run");

  // THE FALL-THROUGH IS THE WHOLE REASON THIS IS SAFE. Rejecting lands in the
  // branch that already exists — `disconnected = true`, then watch the trace and
  // the site — which is proven (arm C) and can see a build that finished. Until
  // now the ONLY way to reach it was a reset.
  assert.match(CODE, /disconnected = true;/,
    "the timeout must fall through to the watch, not become a new failure path");
});

// ── A 200 IS NOT A PUBLISHED SITE ───────────────────────────────────────────
//
// Run 36 (2026-08-25) is why these exist. The socket reset at 258s, the watch
// polled the site, got a 200, and declared "PUBLISHED after 0.0 minutes" — on
// the EARLY PLACEHOLDER, up since 3m49s, seven minutes before the real site
// existed. It printed `done=false ok=null at=gen` on the same line.
//
// The build happened to succeed, so the run was right BY LUCK. On run 35, which
// never published at all, the same code would have reported a site that does
// not exist.
const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

test("THE WATCH READS THE BODY ON A 200 — r.ok alone cannot tell the site from the stand-in", () => {
  // Anchored on the WATCH's own branch rather than on any `r.ok` in the file:
  // `discoverSlug` has one too and it is about a completely different read.
  //
  // BOUNDED ON THE LOOP'S OWN STATE AND ITS LAST STATEMENT. This named a
  // variable that was renamed on 2026-08-26 when the watch grew a second way to
  // settle, so both anchors answered -1 and `slice(-1, -1)` gave the empty
  // string — which the length check below caught, LOUDLY, which is the whole
  // reason it is there. `let published = false` and the poll's own sleep are
  // properties of the loop rather than names somebody chose.
  const at = CODE.indexOf("let published = false");
  assert.ok(at > 0, "the watch loop's published state is gone");
  const end = CODE.indexOf("setTimeout(r, 15000)", at);
  assert.ok(end > at, "could not find the poll's own sleep — the loop window would be wrong");
  const loop = CODE.slice(at, end);
  assert.ok(loop.length > 200, "the watch loop window is empty");
  assert.ok(loop.length < 4000,
    "the watch loop window ran past the loop — an over-wide window passes these checks against " +
    "text from somewhere else");
  assert.match(loop, /isPlaceholder\(await r\.text\(\)\)/,
    "the watch does not read the body — this is the run-36 bug, restored");
  assert.match(loop, /if \(!stand\) published = true/,
    "a placeholder 200 must not count as published");
});

test("THE MARKER AGREES WITH WHAT worker.js REALLY EMITS — derived, never restated", () => {
  // THE ONE WAY THIS FIX DIES SILENTLY. `worker.js` owns the meta name; this
  // script carries its own copy of the attribute pair. Rename the tag there and
  // the watch stops recognising a placeholder — with no error anywhere, and the
  // run-36 bug back exactly as it was.
  //
  // So the tag is REBUILT from worker.js's own constant and its own emitting
  // line, and the script's copy has to be found inside it.
  const name = WORKER.match(/const PLACEHOLDER_MARK = "([^"]+)"/);
  assert.ok(name, "worker.js no longer declares PLACEHOLDER_MARK");
  // The EMITTING line too, so this cannot pass on a constant nothing renders —
  // a marker declared and never put in the page is exactly as invisible to the
  // watch as one that was renamed.
  assert.match(WORKER, /<meta name=\\"" \+ PLACEHOLDER_MARK \+ "\\" content=\\"placeholder\\">/,
    "worker.js no longer emits the placeholder meta tag");
  const emitted = `name="${name[1]}" content="placeholder"`;
  const mine = CODE.match(/const PLACEHOLDER_MARK = '([^']+)'/);
  assert.ok(mine, "the harness lost its placeholder marker");
  assert.equal(mine[1], emitted,
    `the harness looks for ${JSON.stringify(mine[1])} and worker.js emits ${JSON.stringify(emitted)}`);
});

test("A SETTLED PLACEHOLDER ENDS THE WAIT, and only on a STRICT done === true", () => {
  // Without this the watch polls a FAILED build's placeholder for the rest of
  // the job — an hour of "still waiting" about a build that gave up ten minutes
  // earlier. And it must be strict: an unreadable trace answers `{err}`, and
  // "Supabase blinked" must not read as "the build gave up".
  assert.match(CODE, /if \(stand && got\.row && got\.row\.done === true\)/,
    "a settled placeholder no longer ends the wait, or the check went truthy");
});

test("THE WATCH RUNS ON A FIRED BUILD, not only on a reset", () => {
  // THIS IS STAGE 2'S WHOLE MEASUREMENT AND IT NEARLY SHIPPED SKIPPED. The watch
  // was written for the ~285s reset and gated `if (disconnected)`, because that
  // was the only way an answer could arrive late. Stage 2 made a late answer the
  // ORDINARY case — the POST returns 202 in seconds and the socket does not die
  // — so `disconnected` stays false, the watch would never run, step 4c would
  // ask two seconds after the generation started and get its pending 202, and
  // step 5 would print `page=undefined cost=undefined` on a perfect build.
  //
  // ~130 credits, measuring nothing. Asserted as a PROPERTY of the gate rather
  // than a spelling, because "tidy this back to `disconnected`" is a one-word
  // edit that restores the bug with every other check in this file green.
  // ANCHORED ON THE STATEMENT THE GATE OPENS, NEVER ON THE COMMENT ABOVE IT.
  // `CODE` is comment-BLANKED — the file argues both hazards at length and would
  // otherwise match its own prose — so the first draft of this anchored on
  // `// THE SLUG IS ALREADY IN HAND` and matched nothing at all, failing against
  // perfectly correct code. `\s*` crosses the blanked comment.
  const gate = CODE.match(/\nif \(([^)]*)\) \{\s*let slug = SLUG/);
  assert.ok(gate, "could not find the watch's gate — this check would be vacuous");
  assert.match(gate[1], /\bfiredJob\b/,
    "the watch must run on a FIRED build. Gated on `disconnected` alone it is skipped on every " +
    "stage-2 build, which is every build — and the run reports page=undefined cost=undefined");
  assert.match(gate[1], /\bdisconnected\b/,
    "…and it must still run on a reset, which is what it was built for");

  // AND THE SLUG COMES OFF THE 202 RATHER THAN OUT OF SUPABASE. The fired answer
  // carries it, so `discoverSlug` there is a round trip for something we were
  // just told — and it must stay as the fallback for the reset, where the answer
  // is the thing that was lost.
  assert.match(CODE, /let slug = SLUG \|\| \(d && d\.slug\) \|\| ""/,
    "the fired path must prefer the slug the 202 already carried");
  assert.match(CODE, /slug = await discoverSlug\(\)/,
    "…and the ledger lookup must survive as the fallback for a reset");
});

test("STEP 5 PRINTS WHEN THERE IS AN ANSWER, and says WHICH absence when there is not", () => {
  // `!disconnected` stopped meaning "we have the answer" the moment a build
  // could return 202 and answer minutes later: on the fired path it is TRUE
  // while `d` is the 202, which carries no page, no cost and no image report.
  // So step 5 would have printed `undefined` four times over rather than saying
  // the generation had not finished.
  assert.match(CODE, /let haveAnswer = !!build && !disconnected && !firedJob;/,
    "the answer flag must start false on a fired build — the 202 is not the answer");
  assert.match(CODE, /haveAnswer = true;/, "…and step 4c must set it when it collects");

  // THE RESPONSE DUMP GATES ON THE SAME THING, because it makes the same claim.
  // On `!disconnected` it prints the 202 — a job id and a `resuming` stage —
  // under the heading "full response", which is a bare fact wearing the label of
  // the thing this run exists to record. Survived the first sweep.
  assert.match(CODE, /\nif \(haveAnswer\) \{\s*log\("step 4 — full response/,
    "the response dump must gate on having the answer too, or it prints the 202 as if it were one");
  // The gate and the region are located by ONE match, so this cannot pass on a
  // step 5 that is gated correctly somewhere else in the file. Anchored on code
  // rather than the `── step 5:` banner, which the blanker turns to spaces.
  const fiveAt = CODE.search(/\nif \(haveAnswer\) \{\s*log\(`step 5 — page=/);
  assert.ok(fiveAt > 0,
    "step 5 must gate on having the answer, not on the socket having survived");
  const five = CODE.slice(fiveAt);
  assert.ok(five.length > 400, "could not find step 5 — this check would be vacuous");

  // TWO ABSENCES, TWO SENTENCES. A reset lost the response for good; a fired
  // generation that had not finished has its answer stored under the job id and
  // is merely slow. Telling somebody their cost breakdown is "gone" when it is
  // sitting in R2 sends them looking for a bug that is not there.
  assert.match(five, /\} else if \(disconnected\) \{/,
    "the reset's own sentence must stay reachable");
  assert.match(five, /not written[\s\S]{0,400}NOT lost/,
    "a fired build that had not finished must be told apart from a lost response");
});

test("ONE TRACE READ SERVES BOTH THE LINE AND THE DECISION", () => {
  // The fact the watch needed was already in its hand and only the formatter
  // could see it. Two readers would drift back into exactly that.
  assert.match(CODE, /async function readTrace\(/, "readTrace is gone");
  assert.match(CODE, /function traceText\(/, "traceText is gone");
  assert.match(CODE, /async function traceLine\(slug\) \{ return traceText\(await readTrace\(slug\)\); \}/,
    "traceLine no longer composes from the shared reader");
  // A read that FAILS must be `{err}`, never a null row: "no answer" and "no
  // row" are different, and the second is what a build that never started is.
  assert.match(CODE, /return \{ err: `trace read \$\{r\.status\}` \}/, "a failed read stopped naming itself");
});
