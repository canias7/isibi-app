// PUBLICATION INTEGRITY (2026-09-06, owner: "the failed-upload behavior is a
// blocking publishing defect: afterActivate advances editable state even when
// the new script is not serving. A later edit carrying that state forward is
// not a successful recovery guarantee").
//
// ── WHICH VERSION IS AUTHORITATIVE, STATED ONCE ────────────────────────────
//
// A site has exactly one authoritative version and it is `current/<slug>.json`
// — the pointer. Everything else is derived from it:
//
//   VISITORS      the live script serves `builds/<slug>/<SITE_VERSION>/client`,
//                 where SITE_VERSION is baked into the script the pointer's
//                 activation uploaded. So the pointer is authoritative only
//                 while the script that names it is the one being served,
//                 which is why an activation whose upload does not land is
//                 now a FAILED activation that puts the pointer back.
//   NEXT EDITS    `loadSiteSourceForEdit` reads the editable copy under
//                 `source/<slug>/`, and stage 6's repair reconciles that copy
//                 with the POINTER on every claim. So the pointer decides what
//                 the next edit starts from, one hop removed.
//   RECONCILE     3b compares the pointer, the live script's own stamps and
//                 the job's staged version. `lost-upload` — pointer ours, live
//                 older — is the ONE state where the pointer names a version
//                 nothing serves, and the reconcile's answer is to upload the
//                 script again rather than to move the pointer.
//
// The defect was that the third of those was the ORDINARY outcome of a failed
// upload rather than a narrow residue: the pointer moved, the state copy ran,
// and the editable source advanced to a version no visitor had ever been
// served. The repair then saw head and pointer agree and found nothing to fix.
//
// This file drives the corrected contract against a fake R2 with R2's own
// conditional-write semantics, drives the collector's lease enforcement, and
// drives the runtime diagnostic through the real router.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import {
  stageBuild, activateBuild, readPointer, POINTER_KEY,
  HEAD_KEY, readHead, writeHead, repairNeeded, buildPrefix,
} from "../site-builds.mjs";
import { versionId } from "../site-versions.mjs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";

const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

/** Length-preserving, string-aware comment blanking. A scan that FORBIDS a
 *  spelling reads the blanked text; a scan that REQUIRES a landmark finds it
 *  on the raw text first — the recorded pair of traps. */
function blankComments(src) {
  let out = ""; let i = 0; let inBlock = false; let quote = "";
  while (i < src.length) {
    const c = src[i]; const nx = src[i + 1];
    if (inBlock) { if (c === "*" && nx === "/") { out += "  "; i += 2; inBlock = false; continue; } out += c === "\n" ? "\n" : " "; i++; continue; }
    if (quote) { out += c; if (c === "\\") { out += nx === undefined ? "" : nx; i += 2; continue; } if (c === quote) quote = ""; i++; continue; }
    if (c === '"' || c === "'" || c === "`") { quote = c; out += c; i++; continue; }
    if (c === "/" && nx === "*") { out += "  "; i += 2; inBlock = true; continue; }
    if (c === "/" && nx === "/") { while (i < src.length && src[i] !== "\n") { out += " "; i++; } continue; }
    out += c; i++;
  }
  return out;
}
const W = blankComments(WORKER);
const at = (src, needle, what) => { const i = src.indexOf(needle); assert.ok(i >= 0, `${what}: landmark "${needle}" is gone`); return i; };

/**
 * A fake R2 with the THREE semantics activation rests on:
 *   • etags on every object;
 *   • a put whose `onlyIf` did not hold answering NULL, as the binding does;
 *   • `etagDoesNotMatch: "*"` as create-if-absent.
 *
 * The third is the one a first draft leaves out, and leaving it out makes the
 * fake MORE permissive than R2 — the recorded fixture trap: it would certify a
 * first activation R2 itself refuses.
 */
function fakeR2() {
  const store = new Map();
  const etagOf = (s) => createHash("md5").update(typeof s === "string" ? s : Buffer.from(s)).digest("hex");
  const objOf = (k) => {
    const e = store.get(k);
    if (!e) return null;
    return { key: k, etag: e.etag, httpMetadata: e.httpMetadata, async text() { return typeof e.body === "string" ? e.body : Buffer.from(e.body).toString("utf8"); } };
  };
  const puts = []; const removes = []; const logs = [];
  return {
    store, puts, removes, logs,
    put: async (key, body, contentType, onlyIf) => {
      const cur = store.get(key);
      if (onlyIf && onlyIf.etagMatches != null && (!cur || cur.etag !== String(onlyIf.etagMatches))) return null;
      if (onlyIf && onlyIf.etagDoesNotMatch != null && cur && (String(onlyIf.etagDoesNotMatch) === "*" || cur.etag === String(onlyIf.etagDoesNotMatch))) return null;
      store.set(key, { body, etag: etagOf(body), httpMetadata: { contentType } });
      puts.push(key);
      return objOf(key);
    },
    get: async (key) => objOf(key),
    list: async (prefix) => [...store.keys()].filter((k) => k.startsWith(prefix)).sort().map((key) => ({ key })),
    remove: async (key) => { removes.push(key); store.delete(key); },
    mime: () => "application/octet-stream",
    log: (...a) => { logs.push(a.join(" ")); },
  };
}

const DIST = { "assets/app.js": { t: "js" }, "sitemap.xml": { t: "<urlset/>" } };
const V1 = versionId(1_000, "aaaaaa");
const V2 = versionId(2_000, "bbbbbb");
const V3 = versionId(3_000, "cccccc");
const SLUG = "cafe";

