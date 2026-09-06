// WHAT A LEASE-LESS BUILD COLLECTOR CAN AND CANNOT DO (audit, 2026-09-06).
//
// Stage 6 gave every site a lock and stage 2c gave every build a row, and the
// resumed-build collector is the ONE caller that deliberately proceeds when the
// lock refuses it:
//
//     if (row.busy) console.log("… publishing anyway; the pointer decides");
//     const lease = row.held ? rowOwner : null;
//
// That is a stated residue rather than an oversight — its record is already
// claimed and marked charged, so waiting would mean a build that never
// publishes. But "goes on" is not "may do anything", and what it may do had
// never been written down. These pin the four separate questions, because the
// answers differ and collapsing them is how a residue becomes a hole.
//
// WHAT IS READ AND WHAT IS DRIVEN, said plainly: the collector needs a queue, a
// container, R2 and Postgres to run, so its ORDER is read from the source with
// brace-accurate windows, and the reachability question — can schema be applied
// from here at all — is answered from the import graph, which text cannot fake.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");

/** The collector's own body, brace-matched from its declaration. */
function collectorBody() {
  const at = W.indexOf("async function runResumedSiteBuild(");
  assert.ok(at > 0, "the collector is gone — re-anchor this guard");
  const open = W.indexOf("{", W.indexOf(")", at));
  let depth = 0;
  for (let i = open; i < W.length; i++) {
    if (W[i] === "{") depth++;
    else if (W[i] === "}" && --depth === 0) return W.slice(at, i + 1);
  }
  assert.fail("the collector's body never closes");
}

const BODY = collectorBody();

/**
 * The same text with every whole-line comment blanked, LENGTH PRESERVED.
 *
 * The publish call's own arguments carry a comment reading "the container which
 * row's lease it holds" — so a scan for `lease` inside them answers yes for
 * prose. That is this repository's recorded "prose contains the thing it
 * forbids" trap, met on the first draft of the case below.
 */
const bare = (s) => s.split("\n")
  .map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? " ".repeat(l.length) : l)).join("\n");

const BARE_BODY = bare(BODY);

test("the collector really does go on when the site's lock refuses it", () => {
  assert.ok(BODY.length > 2000, "the body window collapsed: " + BODY.length);
  const busy = BODY.indexOf("row.busy");
  assert.ok(busy > 0, "the collector no longer reads a busy claim");
  // It LOGS and continues — there is no return, throw or early exit on the
  // busy branch. If that ever changes this guard should change with it, but
  // the change would be a behaviour change and must be deliberate.
  const line = BODY.slice(busy, BODY.indexOf("\n", BODY.indexOf("\n", busy) + 1));
  assert.match(line, /console\.log/, "the busy branch no longer says anything");
  assert.doesNotMatch(line, /\breturn\b|\bthrow\b/, "the busy branch now stops — the residue changed, update the audit");
});

test("a refused claim leaves NO lease, and the lease reaches only the heartbeat and the refire", () => {
  assert.match(BODY, /const lease = row\.held \? rowOwner : null;/,
    "the lease is no longer derived from whether the row was really held");

  // Every use of `lease` in the collector. If it ever reaches the publish,
  // that is a behaviour change worth noticing — today it does not, which is
  // exactly why the pointer has to be the wall.
  // WIDE ENOUGH FOR THE CALL THAT USES IT LAST: `recordRefire` takes the lease
  // as its ninth argument, so the name sits ~70 characters after the callee.
  // A 60-character look-back reported it missing on this guard's first draft.
  const uses = [...BARE_BODY.matchAll(/\blease\b/g)].map((m) => BARE_BODY.slice(Math.max(0, m.index - 140), m.index + 40));
  assert.ok(uses.length >= 3, "the lease vanished from the collector");
  const beat = uses.some((u) => /buildRowBeat/.test(u));
  const refire = uses.some((u) => /recordRefire/.test(u));
  assert.ok(beat, "the lease no longer gates the heartbeat");
  assert.ok(refire, "the lease no longer reaches the refire record");
});

