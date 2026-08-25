// Published versions, and rolling one back.
//
// Every side effect is injected, so all of this runs with no R2 and no Worker.
// The fake below is deliberately a REAL key-value store rather than a recorder:
// a fake that answers `{}` to everything cannot tell a rollback that copied the
// right files from one that copied nothing — which is the exact shape of the
// `setTotp` failure recorded in the notes, where a fake more capable than the
// dependency hid a live bug for weeks.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  MAX_VERSIONS, versionId, isVersionId, versionLabel,
  archiveVersion, listVersions, rollbackVersion, pruneVersions, deleteAllVersions,
} from "../site-versions.mjs";

/** An in-memory R2: a Map of key → body, plus a log of every mutation in order. */
function bucket(seed = {}) {
  const store = new Map(Object.entries(seed));
  const log = [];
  return {
    store, log,
    deps: {
      async list(prefix) {
        // DELIBERATELY UNORDERED, and reversed rather than merely unspecified.
        // R2 happens to list lexicographically, so a fake that sorted made the
        // `.sort()` in `pruneVersions` load-bearing for nothing — a mutation
        // removing it survived the whole suite. A fake that is MORE capable
        // than the real dependency hides bugs (the `setTotp` lesson); one that
        // is less capable can only ever over-report, which is the safe
        // direction. Nothing here may assume an order it was not promised.
        return [...store.keys()].filter((k) => k.startsWith(prefix)).sort().reverse().map((key) => ({ key }));
      },
      async copy(from, to) {
        if (!store.has(from)) throw new Error("missing source: " + from);
        store.set(to, store.get(from));
        log.push(["copy", from, to]);
      },
      async remove(key) { store.delete(key); log.push(["remove", key]); },
      async put(key, text) { store.set(key, text); log.push(["put", key]); },
      async read(key) { return store.has(key) ? store.get(key) : null; },
    },
  };
}

/** A published site with the files a real generated build has. */
const DIST = ["index.html", "assets/index-a1.js", "assets/menu-b2.js", "assets/style-c3.css"];
function published(slug = "cafe", files = DIST, tag = "v1") {
  const s = {};
  for (const f of files) s["sites/" + slug + "/" + f] = tag + ":" + f;
  return s;
}

// ── ids ───────────────────────────────────────────────────────────────────────

test("a version id sorts chronologically as a string", () => {
  // R2 lists lexicographically and nothing else records the order, so the id
  // has to carry it. Unpadded, 999 would sort after 1000 and the pruner would
  // drop the NEWEST version instead of the oldest.
  const early = versionId(999, "aaa");
  const late = versionId(1000, "aaa");
  assert.ok(early < late, early + " should sort before " + late);
  assert.ok(versionId(1e12, "a") < versionId(2e12, "a"));
  assert.equal(versionId(999, "aaa").split("-")[0].length, 14);
});

test("two publishes in the same millisecond get different ids", () => {
  // Without the random tail the second archive would overwrite the first, and
  // the owner would have one rollback point where they were shown two.
  assert.notEqual(versionId(1700000000000, "abc123"), versionId(1700000000000, "def456"));
});

test("a version id survives a hostile clock and a hostile tail", () => {
  assert.match(versionId(-5, "aaa"), /^0{14}-aaa$/);
  assert.match(versionId(NaN, "aaa"), /^0{14}-aaa$/);
  assert.match(versionId(1, "A/B/../c"), /^0{13}1-abc$/);      // path characters stripped
  assert.match(versionId(1, ""), /^0{13}1-000000$/);           // never a trailing dash
  assert.ok(isVersionId(versionId(Date.now(), "zz")));
});

test("isVersionId refuses anything a caller could aim at another key", () => {
  // This is the whole reason the shape is checked before an id reaches a key:
  // the id is concatenated into an R2 prefix, so a traversal or a wildcard here
  // is a read of somebody else's objects.
  for (const bad of ["", null, undefined, "..", "../../sites/other", "00000000000001-aa/../x",
                     "abcdefghijklmn-aa", "0000000000001-aa", "00000000000001-", "00000000000001-AAA",
                     "00000000000001-aaaaaaa", "00000000000001-a a", 12345]) {
    assert.equal(isVersionId(bad), false, JSON.stringify(bad) + " must not be accepted");
  }
  assert.equal(isVersionId("00000000000001-a"), true);
  assert.equal(isVersionId("99999999999999-abc123"), true);
});

// ── labels ────────────────────────────────────────────────────────────────────

test("a revise is named by what the customer asked for", () => {
  assert.equal(versionLabel({ revise: true, changeNote: "make the background yellow" }), "make the background yellow");
  assert.equal(versionLabel({ revise: false, brand: "Sharp Fade Barbers" }), "Built Sharp Fade Barbers");
});

test("a label is one line and one clause", () => {
  // An instruction can be a paragraph, and a paragraph in a list row is a row
  // nobody reads.
  assert.equal(
    versionLabel({ revise: true, changeNote: "Add a booking page. Also make the hero bigger and put the phone number in the header." }),
    "Add a booking page.");
  const long = versionLabel({ revise: true, changeNote: "x".repeat(200) });
  assert.ok(long.length <= 60, "got " + long.length);
  assert.ok(long.endsWith("…"), "a cut label must say it was cut");
  assert.equal(versionLabel({ revise: true, changeNote: "line one\n\nline two" }), "line one line two");
});

test("a label is never empty, whatever it is handed", () => {
  // An unlabelled row is indistinguishable from a broken one, and every one of
  // these is a shape the route can really produce.
  for (const args of [{}, { revise: true }, { revise: true, changeNote: "   " },
                      { revise: true, changeNote: null }, { revise: false, brand: "" },
                      { revise: false, brand: "   " }, { brand: null }, { changeNote: undefined }]) {
    assert.ok(versionLabel(args).trim(), "empty label for " + JSON.stringify(args));
  }
  assert.equal(versionLabel({ revise: true, changeNote: "  " }), "Revised");
  assert.equal(versionLabel({}), "First build");
});

// ── archive ───────────────────────────────────────────────────────────────────

test("an archive copies every published file and writes a manifest", async () => {
  const b = bucket(published());
  const id = versionId(1000, "aa");
  const r = await archiveVersion(b.deps, { slug: "cafe", id, label: "First build", files: DIST });

  assert.equal(r.ok, true);
  assert.equal(r.files, DIST.length);
  for (const f of DIST) assert.equal(b.store.get("versions/cafe/" + id + "/" + f), "v1:" + f);

  const m = JSON.parse(b.store.get("versions/cafe/" + id + "/_manifest.json"));
  assert.deepEqual(m.files, DIST);
  assert.equal(m.label, "First build");
  assert.equal(m.at, 1000);
});

test("an archive refuses an id it did not mint, before touching anything", async () => {
  const b = bucket(published());
  for (const id of ["../../sites/other", "..", "x", "", null, "0000000000000a-aa", "00000000000001-aaaaaaa"]) {
    const r = await archiveVersion(b.deps, { slug: "cafe", id, files: DIST });
    assert.equal(r.ok, false, JSON.stringify(id) + " must not be archived under");
  }
  // Asserted on the LOG rather than on the return: an id that reached the copy
  // loop would write real objects under a key the caller chose, and a refusal
  // returned after that has already done the damage.
  assert.equal(b.log.length, 0, "nothing may be written for a refused id");
});

