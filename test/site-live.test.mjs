// Taking a site off the web, and putting it back.
//
// The property under test everywhere: going offline is NEVER a one-way door.
// The button this replaces posted to a route that did not exist and told the
// owner to try again, so the failure mode being guarded against is not "it
// breaks" — it is "it says it worked".
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { wayBack, takeOffline, putBackOnline } from "../site-live.mjs";

const V = [{ id: "20260812-aaaa", at: 2, label: "Latest" }, { id: "20260811-bbbb", at: 1, label: "Older" }];

// THE ROLLBACK FAKE USED TO ANSWER `{ok, files}` AND THAT IS NOT WHAT THE REAL
// ONE ANSWERS. `rollbackVersion` returns the archived SCRIPT too, and its
// docstring says the caller must read it: a version with one needs it uploaded,
// one without needs whatever is standing taken down. A fake that never produced
// a script meant this module never had to decide — so the whole script half was
// missing and 20 tests were green, while "put the site back online" restored the
// pages over no script at all and the platform answered 404 at every address.
// The `setTotp` lesson from the other direction: a fake LESS informative than the
// thing it stands in for hides the branch nobody wrote.
const deps = (o = {}) => {
  const seen = { wiped: 0, rolled: [], recompiled: 0, put: [], dropped: [], order: [] };
  return {
    seen,
    d: {
      versions: async () => ("versions" in o ? o.versions : V),
      hasSource: async () => ("hasSource" in o ? o.hasSource : true),
      wipe: async () => { seen.wiped++; if (o.wipeThrows) throw new Error("R2 down"); return 7; },
      rollback: async ({ id }) => {
        seen.rolled.push(id); seen.order.push("files");
        return o.rollback === undefined ? { ok: true, files: 12, worker: "export default { fetch(){} }", build: "b-old" } : o.rollback;
      },
      putWorker: async ({ slug, code, build }) => {
        seen.put.push({ slug, code, build }); seen.order.push("worker");
        if (o.putThrows) throw new Error("dispatch down");
        return o.putWorker === undefined ? { ok: true } : o.putWorker;
      },
      dropWorker: async ({ slug }) => {
        seen.dropped.push(slug); seen.order.push("worker");
        return o.dropWorker === undefined ? { ok: true } : o.dropWorker;
      },
      recompile: async () => { seen.recompiled++; return o.recompile === undefined ? { ok: true, files: 12 } : o.recompile; },
    },
  };
};

// ── which way back ──────────────────────────────────────────────────────────

test("a version is preferred over a recompile — it is the exact bytes that were live", () => {
  assert.deepEqual(wayBack({ versions: V, hasSource: true }), { how: "version", id: "20260812-aaaa" });
});

test("the NEWEST version is the one chosen", () => {
  assert.equal(wayBack({ versions: V, hasSource: false }).id, V[0].id);
});

test("stored source is the fallback when there is no archive", () => {
  assert.deepEqual(wayBack({ versions: [], hasSource: true }), { how: "recompile" });
});

test("neither means no way back", () => {
  assert.deepEqual(wayBack({ versions: [], hasSource: false }), { how: null });
  assert.deepEqual(wayBack({}), { how: null });
});

test("a version entry with no id does not count as one", () => {
  assert.equal(wayBack({ versions: [{}, null], hasSource: false }).how, null);
});

// ── going offline ───────────────────────────────────────────────────────────

test("a site with a saved copy goes offline, and the files really are removed", async () => {
  const { d, seen } = deps();
  const r = await takeOffline(d, { slug: "cafe" });
  assert.equal(r.ok, true);
  assert.equal(r.live, false);
  assert.equal(seen.wiped, 1);
  assert.equal(r.removed, 7);
});

test("GOING OFFLINE IS REFUSED WITH NO WAY BACK, and nothing is wiped", async () => {
  // The whole point of the module. Wiping here turns a reversible action into a
  // permanent one, which is the bug this replaces rather than a new version of it.
  const { d, seen } = deps({ versions: [], hasSource: false });
  const r = await takeOffline(d, { slug: "cafe" });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "no-way-back");
  assert.equal(seen.wiped, 0, "a refused offline must not have deleted anything");
  assert.match(r.msg, /gone for good/);
});

test("the reply names what SURVIVES, not just what went", async () => {
  // Somebody taking their shop's site down mid-refit wants to hear the bookings
  // are still there before they hear a file count.
  const { d } = deps();
  const r = await takeOffline(d, { slug: "cafe" });
  assert.match(r.msg, /bookings/);
  assert.match(r.msg, /put the site back online/);
});

