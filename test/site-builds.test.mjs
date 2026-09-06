// IMMUTABLE PUBLISHING (stage 7, 2026-09-05, owner: "ok go").
//
// A publish used to write over the one live prefix and sweep what it did not
// write; the script named that prefix; a rollback copied an old dist back over
// the same keys. Now every build is staged under its own prefix, written once,
// and made live by moving one pointer — so a script can never point a live
// page at assets that are not there, and a rollback is the same activation
// with an older version. This file DRIVES the module against a fake R2 that
// keeps etags and honours `onlyIf`, then reads the Worker's wiring of it:
// both publish paths stage before the gate and activate after it, the script
// reads its own baked prefix, the platform's own readers resolve through the
// pointer, the delete path takes the builds, and the wall admits the prefix.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import {
  stageBuild, activateBuild, readPointer, listBuilds, readBuild, pruneBuilds, deleteAllBuilds,
  assetKeyFor, mergeVersions, stateConfigOf, mintVersion, buildPrefix, POINTER_KEY, P_BUILDS,
  STATE_CONFIG_FIELDS, isVersionId,
  HEAD_KEY, REPAIR_CONFIG_FIELDS, repairConfigOf, sameJson, readHead, writeHead, repairNeeded, repairEditable, STATE_DIR,
} from "../site-builds.mjs";
import { MAX_VERSIONS, versionId } from "../site-versions.mjs";
import { CONFIG_FIELDS } from "../site-config.mjs";
import { jobPrefixes, allowedJobKey } from "../builder/job-gateway.mjs";

const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const SERVER_TS = fs.readFileSync(new URL("../builder/lovable/template/src/server.ts", import.meta.url), "utf8");
const BRAND_TS = fs.readFileSync(new URL("../builder/lovable/template/src/site-brand.ts", import.meta.url), "utf8");
const BUILD_SERVER = fs.readFileSync(new URL("../builder/build-server.mjs", import.meta.url), "utf8");
const DOCKERFILE = fs.readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
const blank = (s) => s.replace(/^([ \t]*)\/\/.*$/gm, (m) => " ".repeat(m.length));

/** A fake R2 with the three semantics activation rests on: etags, a put whose
 *  `onlyIf` did not hold answering NULL the way R2's binding does, and
 *  `etagDoesNotMatch: "*"` as create-if-absent — which a first activation is
 *  conditional on since 2026-09-06. A fake that ignored that condition would
 *  be MORE permissive than R2, which is the recorded fixture trap: it would
 *  certify a first activation that R2 itself refuses. */
function fakeR2() {
  const store = new Map();
  const etagOf = (s) => createHash("md5").update(typeof s === "string" ? s : Buffer.from(s)).digest("hex");
  const objOf = (k) => {
    const e = store.get(k);
    if (!e) return null;
    return { key: k, etag: e.etag, httpMetadata: e.httpMetadata, async text() { return typeof e.body === "string" ? e.body : Buffer.from(e.body).toString("utf8"); } };
  };
  const puts = [];
  const deps = {
    store, puts,
    put: async (key, body, contentType, onlyIf) => {
      const cur = store.get(key);
      if (onlyIf && onlyIf.etagMatches != null && (!cur || cur.etag !== String(onlyIf.etagMatches))) return null;
      // `*` is R2's "any object at all", so the condition holds only when the
      // key is absent; a literal etag holds unless it is the one there.
      if (onlyIf && onlyIf.etagDoesNotMatch != null && cur && (String(onlyIf.etagDoesNotMatch) === "*" || cur.etag === String(onlyIf.etagDoesNotMatch))) return null;
      store.set(key, { body, etag: etagOf(body), httpMetadata: { contentType } });
      puts.push(key);
      return objOf(key);
    },
    get: async (key) => objOf(key),
    list: async (prefix) => [...store.keys()].filter((k) => k.startsWith(prefix)).sort().map((key) => ({ key })),
    remove: async (key) => { store.delete(key); },
    mime: (rel) => (/\.js$/.test(rel) ? "text/javascript" : /\.css$/.test(rel) ? "text/css" : "application/octet-stream"),
    log: () => {},
  };
  return deps;
}

const DIST = { "assets/index-abc.js": { t: "js" }, "assets/index-abc.css": { t: "css" }, "card.png": { b: Buffer.from("png").toString("base64") }, "sitemap.xml": { t: "<urlset/>" } };
const V1 = versionId(1_000, "aaaaaa");
const V2 = versionId(2_000, "bbbbbb");
const V3 = versionId(3_000, "cccccc");

async function staged(deps, version, extra = {}) {
  return stageBuild(deps, {
    slug: "cafe", version, files: DIST,
    worker: { code: "export default {} // " + version, build: "bld-" + version.slice(0, 5) },
    state: { pages: '[{"path":"index.tsx","source":"<p/>"}]', parts: "[]", config: '{"css":"x"}', sidecar: '{"origin":"https://cafe.gofarther.app/"}' },
    manifest: { parent: "", job: "job-1", label: "First build", langs: ["en"], routes: ["/"] },
    ...extra,
  });
}

/* ───────────────────────────── staging ───────────────────────────── */

