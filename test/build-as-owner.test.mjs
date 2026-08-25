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
  const disc = CODE.slice(CODE.indexOf("async function discoverSlug"),
    CODE.indexOf("if (disconnected) {"));
  assert.ok(disc.length > 200, "could not find discoverSlug — this check would be vacuous");
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
  const watch = CODE.slice(CODE.indexOf("if (disconnected) {"));
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
  const at = CODE.indexOf("let settledOnPlaceholder");
  assert.ok(at > 0, "the watch loop's placeholder state is gone");
  const loop = CODE.slice(at, CODE.indexOf("if (settledOnPlaceholder)", at));
  assert.ok(loop.length > 200, "the watch loop window is empty");
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