test("A FAILED WIPE SAYS THE SITE IS STILL UP — never that it worked", async () => {
  const { d } = deps({ wipeThrows: true });
  const r = await takeOffline(d, { slug: "cafe" });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "wipe");
  assert.match(r.msg, /still up/);
});

test("an unreadable archive does not block a site that has source", async () => {
  const d = {
    versions: async () => { throw new Error("R2 list failed"); },
    hasSource: async () => true,
    wipe: async () => 3,
  };
  const r = await takeOffline(d, { slug: "cafe" });
  assert.equal(r.ok, true);
  assert.equal(r.back, "recompile");
});

test("no slug is refused rather than wiping a prefix built from undefined", async () => {
  const { d, seen } = deps();
  assert.equal((await takeOffline(d, {})).ok, false);
  assert.equal(seen.wiped, 0);
});

// ── coming back ─────────────────────────────────────────────────────────────

test("the newest version is restored, and nothing is recompiled", async () => {
  const { d, seen } = deps();
  const r = await putBackOnline(d, { slug: "cafe" });
  assert.equal(r.ok, true);
  assert.equal(r.how, "version");
  assert.deepEqual(seen.rolled, ["20260812-aaaa"]);
  assert.equal(seen.recompiled, 0, "a restore is containerless — recompiling would cost time for nothing");
});

// ── the script half, which is what makes those files a site ─────────────────

test("A VERSION'S OWN SCRIPT IS PUT BACK UP, after the files", async () => {
  // `takeOffline` removes the script first, deliberately, so by here there is
  // NONE standing — and under Start there is no static path to fall back to.
  // Restoring the files alone leaves the site answering 404 at every address
  // while the reply says it is back.
  const { d, seen } = deps();
  const r = await putBackOnline(d, { slug: "cafe" });
  assert.equal(r.ok, true);
  assert.equal(seen.put.length, 1, "the archived script was never uploaded");
  assert.equal(seen.put[0].slug, "cafe");
  assert.equal(seen.put[0].code, "export default { fetch(){} }");
  // THE VERSION'S OWN STAMP, not this moment's: a rollback serves an OLD build,
  // so what the upload has to wait for is that build's id.
  assert.equal(seen.put[0].build, "b-old");
  assert.deepEqual(seen.order, ["files", "worker"],
    "a script uploaded first serves a document naming assets that are not back yet");
  assert.equal(seen.dropped.length, 0);
});

test("…and the reply SAYS the script went back up", async () => {
  // The owner's only signal. A response that cannot tell "the archived script is
  // serving again" from "there is no script at all" is the works-but-cannot-say-so
  // failure this whole route was reported for.
  const { d } = deps();
  assert.equal((await putBackOnline(d, { slug: "cafe" })).worker, "uploaded");
});

test("a version with NO script takes down whatever is standing, and says so", async () => {
  // A pre-Start archive: those carry real prerendered documents, so the static
  // path genuinely is where they belong — and a newer script left over them
  // would name assets the restore has just swept away. Blank either way.
  const { d, seen } = deps({ rollback: { ok: true, files: 9, worker: null } });
  const r = await putBackOnline(d, { slug: "cafe" });
  assert.equal(r.ok, true);
  assert.equal(r.worker, "dropped");
  assert.deepEqual(seen.dropped, ["cafe"]);
  assert.equal(seen.put.length, 0, "there was no script to upload");
});

test("A FAILED UPLOAD IS NEVER REPORTED AS BACK ONLINE — it falls through to the recompile", async () => {
  // The recompile publishes a script of its own, so it is a real recovery rather
  // than a retry of the same failure.
  const { d, seen } = deps({ putWorker: { ok: false, status: 500, error: "dispatch refused" } });
  const r = await putBackOnline(d, { slug: "cafe" });
  assert.equal(seen.recompiled, 1);
  assert.equal(r.ok, true);
  assert.equal(r.how, "recompile");
});

test("…and an upload that THROWS falls through too", async () => {
  const { d, seen } = deps({ putThrows: true });
  const r = await putBackOnline(d, { slug: "cafe" });
  assert.equal(seen.recompiled, 1);
  assert.equal(r.how, "recompile");
});