test("a build is staged under its own prefix — dist, script, state, and the manifest LAST", async () => {
  const deps = fakeR2();
  const r = await staged(deps, V1);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.files, 4);
  assert.equal(r.worker, true);
  const p = buildPrefix("cafe", V1);
  for (const k of ["client/assets/index-abc.js", "client/assets/index-abc.css", "client/card.png", "client/sitemap.xml", "server.js", "state/pages.json", "state/parts.json", "state/config.json", "state/sidecar.json", "manifest.json"]) {
    assert.ok(deps.store.has(p + k), "not staged: " + k);
  }
  assert.equal(deps.puts[deps.puts.length - 1], p + "manifest.json", "the manifest is not the last write — a half-staged prefix would list as whole");
  const m = JSON.parse(await (await deps.get(p + "manifest.json")).text());
  assert.equal(m.version, V1);
  assert.equal(m.build, "bld-" + V1.slice(0, 5));
  assert.equal(m.worker, true);
  assert.deepEqual(m.files.sort(), Object.keys(DIST).sort());
  assert.deepEqual(m.routes, ["/"]);
  assert.equal(m.job, "job-1");
  // NOTHING LIVE IS TOUCHED: no pointer, no live marker, no sidecar, no `sites/`.
  assert.ok(![...deps.store.keys()].some((k) => k.startsWith("sites/") || k.startsWith("sitemeta/") || k.startsWith("current/")),
    "staging wrote outside the build's own prefix: " + [...deps.store.keys()].join(", "));
  // A binary entry rides as bytes, a text entry as text.
  assert.equal(deps.store.get(p + "client/card.png").httpMetadata.contentType, "application/octet-stream");
  assert.equal(deps.store.get(p + "client/assets/index-abc.js").httpMetadata.contentType, "text/javascript");
});

test("staging refuses an id it did not mint, an empty dist, and says when there is no script", async () => {
  const deps = fakeR2();
  assert.equal((await staged(deps, "../current")).ok, false);
  assert.equal((await staged(deps, "not-a-version")).ok, false);
  assert.equal(deps.store.size, 0, "a refused stage wrote something");
  const empty = await stageBuild(deps, { slug: "cafe", version: V1, files: {}, worker: null, state: {}, manifest: {} });
  assert.equal(empty.ok, false);
  assert.equal(empty.error, "nothing to stage");
  const noScript = await staged(deps, V1, { worker: null });
  assert.equal(noScript.ok, true);
  assert.equal(noScript.worker, false);
  const m = JSON.parse(await (await deps.get(buildPrefix("cafe", V1) + "manifest.json")).text());
  assert.equal(m.worker, false, "a build staged without a script claims one");
  assert.ok(!deps.store.has(buildPrefix("cafe", V1) + "server.js"));
});

/* ─────────────────────────── activation ─────────────────────────── */

