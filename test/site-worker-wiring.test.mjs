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
  // TWO MECHANISMS PUT THE FILES THERE, and the invariant is about the FILES
  // rather than about one function's name. A publish writes them
  // (`writeSiteDistToR2`); a rollback copies an archived build back
  // (`rollbackVersion`), and it restores that version's OWN script afterwards —
  // which is the whole reason a rollback stopped being a `dropSiteWorker`, since
  // under Start there is no static path for a dropped script to fall back to.
  const PUT_FILES = ["writeSiteDistToR2(", "rollbackVersion("];
  for (const at of calls) {
    const open = starts.filter((s) => s < at).pop();
    assert.ok(open !== undefined, "a putSiteWorker call sits outside any function — rescope this");
    const before = code.slice(open, at);
    assert.ok(PUT_FILES.some((f) => before.includes(f)),
      "a putSiteWorker call has nothing that puts the site's files in place before it IN ITS OWN " +
      "FUNCTION — the script would land ahead of the files it serves, and every asset on the site " +
      "would 404 until the writes finished");
  }
});

/* ------------------------------------------------ the removing half */

test("EVERY PATH THAT WANTS NOTHING SERVED TAKES THE SCRIPT DOWN", () => {
  // Two of them: the offline switch and a site delete. Both wipe the files, and
  // without dropping the script the site carries on answering — the script
  // renders the document from its own bundle, so "offline" and "deleted" would
  // both still serve a page.
  //
  // A ROLLBACK IS NO LONGER ONE OF THEM, and that changed with Start. It used to
  // drop the script "to put the site back on the static path", which was true
  // while a published site was documents plus a bundle; `dist/client` has no HTML
  // at all now, so dropping it left the site 404ing. It restores the VERSION'S
  // OWN script instead — except for a pre-Start version, which really does have
  // documents, and for which dropping is still right.
  const drops = offsets(code, /\bdropSiteWorker\(/g);
  // One definition, plus the offline wipe, plus site delete, plus the rollback's
  // no-archived-script arm.
  assert.ok(drops.length >= 4,
    "expected the offline wipe, the site delete and the rollback's no-script arm to each take the " +
    "script down; found " + (drops.length - 1) + " call sites");
});

test("A ROLLBACK PUTS THE VERSION'S OWN SCRIPT BACK, after its files", () => {
  // THIS ASSERTED THE OPPOSITE, on the reasoning that dropping the script "puts
  // the site back on the static path, which is exactly what the archived files
  // are". Measured on a real TanStack Start build: `dist/client` contains no HTML
  // at all, so there is no static path — a rollback that only dropped the script
  // left the site 404ing at its own front door. And keeping the standing script
  // is no better: the server bundle bakes in its own build's content-hashed
  // asset names, so it would name assets the restore has just swept away.
  //
  // AFTER the files, like every other publish: the script serves them out of R2.
  const at = code.indexOf("rollbackVersion(versionDepsWithSweep(env), { slug: ownerSlug");
  assert.ok(at > 0, "the versions route's rollback call moved — re-anchor this check");
  const put = code.indexOf("putSiteWorker(env, ownerSlug", at);
  assert.ok(put > at, "the rollback no longer restores the version's own script after its files");
  // AND THE ARCHIVE CARRIES IT, or there is nothing to restore. Either half alone
  // passes while the wire is cut: an archive with no script leaves the route
  // reading `rb.worker` as undefined on every version for ever.
  const vers = fs.readFileSync(new URL("../site-versions.mjs", import.meta.url), "utf8");
  assert.match(vers, /export async function archiveVersion\(deps, \{[^}]*\bworker\b/,
    "archiveVersion no longer takes the script, so no version can be restored to a working site");
  assert.match(vers, /deps\.put\(dest \+ WORKER_FILE, worker/,
    "the archived script is never written");
});

test("A VERSION WITH NO SCRIPT DROPS WHATEVER IS STANDING", () => {
  // The pre-Start versions: they carry real prerendered documents, so the static
  // path genuinely is where they belong — and leaving a NEWER script over them is
  // the naming-dead-assets failure. Read as a ternary on the archived script so
  // the two arms cannot be reordered into one.
  const at = code.indexOf("rollbackVersion(versionDepsWithSweep(env), { slug: ownerSlug");
  const win = code.slice(at, at + 1200);
  assert.match(win, /rb\.worker[\s\S]{0,200}?putSiteWorker\(env, ownerSlug[\s\S]{0,200}?dropSiteWorker\(env, ownerSlug\)/,
    "the rollback no longer chooses between restoring the version's script and dropping the live one");
});

test("A HALF-RESTORE IS REFUSED, and the read happens before anything is copied", () => {
  // A version that CLAIMS a script and cannot produce one must not proceed: the
  // files would already be back, the standing script would still name the
  // previous build's assets, and the customer would be told it was restored.
  // Refusing leaves them the site they had — the same direction the old
  // failed-removal refusal took, moved to the thing that can now fail.
  const vers = fs.readFileSync(new URL("../site-versions.mjs", import.meta.url), "utf8");
  const read = vers.indexOf("await deps.read(src + WORKER_FILE)");
  const copy = vers.indexOf("await deps.copy(src + rel");
  assert.ok(read > 0 && copy > 0 && read < copy,
    "the archived script is read after the files are copied — a missing one would half-restore");
  assert.match(vers.slice(read, copy), /status: 409/,
    "a version whose script cannot be read no longer refuses");
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

/* ------------------------------------------------------ the answer gets out */

test("THE UPLOAD'S RESULT LEAVES THE BUILDING", () => {
  // `putSiteWorker` logged its result and returned it to nobody, so a build
  // could package a script, fail to upload it, and report success — with the
  // only trace in a Cloudflare log. The site serves from R2 either way, so
  // nothing looks wrong. That is the works-but-cannot-say-so shape this repo
  // records a dozen times, built while fixing it.
  //
  // ASSERTED AT ALL THREE LINKS, because each one alone passes with the wire
  // cut: the capture, the route forwarding it, and the smoke run reading it.
  assert.match(code, /workerUpload = await putSiteWorker\(/,
    "the upload result is discarded again — a failed upload would report as success");
  assert.match(code, /out\.worker =/, "the result never reaches the build's own return value");
  assert.match(code, /worker: pages\.worker \|\| undefined/,
    "the route no longer forwards the upload result");
  // AND THE SMOKE RUN REPORTS ALL THREE OUTCOMES, not merely mentions the
  // field. `assert.match(smoke, /d\.worker\b/)` was the first draft and it
  // passed with the absent-branch broken, because `d.worker.uploaded` two
  // lines down still matched — proved by a mutation that survived. What
  // matters is that "nothing was uploaded", "it worked" and "it failed" are
  // three distinct sentences: the run is the ONLY place a real upload happens,
  // so a missing branch is an outcome nobody would ever see.
  const smoke = fs.readFileSync(new URL("integration/build-smoke.mjs", import.meta.url), "utf8");
  const said = new Set();
  for (const m of smoke.matchAll(/console\.log\("   worker: ([^"]+)/g)) said.add(m[1]);
  assert.equal(said.size, 3,
    "build smoke must separate no-upload, success and failure — it says: " + [...said].join(" | "));
  assert.match(smoke, /if \(!d\.worker\)/, "the absent case is no longer distinguished");
});

test("AND SO DOES THE REMOVAL'S", () => {
  // The worse half of the same blindness, and the one that took a curl to
  // find. A failed UPLOAD is invisible and harmless — the site falls back to
  // R2. A failed REMOVAL leaves a deleted site serving, a rollback that does
  // not take, and an offline switch that stays online, with the ownership row
  // it would be authorised against already gone. Measured live: 21 objects
  // removed and the address still answering 200 a quarter of an hour later.
  assert.match(code, /const workerDrop = await dropSiteWorker\(env, dslug\)/,
    "the removal's result is discarded again");
  assert.match(code, /workerRemoved: workerDrop \? workerDrop\.ok : undefined/,
    "the delete response no longer says whether the script went");
  assert.match(code, /SITE WORKER NOT REMOVED/,
    "…and the log line no longer says what it costs");
  const smoke = fs.readFileSync(new URL("integration/build-smoke.mjs", import.meta.url), "utf8");
  assert.match(smoke, /dd\.workerRemoved === false/,
    "build smoke does not name the cause — the files-are-gone check would fail with no explanation");
});

test("…and says nothing when there is nothing to say", () => {
  // Omitted rather than reported false, so a deployment with no dispatch
  // credentials — every one before this shipped — has a byte-identical
  // response. Its PRESENCE is the signal, the contract `render` and
  // `salvageNote` already use.
  const at = code.indexOf("if (workerUpload) {");
  assert.ok(at > 0, "the result is now attached unconditionally, so an ordinary build's response changed shape");
  // And a failure carries Cloudflare's own code, which is the difference
  // between a missing token scope (10000) and a product not enabled (1404).
  const block = code.slice(at, at + 400);
  assert.match(block, /status: workerUpload\.status/, "a failed upload no longer names Cloudflare's own status");
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

test("EVERY ARCHIVE PASSES THE SCRIPT, or the version cannot be restored", () => {
  // DERIVED FROM THE CALL SITES, not a list of the two that exist today. The
  // build path and the cheap-edit spine each archive, and a third would be
  // written by somebody who had not read `archiveVersion` — whose contract is
  // that a version without its script restores to a blank page or a 404.
  //
  // BOTH SURVIVED A MUTATION SWEEP against `site-versions.mjs`'s own tests,
  // which is the recurring shape here: the module is correct and tested, the
  // Worker never hands it the argument, and nothing spans the two. Twelfth
  // recorded instance.
  const calls = offsets(code, /archiveVersion\(versionDeps\(env\), \{/g);
  assert.ok(calls.length >= 2,
    "expected the build path and the cheap-edit spine to both archive; found " + calls.length);
  for (const at of calls) {
    // To the matching close of the object literal, so a neighbouring call's
    // argument cannot satisfy this one — the overlapping-window bug.
    const end = code.indexOf("});", at);
    assert.ok(end > at, "an archiveVersion call has no closing — rescope this");
    assert.match(code.slice(at, end), /\bworker:/,
      "an archiveVersion call passes no script, so that version restores to a site with no document");
  }
});

test("THE UPLOAD'S ANSWER IS KEPT ON BOTH COMPILING PATHS", () => {
  // It stopped being harmless. Under Start the script is the ONLY thing that
  // renders a document — `dist/client` holds no HTML, measured — so a failed
  // upload leaves the site 404ing while the customer is told their change
  // landed. The build path reported it and the cheap-edit spine discarded it: a
  // real asymmetry, and a mutation restoring it survived the whole suite.
  const calls = offsets(code, /await putSiteWorker\(env, slug,/g);
  assert.ok(calls.length >= 2, "expected an upload on both compiling paths; found " + calls.length);
  for (const at of calls) {
    // The assignment is what makes the answer readable; a bare `await` throws it
    // away. Read backwards from the call to the start of its own statement.
    const line = code.lastIndexOf("\n", at);
    assert.match(code.slice(line, at), /=\s*$/,
      "a putSiteWorker call's result is discarded — a failed upload would report as a successful publish");
  }
  // AND EACH PATH TELLS THE CALLER. Either half alone passes while the wire is
  // cut: a captured result nothing returns is the same silence.
  assert.match(code, /uploaded: false, status: wput\.status/,
    "the cheap-edit spine no longer reports a failed upload");
  assert.match(code, /uploaded: false, status: workerUpload\.status/,
    "the build path no longer reports a failed upload");
});