test("with no source behind it, a failed upload REFUSES and does not claim the site is live", async () => {
  const { d } = deps({ putWorker: { ok: false, status: 500 }, hasSource: false });
  const r = await putBackOnline(d, { slug: "cafe" });
  assert.equal(r.ok, false);
  assert.notEqual(r.live, true);
  assert.equal(r.reason, "worker");
  assert.doesNotMatch(r.msg, /Back online/, "the one sentence this must not say");
  assert.match(r.msg, /isn't serving/);
});

test("a caller that has not wired the script deps cannot be told the site is live", async () => {
  // The opposite call from `rollbackVersion`'s optional `sweep`, and deliberately
  // so: there, "behave exactly as before" was correct; here before was the bug.
  const { d, seen } = deps();
  delete d.putWorker; delete d.dropWorker;
  const r = await putBackOnline(d, { slug: "cafe" });
  assert.equal(seen.recompiled, 1, "an unwired script half must not pass as a completed restore");
  assert.equal(r.how, "recompile");
});

test("a restore that ACTIVATED (stage 7) is back online with its script up, and nothing is settled twice", async () => {
  // A build-layout version's own script goes up inside `deps.rollback`; the
  // answer says so, and this module must neither upload it again nor read the
  // absence of a code string as "drop the standing script" — the outcome that
  // would take a just-restored site down.
  const { d, seen } = deps({ versions: [{ id: "00000000001000-aaaaaa" }] });
  d.rollback = async () => ({ ok: true, id: "00000000001000-aaaaaa", files: 4, activated: true, uploaded: true });
  d.putWorker = async () => { throw new Error("must not upload twice"); };
  d.dropWorker = async () => { throw new Error("must not drop"); };
  const r = await putBackOnline(d, { slug: "cafe" });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.live, true);
  assert.equal(r.how, "version");
  assert.equal(r.worker, "uploaded");
  assert.equal(r.files, 4);
  assert.equal(seen.recompiled, 0, "an activated restore fell through to the recompile");
});

test("an unconfigured dispatch namespace is not a failure", async () => {
  // `putSiteWorker`/`dropSiteWorker` both answer `null` when there are no
  // credentials — a platform with no scripts anywhere, not this site's problem.
  // Only an explicit `ok === false` is a failure, the same reading
  // `/versions/restore` uses.
  const { d, seen } = deps({ putWorker: null });
  const r = await putBackOnline(d, { slug: "cafe" });
  assert.equal(r.ok, true);
  assert.equal(r.how, "version");
  assert.equal(seen.recompiled, 0);
});

test("a RECOMPILE whose script upload failed is not reported as back online either", async () => {
  // The same half-site on the other branch. `recompileAndPublish` uploads the
  // script itself and sets `worker.uploaded === false` only when the upload
  // really failed, so reading `pub.ok` alone calls a 404 site live.
  const { d } = deps({ versions: [], recompile: { ok: true, files: 12, worker: { uploaded: false, status: 500, error: "x" } } });
  const r = await putBackOnline(d, { slug: "cafe" });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "worker");
  assert.doesNotMatch(r.msg, /Back online/);
});

test("a recompile that reports a healthy script is back online as before", async () => {
  // The floor under the check above: `worker` is undefined on every clean
  // publish, so an ordinary recompile must not start refusing.
  const { d } = deps({ versions: [] });
  const r = await putBackOnline(d, { slug: "cafe" });
  assert.equal(r.ok, true);
  assert.equal(r.how, "recompile");
});

test("with no archive it recompiles from the stored source", async () => {
  const { d, seen } = deps({ versions: [] });
  const r = await putBackOnline(d, { slug: "cafe" });
  assert.equal(r.ok, true);
  assert.equal(r.how, "recompile");
  assert.equal(seen.recompiled, 1);
});

test("A VERSION THAT WILL NOT RESTORE FALLS THROUGH TO THE RECOMPILE", async () => {
  // The archive is best-effort by design — `listVersions` already skips an
  // unreadable manifest — and the source is a second, independent copy.
  // Refusing here would strand a site over a convenience path.
  const { d, seen } = deps({ rollback: { ok: false } });
  const r = await putBackOnline(d, { slug: "cafe" });
  assert.equal(r.ok, true);
  assert.equal(r.how, "recompile");
  assert.equal(seen.recompiled, 1);
});

test("…and a rollback that THROWS falls through too", async () => {
  const { d, seen } = deps();
  d.rollback = async () => { throw new Error("copy failed"); };
  const r = await putBackOnline(d, { slug: "cafe" });
  assert.equal(r.ok, true);
  assert.equal(seen.recompiled, 1);
});

test("a failed restore with no source to fall back on is reported, never as success", async () => {
  const { d } = deps({ rollback: { ok: false }, hasSource: false });
  const r = await putBackOnline(d, { slug: "cafe" });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "restore");
});