async function stage(deps, version, pagesText = '[{"path":"index.tsx","source":"<p>' + version + '</p>"}]') {
  return stageBuild(deps, {
    slug: SLUG, version, files: DIST,
    worker: { code: "export default {} // " + version, build: "bld-" + version.slice(0, 5) },
    state: { pages: pagesText, parts: "[]", config: '{"css":"x"}', sidecar: '{"origin":"https://cafe.gofarther.app/"}' },
    manifest: { parent: "", job: "job-" + version.slice(0, 5), langs: ["en"], routes: ["/"] },
  });
}

/** A site already live on V1, with its editable copy and head marker in step —
 *  the state every one of these cases starts from. */
async function liveOnV1() {
  const deps = fakeR2();
  await stage(deps, V1);
  const a = await activateBuild(deps, {
    slug: SLUG, version: V1, build: "bld-1", job: "job-1", expectEtag: null,
    putWorker: async () => ({ ok: true }),
    afterActivate: async () => {
      await deps.put("source/" + SLUG + "/pages.json", '[{"path":"index.tsx","source":"<p>' + V1 + '</p>"}]', "application/json");
      await writeHead(deps, SLUG, V1);
    },
  });
  assert.equal(a.ok, true, "the fixture's own first activation failed: " + JSON.stringify(a));
  return deps;
}

/* ══════════════════ 1. A FAILED OR AMBIGUOUS UPLOAD ══════════════════ */

// EVERY answer but an explicit success. `putSiteWorker` answers `null` when
// there is no script to send OR no credentials to send it with, and the old
// reading (`!(worker && worker.ok === false)`) counted both as uploaded — so a
// Worker deployed without dispatch credentials moved every pointer it touched
// and advanced every site's editable state with no script uploaded at all.
for (const [name, answer] of [
  ["an explicit refusal", { ok: false, status: 500, error: "upload refused" }],
  ["null — no script, or no credentials to send it with", null],
  ["undefined — a hook that fell off the end", undefined],
  ["an answer with no verdict at all", {}],
  ["a truthy answer that is not a success", { uploaded: true }],
]) {
  test("a script upload that answers " + name + " is not a publish: the pointer goes back and nothing downstream runs", async () => {
    const deps = await liveOnV1();
    await stage(deps, V2);
    const before = await readPointer(deps, SLUG);
    let committed = false, copied = false;
    const r = await activateBuild(deps, {
      slug: SLUG, version: V2, build: "bld-2", job: "job-2", expectEtag: before.etag, previous: before,
      sidecar: '{"origin":"NEW"}', sidecarKey: "sitemeta/" + SLUG + ".json",
      putWorker: async () => answer,
      commit: async () => { committed = true; },
      afterActivate: async () => { copied = true; },
    });
    assert.equal(r.ok, false, "answered as a publish: " + JSON.stringify(r));
    assert.equal(r.error, "not-served");
    assert.equal(r.uploaded, false);
    assert.equal(r.reverted, true, "the pointer was left ahead of the live script");
    assert.equal(committed, false, "a job was committed over a script that is not up");
    assert.equal(copied, false, "the editable state advanced to a version nothing serves");
    // THE AUTHORITATIVE VERSION IS UNMOVED, and so is everything derived
    // from it: the visitor's pointer, the editable copy and the head marker.
    const p = await readPointer(deps, SLUG);
    assert.equal(p.version, V1, "the pointer names a version no visitor is served");
    assert.equal((await readHead(deps, SLUG)).version, V1, "the head marker moved");
    assert.match(await (await deps.get("source/" + SLUG + "/pages.json")).text(), new RegExp(V1), "the editable copy advanced");
    // And with pointer and marker agreeing at V1, the next claim's repair
    // correctly finds nothing to do — which is exactly what made the old
    // behaviour invisible when they agreed at V2 instead.
    assert.deepEqual(repairNeeded({ pointer: p, head: { version: V1 } }), { repair: false, why: "same" });
  });
}

test("the undo is conditional on our own write: a newer publish that landed while the upload was failing is never clobbered", async () => {
  const deps = await liveOnV1();
  await stage(deps, V2);
  await stage(deps, V3);
  const before = await readPointer(deps, SLUG);
  // Our activation moves the pointer to V2, and while OUR upload is in flight
  // somebody else publishes V3 — the same window the forward write is
  // conditional for, inverted.
  const r = await activateBuild(deps, {
    slug: SLUG, version: V2, expectEtag: before.etag, previous: before,
    putWorker: async () => {
      const mid = await readPointer(deps, SLUG);
      const other = await activateBuild(deps, { slug: SLUG, version: V3, expectEtag: mid.etag, previous: mid, putWorker: async () => ({ ok: true }) });
      assert.equal(other.ok, true, "the interloper could not publish: " + JSON.stringify(other));
      return { ok: false, status: 500 };
    },
  });
  assert.equal(r.ok, false);
  assert.equal(r.error, "not-served");
  assert.equal(r.reverted, false, "the undo overwrote a newer publication");
  assert.equal((await readPointer(deps, SLUG)).version, V3, "the newer publish was rolled back by an older job's undo");
  assert.ok(deps.logs.some((l) => l.includes("pointer left ahead")), "an undo that could not run said nothing, so 3b's reconcile has no trail");
});

test("with no previous pointer the undo is a delete, and it removes only what is still byte-for-byte ours", async () => {
  // R2 HAS NO CONDITIONAL DELETE, so this leg is a read-then-delete and the
  // race is named rather than papered over. Both halves are driven.
  const deps = fakeR2();
  await stage(deps, V1);
  const r = await activateBuild(deps, { slug: SLUG, version: V1, expectEtag: null, putWorker: async () => null });
  assert.equal(r.ok, false);
  assert.equal(r.error, "not-served");
  assert.equal(r.reverted, true);
  assert.equal(await readPointer(deps, SLUG), null, "a first activation that never served left a pointer behind");
  assert.ok(deps.removes.includes(POINTER_KEY(SLUG)));

  // And the other half: somebody else's pointer is left exactly where it is.
  const d2 = fakeR2();
  await stage(d2, V1);
  await stage(d2, V2);
  const r2 = await activateBuild(d2, {
    slug: SLUG, version: V1, expectEtag: null,
    putWorker: async () => {
      const mid = await readPointer(d2, SLUG);
      await activateBuild(d2, { slug: SLUG, version: V2, expectEtag: mid.etag, previous: mid, putWorker: async () => ({ ok: true }) });
      return null;
    },
  });
  assert.equal(r2.error, "not-served");
  assert.equal(r2.reverted, false);
  assert.equal((await readPointer(d2, SLUG)).version, V2, "the read-then-delete took somebody else's pointer");
  assert.ok(!d2.removes.includes(POINTER_KEY(SLUG)), "a pointer that was not ours was deleted");
});