test("activation: pointer, then sidecar, then the live marker, then the script, then the commit, then the state copy", async () => {
  const deps = fakeR2();
  await staged(deps, V1);
  const order = [];
  const realPut = deps.put;
  deps.put = async (k, ...rest) => { order.push("put " + k); return realPut(k, ...rest); };
  const r = await activateBuild(deps, {
    slug: "cafe", version: V1, build: "bld-1", parent: "", job: "job-1", expectEtag: null,
    sidecar: '{"origin":"x"}', sidecarKey: "sitemeta/cafe.json", liveKey: "sites/cafe/site.live",
    putWorker: async () => { order.push("script"); return { ok: true, uploaded: true }; },
    commit: async () => { order.push("commit"); },
    afterActivate: async () => { order.push("state"); },
    now: "2026-09-05T20:00:00.000Z",
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.uploaded, true);
  assert.deepEqual(order, ["put current/cafe.json", "put sitemeta/cafe.json", "put sites/cafe/site.live", "script", "commit", "state"]);
  const p = await readPointer(deps, "cafe");
  assert.equal(p.version, V1);
  assert.equal(p.build, "bld-1");
  assert.equal(p.job, "job-1");
  assert.equal(p.activatedAt, "2026-09-05T20:00:00.000Z");
  assert.ok(p.etag, "the pointer carries no etag — the next activation cannot be conditional");
  assert.equal(await (await deps.get("sitemeta/cafe.json")).text(), '{"origin":"x"}');
  assert.ok(deps.store.has("sites/cafe/site.live"), "the live marker is not where the scripts probe for it");
});

test("a stale holder cannot move the pointer: the conditional write answers superseded and touches nothing", async () => {
  const deps = fakeR2();
  await staged(deps, V1);
  await staged(deps, V2);
  const first = await activateBuild(deps, { slug: "cafe", version: V1, expectEtag: null, putWorker: async () => ({ ok: true }) });
  assert.equal(first.ok, true);
  const etagAfterFirst = (await readPointer(deps, "cafe")).etag;
  // Somebody else activates V2 in between (their read saw V1's etag).
  const other = await activateBuild(deps, { slug: "cafe", version: V2, expectEtag: etagAfterFirst, putWorker: async () => ({ ok: true }) });
  assert.equal(other.ok, true);
  // The stale holder still carries V1's etag.
  let scriptCalls = 0;
  const stale = await activateBuild(deps, {
    slug: "cafe", version: V1, expectEtag: etagAfterFirst, sidecar: "STALE", sidecarKey: "sitemeta/cafe.json", liveKey: "sites/cafe/site.live",
    putWorker: async () => { scriptCalls++; return { ok: true }; }, commit: async () => { throw new Error("must not commit"); },
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.error, "superseded");
  assert.equal((await readPointer(deps, "cafe")).version, V2, "the stale holder moved the pointer back");
  assert.equal(scriptCalls, 0, "the stale holder uploaded its script over the newer one");
  assert.ok(!deps.store.has("sitemeta/cafe.json") || (await (await deps.get("sitemeta/cafe.json")).text()) !== "STALE", "the stale sidecar was written");
});

// RE-ANCHORED 2026-09-06 (owner: "the failed-upload behavior is a blocking
// publishing defect"). This case pinned the OPPOSITE contract — a failed
// upload answering `ok: true` with the pointer left ahead and the state copy
// run anyway — and the property, not the spelling, is what the owner changed:
// advancing the editable state to a version no visitor is served is a
// divergence that heals only if another edit happens to arrive. The pointer
// now goes back and nothing downstream of it runs. `test/publish-integrity.
// test.mjs` drives the whole contract; this keeps the neighbouring case in
// this file honest about which activation is the authoritative one.
test("a failed script upload is a FAILED activation: the pointer goes back, nothing commits, nothing advances", async () => {
  const deps = fakeR2();
  await staged(deps, V1);
  await staged(deps, V2);
  // A site already serving V1, so the undo has somewhere to go back to.
  await activateBuild(deps, { slug: "cafe", version: V1, expectEtag: null, putWorker: async () => ({ ok: true }) });
  const before = await readPointer(deps, "cafe");
  let committed = false, copied = false;
  const r = await activateBuild(deps, {
    slug: "cafe", version: V2, expectEtag: before.etag, previous: before,
    putWorker: async () => ({ ok: false, status: 500, error: "upload refused" }),
    commit: async () => { committed = true; }, afterActivate: async () => { copied = true; },
  });
  assert.equal(r.ok, false, "a failed upload must not answer as a publish");
  assert.equal(r.error, "not-served");
  assert.equal(r.uploaded, false);
  assert.equal(r.reverted, true);
  assert.equal(committed, false, "a job was committed over a script that is not up");
  assert.equal(copied, false, "the editable state advanced to a version nothing serves");
  assert.equal((await readPointer(deps, "cafe")).version, V1, "the site is not still on the version its live script serves");
});

test("a state copy that throws never fails an activation that has already happened", async () => {
  const deps = fakeR2();
  await staged(deps, V1);
  const r = await activateBuild(deps, { slug: "cafe", version: V1, expectEtag: null, putWorker: async () => ({ ok: true }), afterActivate: async () => { throw new Error("R2 blip"); } });
  assert.equal(r.ok, true);
  assert.equal(r.uploaded, true);
});

test("a pointer that cannot be parsed throws rather than reading as 'no site'", async () => {
  const deps = fakeR2();
  await deps.put(POINTER_KEY("cafe"), "not json", "application/json");
  await assert.rejects(() => readPointer(deps, "cafe"));
  await deps.put(POINTER_KEY("cafe"), '{"version":"junk"}', "application/json");
  await assert.rejects(() => readPointer(deps, "cafe"), /unreadable/);
  assert.equal(await readPointer(deps, "other"), null, "a site with no pointer is null, not a throw");
});

/* ─────────────────────── the list, the read, the prune ─────────────────────── */

test("builds list newest first, only those with a whole manifest, and say which have no script", async () => {
  const deps = fakeR2();
  await staged(deps, V1);
  await staged(deps, V3, { worker: null });
  await staged(deps, V2);
  // A prefix that never finished staging: files and no manifest.
  await deps.put(buildPrefix("cafe", versionId(4_000, "dddddd")) + "client/a.js", "x", "text/javascript");
  // A manifest that names no files — a stage cut before its end could leave
  // one — is not a whole build either, to the list or to a restore.
  const cut = versionId(5_000, "eeeeee");
  await deps.put(buildPrefix("cafe", cut) + "client/a.js", "x", "text/javascript");
  await deps.put(buildPrefix("cafe", cut) + "manifest.json", JSON.stringify({ version: cut, files: [], worker: true }), "application/json");
  // A stray object under the prefix that is not a version.
  await deps.put(P_BUILDS("cafe") + "junk.txt", "x", "text/plain");
  const list = await listBuilds(deps, "cafe");
  assert.deepEqual(list.map((v) => v.id), [V3, V2, V1]);
  assert.equal(await readBuild(deps, "cafe", cut), null, "a manifest naming no files restores");
  assert.equal(list.every((v) => v.layout === "build"), true);
  assert.equal(list[0].restorable, false, "a build staged without a script is offered as restorable");
  assert.equal(list[1].restorable, undefined);
  assert.equal(list[1].files, 4);
  assert.equal(list[1].build, "bld-" + V2.slice(0, 5));
  assert.deepEqual(await listBuilds(deps, "other"), []);
});

test("readBuild hands a restore everything the prefix holds, and null for a build that is not there", async () => {
  const deps = fakeR2();
  await staged(deps, V1);
  const b = await readBuild(deps, "cafe", V1);
  assert.equal(b.manifest.version, V1);
  assert.match(b.worker, /export default/);
  assert.equal(b.pages, '[{"path":"index.tsx","source":"<p/>"}]');
  assert.equal(b.parts, "[]");
  assert.equal(b.config, '{"css":"x"}');
  assert.equal(b.sidecar, '{"origin":"https://cafe.gofarther.app/"}');
  assert.equal(await readBuild(deps, "cafe", V2), null);
  assert.equal(await readBuild(deps, "cafe", "../../current/cafe.json"), null);
  // A build whose manifest says it has a script and whose script is gone answers null for it.
  await deps.remove(buildPrefix("cafe", V1) + "server.js");
  assert.equal((await readBuild(deps, "cafe", V1)).worker, null);
});

test("pruning drops the oldest whole prefixes past the cap and never the pointer's version or its parent", async () => {
  const deps = fakeR2();
  const ids = [];
  for (let i = 1; i <= 5; i++) { const id = versionId(i * 1000, "v" + i); ids.push(id); await staged(deps, id); }
  // Keep the second-oldest (as if it were the pointer's parent) with cap 2.
  const n = await pruneBuilds(deps, { slug: "cafe", keep: [ids[4], ids[1]], cap: 2 });
  assert.equal(n, 2, "expected the two oldest unkept builds to go");
  const left = new Set((await listBuilds(deps, "cafe")).map((v) => v.id));
  assert.deepEqual([...left].sort(), [ids[1], ids[3], ids[4]].sort());
  assert.ok(![...deps.store.keys()].some((k) => k.includes(ids[0]) || k.includes(ids[2])), "a pruned prefix left objects behind");
  // A nonsense cap keeps everything the default would.
  assert.equal(await pruneBuilds(deps, { slug: "cafe", keep: [], cap: -1 }), 0);
  assert.equal(await pruneBuilds(deps, { slug: "cafe", keep: [], cap: "junk" }), 0);
  assert.equal(MAX_VERSIONS >= 2, true, "the cap must keep at least the pointer's version and its parent");
});

test("deleting a site takes every build and the pointer", async () => {
  const deps = fakeR2();
  await staged(deps, V1);
  await staged(deps, V2);
  // WITH A SCRIPT THAT LANDS: an activation whose upload does not land now
  // undoes its own pointer, and this case is about the DELETE taking a
  // pointer that is really there.
  await activateBuild(deps, { slug: "cafe", version: V2, expectEtag: null, putWorker: async () => ({ ok: true }) });
  assert.ok(await readPointer(deps, "cafe"), "the pointer under test was never written");
  await staged(fakeR2(), V1); // another store, untouched
  const n = await deleteAllBuilds(deps, "cafe");
  assert.ok(n >= 20, "expected every object of two builds gone, removed " + n);
  assert.equal(await readPointer(deps, "cafe"), null);
  assert.deepEqual(await listBuilds(deps, "cafe"), []);
});

/* ─────────────────────────── the pure helpers ─────────────────────────── */

test("assetKeyFor resolves through the pointer when there is one and the frozen prefix otherwise", () => {
  assert.equal(assetKeyFor(null, "cafe", "assets/a.js"), "sites/cafe/assets/a.js");
  assert.equal(assetKeyFor({ version: V1 }, "cafe", "/assets/a.js"), buildPrefix("cafe", V1) + "client/assets/a.js");
  assert.equal(assetKeyFor({ version: "junk" }, "cafe", "a.js"), "sites/cafe/a.js", "a pointer with a bad version is read as one");
});

test("mergeVersions is both layouts, newest first, without duplicates", () => {
  const m = mergeVersions([{ id: V1, label: "old" }, { id: "junk" }], [{ id: V3, layout: "build" }, { id: V2, layout: "build" }, { id: V1, layout: "build" }]);
  assert.deepEqual(m.map((v) => v.id), [V3, V2, V1]);
  assert.equal(m[2].label, "old", "the first-seen row is not the one kept");
});

test("a version's state keeps the config fields a build bakes and never the owner's settings", () => {
  const all = Object.fromEntries(CONFIG_FIELDS.map((f) => [f, f + "-value"]));
  const kept = stateConfigOf(all);
  assert.deepEqual(Object.keys(kept).sort(), [...STATE_CONFIG_FIELDS].sort());
  assert.equal(kept.verify, undefined, "a rollback would take the owner's Search Console tag back");
  assert.equal(kept.share, undefined, "a rollback would take the owner's chosen card back");
  // DERIVED from the config's own field list, so a field added to the config
  // has to be placed on one side or the other here.
  for (const f of CONFIG_FIELDS) assert.ok(STATE_CONFIG_FIELDS.includes(f) || ["verify", "share"].includes(f), "a config field neither baked nor a setting: " + f);
  assert.deepEqual(stateConfigOf(null), {});
});

test("a minted version is an id the store accepts and orders as a string", () => {
  const a = mintVersion(5_000, "zz"), b = mintVersion(6_000, "aa");
  assert.ok(isVersionId(a) && isVersionId(b));
  assert.ok(a < b);
});

/* ────────────────────────── the wiring, read ────────────────────────── */

test("the script reads ITS OWN prefix, falls back one hop, and answers x-site-version", () => {
  const s = blank(SERVER_TS);
  assert.match(s, /import \{ SITE_BUILD, SITE_SLUG, SITE_VERSION, SITE_PARENT \} from "\.\/site-brand";/);
  assert.match(s, /const OWN_ASSETS = SITE_VERSION \? "builds\/" \+ SITE_SLUG \+ "\/" \+ SITE_VERSION \+ "\/client" : "sites\/" \+ SITE_SLUG;/,
    "the script does not read its own build prefix");
  assert.match(s, /const PARENT_ASSETS = SITE_VERSION\s*\? \(SITE_PARENT \? "builds\/" \+ SITE_SLUG \+ "\/" \+ SITE_PARENT \+ "\/client" : "sites\/" \+ SITE_SLUG\)\s*: "";/,
    "the one fallback hop is not the parent's prefix (or the frozen legacy one)");
  assert.match(s, /env\.SITES\.get\(OWN_ASSETS \+ url\.pathname\)/, "the asset branch does not read the own prefix");
  assert.match(s, /if \(!obj && PARENT_ASSETS\) obj = env\.SITES && \(await env\.SITES\.get\(PARENT_ASSETS \+ url\.pathname\)\);/, "the fallback hop is gone");
  assert.match(s, /if \(SITE_VERSION\) h\.set\("x-site-version", SITE_VERSION\);/, "the version header is not stamped");
  // The live probe and the meta read are UNCHANGED: every script, old and new, probes the same keys.
  assert.match(s, /env\.SITES\.head\("sites\/" \+ SITE_SLUG \+ "\/" \+ LIVE_FILE\)/);
  assert.match(s, /env\.SITES\.get\("sitemeta\/" \+ SITE_SLUG \+ "\.json"\)/);
  // The template's placeholder declares both, empty.
  assert.match(BRAND_TS, /export const SITE_VERSION = "";/);
  assert.match(BRAND_TS, /export const SITE_PARENT = "";/);
});

test("the container bakes the version and its parent off the payload, held to the id shape, and stamps the script with it", () => {
  const b = blank(BUILD_SERVER);
  assert.match(b, /function writeSiteBrand\(\{[^}]*\bversion, parent \}\)/, "writeSiteBrand does not take the version");
  assert.match(b, /"export const SITE_VERSION = " \+ JSON\.stringify\(versionValue\(version\)\) \+ ";\\n" \+/);
  assert.match(b, /"export const SITE_PARENT = " \+ JSON\.stringify\(versionValue\(parent\)\) \+ ";\\n"/);
  assert.match(b, /const VERSION_RE = \/\^\[0-9\]\{14\}-\[a-z0-9\]\{1,6\}\$\/;/, "the id shape is not held — a payload could bake any key");
  assert.match(b, /const versionValue = \(v\) => \(typeof v === "string" && VERSION_RE\.test\(v\) \? v : ""\);/, "a malformed version is baked as a key the script would build an address from");
  assert.match(b, /version: payload\.version, parent: payload\.parent \}\);/, "the payload's version does not reach writeSiteBrand");
  assert.match(b, /if \(worker && worker\.ok && brandUsed\.version\) worker\.version = brandUsed\.version;/, "the script's answer does not say which version it serves");
  assert.match(b, /version: versionValue\(version\) \};/, "writeSiteBrand does not report the version it baked");
});