test("an archive of nothing is refused rather than recorded as an empty version", async () => {
  // A version with no files would list, and restoring it would sweep the live
  // site to nothing — a rollback that deletes the customer's site.
  const b = bucket(published());
  for (const files of [[], null, undefined, ["", null]]) {
    const r = await archiveVersion(b.deps, { slug: "cafe", id: versionId(1, "a"), files });
    assert.equal(r.ok, false, JSON.stringify(files) + " must not archive");
  }
  assert.equal(b.log.length, 0);
});

test("a label is bounded and defaulted", async () => {
  const b = bucket(published());
  const id = versionId(1, "a");
  await archiveVersion(b.deps, { slug: "cafe", id, label: "x".repeat(500), files: DIST });
  assert.equal(JSON.parse(b.store.get("versions/cafe/" + id + "/_manifest.json")).label.length, 80);

  const id2 = versionId(2, "a");
  await archiveVersion(b.deps, { slug: "cafe", id: id2, files: DIST });
  assert.equal(JSON.parse(b.store.get("versions/cafe/" + id2 + "/_manifest.json")).label, "Build");
});

// ── list ──────────────────────────────────────────────────────────────────────

test("versions list newest first", async () => {
  const b = bucket(published());
  const ids = [];
  for (const t of [1000, 2000, 3000]) {
    const id = versionId(t, "a" + t);
    ids.push(id);
    await archiveVersion(b.deps, { slug: "cafe", id, label: "build " + t, files: DIST });
  }
  const list = await listVersions(b.deps, { slug: "cafe" });
  assert.deepEqual(list.map((v) => v.id), ids.slice().reverse());
  assert.deepEqual(list.map((v) => v.at), [3000, 2000, 1000]);
  assert.equal(list[0].files, DIST.length);
});

test("a version with no readable manifest is not offered", async () => {
  // Restoring it would mean guessing its file list, and a wrong guess publishes
  // a mixture of two builds — worse than the version simply not being there.
  const b = bucket(published());
  const good = versionId(2000, "aa");
  await archiveVersion(b.deps, { slug: "cafe", id: good, files: DIST });

  const orphan = versionId(1000, "bb");
  b.store.set("versions/cafe/" + orphan + "/index.html", "stray");
  const corrupt = versionId(3000, "cc");
  b.store.set("versions/cafe/" + corrupt + "/index.html", "stray");
  b.store.set("versions/cafe/" + corrupt + "/_manifest.json", "{not json");

  assert.deepEqual((await listVersions(b.deps, { slug: "cafe" })).map((v) => v.id), [good]);
});

test("a stray object under the versions prefix is not read as a version", async () => {
  const b = bucket();
  b.store.set("versions/cafe/notanid/_manifest.json", JSON.stringify({ files: ["index.html"] }));
  b.store.set("versions/cafe/_scratch", "x");
  assert.deepEqual(await listVersions(b.deps, { slug: "cafe" }), []);
});

test("one site's versions are not another's", async () => {
  const b = bucket({ ...published("cafe"), ...published("barber", DIST, "v9") });
  await archiveVersion(b.deps, { slug: "cafe", id: versionId(1, "a"), files: DIST });
  await archiveVersion(b.deps, { slug: "barber", id: versionId(2, "b"), files: DIST });
  assert.equal((await listVersions(b.deps, { slug: "cafe" })).length, 1);
  assert.equal((await listVersions(b.deps, { slug: "barber" })).length, 1);
  assert.equal((await listVersions(b.deps, { slug: "CAFE" })).length, 1, "slugs are case-insensitive");
});

// ── rollback ──────────────────────────────────────────────────────────────────

test("a rollback puts the saved build back on the live prefix", async () => {
  const b = bucket(published("cafe", DIST, "v1"));
  const id = versionId(1000, "aa");
  await archiveVersion(b.deps, { slug: "cafe", id, files: DIST });

  // Publish something else over the top, the way a revise would.
  const NEXT = ["index.html", "assets/index-z9.js"];
  for (const k of [...b.store.keys()]) if (k.startsWith("sites/cafe/")) b.store.delete(k);
  for (const f of NEXT) b.store.set("sites/cafe/" + f, "v2:" + f);

  const r = await rollbackVersion(b.deps, { slug: "cafe", id });
  assert.equal(r.ok, true);
  assert.equal(r.files, DIST.length);

  const live = [...b.store.keys()].filter((k) => k.startsWith("sites/cafe/")).sort();
  assert.deepEqual(live, DIST.map((f) => "sites/cafe/" + f).sort());
  for (const f of DIST) assert.equal(b.store.get("sites/cafe/" + f), "v1:" + f);
});

test("a rollback sweeps what the old build had and the restored one does not", async () => {
  // THIS IS THE HALF THAT IS EASY TO LEAVE OUT. Copying the version's files in
  // is not a rollback on its own: the newer build's extra chunks would still be
  // sitting there, and a stale `press-*.js` beside a restored index is exactly
  // the mixture the manifest exists to prevent.
  const b = bucket(published("cafe", ["index.html", "assets/a.js"], "v1"));
  const id = versionId(1000, "aa");
  await archiveVersion(b.deps, { slug: "cafe", id, files: ["index.html", "assets/a.js"] });
  b.store.set("sites/cafe/assets/from-the-newer-build.js", "v2");

  const r = await rollbackVersion(b.deps, { slug: "cafe", id });
  assert.equal(r.swept, 1);
  assert.equal(b.store.has("sites/cafe/assets/from-the-newer-build.js"), false);
});

test("index.html is copied LAST", async () => {
  // The pointer goes in after the thing it points at, or a visitor mid-rollback
  // gets an index naming a bundle that is not there yet — a blank page. Same
  // ordering rule as the publish path.
  const b = bucket(published("cafe", DIST, "v1"));
  const id = versionId(1000, "aa");
  await archiveVersion(b.deps, { slug: "cafe", id, files: DIST });
  b.log.length = 0;

  await rollbackVersion(b.deps, { slug: "cafe", id });
  const copies = b.log.filter((e) => e[0] === "copy").map((e) => e[2]);
  assert.equal(copies.at(-1), "sites/cafe/index.html", "index.html must be the last file copied in");
  assert.ok(copies.length > 1, "the ordering claim is vacuous with one file");
});

test("nothing is removed before every file of the version is in place", async () => {
  // The other half of write-then-sweep: a remove that ran first would take the
  // live site down for the duration of the copies.
  const b = bucket(published("cafe", ["index.html", "assets/a.js"], "v1"));
  const id = versionId(1000, "aa");
  await archiveVersion(b.deps, { slug: "cafe", id, files: ["index.html", "assets/a.js"] });
  b.store.set("sites/cafe/assets/stale.js", "v2");
  b.log.length = 0;

  await rollbackVersion(b.deps, { slug: "cafe", id });
  const firstRemove = b.log.findIndex((e) => e[0] === "remove");
  const lastCopy = b.log.map((e) => e[0]).lastIndexOf("copy");
  assert.ok(firstRemove > lastCopy, "a sweep ran before the copies finished");
});