test("the undo puts the sidecar and the live marker back too — a failed publish must not leave the old page wearing the new head", async () => {
  // THE SIDECAR IS WHAT A VISITOR READS: the site's own script fetches it per
  // request for its title, description, canonical, og tags and redirect map.
  // Written before the script by stage 7's ordering argument, so the undo has
  // to reach it or a failed publish leaves the OLD page with the NEW head —
  // the same half-applied publish, one key over. Found by the end-to-end case
  // below and driven here, branch by branch.
  const KEY = "sitemeta/" + SLUG + ".json";
  const LIVE = "sites/" + SLUG + "/site.live";

  // (a) A sidecar that was there goes back byte for byte.
  const deps = await liveOnV1();
  await deps.put(KEY, '{"origin":"https://cafe.gofarther.app/","title":"OLD"}', "application/json");
  await stage(deps, V2);
  const before = await readPointer(deps, SLUG);
  const r = await activateBuild(deps, {
    slug: SLUG, version: V2, expectEtag: before.etag, previous: before,
    sidecar: '{"origin":"https://cafe.gofarther.app/","title":"NEW"}', sidecarKey: KEY, liveKey: LIVE,
    putWorker: async () => ({ ok: false, status: 500 }),
  });
  assert.equal(r.error, "not-served");
  assert.equal(await (await deps.get(KEY)).text(), '{"origin":"https://cafe.gofarther.app/","title":"OLD"}', "the head advanced to a version nothing serves");

  // (b) A sidecar that was NOT there is removed, and so is a live marker this
  // activation invented — a first publish that never served must not leave a
  // site claiming to be live.
  const fresh = fakeR2();
  await stage(fresh, V1);
  const f = await activateBuild(fresh, {
    slug: SLUG, version: V1, expectEtag: null,
    sidecar: '{"origin":"x"}', sidecarKey: KEY, liveKey: LIVE,
    putWorker: async () => null,
  });
  assert.equal(f.error, "not-served");
  assert.equal(await fresh.get(KEY), null, "a sidecar written by a publish that never served was left behind");
  assert.equal(await fresh.get(LIVE), null, "a site that has never served is marked live");

  // (c) A sidecar somebody else rewrote in the meantime is THEIRS and is left
  // exactly as it is — the pointer undo's own argument, applied here.
  const raced = await liveOnV1();
  await raced.put(KEY, "OLD", "application/json");
  await stage(raced, V2);
  const b3 = await readPointer(raced, SLUG);
  await activateBuild(raced, {
    slug: SLUG, version: V2, expectEtag: b3.etag, previous: b3, sidecar: "MINE", sidecarKey: KEY,
    putWorker: async () => { await raced.put(KEY, "SOMEBODY ELSE'S", "application/json"); return null; },
  });
  assert.equal(await (await raced.get(KEY)).text(), "SOMEBODY ELSE'S", "the undo took a value that was not ours");

  // (d) CANNOT-TELL IS NOT THERE-WAS-NOTHING. A previous value we could not
  // read records nothing, so the undo leaves the key alone rather than
  // deleting a live sidecar on the strength of a failed read.
  const blind = await liveOnV1();
  await blind.put(KEY, "OLD", "application/json");
  await stage(blind, V2);
  const b4 = await readPointer(blind, SLUG);
  const realGet = blind.get;
  blind.get = async (k) => { if (k === KEY) throw new Error("R2 blip"); return realGet(k); };
  await activateBuild(blind, {
    slug: SLUG, version: V2, expectEtag: b4.etag, previous: b4, sidecar: "MINE", sidecarKey: KEY,
    putWorker: async () => null,
  });
  blind.get = realGet;
  assert.equal(await (await blind.get(KEY)).text(), "MINE", "an unreadable previous value was guessed at rather than left alone");
  assert.ok(blind.logs.some((l) => l.includes("will not be undone")), "the un-undoable write was silent");

  // (e) THE CONTROL: a publish that lands keeps its new sidecar and its marker.
  const good = await liveOnV1();
  await good.put(KEY, "OLD", "application/json");
  await stage(good, V2);
  const b5 = await readPointer(good, SLUG);
  const ok = await activateBuild(good, {
    slug: SLUG, version: V2, expectEtag: b5.etag, previous: b5, sidecar: "NEW", sidecarKey: KEY, liveKey: LIVE,
    putWorker: async () => ({ ok: true }),
  });
  assert.equal(ok.ok, true);
  assert.equal(await (await good.get(KEY)).text(), "NEW", "a successful publish undid its own sidecar");
  assert.ok(await good.get(LIVE));
});

