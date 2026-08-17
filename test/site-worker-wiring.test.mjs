// WHO UPLOADS THE SITE'S SCRIPT, AND WHO TAKES IT DOWN.
//
// The script is a SECOND copy of what a site serves, and it goes stale the
// moment R2 changes underneath it: it bakes in the shell (which names that
// build's content-hashed assets) and the route list. So there is exactly one
// rule, and every path in the platform is on one side of it:
//
//   a path that COMPILES uploads the script it just packaged
//   a path that changes what R2 holds WITHOUT compiling takes the script down
//
// Getting either half wrong is silent and total. A publish that skips the
// upload leaves a script serving the previous build's chunks — which survive
// one publish on the sweep's grace period and are gone after the next, so the
// site goes blank an edit later with nothing connecting it to the edit that did
// it. A wipe that leaves the script up serves a fully rendered page from a site
// that was supposed to be offline or deleted.
//
// DERIVED, NOT LISTED. A hand-written list of today's call sites is exactly
// what left twelve features dead in this file: the eighth path added later is
// covered by nobody. So both halves are found by scanning `worker.js` for the
// things that change R2 and requiring each to be paired.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

/**
 * `worker.js` cannot have its comments stripped wholesale — a `/*` inside a
 * string literal eats 46% of the file, measured. Line comments are safe to
 * blank conservatively, and that is all these scans need: the hazard here is a
 * comment MENTIONING a call satisfying a check for code that does not make one.
 */