test("a rollback to an id that is not ours is a 404 and writes nothing", async () => {
  // THE FIRST VERSION OF THIS PASSED WITH THE ID CHECK DELETED, and the reason
  // is the whole point of the sweep: every id here is one nothing has a
  // manifest for, so the 404 came from the missing-manifest check one line
  // BELOW the guard under test. The shape check was covered by nothing.
  //
  // So each bad id is now planted with a manifest at exactly the key it would
  // build. Skip the check and the rollback succeeds — restoring files from a
  // key the caller chose, which is the failure the check exists to prevent.
  const b = bucket(published());
  const HOSTILE = ["../../sites/other", "..", "x", "00000000000001-aaaaaaa", "0000000000000a-aa"];
  for (const id of HOSTILE) {
    b.store.set("versions/cafe/" + id + "/_manifest.json", JSON.stringify({ id, files: ["index.html"] }));
    b.store.set("versions/cafe/" + id + "/index.html", "PLANTED");
  }
  b.log.length = 0;

  for (const id of [...HOSTILE, "", null, undefined]) {
    const r = await rollbackVersion(b.deps, { slug: "cafe", id });
    assert.equal(r.ok, false, JSON.stringify(id) + " must be refused by SHAPE, before any lookup");
    assert.equal(r.status, 404);
  }
  assert.equal(b.log.length, 0, "a refused id must not read, copy or remove anything");
  assert.equal(b.store.get("sites/cafe/index.html"), "v1:index.html", "the live site must be untouched");
});

test("a rollback to a well-formed id that does not exist is a 404, not an empty publish", async () => {
  // The dangerous failure: treating a missing manifest as "no files" and then
  // sweeping — which would delete the live site instead of restoring one.
  const b = bucket(published());
  const r = await rollbackVersion(b.deps, { slug: "cafe", id: versionId(1000, "aa") });
  assert.equal(r.ok, false);
  assert.equal(r.status, 404);
  assert.equal(b.log.length, 0);
  assert.equal(b.store.has("sites/cafe/index.html"), true, "the live site must be untouched");
});

test("a rollback cannot reach another site's version", async () => {
  const b = bucket({ ...published("cafe"), ...published("barber", DIST, "v9") });
  const id = versionId(1000, "aa");
  await archiveVersion(b.deps, { slug: "barber", id, files: DIST });
  const r = await rollbackVersion(b.deps, { slug: "cafe", id });
  assert.equal(r.ok, false, "cafe has no version with that id, whoever else does");
  assert.equal(b.store.get("sites/cafe/index.html"), "v1:index.html");
});

// ── pruning ───────────────────────────────────────────────────────────────────

test("publishing past the cap drops the OLDEST version", async () => {
  const b = bucket(published());
  const ids = [];
  for (let i = 1; i <= MAX_VERSIONS + 3; i++) {
    const id = versionId(i * 1000, "a" + i);
    ids.push(id);
    await archiveVersion(b.deps, { slug: "cafe", id, files: DIST });
  }
  const kept = (await listVersions(b.deps, { slug: "cafe" })).map((v) => v.id);
  assert.equal(kept.length, MAX_VERSIONS);
  assert.deepEqual(kept, ids.slice(-MAX_VERSIONS).reverse());
  for (const gone of ids.slice(0, 3)) {
    assert.equal([...b.store.keys()].some((k) => k.includes(gone)), false, gone + " should be swept whole");
  }
});

test("pruning removes a version's manifest as well as its files", async () => {
  // A manifest left behind would keep listing a version whose files are gone,
  // and restoring it would sweep the live site down to nothing.
  const b = bucket(published());
  for (let i = 1; i <= 3; i++) await archiveVersion(b.deps, { slug: "cafe", id: versionId(i * 1000, "a" + i), files: DIST });
  await pruneVersions(b.deps, { slug: "cafe", cap: 1 });
  assert.deepEqual([...b.store.keys()].filter((k) => k.includes("_manifest")).length, 1);
});

test("pruning under the cap does nothing", async () => {
  const b = bucket(published());
  await archiveVersion(b.deps, { slug: "cafe", id: versionId(1000, "aa"), files: DIST });
  b.log.length = 0;
  assert.equal(await pruneVersions(b.deps, { slug: "cafe" }), 0);
  assert.equal(b.log.length, 0);
});

test("a nonsense cap falls back to the default rather than deleting everything", async () => {
  // Same direction as `site-sessions.mjs`: deleting too little costs storage,
  // deleting too much destroys the only record that a build ever existed.
  const b = bucket(published());
  for (let i = 1; i <= 3; i++) await archiveVersion(b.deps, { slug: "cafe", id: versionId(i * 1000, "a" + i), files: DIST });
  for (const cap of [0, -1, NaN, null, "lots"]) {
    assert.equal(await pruneVersions(b.deps, { slug: "cafe", cap }), 0, "cap " + cap + " must not prune");
  }
  assert.equal((await listVersions(b.deps, { slug: "cafe" })).length, 3);
});

// ── delete ────────────────────────────────────────────────────────────────────

test("deleting a site takes its whole archive", async () => {
  const b = bucket({ ...published("cafe"), ...published("barber", DIST, "v9") });
  await archiveVersion(b.deps, { slug: "cafe", id: versionId(1000, "aa"), files: DIST });
  await archiveVersion(b.deps, { slug: "cafe", id: versionId(2000, "bb"), files: DIST });
  await archiveVersion(b.deps, { slug: "barber", id: versionId(3000, "cc"), files: DIST });

  const n = await deleteAllVersions(b.deps, { slug: "cafe" });
  assert.equal(n, (DIST.length + 1) * 2);
  assert.equal([...b.store.keys()].some((k) => k.startsWith("versions/cafe/")), false);
  assert.equal((await listVersions(b.deps, { slug: "barber" })).length, 1, "another site's archive must survive");
});

test("deleting a site with no archive is zero, not an error", async () => {
  const b = bucket(published());
  assert.equal(await deleteAllVersions(b.deps, { slug: "cafe" }), 0);
});

// ── the seam with worker.js ───────────────────────────────────────────────────

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