test("a success still runs the whole tail in order — the correction must not have cost the ordinary publish", async () => {
  const deps = await liveOnV1();
  await stage(deps, V2);
  const before = await readPointer(deps, SLUG);
  const order = [];
  const realPut = deps.put;
  deps.put = async (k, ...rest) => { order.push("put " + k); return realPut(k, ...rest); };
  const r = await activateBuild(deps, {
    slug: SLUG, version: V2, expectEtag: before.etag, previous: before,
    sidecar: '{"origin":"x"}', sidecarKey: "sitemeta/" + SLUG + ".json", liveKey: "sites/" + SLUG + "/site.live",
    putWorker: async () => { order.push("script"); return { ok: true }; },
    commit: async () => { order.push("commit"); },
    afterActivate: async () => { order.push("state"); },
  });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.uploaded, true);
  assert.deepEqual(order, ["put current/cafe.json", "put sitemeta/cafe.json", "put sites/cafe/site.live", "script", "commit", "state"]);
  assert.equal((await readPointer(deps, SLUG)).version, V2);
  assert.ok(!deps.removes.includes(POINTER_KEY(SLUG)), "a successful publish deleted its own pointer");
});

/* ══════════════════ 2. THE COLLECTOR'S LEASE ══════════════════════════ */

// Owner: "Enforce current site-lease ownership for collector activation …
// Source-string guards alone are insufficient." So the hook is DRIVEN through
// `activateBuild` for the three shapes the owner named.
//
// WHY THE ETAG IS NOT ENOUGH. The conditional write stops a holder whose
// pointer moved under it. It does not stop a holder that lost its LEASE while
// nobody published: the etag still matches, so the write lands and a job the
// platform has already refunded and closed publishes anyway.

test("an expired collector is refused before the pointer moves, and nothing at all is written", async () => {
  const deps = await liveOnV1();
  await stage(deps, V2);
  const before = await readPointer(deps, SLUG);
  const writesBefore = deps.puts.length;
  let scriptCalls = 0;
  const r = await activateBuild(deps, {
    slug: SLUG, version: V2, expectEtag: before.etag, previous: before,
    assertLease: async () => false,
    sidecar: "STALE", sidecarKey: "sitemeta/" + SLUG + ".json",
    putWorker: async () => { scriptCalls++; return { ok: true }; },
    commit: async () => { throw new Error("must not commit"); },
    afterActivate: async () => { throw new Error("must not advance"); },
  });
  assert.equal(r.ok, false);
  assert.equal(r.error, "lease-lost");
  assert.equal(scriptCalls, 0, "a collector with no lease uploaded its script");
  assert.equal(deps.puts.length, writesBefore, "a refused activation wrote: " + deps.puts.slice(writesBefore).join(", "));
  assert.equal((await readPointer(deps, SLUG)).version, V1);
});

test("a NEWER owner holds the lease: the beat the collector sends is refused by name, and its publish stops", async () => {
  // The real shape — the collector asks `edit_beat` under its own name and the
  // row's lease belongs to somebody else, so the RPC answers `ok: false`.
  const deps = await liveOnV1();
  await stage(deps, V2);
  const before = await readPointer(deps, SLUG);
  const beats = [];
  const rowOwner = "resume:old-collector";
  const rowNow = { lease_owner: "container:the-newer-one" };
  const assertLease = async () => {
    beats.push(rowOwner);
    const held = rowNow.lease_owner === rowOwner;
    return !(held === false); // the shape `edit_beat` answers: ok:false when not the holder
  };
  const r = await activateBuild(deps, {
    slug: SLUG, version: V2, expectEtag: before.etag, previous: before, assertLease,
    putWorker: async () => ({ ok: true }), commit: async () => { throw new Error("must not commit"); },
  });
  assert.deepEqual(beats, [rowOwner], "the lease was not re-asked under the collector's own name");
  assert.equal(r.ok, false);
  assert.equal(r.error, "lease-lost");
  assert.equal((await readPointer(deps, SLUG)).version, V1, "a collector that lost the lease to a newer owner published anyway");
});

test("an older upload completing late: the lease went and came back to somebody else between the read and the write", async () => {
  // THE CASE THE ETAG CANNOT SEE. The collector read a claim minutes ago, its
  // lease lapsed, the sweep settled the row and a NEW job took the site — but
  // that new job has not published yet, so the pointer is exactly where the
  // old collector last saw it and `etagMatches` holds. Only re-asking the
  // lease immediately before the write refuses this.
  const deps = await liveOnV1();
  await stage(deps, V2);
  const readMinutesAgo = await readPointer(deps, SLUG);
  assert.equal(readMinutesAgo.version, V1);
  // Time passes; the row is taken over; the pointer is untouched.
  const lease = { owner: "resume:late-one" };
  lease.owner = "container:whoever-holds-it-now";
  let wrote = false;
  const r = await activateBuild(deps, {
    slug: SLUG, version: V2, expectEtag: readMinutesAgo.etag, previous: readMinutesAgo,
    assertLease: async () => lease.owner === "resume:late-one",
    putWorker: async () => { wrote = true; return { ok: true }; },
  });
  assert.equal(r.error, "lease-lost", "the etag held, so only the lease could refuse this: " + JSON.stringify(r));
  assert.equal(wrote, false);
  assert.equal((await readPointer(deps, SLUG)).version, V1);
  // THE CONTROL, without which a hook that refused EVERYONE would pass every
  // case above: the same activation with the lease still held publishes.
  lease.owner = "resume:late-one";
  const ok = await activateBuild(deps, {
    slug: SLUG, version: V2, expectEtag: readMinutesAgo.etag, previous: readMinutesAgo,
    assertLease: async () => lease.owner === "resume:late-one",
    putWorker: async () => ({ ok: true }),
  });
  assert.equal(ok.ok, true, JSON.stringify(ok));
  assert.equal((await readPointer(deps, SLUG)).version, V2);
});

