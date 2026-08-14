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
  const i = worker.indexOf("rollbackVersion(versionDeps(env)");
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
  const i = worker.indexOf("rollbackVersion(versionDeps(env)");
  const route = worker.slice(Math.max(0, i - 1200), i);
  assert.ok(!/if \(!isVersionId\(/.test(route),
    "a second copy of the check drifts from the first — the module is the one place");
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
  assert.match(smoke, /fetch\(`\$\{BASE\}\/api\/site\/react-build`[\s\S]{0,300}JSON\.stringify\(reviseBody\)/,
    "…and nothing sends it to the build route");
  assert.match(smoke, /SMOKE_SKIP_JOURNEY/, "the journey must be turn-off-able — it spends a second real build");
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
  const after = smoke.slice(i, i + 1200);
  assert.match(after, /restoredCss/, "nothing re-reads the published stylesheet after restoring");
  assert.match(after, /!\/--background/, "the revised colour must be asserted GONE from the live site");
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