test("the archive is labelled with the change, and the change reaches it", () => {
  // A CHAIN, because this has four links and any one of them silently makes
  // every row read the same: the route sends the raw sentence, the function
  // takes it, the archive is labelled from it, and the list returns it.
  assert.match(worker, /changeNote:\s*brief,/, "the route must send the raw turn message");
  assert.match(worker, /async function buildAndPublishPages\(env, \{[^}]*changeNote/,
    "…and the build function must take it");
  // Inside the BUILD path: the shared spine archives too, with its own label,
  // and it is defined above — so the first `archiveVersion(` in the file is no
  // longer this one.
  const bp = worker.indexOf("async function buildAndPublishPages");
  assert.ok(bp > 0, "the build function is gone");
  const i = worker.indexOf("await archiveVersion(", bp);
  assert.ok(i > bp, "the build path no longer archives");
  const call = worker.slice(i, worker.indexOf("});", i));
  assert.match(call, /label: versionLabel\(\{[^}]*changeNote/, "…and the label must be built from it");
  // The composed brief is thousands of characters with the change buried in the
  // middle; labelling from it would put a wall of text in the list.
  assert.ok(!/label:\s*brief\b/.test(call), "the label must not be the composed brief");
  assert.ok(!/label:\s*brand\b/.test(call), "labelling by brand is what made every row identical");
});

test("the publish path archives, and cannot fail a publish that succeeded", async () => {
  // The site is already live by the time an archive runs, so a throw here would
  // trade a working site for a bookkeeping entry. Asserted on the source
  // because the wrapping is the whole guarantee.
  const i = worker.indexOf("await archiveVersion(");
  assert.ok(i > 0, "nothing archives — version history is dead at the publish end");
  const before = worker.slice(Math.max(0, i - 900), i);
  const open = before.lastIndexOf("try {");
  assert.ok(open >= 0, "the archive call is not inside a try");
  assert.ok(/catch/.test(worker.slice(i, i + 900)), "the archive call's try has no catch");
});

test("the restore route rolls back the version the CALLER named", () => {
  // A route cannot be driven from here — nothing can import a Worker
  // entrypoint — so the one thing that binds this layer is read off the source.
  // Worth having: a mutant hardcoding an id survived the entire suite, and an
  // id that ignores the request body is a Restore button that always restores
  // the same build.
  // ANCHORED ON THE CALL, NOT ON THE DEPS IT IS HANDED. This named
  // `rollbackVersion(versionDeps(env)` exactly, and went red on a correct change
  // the moment a rollback started getting the sweep — a test about word order,
  // which is this repo's most repeated own-goal.
  const i = worker.indexOf("const rb = await rollbackVersion(");
  assert.ok(i > 0, "the restore route is gone — re-point this guard");
  const call = worker.slice(i, worker.indexOf(")", worker.indexOf("{", i)) + 1);
  assert.match(call, /slug:\s*ownerSlug/, "the slug comes from the authorised route, never the body");
  assert.match(call, /id:\s*vb\s*&&\s*vb\.id/, "the id must come from the request body");
});

test("the restore route's id is shape-checked exactly once", () => {
  // Both ends of the decision recorded in the route's comment. The check lives
  // in `rollbackVersion`; a second copy in the Worker was measured INERT (its
  // mutant changed nothing observable, because the module refuses first and
  // before any I/O) and removed, so this asserts the module still has it and
  // the route still does not — either half alone lets the pair drift into
  // "checked nowhere".
  const mod = fs.readFileSync(new URL("../site-versions.mjs", import.meta.url), "utf8");
  assert.match(mod, /export async function rollbackVersion[\s\S]{0,200}if \(!isVersionId\(id\)\)/,
    "the module must refuse a bad id before it touches a key");
  const i = worker.indexOf("const rb = await rollbackVersion(");
  assert.ok(i > 0, "the restore route is gone — re-point this guard");
  const route = worker.slice(Math.max(0, i - 1200), i);
  assert.ok(!/if \(!isVersionId\(/.test(route),
    "a second copy of the check drifts from the first — the module is the one place");
});

test("the versions route hands the module's answer through, unprojected", () => {
  // THE WIRING LAYER, where this repo has recorded twelve dead features. The
  // module now carries `restorable: false` on a version whose script was lost,
  // and its only consumer is the wire: a route that projected the array — even
  // innocently, to rename a field — would drop it, and the panel would offer a
  // Restore button that can only ever fail with nothing anywhere saying why.
  //
  // BOUNDED BY THE END OF THE LINE, not by a byte count: the call and the
  // response literal are one statement, so the landmark is `\n`. If the route
  // legitimately grows a projection, re-point this at whatever preserves the
  // flag rather than deleting it.
  const i = worker.indexOf("versions: await listVersions(");
  assert.ok(i > 0, "the versions listing route is gone — re-point this guard");
  const stmt = worker.slice(i, worker.indexOf("\n", i));
  assert.ok(!/\.map\(|\.filter\(|\.slice\(/.test(stmt),
    "the route projects the version list — `restorable` would never reach the panel: " + stmt.trim());
});

test("deleting a site deletes its versions, after the live files", async () => {
  // Ordering: the published prefix is what the caller asked to take down, so
  // the archive sweep must not be able to answer an error before it happens.
  const del = worker.indexOf("async function deleteSiteFor");
  assert.ok(del > 0);
  const body = worker.slice(del, worker.indexOf("\n}", worker.indexOf("domainsReleased", del)));
  const live = body.indexOf("deleteSitePrefix(env, dslug)");
  const vers = body.indexOf("deleteAllVersions(");
  assert.ok(live > 0, "the live sweep is gone — re-point this guard");
  assert.ok(vers > 0, "a deleted site's archive would outlive it");
  assert.ok(live < vers, "versions must be swept after the published files, not before");
});

// ── the live journey ──────────────────────────────────────────────────────────
//
// `build-smoke.mjs` runs against the DEPLOYED Worker, so nothing in `npm test`
// executes it — a mutation deleting one of its assertions is caught by no unit
// test at all. Asserted on the SOURCE instead, which is this repo's standing
// answer for a check it cannot run: it cannot prove the journey passes, but it
// stops the journey being quietly hollowed out into a run that asserts nothing.

const smoke = fs.readFileSync(new URL("./integration/build-smoke.mjs", import.meta.url), "utf8");

test("the smoke run walks a SECOND turn, not just a first build", () => {
  // Every bug the owner hit live was in this path and nothing tested it: the
  // run built one site once and stopped.
  // TWO FACTS, ASSERTED APART. The first draft matched "react-build … within
  // 400 characters … instruction:" and failed on correct code, because the body
  // is declared BEFORE the fetch that sends it — a proximity window standing in
  // for a relationship, which is this session's recurring bug.
  assert.match(smoke, /const reviseBody = \{[\s\S]{0,400}instruction:/, "nothing builds a revise body");
  // ANCHORED ON THE ROUTE AND THE BODY, NOT ON THE TRANSPORT. This pinned
  // `fetch(` and went red on 2026-08-23 when both build POSTs moved to
  // `postLong` — a change that preserves this property exactly and exists
  // because `fetch` was the bug. The recurring own-goal: a guard about a
  // relationship, written as a spelling.
  assert.match(smoke, /`\$\{BASE\}\/api\/site\/react-build`[\s\S]{0,300}JSON\.stringify\(reviseBody\)/,
    "…and nothing sends it to the build route");
  assert.match(smoke, /SMOKE_SKIP_JOURNEY/, "the journey must be turn-off-able — it spends a second real build");
});

test("neither build POST goes through `fetch`, which gives up at 300 seconds", () => {
  // WHY THIS IS AN ASSERTION AND NOT A COMMENT. undici — the engine behind
  // Node's global fetch — abandons a request whose response headers have not
  // arrived in 300s, and that ceiling is NOT reachable from the fetch options:
  // an AbortSignal set longer does not raise it, because the headers timeout
  // fires first. A build takes six to twelve minutes.
  //
  // Measured on run 32624314043: `UNCAUGHT: fetch failed` at exactly 300.0s,
  // mid-build. And what that abort costs is not a lost log line — the `finally`
  // then deleted the throwaway user, cascading `site_backends` away and tearing
  // down the build's own Neon project one second later. The harness destroyed
  // the thing it exists to observe.
  //
  // So this is a property of the harness that has to hold, and it is exactly
  // the kind that gets "tidied" back to fetch by somebody making the file
  // consistent. `scripts/build-as-owner.mjs` learned this months ago; this file
  // was the one that never did.
  assert.match(smoke, /function postLong\(/, "the no-timeout POST is gone — the run dies at 300s again");
  // AT THE START OF A LINE, so a commented-out import does not satisfy it.
  // Found by mutation: `// import https from "node:https";` passed a bare match
  // perfectly — prose containing the thing it asserts, which is the trap this
  // repo has now recorded eight times, here in the guard written for it.
  assert.match(smoke, /^import https from "node:https";$/m, "…and postLong cannot work without node:https");
  for (const m of smoke.matchAll(/([A-Za-z]+)\(`\$\{BASE\}\/api\/site\/react-build`/g)) {
    assert.equal(m[1], "postLong",
      `the build route is posted with \`${m[1]}\` — anything but postLong gives up at 300 seconds, mid-build`);
  }
  // A FLOOR, because the loop above passes vacuously over zero matches — which
  // is what a renamed constant or a rewritten URL would produce, reported as a
  // clean sweep.
  assert.equal([...smoke.matchAll(/\(`\$\{BASE\}\/api\/site\/react-build`/g)].length, 2,
    "expected exactly two posts to the build route (the first build and the revise)");
});

test("the disconnect experiment is off unless asked for, and cannot half-fire", () => {
  // `SMOKE_CUT_MS` destroys the build's own socket N milliseconds in — the only
  // way to prove the queue, because since `postLong` removed our 300-second
  // ceiling this harness HOLDS the connection for the whole build and a run left
  // to itself produces no disconnect at all.
  //
  // WHAT MUST HOLD IS THAT IT IS INERT BY DEFAULT. A truthiness read would let
  // `SMOKE_CUT_MS=abc` or `=0` cut at some arbitrary moment of an ordinary paid
  // run, and the failure would look exactly like the edge reset it is imitating.
  // Strictly a positive number, which is the same discipline `SMOKE_KEEP_SITE`
  // already lives under for the same reason: these switches spend money.
  assert.match(smoke, /Number\(process\.env\.SMOKE_CUT_MS \|\| 0\) > 0 \? Number\(process\.env\.SMOKE_CUT_MS\) : 0/,
    "SMOKE_CUT_MS is not read as a strictly positive number — a stray value could cut a real run");
  // AND IT REACHES THE POST. A knob read and never threaded is the wiring
  // failure this repo has recorded twelve times, and here it would be a run
  // reporting a disconnect experiment that never disconnected.
  assert.match(smoke, /JSON\.stringify\(\{ brief, slug: runSlug \}\), CUT_MS\)/,
    "CUT_MS never reaches the build POST — the experiment would report itself and do nothing");
  assert.match(smoke, /req\.destroy\(/, "nothing actually cuts the socket");
  // A CUT RUN IS NOT A FAILED RUN. Counting it as one makes the single check
  // that can prove the queue permanently red, which is how a signal stops being
  // read — this file's own recurring lesson about a red check nobody looks at.
  assert.match(smoke, /if \(e && e\.deliberate\)/,
    "a deliberate stop is counted as an uncaught failure");
});

test("a dropped connection watches the site instead of abandoning the run", () => {
  // THE ONE CONDITION UNDER WHICH THIS HARNESS CAN PROVE THE QUEUE. Since the
  // build became a queued job a reset is survivable by design, so giving up on
  // one throws away the only live measurement of the thing no unit test can
  // reach: whether Cloudflare really keeps a consumer alive with nobody
  // connected.
  //
  // It also keeps the teardown honest. The `finally` deletes the throwaway user,
  // which drops the site's Neon project; waiting here means that by the time
  // cleanup runs the build is over either way.
  assert.match(smoke, /async function waitForSite\(/, "nothing waits for the site when the answer is lost");
  const i = smoke.indexOf("if (dropped) {");
  assert.ok(i > 0, "a dropped build POST is no longer handled at all");
  // BOUNDED BY THE BRANCH'S OWN CLOSE, not by a byte count. A 1200-character
  // window ran past the branch into the next block's `ok("build returns 200"`,
  // so a mutant demoting the headline to a `console.log` survived — the
  // overlapping-window own-goal, which this repo has recorded four times and
  // which is what a byte window always eventually does.
  const close = smoke.indexOf("\n  }\n", i);
  assert.ok(close > i, "could not find the end of the dropped-connection branch");
  const block = smoke.slice(i, close);
  assert.match(block, /waitForSite\(runSlug/, "the drop path does not watch the site");
  // `ok(` SPECIFICALLY ON THE HEADLINE, not merely somewhere in the block: what
  // has to hold is that the proof is RECORDED as a result, and a `console.log`
  // saying the same words reaches the log and no scoreboard.
  assert.match(block, /ok\("THE BUILD SURVIVED A DROPPED CONNECTION/,
    "the drop path does not RECORD the survival — a printed line is not a result");

  // ── AND THE STAND-IN IS NOT A SITE ─────────────────────────────────────────
  //
  // `waitForSite` read the STATUS and nothing else, and the early placeholder is
  // a 200 at the site's own address. Measured on run 32881464381: the watch
  // returned live on its FIRST look, ~10s after the cut, the run declared the
  // build survived, and the `finally` then deleted the throwaway user four and a
  // half minutes into a thirteen-minute build — cascading `site_backends` and
  // dropping the Neon project out from under the build it had just passed.
  //
  // THE SAME BUG WAS FIXED ONE FILE OVER THE SAME DAY and this watcher did not
  // get it. So the guard is on the PROPERTY rather than on either spelling: the
  // wait must read the body and must refuse the marker.
  const w = smoke.slice(smoke.indexOf("async function waitForSite("));
  const body = w.slice(0, w.indexOf("\n}\n") + 1);
  assert.ok(body.length > 200, "the waitForSite window is empty — this check would be vacuous");

  // ASSERTED AS AN OCCURRENCE COUNT, NOT A PRESENCE, and the first draft of this
  // guard proved why. It matched `.text()` and `PLACEHOLDER_MARK` anywhere in
  // the function — and a mutant that restored the status-only return and left
  // the body-reading branch behind an `if (false)` SURVIVED it, because the
  // strings were still there in dead code. A presence standing in for a
  // property, in the guard written for a bug that had already escaped twice.
  //
  // What has to hold is that there is exactly ONE way to be called live, and
  // that it is the one that has looked at the body.
  const lives = body.match(/live: true/g) || [];
  assert.equal(lives.length, 1,
    `waitForSite has ${lives.length} ways to answer "live" — a second one is a path that never read the body`);
  const liveLine = body.split("\n").find((l) => l.includes("live: true"));
  assert.match(liveLine, /!\s*html\.includes\(PLACEHOLDER_MARK\)/,
    `the only "live" answer must be gated on the body NOT carrying the marker, and it reads: ${liveLine.trim()}`);
  // THE MARKER IS DERIVED FROM `worker.js`, NEVER RESTATED. Rename it there and
  // a watcher pinning its own copy silently stops recognising a stand-in — no
  // error, bug restored. The stamp is built from the constant AND from the line
  // that renders it, so a marker declared and never emitted fails too.
  const wk = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const mark = wk.match(/const PLACEHOLDER_MARK = "([^"]+)"/);
  assert.ok(mark, "worker.js no longer declares PLACEHOLDER_MARK");
  assert.match(wk, new RegExp(`PLACEHOLDER_META = "<meta name=\\\\"" \\+ PLACEHOLDER_MARK`),
    "the placeholder meta tag is no longer built from PLACEHOLDER_MARK");
  assert.ok(smoke.includes(`name="${mark[1]}" content="placeholder"`),
    `build smoke looks for a marker worker.js does not stamp (worker.js says ${mark[1]})`);
});

test("the publish gap is watched WHILE the site republishes", () => {
  // The gap only exists during a publish, so a check that runs afterwards can
  // never see it. The invariant is race-free: index.html is written last, so at
  // every instant it names a bundle that exists.
  const i = smoke.indexOf("const gaps = []");
  assert.ok(i > 0, "the gap poll is gone");
  const block = smoke.slice(i, smoke.indexOf("polling = false", i));
  assert.match(block, /while \(polling\)/, "the poll must actually loop");
  assert.match(block, /index\.html named no bundle|gaps\.push/, "it must record what it saw");
  // The poll has to run ACROSS the revise, not before or after it.
  const revise = smoke.indexOf("react-build", i);
  const stop = smoke.indexOf("polling = false", i);
  assert.ok(i < revise && revise < stop, "the poll must be started before the revise and stopped after it");
  // ASSERTED ON THE `ok(` CALL, not on the expression anywhere in the file. A
  // mutant replacing the condition with `true` left `gaps.length === 0` in the
  // *message* argument and survived — the poll still ran, still recorded, and
  // reported a pass whatever it found.
  assert.match(smoke, /ok\("THE SITE WAS NEVER HALF-PUBLISHED[^]*?\n\s*gaps\.length === 0,/,
    "the gap result must be the CONDITION of the assertion, not merely mentioned near it");
});

test("the journey checks the two halves of a revise that were both wrong", () => {
  // The look must be KEPT (it used to re-roll from a few words) and the one
  // thing asked for must have CHANGED. Either alone passes on a broken build.
  assert.match(smoke, /fontsOf\(afterCss\) === beforeFonts/, "nothing checks the look was kept");
  assert.match(smoke, /--background:\\s\*\(#ffcc00\|#fc0\)/, "nothing checks the asked-for colour landed");
});

test("the journey proves RESTORE changed the live site, not just answered 200", () => {
  // The old button reported success and touched nothing published. A 200 is
  // exactly what it used to return.
  const i = smoke.indexOf("restoring an earlier build answers 200");
  assert.ok(i > 0, "the restore step is gone");
  // BOUNDED BY A LANDMARK, NOT BY BYTES. This read `slice(i, i + 1200)` and
  // went red the day a comment was added above `restoredCss` — a test about how
  // much prose sits in the window, failing a change that was correct. This
  // repo's most repeated own-goal, and the file's own neighbours already record
  // it. The restore section ends where the delete section begins.
  const end = smoke.indexOf("an unauthenticated delete is refused", i);
  assert.ok(end > i, "the restore section no longer ends at the delete checks — re-anchor this window");
  const after = smoke.slice(i, end);
  assert.match(after, /restoredCss/, "nothing re-reads the published stylesheet after restoring");
  assert.match(after, /!\/--background/, "the revised colour must be asserted GONE from the live site");
  // AND IT MUST NOT PASS WHEN IT CANNOT DISCRIMINATE. Measured live 2026-08-20:
  // the revise left the stylesheet byte-identical, so the restore's predicate
  // (`h === beforeCssHref`) was ALREADY satisfied, it settled in 572ms, and it
  // reported "THE LIVE SITE REALLY WENT BACK" about a site that had never left.
  // It read as the strongest evidence in the run that the colour had arrived
  // and was evidence of nothing.
  assert.match(after, /reviseMovedCss/,
    "the restore assertion is not gated on the revise having moved the stylesheet — it passes vacuously when the revise did nothing");
});

// ─────────────────────────────────────────── real addresses for published pages
//
// EVERY PAGE OF EVERY PUBLISHED SITE HAD THE SAME ADDRESS, and this 404 was why.
//
// `/s/<slug>/book` looked for `book.html`, which vite never emits, so it 404'd —
// which is why the template ran on `createHashHistory()` and every page lived at
// `#/book`. A fragment never reaches a server, so: search engines saw one page
// per site (a barber shop's Services and Booking pages could not be indexed at
// all), every shared link previewed the home page whatever you copied, and
// `logSiteHit` recorded every view in the site's life as "/".
//
// The fallback is what makes real paths possible. Its restriction to
// EXTENSIONLESS paths is the whole safety of it, and is asserted separately from
// the fallback itself — a fallback that also caught `.js` would answer a missing
// chunk with HTML, and the browser's error for that points nowhere near the
// deleted file.
test("an extensionless path falls back to the app shell, and an asset never does", () => {
  const w = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

  const at = w.indexOf('if (!obj && !ext && rest !== "") {');
  assert.ok(at > 0, "the SPA fallback is gone or reshaped — deep links 404 again");

  // It must sit between the first lookup and the 404, or it cannot fire.
  const get = w.indexOf('let obj = await env.SITES_BUCKET.get(key);');
  const miss = w.indexOf('if (!obj) return new Response("Not found", { status: 404 });', get);
  assert.ok(get > 0 && miss > at && at > get,
    "the fallback is not between the lookup and the 404 — it is unreachable either way round");

  const block = w.slice(at, miss);
  assert.match(block, /SITES_BUCKET\.get\("sites\/" \+ slug \+ "\/index\.html"\)/,
    "the fallback must serve the app shell");
  assert.match(block, /ctype = "text\/html; charset=utf-8"/,
    "the shell must be served AS html — `book` has no extension, so the content type " +
    "would otherwise still be whatever the missed lookup guessed");

  // BOTH GUARDS, asserted apart. `!ext` keeps assets 404ing; `rest !== ""` keeps
  // the root's own miss honest, since falling back to index.html when index.html
  // is what missed is a loop dressed as a feature.
  assert.match(block.slice(0, 60), /!ext/, "an asset would fall back too — a missing chunk would answer HTML");
  assert.match(block.slice(0, 60), /rest !== ""/, "the root's own miss falls back to itself");

  // And the traffic log gets the REAL path, which is the whole reason per-page
  // analytics were impossible rather than merely unbuilt. The window runs to a
  // LANDMARK (the response body assembly), not a byte count — the comment above
  // the log line grew once and a fixed 500 stopped covering the thing this
  // asserts (the repo's own recurring window bug).
  const servedAt = w.indexOf("let served = obj.body", miss);
  assert.ok(servedAt > miss, "the response assembly moved — the log window has no end");
  assert.match(w.slice(miss, servedAt), /logSiteHit\(env, ctx, slug, "\/" \+ rest, request\)/,
    "the hit log stopped recording the path it was served");
});

/* ── the script that serves a version ───────────────────────────────────── */

test("A VERSION KEEPS THE SCRIPT THAT SERVES IT", async () => {
  // MEASURED ON A REAL TANSTACK START BUILD, which is what makes this necessary
  // rather than tidy: `dist/client` contains no HTML at all, and the server
  // bundle bakes in that build's own content-hashed client asset names (one
  // occurrence each). So a document exists only because a script renders it, and
  // only THAT build's script can name THAT build's assets.
  const b = bucket(published());
  const id = versionId(1000, "aa");
  const r = await archiveVersion(b.deps, { slug: "cafe", id, label: "First", files: DIST, worker: "export default 1" });
  assert.equal(r.ok, true);
  assert.equal(r.worker, true, "the script was not archived");
  assert.equal(b.store.get("versions/cafe/" + id + "/_worker.js"), "export default 1");
  assert.equal(JSON.parse(b.store.get("versions/cafe/" + id + "/_manifest.json")).worker, true);
});

test("the archived script is NOT a published file", async () => {
  // It lives under `versions/`, which nothing serves — so it can never be
  // fetched. And it must stay out of `files`, or a rollback would copy a site's
  // own server code onto the PUBLIC prefix.
  const b = bucket(published());
  const id = versionId(1000, "aa");
  await archiveVersion(b.deps, { slug: "cafe", id, files: DIST, worker: "export default 1" });
  const m = JSON.parse(b.store.get("versions/cafe/" + id + "/_manifest.json"));
  assert.ok(!m.files.includes("_worker.js"), "the script is listed as a published file");
  const rb = await rollbackVersion(b.deps, { slug: "cafe", id });
  assert.equal(rb.ok, true);
  assert.equal(b.store.get("sites/cafe/_worker.js"), undefined, "the script was copied onto the served prefix");
});

test("A ROLLBACK HANDS THE SCRIPT BACK — it does not upload it", async () => {
  // This module's whole point is that it drives with a fake store and no
  // Cloudflare account; the caller owns the dispatch namespace.
  const b = bucket(published());
  const id = versionId(1000, "aa");
  await archiveVersion(b.deps, { slug: "cafe", id, files: DIST, worker: "export default 1" });
  const rb = await rollbackVersion(b.deps, { slug: "cafe", id });
  assert.equal(rb.worker, "export default 1");
});

test("A VERSION WITH NO SCRIPT ANSWERS null, and is still restorable", async () => {
  // Every version archived before this carries real prerendered documents, so
  // the static path is genuinely where it should go back to — and the caller
  // reads `null` as "take down whatever is standing". Refusing these would break
  // every rollback on the platform the day this shipped.
  const b = bucket(published());
  const id = versionId(1000, "aa");
  await archiveVersion(b.deps, { slug: "cafe", id, files: DIST });
  assert.equal(JSON.parse(b.store.get("versions/cafe/" + id + "/_manifest.json")).worker, undefined,
    "a manifest claims a script that was never written");
  const rb = await rollbackVersion(b.deps, { slug: "cafe", id });
  assert.equal(rb.ok, true);
  assert.equal(rb.worker, null);
});

test("A CLAIMED SCRIPT THAT IS MISSING REFUSES, BEFORE ANY FILE IS COPIED", async () => {
  // The half-restore is the dangerous outcome: the files back, the standing
  // script still naming the previous build's assets, and the customer told it
  // was restored. Refusing leaves them the site they had.
  const b = bucket(published());
  const id = versionId(1000, "aa");
  await archiveVersion(b.deps, { slug: "cafe", id, files: DIST, worker: "export default 1" });
  b.store.delete("versions/cafe/" + id + "/_worker.js");
  const before = new Map(b.store);
  const rb = await rollbackVersion(b.deps, { slug: "cafe", id });
  assert.equal(rb.ok, false);
  assert.equal(rb.status, 409);
  assert.match(rb.error, /script is missing/);
  assert.deepEqual([...b.store.keys()].sort(), [...before.keys()].sort(), "a refused rollback still wrote something");
});

/** An archive whose script put throws, which is the whole subject below. */
function scriptWriteFails(b) {
  const put = b.deps.put;
  b.deps.put = async (key, text, ct) => {
    if (key.endsWith("_worker.js")) throw new Error("r2 down");
    return put(key, text, ct);
  };
  return b;
}

test("A FAILED SCRIPT WRITE DOES NOT CLAIM ONE", async () => {
  // A flag set over a write that failed is a version reporting itself
  // restorable and restoring a site with no document — strictly worse than one
  // that honestly has no script, because that one still falls back.
  const b = scriptWriteFails(bucket(published()));
  const id = versionId(1000, "aa");
  const r = await archiveVersion(b.deps, { slug: "cafe", id, files: DIST, worker: "export default 1" });
  assert.equal(r.ok, true, "a failed script write must not fail the archive — the site is already live");
  assert.equal(r.worker, false);
  // AND IT SAYS SO RATHER THAN SAYING NOTHING. This asserted `worker` was
  // `undefined` on the manifest — i.e. it pinned the bug: absent is what a
  // PRE-START version says, and a rollback reads that as "drop whatever script
  // is standing". See the test below for what that cost.
  const m = JSON.parse(b.store.get("versions/cafe/" + id + "/_manifest.json"));
  assert.equal(m.worker, false, "a lost script must be recorded as lost, not as never-existed");
  assert.ok(m.workerError, "nothing records WHY the script was lost");
  assert.equal(r.workerLost, true, "the caller cannot tell a lost script from a build that had none");

  // AND THE REASON IS READABLE WHATEVER WAS THROWN. `String(undefined)` is the
  // literal "undefined", which reads like a bug in whoever wrote the field
  // rather than a store that would not say why. Asserted as a PROPERTY — the
  // recorded reason is never a stringified nothing — not on the fallback's
  // wording.
  const nul = bucket(published("bar"));
  nul.deps.put = async (k, v) => { if (k.endsWith("_worker.js")) throw null; nul.store.set(k, v); };
  const nid = versionId(2000, "bb");
  const nr = await archiveVersion(nul.deps, { slug: "bar", id: nid, files: DIST, worker: "export default 1" });
  const nm = JSON.parse(nul.store.get("versions/bar/" + nid + "/_manifest.json"));
  assert.equal(nm.worker, false);
  for (const [where, why] of [["manifest", nm.workerError], ["return", nr.workerError]]) {
    assert.ok(why && !/^(undefined|null)$/.test(why), where + " recorded a stringified nothing: " + JSON.stringify(why));
  }
});

test("a non-string script is ignored rather than stored", async () => {
  // `String({})` is "[object Object]" — a perfectly valid JavaScript-shaped
  // string that would upload and serve nothing, which is the coercion class
  // this repo has recorded four times.
  const b = bucket(published());
  for (const bad of [{}, ["export default 1"], 7, true, ""]) {
    const id = versionId(1000, "a" + String(bad).slice(0, 1));
    const r = await archiveVersion(b.deps, { slug: "cafe", id, files: DIST, worker: bad });
    assert.equal(r.worker, false, "a " + typeof bad + " was archived as a script");
  }
});

/* ── a lost script is not a pre-Start version ───────────────────────────────
 *
 * MEASURED AGAINST THE REAL MODULE 2026-08-21, before a line was changed. An
 * archive whose script put threw produced a manifest byte-identical to a
 * pre-Start one — `{"id","at","label","files"}`, no `worker` key — `listVersions`
 * offered it like any other, and `rollbackVersion` answered `worker: null`. The
 * restore route reads `rb.worker ? putSiteWorker : dropSiteWorker`, so that
 * `null` took the LIVE script down. Under Start there is nothing to fall back
 * onto (`dist/client` holds no HTML), so the site 404s at its own front door —
 * a transient R2 blip turned into an outage days later, at the moment somebody
 * was trying to fix their site.
 *
 * Every test here needs BOTH halves. "A lost script refuses" is satisfied by a
 * module that refuses everything, and that would break every pre-Start rollback
 * on the platform — so the counter-case is asserted beside it each time.
 */

test("A LOST SCRIPT REFUSES THE RESTORE, and a version that never had one still restores", async () => {
  const lost = scriptWriteFails(bucket(published()));
  const lostId = versionId(1000, "aa");
  await archiveVersion(lost.deps, { slug: "cafe", id: lostId, files: DIST, worker: "export default 1" });

  // NOTHING MAY BE WRITTEN BY THE REFUSAL. Restoring the files and then
  // discovering there is no script is the half-restore: the standing script
  // names the previous build's assets, which this would have just swept away.
  const before = new Map(lost.store);
  const rb = await rollbackVersion(lost.deps, { slug: "cafe", id: lostId });
  assert.equal(rb.ok, false, "a version whose script was lost restored as though it never had one");
  assert.equal(rb.status, 409);
  assert.notEqual(rb.worker, null,
    "`worker: null` is the caller's instruction to DROP the standing script — a lost script must never produce it");
  assert.deepEqual([...lost.store.keys()].sort(), [...before.keys()].sort(),
    "a refused rollback still wrote something");

  // THE COUNTER-CASE, in the same test so neither can be satisfied alone. A
  // version that genuinely never had a script is a pre-Start archive: it
  // carries real prerendered documents, the static path is where it belongs,
  // and refusing these would break every rollback on the platform.
  const pre = bucket(published());
  const preId = versionId(1000, "bb");
  await archiveVersion(pre.deps, { slug: "cafe", id: preId, files: DIST });
  const ok = await rollbackVersion(pre.deps, { slug: "cafe", id: preId });
  assert.equal(ok.ok, true, "a pre-Start version must still restore");
  assert.equal(ok.worker, null, "…and must still tell the caller to drop the standing script");
});

test("a manifest written before this shipped behaves exactly as it did", async () => {
  // THE DEPLOYMENT-SAFETY PROPERTY. Ten versions per site are already in R2 and
  // none of them carries a `worker` key, so the absence has to keep meaning what
  // it has always meant. Planted as literal old-format JSON rather than produced
  // by `archiveVersion`, because what is being asserted is a fact about the
  // BYTES already in the store, not about today's writer.
  const b = bucket(published());
  const id = versionId(2000, "aa");
  b.store.set("versions/cafe/" + id + "/_manifest.json",
    JSON.stringify({ id, at: 2000, label: "Old build", files: DIST }));
  for (const f of DIST) b.store.set("versions/cafe/" + id + "/" + f, "old:" + f);

  assert.deepEqual(await listVersions(b.deps, { slug: "cafe" }),
    [{ id, at: 2000, label: "Old build", files: DIST.length }],
    "an old manifest grew a field — the listing is not byte-identical to before");
  const rb = await rollbackVersion(b.deps, { slug: "cafe", id });
  assert.equal(rb.ok, true);
  assert.equal(rb.worker, null);
  assert.equal(b.store.get("sites/cafe/index.html"), "old:index.html", "the old build did not come back");
});

test("the list says which versions cannot be put back", async () => {
  // OFFERED AND FLAGGED, rather than dropped the way an unreadable manifest is.
  // Dropping it makes the loss silent — the owner sees yesterday's build simply
  // missing with nothing anywhere to explain it, which is the class of failure
  // the flag exists to end.
  const b = scriptWriteFails(bucket(published()));
  const bad = versionId(1000, "aa");
  await archiveVersion(b.deps, { slug: "cafe", id: bad, files: DIST, worker: "export default 1" });

  const list = await listVersions(b.deps, { slug: "cafe" });
  assert.equal(list.length, 1, "the version was hidden rather than flagged");
  assert.equal(list[0].restorable, false);

  // PRESENT ONLY WHEN FALSE, so a healthy list is byte-identical to before and
  // the field's PRESENCE is the alarm. Asserted with `in` rather than on the
  // value: `restorable: true` and no key at all both read as truthy.
  const good = bucket(published());
  await archiveVersion(good.deps, { slug: "cafe", id: versionId(2000, "bb"), files: DIST, worker: "export default 1" });
  await archiveVersion(good.deps, { slug: "cafe", id: versionId(3000, "cc"), files: DIST });
  for (const v of await listVersions(good.deps, { slug: "cafe" })) {
    assert.ok(!("restorable" in v), "a healthy version carries the flag: " + JSON.stringify(v));
  }
});

test("the two ways a script can be unrestorable are said APART", async () => {
  // Both are "no script to restore" and they have different causes — one never
  // stored the object, one lost it afterwards — and a single sentence for both
  // is a failure that cannot name itself. The owner's next move is the same
  // either way, so both are 409.
  const lostB = scriptWriteFails(bucket(published()));
  const lostId = versionId(1000, "aa");
  await archiveVersion(lostB.deps, { slug: "cafe", id: lostId, files: DIST, worker: "export default 1" });
  const lost = await rollbackVersion(lostB.deps, { slug: "cafe", id: lostId });

  const goneB = bucket(published());
  const goneId = versionId(1000, "bb");
  await archiveVersion(goneB.deps, { slug: "cafe", id: goneId, files: DIST, worker: "export default 1" });
  goneB.store.delete("versions/cafe/" + goneId + "/_worker.js");
  const gone = await rollbackVersion(goneB.deps, { slug: "cafe", id: goneId });

  assert.equal(lost.status, 409);
  assert.equal(gone.status, 409);
  assert.notEqual(lost.error, gone.error, "two different causes wear one sentence");
  // A SENTENCE, NOT A TOKEN. `public/chat.js` puts `d.error` straight into a
  // toast the owner reads, so `worker-lost` would be shown to a customer.
  // Asserted as a property rather than on the wording, which is this repo's
  // most repeated own-goal.
  for (const [what, e] of [["lost", lost.error], ["gone", gone.error]]) {
    assert.equal(typeof e, "string", what + " has no message");
    assert.ok(/\s/.test(e) && e.length > 20, what + " is a token, not something an owner can read: " + e);
  }
});

test("PRUNING TAKES THE SCRIPT WITH THE VERSION", async () => {
  // A leftover script under a pruned version is a megabyte-and-a-half of dead
  // weight per site with nothing that would ever find it again — the same class
  // as the orphaned Neon project and the leftover meta sidecar.
  const b = bucket(published());
  for (let i = 1; i <= MAX_VERSIONS + 1; i++) {
    await archiveVersion(b.deps, { slug: "cafe", id: versionId(1000 + i, "a" + i), files: DIST, worker: "v" + i });
  }
  const scripts = [...b.store.keys()].filter((k) => k.endsWith("/_worker.js"));
  assert.equal(scripts.length, MAX_VERSIONS, "a pruned version left its script behind: " + scripts.join(" "));
});