test("cannot-tell is not not-ours: a lease check that throws proceeds, and no hook at all is a caller that cannot lose one", async () => {
  const thrown = await liveOnV1();
  await stage(thrown, V2);
  const b1 = await readPointer(thrown, SLUG);
  const r1 = await activateBuild(thrown, {
    slug: SLUG, version: V2, expectEtag: b1.etag, previous: b1,
    assertLease: async () => { throw new Error("supabase down"); },
    putWorker: async () => ({ ok: true }),
  });
  assert.equal(r1.ok, true, "a lease we could not ask about refused a publish the caller was entitled to make");
  assert.ok(thrown.logs.some((l) => l.includes("lease check threw")), "the proceed-anyway was silent");

  const none = await liveOnV1();
  await stage(none, V2);
  const b2 = await readPointer(none, SLUG);
  const r2 = await activateBuild(none, { slug: SLUG, version: V2, expectEtag: b2.etag, previous: b2, putWorker: async () => ({ ok: true }) });
  assert.equal(r2.ok, true);
  // And a truthy non-boolean is a yes, never a veto: only an explicit `false`
  // refuses, because that is the one answer that cannot be a mistake.
  const truthy = await liveOnV1();
  await stage(truthy, V2);
  const b3 = await readPointer(truthy, SLUG);
  const r3 = await activateBuild(truthy, { slug: SLUG, version: V2, expectEtag: b3.etag, previous: b3, assertLease: async () => ({ ok: true }), putWorker: async () => ({ ok: true }) });
  assert.equal(r3.ok, true);
});

test("the collector hands a lease hook in, built from the lease it actually holds, and the spine forwards it", () => {
  // The source read is the WIRING, not the behaviour — the behaviour is driven
  // above. What a drive cannot see from here is whether the one caller that
  // can lose its lease is the one that hands the hook in.
  const c = at(W, "async function runResumedSiteBuild(", "the collector");
  const cEnd = W.indexOf("\nasync function ", c + 10);
  const body = W.slice(c, cEnd > c ? cEnd : W.length);
  assert.match(body, /const lease = row\.held \? rowOwner : null;/, "the collector does not name the lease it holds");
  assert.match(body, /const assertLease = async \(\) => \{/, "the collector builds no lease hook");
  assert.match(body, /if \(!lease\) return false;/, "a collector that holds no lease is not refused");
  assert.match(body, /"edit_beat"/, "the hook does not re-ask the row");
  assert.match(body, /p_owner: lease/, "the beat is not sent under the lease the collector holds");
  assert.match(body, /catch \{ return true; \}/, "a beat that throws vetoes the publish, so a database blip loses a build");
  const hands = body.indexOf("assertLease,");
  assert.ok(hands > body.indexOf("const assertLease"), "the collector builds a hook it never hands in");
  // The spine's builder takes it and forwards it to the activation.
  const b = at(W, "async function buildAndPublishPages(", "the build publisher");
  const bEnd = W.indexOf("\nasync function ", b + 10);
  const pub = W.slice(b, bEnd > b ? bEnd : W.length);
  // THE PARAMETER, NOT ITS POSITION. A guard pinned to `picker = null, models
  // = null })` as the END of this signature has already gone red once for an
  // honest new argument; what matters is that the hook is taken and DEFAULTED,
  // so every caller that hands none is unchanged.
  assert.match(pub.slice(0, pub.indexOf("\n")), /\bassertLease = null\b/, "buildAndPublishPages does not take a lease hook, defaulted");
  const act = pub.indexOf("await activateBuild(buildDeps(env), {");
  assert.ok(act > 0, "the build path's activation moved");
  const call = pub.slice(act, pub.indexOf("});", act));
  assert.match(call, /assertLease,/, "the hook is taken and never forwarded — the wiring trap, exactly");
  // AND THE SPINE'S OWN ACTIVATION passes `previous`, so its undo has
  // somewhere to go back to. All three call sites, by count.
  // EVERY call site, matched on the FUNCTION rather than on the deps it is
  // handed: `restoreVersion` builds its own deps and would have been missed by
  // a `buildDeps(env)` scan — which is exactly the call site whose undo matters
  // most, since a rollback that half-lands is a site stuck between versions.
  const sites = [...W.matchAll(/await activateBuild\(/g)];
  assert.equal(sites.length, 3, "the activation call sites moved — rescope this");
  for (const m of sites) {
    const s = W.slice(m.index, W.indexOf("});", m.index));
    assert.match(s, /previous:/, "an activation with no `previous` cannot undo itself: " + s.slice(0, 160));
  }
});

/* ══════════════════ 3. FIRST ACTIVATION IS CREATE-IF-ABSENT ═══════════ */

test("a first activation is conditional on there being no pointer, so two of them race in the store rather than in a lock", async () => {
  const deps = fakeR2();
  await stage(deps, V1);
  await stage(deps, V2);
  // Two first publishes of one site, neither having read a pointer.
  const a = await activateBuild(deps, { slug: SLUG, version: V1, expectEtag: null, putWorker: async () => ({ ok: true }) });
  assert.equal(a.ok, true);
  let scriptCalls = 0;
  const b = await activateBuild(deps, {
    slug: SLUG, version: V2, expectEtag: null,
    putWorker: async () => { scriptCalls++; return { ok: true }; },
    commit: async () => { throw new Error("must not commit"); },
  });
  assert.equal(b.ok, false, "the second first-activation was granted");
  assert.equal(b.error, "superseded");
  assert.equal(scriptCalls, 0, "the loser uploaded its script over the winner's");
  assert.equal((await readPointer(deps, SLUG)).version, V1, "the loser took the site");
  // The winner is whichever the store admitted, and the loser's answer is the
  // same `superseded` a stale holder gets — one sentence for one situation.
});

test("the condition is create-if-absent and not an unconditional write, read off the call itself", async () => {
  // A drive proves the outcome; this proves the MECHANISM, because an
  // implementation that read the pointer first and then wrote unconditionally
  // would pass the drive above and still race in production.
  const seen = [];
  const deps = fakeR2();
  const realPut = deps.put;
  deps.put = async (k, body, ct, onlyIf) => { if (k === POINTER_KEY(SLUG)) seen.push(onlyIf); return realPut(k, body, ct, onlyIf); };
  await stage(deps, V1);
  await activateBuild(deps, { slug: SLUG, version: V1, expectEtag: null, putWorker: async () => ({ ok: true }) });
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0], { etagDoesNotMatch: "*" }, "a first activation writes the pointer unconditionally");
  // An empty string is not an etag either — the old code read `expectEtag` as
  // truthy-or-unconditional, and "" is what a caller hands in for "none".
  const d2 = fakeR2();
  const seen2 = [];
  const realPut2 = d2.put;
  d2.put = async (k, body, ct, onlyIf) => { if (k === POINTER_KEY(SLUG)) seen2.push(onlyIf); return realPut2(k, body, ct, onlyIf); };
  await stage(d2, V1);
  await activateBuild(d2, { slug: SLUG, version: V1, expectEtag: "", putWorker: async () => ({ ok: true }) });
  assert.deepEqual(seen2[0], { etagDoesNotMatch: "*" });
  // And a real etag is still an etagMatches.
  const d3 = fakeR2();
  const seen3 = [];
  await stage(d3, V1); await stage(d3, V2);
  await activateBuild(d3, { slug: SLUG, version: V1, expectEtag: null, putWorker: async () => ({ ok: true }) });
  const p = await readPointer(d3, SLUG);
  const realPut3 = d3.put;
  d3.put = async (k, body, ct, onlyIf) => { if (k === POINTER_KEY(SLUG)) seen3.push(onlyIf); return realPut3(k, body, ct, onlyIf); };
  await activateBuild(d3, { slug: SLUG, version: V2, expectEtag: p.etag, previous: p, putWorker: async () => ({ ok: true }) });
  assert.deepEqual(seen3[0], { etagMatches: p.etag });
});