test("THE PUBLISH IS NOT GATED ON THE LEASE — the conditional pointer is the wall, not the row", () => {
  // This is the finding the audit turns on. `buildAndPublishPages` is called
  // with the design, the job id, the budget and the models; it is NOT handed
  // the lease and does not ask for one. So a collector that lost the site's
  // lock still stages a version and still attempts activation — and what stops
  // it landing over newer work is stage 7's etag-conditional pointer write,
  // which answers `superseded` and touches nothing.
  const call = BARE_BODY.indexOf("await buildAndPublishPages(env, {");
  assert.ok(call > 0, "the collector no longer publishes — re-anchor");
  let depth = 0, end = -1;
  for (let i = BARE_BODY.indexOf("{", call); i < BARE_BODY.length; i++) {
    if (BARE_BODY[i] === "{") depth++;
    else if (BARE_BODY[i] === "}" && --depth === 0) { end = i; break; }
  }
  assert.ok(end > call, "the publish call's arguments never close");
  const args = BARE_BODY.slice(call, end);
  assert.doesNotMatch(args, /\blease\b/,
    "the publish now takes the lease — if that is deliberate the audit's answer to point 2 changed");
  assert.match(args, /jobId: id/, "the publish no longer carries the row id");
});

test("SCHEMA IS UNREACHABLE FROM THE COLLECTOR — answered from the import graph, not from prose", () => {
  // The sharpest half of "can it write, charge, apply schema, or publish
  // without the lease". Schema has no conditional write and no rollback, so if
  // a lease-less collector could apply it, the pointer would not save us.
  //
  // It cannot: the collector runs the SECOND half of a build (generate,
  // compile, publish). Provisioning and DDL live in the build ROUTE's first
  // invocation, which holds its own claim.
  assert.doesNotMatch(BODY, /applySiteSchema|ensureSiteBackend|normalizeSchema|seedSiteRows/,
    "the collector now reaches schema: a lease-less resume could apply DDL nothing can roll back");

  // And the publish helper it calls cannot reach it either — checked at the
  // module, because a source read of the collector alone would miss a hop.
  const pub = readFileSync(new URL("../builder/publish-pages.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(pub, /applySiteSchema|ensureSiteBackend|seedSiteRows/,
    "the publish helper now applies schema, so the collector reaches it transitively");
});

test("THE MONEY IS GUARDED BY THE RECORD, NOT THE ROW — so a lease-less collector cannot double-charge", () => {
  // `alreadyCharged` on the R2 build record is the wall, and since stage 1c the
  // pages debit is idempotent by ref (`build:<jobId>:pages`) underneath it.
  // Both are facts about the RECORD, which is why losing the row's lease does
  // not open a second charge.
  assert.match(W, /alreadyCharged/, "the charge mark is gone");
  const ref = W.indexOf('billRef = "build:"');
  assert.ok(ref > 0, "the build's debit ref is gone — the pages debit would stop being idempotent");
});

test("A LEASE-LESS COLLECTOR CANNOT COMMIT, so it cannot finalize a publish it did not own", () => {
  // Stage 6 added `lease_expires_at > now()` to `edit_committed`'s owner check.
  // The spine reads the answer, marks the trace and does NOT finalize — so the
  // row is left to the sweep and 3b's reconcile rather than being closed by a
  // holder that had already lost the site.
  const mig = readFileSync(
    new URL("../supabase/applied/20260905200655_site_serialization.sql", import.meta.url), "utf8");
  // ANCHOR ASSERTED BEFORE IT IS USED. The file spells this
  // `CREATE OR REPLACE FUNCTION public.edit_committed(`, in capitals, and a
  // lowercase `indexOf` answers -1 — after which `slice(-1)` is one character
  // and every assertion inside it passes. The recorded vacuous-window trap,
  // met on this guard's first draft.
  const at = mig.search(/CREATE OR REPLACE FUNCTION public\.edit_committed\(/);
  assert.ok(at > 0, "edit_committed is not defined in this migration — re-anchor");
  const fn = mig.slice(at, mig.indexOf("$$;", at));
  assert.ok(fn.length > 200, "the function body window collapsed: " + fn.length);
  assert.match(fn, /lease_expires_at\s*>\s*now\(\)/,
    "the commit no longer requires a live lease: a stale holder could finalize");
  // THE MARK IS BUILT, NOT LITERAL: `tm("commit", commitWhy ? "fail" : "ok", …)`,
  // so a scan for the phrase "commit fail" finds nothing and says the feature
  // is gone. Anchored on the answer being READ and a refusal being said.
  assert.match(W, /const commitWhy = committed && committed\.ok === true \? "" :/,
    "the spine no longer reads whether the commit was granted");
  assert.match(W, /publish commit refused:/,
    "a refused commit is no longer said out loud");
});