test("both publish paths mint the version before the compile, send it in the payload, stage before the gate and activate after it", () => {
  const w = blank(WORKER);
  // The spine.
  const spineAt = w.indexOf("async function recompileAndPublish(");
  const spineEnd = w.indexOf("\nasync function siteRedirectFor(", spineAt);
  assert.ok(spineAt > 0 && spineEnd > spineAt, "the spine moved — rescope this");
  const spine = w.slice(spineAt, spineEnd);
  const mint = spine.indexOf("const version = mintVersion();");
  const payload = spine.indexOf("const cPayload = JSON.stringify({");
  const parentRead = spine.indexOf("parentVersion = p ? p.version : \"\";");
  assert.ok(mint > 0 && parentRead > 0 && payload > mint && payload > parentRead, "the spine does not mint the version (and read the parent) before its payload");
  assert.match(spine, /version, parent: parentVersion \|\| undefined,/, "the spine's payload does not carry the version and its parent");
  const stage = spine.indexOf("await stageBuild(buildDeps(env), {");
  const gate = spine.indexOf('await editRpc(env, "edit_may_publish"');
  const activate = spine.indexOf("await activateBuild(buildDeps(env), {");
  assert.ok(stage > 0 && gate > stage && activate > gate, "the spine does not stage BEFORE the gate and activate AFTER it");
  assert.doesNotMatch(spine, /writeSiteDistToR2\(|archiveVersion\(|sweepAfterPublish\(/, "the spine still writes the live prefix, archives by copy, or sweeps it");
  assert.match(spine, /expectEtag: pointerBefore \? pointerBefore\.etag : null,/, "the spine's activation is not conditional on the pointer it read after the gate");
  assert.match(spine, /keep: \[version, parentVersion\]/, "pruning does not keep the pointer's version and its parent");
  // A STAGE OR AN ACTIVATION THAT FAILED IS A REFUSAL, named, ours — never a
  // publish reported over a prefix that is not there or a pointer that did
  // not move.
  // LANDMARK TO LANDMARK, not `{0,400}` characters: the byte window was outrun
  // by the comment stage 4a put between the condition and its return.
  const stageIf = spine.indexOf("if (!staged || staged.ok !== true) {");
  const stageRet = spine.indexOf('return { ok: false, error: "stage", ours: true,', stageIf);
  assert.ok(stageIf > 0 && stageRet > stageIf && !spine.slice(stageIf, stageRet).includes("\n  }\n"), "a failed stage does not refuse the publish");
  // RE-ANCHORED 2026-09-06: this named the ONE reason the spine passed through
  // (`superseded`) by its exact ternary; two more arrived (`not-served`,
  // `lease-lost`) and the spelling moved. The property is that a failed
  // activation refuses the publish and that a reason the customer's sentence
  // has words for reaches the reply instead of being collapsed into
  // `activate` — asserted per reason, so a fourth one added without a
  // sentence still shows here.
  const actIf = spine.indexOf("if (!act || act.ok !== true) {");
  const actRet = spine.indexOf('ours: true,', actIf);
  assert.ok(actIf > 0 && actRet > actIf && !spine.slice(actIf, actRet).includes("\n  }\n"), "a failed activation does not refuse the publish");
  const actLine = spine.slice(actIf, spine.indexOf("\n", actRet));
  assert.match(actLine, /error: act && \(/, "the activation's reason is not read off the answer");
  for (const why of ["superseded", "not-served", "lease-lost"]) {
    assert.ok(actLine.includes('act.error === "' + why + '"'), why + " is collapsed into `activate`, so its own sentence is unreachable");
  }
  assert.match(actLine, /: "activate"/, "an unknown activation failure has no fallback name");
  // The platform's own readers must not serve a stale pointer from this
  // isolate: the cache is cleared right after activation, on both paths —
  // INSIDE the spine, between the activation and the prune. A first draft
  // compared an absolute offset with a relative one and passed on the clear
  // inside `restoreVersion`, three thousand lines away; a mutation survived
  // on it.
  const clearAt = spine.indexOf("_pointerCache.delete(slug);", activate);
  const pruneAt = spine.indexOf('tm("prune", "start");', activate);
  assert.ok(clearAt > activate && pruneAt > clearAt, "the spine does not clear the pointer cache right after activating");
  // The commit rides INSIDE the activation, after the script.
  const commitAt = spine.indexOf('await editRpc(env, "edit_committed"');
  assert.ok(commitAt > activate, "the commit is not inside the activation");
  // The build path.
  const buildAt = w.indexOf("async function buildAndPublishPages(");
  const buildEnd = w.indexOf("\nasync function deleteSiteFor(", buildAt);
  assert.ok(buildAt > 0 && buildEnd > buildAt, "the build path moved — rescope this");
  const build = w.slice(buildAt, buildEnd);
  const bMint = build.indexOf("const bVersion = mintVersion();");
  const bPayload = build.indexOf("const bPayload = JSON.stringify({");
  assert.ok(bMint > 0 && bPayload > bMint, "the build path does not mint the version before its payload");
  assert.match(build, /version: bVersion, parent: bParent \|\| undefined,/, "the build path's payload does not carry the version");
  const bStage = build.indexOf("await stageBuild(buildDeps(env), {");
  const bActivate = build.indexOf("await activateBuild(buildDeps(env), {");
  assert.ok(bStage > 0 && bActivate > bStage, "the build path does not stage then activate");
  assert.doesNotMatch(build, /writeSiteDistToR2\(|archiveVersion\(/, "the build path still writes the live prefix or archives by copy");
  assert.match(build, /keep: \[bVersion, bParent\]/);
  // On the build path a failed stage or activation THROWS out of the publish
  // dep: `publishPages` reads that as our failure, structurally uncharged.
  assert.match(build, /if \(!staged \|\| staged\.ok !== true\) throw new Error\("the build could not be staged: "/, "a failed stage does not fail the build");
  assert.match(build, /if \(!act \|\| act\.ok !== true\) throw new Error\("the build could not be activated: "/, "a failed activation does not fail the build");
  const bActivateIdx = build.indexOf("await activateBuild(buildDeps(env), {");
  assert.ok(build.indexOf("_pointerCache.delete(slug);", bActivateIdx) > bActivateIdx, "the build path does not clear the pointer cache after activating");
  // No writer of the live prefix is left anywhere in the publish code.
  assert.doesNotMatch(w, /async function writeSiteDistToR2\(/, "the legacy writer of the live prefix still exists");
});

test("the platform's own readers resolve through the pointer; the delete path takes the builds; the restore route activates", () => {
  const w = blank(WORKER);
  assert.match(w, /key = assetKeyFor\(await sitePointer\(env, slug\), slug, rest\.replace\(\/\[\^a-z0-9\/\._-\]\/gi, "-"\)\);/, "the fallback serve path does not resolve a file through the pointer");
  assert.match(w, /env\.SITES_BUCKET\.head\(assetKeyFor\(await sitePointer\(env, slug\), slug, "card\.png"\)\)/, "the card lookup does not resolve through the pointer");
  assert.match(w, /versionsRemoved \+= await deleteAllBuilds\(buildDeps\(env\), dslug\);/, "deleting a site leaves its builds and pointer behind");
  assert.match(w, /mergeVersions\(await listVersions\(versionDeps\(env\), \{ slug: ownerSlug \}\), await listBuilds\(buildDeps\(env\), ownerSlug\)\)/, "the versions list does not show both layouts");
  assert.match(w, /const rb = await restoreVersion\(env, ownerSlug, vb && vb\.id\);/, "the restore route does not go through the one restore function");
  assert.match(w, /rollback: \(\{ slug, id \}\) => restoreVersion\(env, slug, id\),/, "putting a site back online does not restore through the one restore function");
  // The one restore function: a build-layout version is an activation (its own
  // script, its own sidecar, its state restored); a legacy one is the copy path
  // with the pointer dropped, because the site is back on the legacy layout.
  const at = w.indexOf("async function restoreVersion(");
  const end = w.indexOf("\n}\n", at);
  assert.ok(at > 0 && end > at, "restoreVersion is gone");
  const r = w.slice(at, end);
  assert.match(r, /await readBuild\(deps, slug, id\)/);
  assert.match(r, /await activateBuild\(deps, \{/);
  assert.match(r, /await rollbackVersion\(versionDepsWithSweep\(env\), \{ slug, id \}\)/);
  assert.match(r, /env\.SITES_BUCKET\.delete\(POINTER_KEY\(slug\)\)/, "a legacy restore leaves a pointer standing over a legacy layout");
  assert.match(r, /activated: true/);
  assert.match(r, /withConfig\(/, "a restore does not put the version's baked config back");
});

test("the wall admits the build prefix and the pointer, and the image carries the module", () => {
  assert.ok(jobPrefixes("cafe").includes("builds/cafe/"));
  assert.equal(allowedJobKey("cafe", "0123456789abcdef0123456789abcdef", "current/cafe.json"), true);
  assert.equal(allowedJobKey("cafe", "0123456789abcdef0123456789abcdef", "current/other.json"), false);
  assert.equal(allowedJobKey("cafe", "0123456789abcdef0123456789abcdef", "builds/other/x/manifest.json"), false);
  assert.match(DOCKERFILE, /\bsite-builds\.mjs\b/, "the image does not carry site-builds.mjs — the job runtime would die at import");
});

// ── THE EDITABLE COPY KNOWS WHICH BUILD IT CAME FROM (stage 6, 2026-09-05) ──
//
// Activation copies a version's state into the editable locations last and
// best-effort, so a job that dies between the pointer write and the copy
// leaves the live site a version ahead of what the next edit reads. The copy
// ends with a marker naming its version; a job about to read asks whether the
// marker names the pointer's version and repairs the copy from that version's
// state when it does not. DRIVEN against the fake R2 above.

const H1 = versionId(new Date("2026-09-05T10:00:00Z"), "aaaa");
const H2 = versionId(new Date("2026-09-05T11:00:00Z"), "bbbb");

test("the marker round-trips, refuses a bad version, and reads junk as no marker", async () => {
  const r2 = fakeR2();
  assert.equal(await readHead(r2, "fold-lane"), null);
  const w = await writeHead(r2, "fold-lane", H1, "2026-09-05T10:00:01.000Z");
  assert.deepEqual(w, { version: H1, at: "2026-09-05T10:00:01.000Z" });
  assert.deepEqual(await readHead(r2, "fold-lane"), { version: H1, at: "2026-09-05T10:00:01.000Z" });
  assert.equal(HEAD_KEY("Fold-Lane"), "source/fold-lane/head.json", "the marker is not beside the source it marks");
  await assert.rejects(() => writeHead(r2, "fold-lane", "not-a-version"), /bad version id/);
  r2.store.set(HEAD_KEY("x"), { body: "not json", etag: "e" });
  assert.equal(await readHead(r2, "x"), null);
  r2.store.set(HEAD_KEY("y"), { body: JSON.stringify({ version: "junk" }), etag: "e" });
  assert.equal(await readHead(r2, "y"), null);
});

test("repairNeeded: no pointer never repairs; a pointer with no marker, or a marker naming another version, does; the same version does not", () => {
  assert.deepEqual(repairNeeded({ pointer: null, head: null }), { repair: false, why: "no-pointer" });
  assert.deepEqual(repairNeeded({ pointer: { version: "bad" }, head: null }), { repair: false, why: "no-pointer" });
  assert.deepEqual(repairNeeded({ pointer: { version: H2 }, head: null }), { repair: true, why: "no-head" });
  assert.deepEqual(repairNeeded({ pointer: { version: H2 }, head: { version: H1 } }), { repair: true, why: "behind" });
  // A MARKER AHEAD OF THE POINTER IS A DISAGREEMENT TOO: a restore that moved
  // the pointer back and died before its copy leaves the newer copy in place.
  assert.deepEqual(repairNeeded({ pointer: { version: H1 }, head: { version: H2 } }), { repair: true, why: "behind" });
  assert.deepEqual(repairNeeded({ pointer: { version: H2 }, head: { version: H2 } }), { repair: false, why: "same" });
  assert.deepEqual(repairNeeded(), { repair: false, why: "no-pointer" });
});

test("the repair copies the version's pages and parts, merges the config through the caller, marks LAST, and never touches the sidecar", async () => {
  const r2 = fakeR2();
  const dest = buildPrefix("fold-lane", H2) + STATE_DIR;
  await r2.put(dest + "pages.json", JSON.stringify([{ path: "index.tsx", source: "v2" }]), "application/json");
  await r2.put(dest + "parts.json", JSON.stringify([{ name: "Chord", source: "p2" }]), "application/json");
  await r2.put(dest + "config.json", JSON.stringify({ look: { theme: "ink" }, css: "b{}", logo: "", icon: "", langStrings: { es: { Hi: "Hola" } } }), "application/json");
  await r2.put(dest + "sidecar.json", JSON.stringify({ origin: "https://fold-lane.gofarther.app/" }), "application/json");
  await r2.put("source/fold-lane/pages.json", JSON.stringify([{ path: "index.tsx", source: "v1" }]), "application/json");
  await r2.put("sitemeta/fold-lane.json", JSON.stringify({ origin: "https://crookes-guitar.gofarther.app/" }), "application/json");
  r2.puts.length = 0;
  const merged = [];
  const r = await repairEditable(r2, {
    slug: "fold-lane", version: H2, keys: { source: "source/fold-lane/pages.json", parts: "source/fold-lane/parts.json" },
    mergeConfig: async (text) => { merged.push(JSON.parse(text)); return true; }, now: "2026-09-05T12:00:00.000Z",
  });
  assert.deepEqual(r, { ok: true, why: "repaired", wrote: ["source", "parts", "config"], version: H2 });
  assert.equal(await r2.get("source/fold-lane/pages.json").then((o) => o.text()), JSON.stringify([{ path: "index.tsx", source: "v2" }]));
  assert.equal(await r2.get("source/fold-lane/parts.json").then((o) => o.text()), JSON.stringify([{ name: "Chord", source: "p2" }]));
  assert.equal(merged.length, 1);
  assert.equal(merged[0].look.theme, "ink");
  // THE MARKER IS THE LAST WRITE: a copy that dies before it leaves the old
  // marker, which is exactly the disagreement the next repair reads.
  assert.deepEqual(r2.puts, ["source/fold-lane/pages.json", "source/fold-lane/parts.json", HEAD_KEY("fold-lane")]);
  assert.deepEqual(await readHead(r2, "fold-lane"), { version: H2, at: "2026-09-05T12:00:00.000Z" });
  // NEVER THE SIDECAR: the rename lane patches the live one without a publish.
  assert.equal(await r2.get("sitemeta/fold-lane.json").then((o) => o.text()), JSON.stringify({ origin: "https://crookes-guitar.gofarther.app/" }));
  // A MERGE THAT WROTE NOTHING IS NOT COUNTED, and the marker still lands.
  r2.puts.length = 0;
  const r2b = await repairEditable(r2, { slug: "fold-lane", version: H2, keys: { source: "source/fold-lane/pages.json", parts: "source/fold-lane/parts.json" }, mergeConfig: async () => false });
  assert.deepEqual(r2b.wrote, ["source", "parts"]);
  assert.ok(r2.puts.includes(HEAD_KEY("fold-lane")));
  // A VERSION WITH NO STATE COPIES NOTHING AND MARKS NOTHING.
  r2.puts.length = 0;
  const none = await repairEditable(r2, { slug: "fold-lane", version: H1, keys: { source: "source/fold-lane/pages.json" }, mergeConfig: async () => true });
  assert.deepEqual(none, { ok: false, why: "no-state", wrote: [] });
  assert.deepEqual(r2.puts, [], "a build with no state wrote something");
  assert.deepEqual(await repairEditable(r2, { slug: "fold-lane", version: "junk", keys: { source: "x" } }), { ok: false, why: "bad-version", wrote: [] });
});

test("the config a repair restores is the baked look and never the translation cache; drift is judged without regard to key order", () => {
  assert.deepEqual(REPAIR_CONFIG_FIELDS, STATE_CONFIG_FIELDS.filter((f) => f !== "langStrings"));
  assert.ok(!REPAIR_CONFIG_FIELDS.includes("langStrings") && STATE_CONFIG_FIELDS.includes("langStrings"), "the cache is not a state field, or is a repair field");
  assert.deepEqual(repairConfigOf({ look: { a: 1 }, css: "x", logo: "l", icon: "i", langStrings: { es: {} }, verify: { g: 1 }, share: "s" }), { look: { a: 1 }, css: "x", logo: "l", icon: "i" });
  assert.deepEqual(repairConfigOf(null), {});
  assert.deepEqual(repairConfigOf(["look"]), {});
  assert.equal(sameJson({ look: { theme: "ink", kind: "tool" }, css: "" }, { css: "", look: { kind: "tool", theme: "ink" } }), true);
  assert.equal(sameJson({ look: { theme: "ink" } }, { look: { theme: "paper" } }), false);
  assert.equal(sameJson({ a: [1, 2] }, { a: [2, 1] }), false, "array order is meaning");
  assert.equal(sameJson({ a: undefined }, {}), true, "an absent field and an undefined one are one thing");
  assert.equal(sameJson(null, {}), false);
  assert.equal(sameJson("x", "x"), true);
});