/* ══════════════ THE FAILED UPLOAD, END TO END ════════════════════════ */

test("end to end: the old site is still served, the next edit reads the old source, and the reconcile sees a state it can decide", async () => {
  // Mocked externals only — R2 is the fake above, the dispatch upload is the
  // hook, and nothing else is reached. What is asserted is the four things the
  // owner named, in the order a customer meets them.
  const deps = await liveOnV1();
  await stage(deps, V2, '[{"path":"index.tsx","source":"<p>' + V2 + '</p>"}]');
  const before = await readPointer(deps, SLUG);

  const committed = [];
  const r = await activateBuild(deps, {
    slug: SLUG, version: V2, build: "bld-2", parent: V1, job: "job-2",
    expectEtag: before.etag, previous: before,
    sidecar: '{"origin":"https://cafe.gofarther.app/","v":2}', sidecarKey: "sitemeta/" + SLUG + ".json",
    liveKey: "sites/" + SLUG + "/site.live",
    putWorker: async () => ({ ok: false, status: 522, error: "cloudflare timed out" }),
    commit: async () => { committed.push("job-2"); },
    afterActivate: async () => { await deps.put("source/" + SLUG + "/pages.json", '[{"path":"index.tsx","source":"<p>' + V2 + '</p>"}]', "application/json"); await writeHead(deps, SLUG, V2); },
  });

  // (a) THE OLD SITE IS STILL SERVED. The live script bakes V1 and reads
  // `builds/<slug>/<V1>/client`; the pointer the platform's own readers
  // resolve through is V1 too, so the fallback serve path and the card
  // lookup agree with the script.
  assert.equal(r.ok, false);
  assert.equal(r.error, "not-served");
  assert.equal((await readPointer(deps, SLUG)).version, V1);
  assert.ok(deps.store.has(buildPrefix(SLUG, V1) + "client/assets/app.js"), "V1's dist is gone, so the served script has nothing to read");

  // (b) THE NEXT EDIT USES THE CORRECT SOURCE. The editable copy and the head
  // marker are still V1's, and stage 6's repair — which compares them with the
  // pointer on every claim — finds nothing to do, because they agree with what
  // is live rather than with a version that never was.
  assert.equal((await readHead(deps, SLUG)).version, V1);
  assert.match(await (await deps.get("source/" + SLUG + "/pages.json")).text(), new RegExp(V1));
  assert.deepEqual(repairNeeded({ pointer: await readPointer(deps, SLUG), head: await readHead(deps, SLUG) }), { repair: false, why: "same" });

  // (c) BILLING AND JOB STATE RESOLVE. The commit is what turns a reserve into
  // a charge and a row into `done`; it never ran, so the row stays claimed and
  // the consumer's own refund returns the reserve — the ordinary failed-publish
  // path, which the spine reaches because the activation answered `ok:false`.
  assert.deepEqual(committed, [], "the job was committed for a publish that never served");

  // (d) V2 IS STAGED AND HARMLESS. An immutable prefix nobody points at costs
  // storage until the cap prunes it, and it is what the reconcile and a later
  // retry read.
  assert.ok(deps.store.has(buildPrefix(SLUG, V2) + "manifest.json"), "the staged build is gone, so nothing can retry or explain it");
  assert.ok(!deps.store.has("sitemeta/" + SLUG + ".json") || !(await (await deps.get("sitemeta/" + SLUG + ".json")).text()).includes('"v":2'), "the sidecar advanced to a version nothing serves");
});

