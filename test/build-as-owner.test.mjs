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
const CODE = SRC.replace(/\/\/[^\n]*/g, (m) => " ".repeat(m.length));

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
  assert.match(watch, /traceLine\(slug\)/,
    "the trace must be read for the discovered slug, not the unset OWNER_SLUG");
  assert.doesNotMatch(watch, /traceLine\(SLUG\)/);
  assert.doesNotMatch(watch, /slug: SLUG/,
    "the synthesised response must carry the discovered slug");
});