test("a failed recompile is reported, never as success", async () => {
  const { d } = deps({ versions: [], recompile: { ok: false } });
  const r = await putBackOnline(d, { slug: "cafe" });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "recompile");
});

test("nothing to put back says so plainly", async () => {
  const { d, seen } = deps({ versions: [], hasSource: false });
  const r = await putBackOnline(d, { slug: "cafe" });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "no-way-back");
  assert.equal(seen.recompiled, 0);
});

test("coming back never mentions a cost, because there is none", async () => {
  const { d } = deps();
  const r = await putBackOnline(d, { slug: "cafe" });
  assert.match(r.msg, /same address/);
  assert.ok(!/credit/i.test(r.msg));
});

// ── the wiring, which is the layer this feature actually died at ────────────

test("THE ROUTE WIRES BOTH SCRIPT DEPS, to the real dispatch functions", () => {
  // The module can be perfectly correct and never reach a script: `rollback` was
  // wired and `out.worker` was read by nothing, and from outside that is
  // byte-identical to no fix at all. Guarded here because the deps object is the
  // seam, and a module test cannot see it.
  const raw = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  // Prose describing a thing contains that thing's spelling, so a source-read
  // against raw text can match the comment and pass against code that was never
  // wired. Blanked line-wise and length-preserving, so indices stay valid.
  //
  // MEASURED INERT TODAY rather than left looking load-bearing: no comment in
  // `worker.js` spells `putWorker:` or `dropWorker:`, so raw and blanked give the
  // same answer on every assertion here. It stays because the comment beside this
  // wiring argues at length about which of the two a version needs, and one
  // worked example added to it is enough to make the raw scan match deleted code.
  const src = raw.split("\n").map((l) => (l.trim().startsWith("//") ? " ".repeat(l.length) : l)).join("\n");

  const open = src.indexOf("const liveDeps = {");
  assert.ok(open > 0, "could not find the offline/online deps object");
  const close = src.indexOf("putBackOnline(liveDeps", open);
  assert.ok(close > open, "could not find where the deps are used");
  const block = src.slice(open, close);

  // Named AND pointed at the real thing: a `putWorker` wired to anything else is
  // a restore that reports a script it never uploaded.
  assert.match(block, /putWorker:[^\n]*putSiteWorker\(env,\s*slug/);
  assert.match(block, /dropWorker:[^\n]*dropSiteWorker\(env,\s*slug/);
  // The upload needs the version's own code and build stamp — `putSiteWorker`
  // returns `null` for anything that is not `{ok:true, code}`, so a call missing
  // either reads as "nothing to upload" and silently does nothing at all.
  assert.match(block, /putWorker:[^\n]*ok:\s*true,\s*code,\s*build/);
  // And both halves reach the function that decides between them.
  assert.match(src.slice(close, close + 200), /putBackOnline\(liveDeps/);
  // THE ONE RESTORE (stage 7, 2026-09-05): `restoreVersion` activates a
  // build-layout version itself and answers `activated: true`, and falls to
  // `rollbackVersion` for a legacy one — whose script this route's deps then
  // settle. This read `rollbackVersion` here and went red for the change.
  assert.match(block, /rollback:[^\n]*restoreVersion\(env, slug, id\)/);
  const restore = src.slice(src.indexOf("async function restoreVersion("), src.indexOf("\n}\n", src.indexOf("async function restoreVersion(")));
  assert.match(restore, /rollbackVersion\(versionDepsWithSweep\(env\), \{ slug, id \}\)/, "the legacy copy path is gone from the one restore");
  // And the module reads the activated answer as the script being up.
  const live = fs.readFileSync(new URL("../site-live.mjs", import.meta.url), "utf8");
  assert.match(live, /if \(out && out\.ok && out\.activated === true\) \{/, "putBackOnline does not recognise an activated restore");
});

// ── the module's own boundary ───────────────────────────────────────────────

test("THE LANE CANNOT REACH THE DATABASE OR A MODEL", () => {
  // Taking a site offline must never be able to touch the rows it exists to
  // preserve. The protection is that the calls are absent.
  const src = fs.readFileSync(new URL("../site-live.mjs", import.meta.url), "utf8");
  for (const forbidden of ["applySiteSchema", "sqlQuery", "sqlExec", "anthropicMessages", "generateSitePages", "neonDelete"]) {
    assert.ok(!src.includes(forbidden), "site-live must not be able to reach " + forbidden);
  }
});