test("recovery cannot overwrite a newer publication: a retry of the failed version is refused once somebody else has published", async () => {
  const deps = await liveOnV1();
  await stage(deps, V2);
  await stage(deps, V3);
  const before = await readPointer(deps, SLUG);
  // The failed publish, undone.
  const failed = await activateBuild(deps, { slug: SLUG, version: V2, expectEtag: before.etag, previous: before, putWorker: async () => ({ ok: false }) });
  assert.equal(failed.error, "not-served");
  // A later edit publishes V3 and lands.
  const now = await readPointer(deps, SLUG);
  const later = await activateBuild(deps, { slug: SLUG, version: V3, expectEtag: now.etag, previous: now, putWorker: async () => ({ ok: true }) });
  assert.equal(later.ok, true);
  // The old job comes back — a resumed collector, a retried consumer — still
  // carrying the etag it read before any of this.
  let scriptCalls = 0;
  const retry = await activateBuild(deps, {
    slug: SLUG, version: V2, expectEtag: before.etag, previous: before,
    putWorker: async () => { scriptCalls++; return { ok: true }; },
    commit: async () => { throw new Error("must not commit"); },
  });
  assert.equal(retry.ok, false);
  assert.equal(retry.error, "superseded");
  assert.equal(scriptCalls, 0);
  assert.equal((await readPointer(deps, SLUG)).version, V3, "recovery took the site back to a version nobody asked for");
});