function blankLineComments(src) {
  return src.split("\n").map((l) => (/^\s*\/\//.test(l) ? "" : l)).join("\n");
}
const code = blankLineComments(worker);

/** Byte offsets of every match, in order. */
function offsets(src, re) {
  const out = [];
  for (const m of src.matchAll(re)) out.push(m.index);
  return out;
}

/* ------------------------------------------------ the uploading half */

test("EVERY PATH THAT COMPILES UPLOADS THE SCRIPT IT PACKAGED", () => {
  // The container packages a script only when asked, so `worker: true` on a
  // build request IS the set of compiling paths — there is no other way to get
  // one. Each must be paired with a `putSiteWorker` call, or that path
  // publishes new files under a stale script.
  const asks = offsets(code, /\bworker:\s*true\b/g);
  assert.ok(asks.length >= 2,
    "expected the build path and the cheap-edit spine to both request a script; found " + asks.length);
  const puts = offsets(code, /\bputSiteWorker\(/g);
  // One definition plus one call per compiling path.
  assert.ok(puts.length >= asks.length + 1,
    `${asks.length} paths request a script and only ${puts.length - 1} upload one — ` +
    "a publish that skips the upload leaves the site on a stale script");
});

test("the upload happens AFTER the files are written, never before", () => {
  // The dispatch sits IN FRONT of the R2 read, so the moment a script exists it
  // answers everything — including the asset requests it serves out of R2
  // itself. Uploaded first, a site renders its document and 404s every
  // stylesheet and bundle underneath it for as long as the writes take.
  // `await`, so the function's own DECLARATION — which necessarily sits above
  // every write — is not read as a call site that beats them.
  const calls = offsets(code, /await putSiteWorker\(env,/g);
  assert.ok(calls.length >= 2, "expected an upload on both compiling paths; found " + calls.length);
  // SCOPED TO THE ENCLOSING FUNCTION, and that is the whole correctness of this
  // check. A first draft looked for the nearest `writeSiteDistToR2` ANYWHERE
  // above the call — and `recompileAndPublish` is defined earlier in the file,
  // so hoisting the build path's upload above its own write still found that
  // OTHER function's one and passed. The overlapping-window bug, in the guard
  // written to hold an ordering. Proven by mutation: it survived.
  const starts = offsets(code, /async function \w+\(|publish: async \(/g);
  for (const at of calls) {
    const open = starts.filter((s) => s < at).pop();
    assert.ok(open !== undefined, "a putSiteWorker call sits outside any function — rescope this");
    assert.ok(code.slice(open, at).includes("writeSiteDistToR2("),
      "a putSiteWorker call has no writeSiteDistToR2 before it IN ITS OWN FUNCTION — the " +
      "script would land ahead of the files it serves, and every asset on the site would 404 " +
      "until the writes finished");
  }
});

/* ------------------------------------------------ the removing half */

test("EVERY PATH THAT CHANGES R2 WITHOUT COMPILING TAKES THE SCRIPT DOWN", () => {
  // Two such paths exist: a rollback (which restores an older build's files)
  // and the offline switch (which wipes them). Both are expressed here as
  // "reaches for R2 destructively without a compile", and each must have a
  // `dropSiteWorker` before it.
  const drops = offsets(code, /\bdropSiteWorker\(/g);
  // One definition, plus rollback, plus the offline wipe, plus site delete.
  assert.ok(drops.length >= 4,
    "expected the rollback, the offline wipe and the site delete to each take the " +
    "script down; found " + (drops.length - 1) + " call sites");
});

test("a rollback removes the script BEFORE it restores the files", () => {
  // The opposite order publishes an older build under a script whose shell
  // names assets that are about to be swept — a blank page at a public address.
  const at = code.indexOf("rollbackVersion(versionDepsWithSweep(env), { slug: ownerSlug");
  assert.ok(at > 0, "the versions route's rollback call moved — re-anchor this check");
  const drop = code.lastIndexOf("dropSiteWorker(env, ownerSlug)", at);
  assert.ok(drop > 0 && drop < at, "the rollback no longer takes the script down first");
});

test("a failed removal REFUSES the rollback rather than proceeding", () => {
  // Rolling back anyway is the broken-page outcome; refusing leaves the
  // customer the site they already had. `null` means there was nothing to
  // remove — no credentials configured — and must NOT refuse, or every rollback
  // on the platform stops working the moment this ships.
  const at = code.indexOf("dropSiteWorker(env, ownerSlug)");
  assert.ok(at > 0, "the rollback's drop call moved");
  const window = code.slice(at, code.indexOf("rollbackVersion(versionDepsWithSweep(env), { slug: ownerSlug", at));
  assert.match(window, /if\s*\(dropped\s*&&\s*!dropped\.ok\)/,
    "the rollback must refuse on a FAILED removal and proceed when there was nothing to remove");
});

test("the offline wipe removes the script before it deletes the files", () => {
  // Without this the switch does not work at all: the script renders the
  // document from its own baked shell and never reads R2 for it, so a site
  // whose files were wiped carries on answering with a rendered page.
  const at = code.indexOf("wipe: async ({ slug })");
  assert.ok(at > 0, "the offline wipe dep is no longer async — has it stopped dropping the script?");
  const body = code.slice(at, code.indexOf("rollback: ({ slug, id })", at));
  const drop = body.indexOf("dropSiteWorker(");
  const del = body.indexOf("deleteSitePrefix(");
  assert.ok(drop > 0 && del > 0 && drop < del,
    "the offline wipe must take the script down before the files, or it serves a rendered page over nothing");
});

test("deleting a site removes its script before its files", () => {
  const at = code.indexOf("async function deleteSiteFor(");
  assert.ok(at > 0, "deleteSiteFor moved");
  const body = code.slice(at, at + 8000);
  const drop = body.indexOf("dropSiteWorker(env, dslug)");
  const del = body.indexOf("deleteSitePrefix(env, dslug)");
  assert.ok(drop > 0, "deleting a site no longer removes its script — it would bill forever and keep serving");
  assert.ok(del > drop, "the script must come down before the files, or a deleted site keeps rendering");
});

/* ------------------------------------------------------ the credentials */

test("ONE reader decides whether the dispatch API is reachable", () => {
  // Five call sites each deciding what "configured" means is five chances for
  // one to disagree — and the shape of that disagreement is a path that quietly
  // skips the upload while its neighbours do it, leaving a site's script stale
  // against its own files.
  // `= dispatchCreds(env)`, so the declaration is not counted as a reader.
  const creds = offsets(code, /=\s*dispatchCreds\(env\)/g);
  assert.equal(creds.length, 2, "dispatchCreds should be read by putSiteWorker and dropSiteWorker and nowhere else");
  // And nothing else in the file may assemble the account/token pair by hand.
  const hand = code.match(/accountId:\s*env\./g) || [];
  assert.equal(hand.length, 0, "an account id is being read outside dispatchCreds — that is the second reader");
});

test("the account id and the token both reach the Worker", () => {
  // Both are needed to address `/accounts/<id>/workers/dispatch/…` at request
  // time, and neither is inferable — so an upload silently no-ops without them,
  // which reads exactly like a feature that is switched off.
  const dep = fs.readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
  const listed = dep.slice(dep.indexOf("secrets: |"));
  for (const name of ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]) {
    assert.ok(new RegExp("^\\s+" + name + "\\s*$", "m").test(listed),
      name + " is not uploaded to the Worker, so the dispatch API is unreachable at request time");
  }
});

/* ---------------------------------------------------- the dep contract */

test("publishPages HANDS the script to publish rather than hiding it in a closure", () => {
  // A side channel makes "the script never reached the upload" and "no script
  // was made" the same observation — which is precisely the class of failure
  // this repo has recorded twelve times. Asserted at both ends: the module
  // passes it, and the Worker's dep takes it.
  const pp = fs.readFileSync(new URL("../builder/publish-pages.mjs", import.meta.url), "utf8");
  assert.match(pp, /deps\.publish\(built\.files,\s*pages,\s*built\.worker\)/,
    "publish-pages no longer passes the compiled script to publish");
  assert.match(code, /publish:\s*async\s*\(dist,\s*pages,\s*worker\)/,
    "the build path's publish dep no longer takes the script");
});

test("the script published is the one from the compile that produced the files", () => {
  // On the salvage path `built` is REASSIGNED to the second compile. Read from
  // anywhere but `built`, the script uploaded would render source that was just
  // refused, beside files built from the stubbed set.
  const pp = fs.readFileSync(new URL("../builder/publish-pages.mjs", import.meta.url), "utf8");
  const at = pp.indexOf("deps.publish(built.files");
  assert.ok(at > 0, "the publish call moved");
  assert.match(pp.slice(at, at + 200), /built\.worker/,
    "the script must come off `built`, the same object the published files do");
});