test("the spine names a not-served and a lease-lost activation to the customer in its own words", () => {
  const start = at(W, "function compileMsg(", "compileMsg");
  const body = W.slice(start, W.indexOf("\n}\n", start));
  for (const [why, must] of [["not-served", /couldn't be put live/i], ["lease-lost", /something else was changing/i]]) {
    const i = body.indexOf('pub.error === "' + why + '"');
    assert.ok(i > 0, why + " has no sentence, so it wears the compile's");
    const line = body.slice(i, body.indexOf("\n", body.indexOf("return", i)));
    assert.match(line, must, why + "'s sentence does not say what happened: " + line);
    assert.doesNotMatch(line, /didn't compile/, why + " is told as a compile failure");
  }
  // BOTH SIT AFTER THE `ours` TEST, and that is the right side of it: the
  // spine marks both `ours: true`, so they reach their branches, and putting
  // them above it would answer for a caller that never set `ours` at all.
  // `unbilled` is above it for the opposite reason — a short balance is the
  // customer's, not ours. And both must precede the generic ours fallback, or
  // they wear "our build service was restarting".
  const ours = at(body, "if (!pub || !pub.ours) return theirs;", "the ours test");
  const fallback = at(body, "build service", "the generic ours sentence");
  for (const why of ["not-served", "lease-lost"]) {
    const i = body.indexOf('pub.error === "' + why + '"');
    assert.ok(i > ours, why + " is answered before the ours test, so a refusal that is not ours would wear it");
    assert.ok(i < fallback, why + " falls through to the generic restarting sentence");
  }
});

/* ══════════════ 4. THE RUNTIME DIAGNOSTIC ════════════════════════════ */

const USER = { id: "11111111-2222-3333-4444-555555555555", email: "owner@example.com" };
const STRANGER = { id: "99999999-8888-7777-6666-555555555555", email: "someone@example.com" };

/**
 * One authenticated request at the diagnostic, with Supabase stubbed.
 *
 * A FRESH SLUG PER CASE: `siteOwnerBySlug` memoizes for five minutes, so two
 * cases sharing a slug read the first one's owner — the recorded trap, met by
 * stage 3b's own guard the hour it was written.
 */
async function runtime(slug, { env = {}, user = USER, owner = USER.id, token = "Bearer t" } = {}) {
  const real = globalThis.fetch;
  const asked = [];
  globalThis.fetch = async (input) => {
    const u = String((input && input.url) || input || "");
    asked.push(u);
    const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
    if (u.includes("/auth/v1/user")) return user ? json(user) : new Response("no", { status: 401 });
    if (u.includes("/rest/v1/site_backends")) return json(owner ? [{ uid: owner }] : []);
    return new Response("unavailable", { status: 503 });
  };
  try {
    const worker = await loadWorker();
    const req = new Request("https://gofarther.dev/api/site/runtime?slug=" + slug, { headers: token ? { Authorization: token } : {} });
    const res = await worker.fetch(req, env, makeCtx());
    const body = await res.json().catch(() => null);
    return { status: res.status, body, asked };
  } finally { globalThis.fetch = real; }
}

test("the diagnostic answers the two effective eligibilities and the deploy identity for the site's owner", async () => {
  const r = await runtime("diag-on", {
    env: {
      DEPLOY_ID: "abc1234def", EDIT_ASYNC: "on", EDIT_ASYNC_EVERYONE: "on",
      JOB_RUNNER_CANARY: "diag-on", SITE_SECRETS_KEY: "k", SITES_BUCKET: {}, SITE_BUILD_CONTAINER: {},
    },
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body, {
    ok: true, slug: "diag-on", deploy: "abc1234def",
    async: true, runner: true,
    asyncOn: true, asyncEveryone: true, runnerOn: true, runnerEveryone: false,
    runnerBindings: true, runnerKeyed: true,
  });
});

test("every field is a boolean or the deploy id — never a value, never the canary list", async () => {
  const r = await runtime("diag-shape", {
    env: {
      DEPLOY_ID: "sha0000000", EDIT_ASYNC: "on", EDIT_ASYNC_CANARY: "diag-shape secret-other-slug",
      JOB_RUNNER_CANARY: "diag-shape another-customers-site", JOB_RUNNER_EVERYONE: "off",
      SITE_SECRETS_KEY: "the-platform-secret", SUPABASE_SERVICE_KEY: "svc", CREDITS_MINT_SECRET: "mint",
      XAI_API_KEY: "xai-secret", ANTHROPIC_API_KEY: "ant-secret",
      SITES_BUCKET: {}, SITE_BUILD_CONTAINER: {},
    },
  });
  assert.equal(r.status, 200);
  const text = JSON.stringify(r.body);
  for (const secret of ["the-platform-secret", "svc", "mint", "xai-secret", "ant-secret"]) {
    assert.ok(!text.includes(secret), "a secret reached the wire: " + secret);
  }
  for (const other of ["secret-other-slug", "another-customers-site"]) {
    assert.ok(!text.includes(other), "the canary list reached the wire: " + other);
  }
  // Every field but `ok`, `slug` and `deploy` is a boolean, so a future field
  // cannot quietly become a value.
  for (const [k, v] of Object.entries(r.body)) {
    if (k === "slug" || k === "deploy") { assert.equal(typeof v, "string", k); continue; }
    assert.equal(typeof v, "boolean", k + " is not a boolean: " + JSON.stringify(v));
  }
  // The site IS named by both canaries, and that is said as a boolean.
  assert.equal(r.body.async, true);
  assert.equal(r.body.runner, true);
  assert.equal(r.body.runnerEveryone, false);
});

test("a site the canaries do not name reads false, and the switches behind it still read true", async () => {
  const r = await runtime("diag-other", {
    env: { DEPLOY_ID: "sha0000001", EDIT_ASYNC: "on", EDIT_ASYNC_CANARY: "someone-else", JOB_RUNNER_CANARY: "someone-else", SITE_SECRETS_KEY: "k", SITES_BUCKET: {}, SITE_BUILD_CONTAINER: {} },
  });
  assert.equal(r.body.async, false, "an unnamed site reads as queued");
  assert.equal(r.body.runner, false);
  assert.equal(r.body.asyncOn, true, "the master switch is not reported");
  assert.equal(r.body.runnerOn, true, "the runner being on for SOMEBODY is not reported, so `runner:false` cannot be told from `off`");
});

test("the runner's own chain is reported link by link, so a false has a reason", async () => {
  const named = { EDIT_ASYNC: "on", JOB_RUNNER_EVERYONE: "yes" };
  const noKey = await runtime("diag-nokey", { env: { ...named, SITES_BUCKET: {}, SITE_BUILD_CONTAINER: {} } });
  assert.equal(noKey.body.runnerOn, true);
  assert.equal(noKey.body.runnerBindings, true);
  assert.equal(noKey.body.runnerKeyed, false, "no secrets key must read as no key");
  assert.equal(noKey.body.runner, false, "a fire that would answer `no-key` is reported as eligible");

  const noBind = await runtime("diag-nobind", { env: { ...named, SITE_SECRETS_KEY: "k" } });
  assert.equal(noBind.body.runnerKeyed, true);
  assert.equal(noBind.body.runnerBindings, false);
  assert.equal(noBind.body.runner, false, "a fire that would answer `no-binding` is reported as eligible");

  const off = await runtime("diag-off", { env: { SITE_SECRETS_KEY: "k", SITES_BUCKET: {}, SITE_BUILD_CONTAINER: {} } });
  assert.equal(off.body.async, false);
  assert.equal(off.body.asyncOn, false);
  assert.equal(off.body.runner, false);
  assert.equal(off.body.runnerOn, false);
  assert.equal(off.body.runnerEveryone, false);
  assert.equal(off.body.deploy, null, "a Worker with no deploy id must say so rather than inventing one");
});

test("the diagnostic is owner-gated: signed out is 401, a stranger's site is the 404 a missing site gets, no slug is 400", async () => {
  const env = { DEPLOY_ID: "sha0000002", EDIT_ASYNC: "on" };
  const out = await runtime("diag-gate-a", { env, user: null, token: "" });
  assert.equal(out.status, 401);

  const stranger = await runtime("diag-gate-b", { env, user: STRANGER, owner: USER.id });
  assert.equal(stranger.status, 404, "a signed-in stranger can read another owner's deployment state");
  assert.equal(stranger.body.error, "not found", "the refusal says the site is not theirs rather than not there");

  const missing = await runtime("diag-gate-c", { env, owner: null });
  assert.equal(missing.status, 404);

  const worker = await loadWorker();
  const noSlug = await worker.fetch(new Request("https://gofarther.dev/api/site/runtime"), env, makeCtx());
  assert.notEqual(noSlug.status, 404, "the route is not reachable at all");
  assert.equal(noSlug.status, 401, "an unauthenticated caller is refused before the slug is read");
});

test("the route reads the caller before the owner, and the owner before it answers", () => {
  const r = at(W, 'url.pathname === "/api/site/runtime"', "the route");
  const end = W.indexOf('url.pathname === "/api/site/reach"', r);
  assert.ok(end > r, "the route's neighbour moved — rescope this");
  const route = W.slice(r, end);
  assert.ok(route.indexOf("const tu = await authUser(request);") < route.indexOf("const town = await siteOwnerBySlug("), "the site is looked up before the caller");
  assert.ok(route.indexOf("const town = await siteOwnerBySlug(") < route.indexOf("return Response.json({\n        ok: true,"), "the answer is composed before the ownership check");
  assert.match(route, /town !== tu\.id\) return Response\.json\(\{ ok: false, error: "not found" \}, \{ status: 404 \}\)/, "a stranger is not answered with the missing-site 404");
  // THE LIST IS NEVER READ HERE. Not by name, and not through the reader.
  assert.ok(!route.includes("readCanaryList"), "the route reads the canary list");
  assert.ok(!route.includes("JOB_RUNNER_CANARY") && !route.includes("EDIT_ASYNC_CANARY"), "the route names a canary variable");
  assert.ok(!route.includes("SITE_SECRETS_KEY]") , "the key is indexed rather than tested");
  assert.match(route, /const keyed = !!String\(\(env && env\.SITE_SECRETS_KEY\) \|\| ""\);/, "the key's presence is not read as a boolean");
  // AND `readCanaryList` IS NOT IMPORTED AT ALL, so no later edit of this
  // route can reach for it without saying so at the top of the file.
  const imports = W.slice(0, at(W, 'from "./builder/edit-job.mjs";', "the edit-job import"));
  assert.ok(!/\breadCanaryList\b/.test(imports), "readCanaryList is imported into the Worker, so the route is one line from handing back other customers' slugs");
});
