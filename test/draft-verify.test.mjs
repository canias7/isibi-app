// THE PRESSABLE DRAFT / PUBLISH / MEDIA SCENARIO, PROVED OFFLINE (2026-10-16):
// `scripts/draft-verify.mjs` run against the real Worker over the platform's
// stand-ins, with supplied model answers. Nothing reaches a network or money.
//
//   DV1  the boxes are read strictly: an unknown mode, no site, a box filled
//        beside another mode — each refused before anything is read
//   DV2  what a mode refuses on: send and media refuse with DRAFT_FIRST off
//        (they would change the live site), send without spend, a ceiling or
//        image purchases off; publish without the publish opt-in or a listed
//        revision — the press makes no call past its readings
//   DV3  send → publish → recovery on real evidence: the message is held as
//        draft revisions (isolation and the preview pass), Publish of the
//        named revision passes, a later revision stays out, the repeat says
//        already, money checks pass; and the switch-off negative refuses
//   DV4  media: a recording replaced under draft-first through the real
//        routes is held, the live address plays the original, the preview the
//        replacement
//   DV6  the live batch's media modes: setup, held (replacements, deletion,
//        cancel), and the check after Publish, through the real Worker
//   DV7  each new media check fails on the wrong answer it guards against
//   DV5  missing evidence is unverified, never a pass; moneyCheck reads a
//        missing balance as unverified and an overspend as a failure
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { platform, pump, tick, call as callP, T } from "./fixtures/request-flow.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { page as pageSrc, withWire, envFor } from "./fixtures/live-ask.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "./fixtures/rows-db.mjs";
import { mediaBucket } from "./fixtures/r2-media.mjs";
import { siteWorkersServingFiles } from "./fixtures/site-own-files.mjs";
import { buildPrefix, MANIFEST_FILE, SERVER_FILE } from "../site-builds.mjs";
import { readBoxes, unmetFor, runDraftVerify, moneyCheck, finish } from "../scripts/draft-verify.mjs";

blockNetwork();

const TT_FROM = "Follow us on TikTok at @oldloaf";
const TT_TO = "Follow us on TikTok at @harbourloaf";
const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1></section>");
const VISIT = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>" + TT_FROM + "</p></section>");
const LOAVES = { name: "loaves", columns: [{ name: "name", type: "text" }, { name: "description", type: "text" }, { name: "price", type: "numeric" }, { name: "photo", type: "text" }], read: "public", write: "none" };
const ROUTE_TEXT = { intent: "edit", layer: "text", page: "/visit", targets: [{ change: 0, writes: ["page:/visit"] }] };
const ROUTE_DATA = { intent: "edit", layer: "data", targets: [{ change: 0, writes: ["data:loaves"] }] };
const said = (args) => String(args.messages[0].content);
const lineId = (args, file, line) => {
  const at = said(args).split("\n").find((l) => l.includes("[" + file + "] " + line));
  return Number(String(at || "-1.").split(".")[0]);
};

// ── DV1, DV2 ────────────────────────────────────────────────────────────────

test("DV1 THE BOXES ARE READ STRICTLY — an unknown mode, no site and a box filled beside another mode are refused before anything is read", () => {
  assert.equal(readBoxes({ DV_MODE: "publsh", DV_SITE: "a" }).ok, false);
  assert.equal(readBoxes({ DV_MODE: "rehearsal", DV_SITE: "" }).ok, false);
  assert.match(readBoxes({ DV_MODE: "rehearsal", DV_SITE: "a", DV_REVISION: "3" }).refused, /revision/);
  assert.match(readBoxes({ DV_MODE: "send", DV_SITE: "a", DV_PUBLISH: "yes" }).refused, /publish/);
  assert.match(readBoxes({ DV_MODE: "publish", DV_SITE: "a", DV_MESSAGE: "hi" }).refused, /message/);
  const ok = readBoxes({ DV_MODE: "publish", DV_SITE: "Fold-Lane", DV_PUBLISH: "yes", DV_REVISION: "4" });
  assert.deepEqual([ok.ok, ok.opts.slug, ok.opts.revision], [true, "fold-lane", 4]);
});

test("DV2 WHAT A MODE REFUSES ON — send and media with DRAFT_FIRST off (they would change the live site), send without spend, a ceiling, an expected count or image purchases off; publish without its opt-in or a listed revision; the help-needed fixtures never written", () => {
  const rt = (body) => ({ status: 200, body: { draftFirst: true, imagePurchases: false, ...body } });
  const draft = { ok: true, state: { revisions: [{ revision: 2, version: "v2" }] } };
  const base = { slug: "fold-lane-bakery", spend: "yes", maxCredits: 10, message: "x", expectRevisions: 1, mutate: "yes", publish: "yes", revision: 2 };
  assert.deepEqual(unmetFor({ ...base, mode: "send" }, { runtime: rt({}), balance: 50, draft }), []);
  assert.match(unmetFor({ ...base, mode: "send" }, { runtime: rt({ draftFirst: false }), balance: 50, draft }).join(), /DRAFT_FIRST must read on/, "a send with the switch off was not refused");
  assert.match(unmetFor({ ...base, mode: "media" }, { runtime: rt({ draftFirst: false }), balance: 50, draft }).join(), /DRAFT_FIRST must read on/);
  assert.match(unmetFor({ ...base, mode: "send", spend: "" }, { runtime: rt({}), balance: 50, draft }).join(), /spend must be yes/);
  assert.match(unmetFor({ ...base, mode: "send", maxCredits: null }, { runtime: rt({}), balance: 50, draft }).join(), /max_credits/);
  assert.match(unmetFor({ ...base, mode: "send", expectRevisions: null }, { runtime: rt({}), balance: 50, draft }).join(), /expect_revisions/);
  assert.match(unmetFor({ ...base, mode: "send" }, { runtime: rt({ imagePurchases: true }), balance: 50, draft }).join(), /image purchases/);
  assert.match(unmetFor({ ...base, mode: "send" }, { runtime: rt({}), balance: null, draft }).join(), /balance/);
  assert.match(unmetFor({ ...base, mode: "publish", publish: "" }, { runtime: rt({}), balance: 50, draft }).join(), /publish must be yes/);
  assert.match(unmetFor({ ...base, mode: "publish", revision: 7 }, { runtime: rt({}), balance: 50, draft }).join(), /not an unpublished revision/);
  assert.match(unmetFor({ ...base, mode: "media", slug: "fretwork-1" }, { runtime: rt({}), balance: 50, draft }).join(), /help-needed fixture/);
  assert.match(unmetFor({ ...base, mode: "send" }, { runtime: { status: 500 }, balance: 50, draft }).join(), /runtime route/);
});

// ── DV3 ─────────────────────────────────────────────────────────────────────

function bakery() {
  const compiler = installCompiler();
  const db = rowsDb({ tables: { loaves: { columns: LOAF_COLUMNS, rows: BAKERY_LOAVES, next: 12 } }, meta: { schema: JSON.stringify({ tables: [LOAVES] }) } });
  const P = platform({
    slug: "dv-" + Math.random().toString(16).slice(2, 8), pages: [{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }], db, liveScripts: true, balance: 400,
    answers: {
      route: (args) => (/TikTok|heading/.test(said(args)) ? ROUTE_TEXT : ROUTE_DATA),
      [T.text]: (args) => (/heading/.test(said(args)) ? { edits: [{ id: lineId(args, "visit.tsx", "Come to the bakery"), to: "Come and see us" }] } : { edits: [{ id: lineId(args, "visit.tsx", TT_FROM), to: TT_TO }] }),
      write_row_changes: () => ({ changes: [{ table: "loaves", id: 2, values: { price: 5.6 } }] }),
    },
  });
  return { P, db, compiler };
}
/** The harness's io over the real Worker: its `sleep` moves the platform's queue and cron on. */
function ioOf(P) {
  return {
    call: async (method, path, { json } = {}) => callP(P, method, path, json),
    fetchPage: async (url) => {
      const worker = await loadWorker();
      return P.run(async () => { const ctx = makeCtx(); const r = await worker.fetch(new Request(url), P.env, ctx); await Promise.allSettled(ctx.pending); return r; });
    },
    sleep: async () => { await pump(P); if (!P.queue.length) await tick(P); },
    now: (() => { let t = 0; return () => (t += 1000); })(),
    log: () => {},
  };
}

test("DV3 SEND → PUBLISH → RECOVERY ON REAL EVIDENCE — one message held as a draft revision (isolation, the preview, money pass); then a row change saved after; Publish of the page revision passes with the later revision kept out and the repeat `already`; recovery passes; with the switch OFF the same send is refused before anything is sent", async () => {
  const { P, db, compiler } = bakery();
  try {
    // A LIVE SITE, published once with the switch off.
    const io = ioOf(P);
    const first = await callP(P, "POST", "/api/site/route", { message: "Change our TikTok link on the Visit page to @harbourloaf.", slug: P.slug, picker: "sonnet", hasSite: true, firstBuild: false, picked: false, history: [], files: [], brief: "x", qa: [], answering: false, idem: "rq" + "ab".repeat(10) });
    assert.equal(first.status, 200, JSON.stringify(first.body));
    for (let i = 0; i < 8; i++) await io.sleep();
    // THE NEGATIVE: the switch still off — the send is refused, nothing sent.
    const sends0 = P.modelLog.length;
    const off = await runDraftVerify({ mode: "send", slug: P.slug, picker: "sonnet", spend: "yes", maxCredits: 20, message: "Change the Visit page heading to Come and see us.", expectRevisions: 1, expectHeld: [] }, io);
    assert.equal(off.exit, 2, JSON.stringify(off.verdict));
    assert.match(off.refused.join(), /DRAFT_FIRST must read on/);
    assert.equal(P.modelLog.length, sends0, "a refused send reached a model");

    P.env.DRAFT_FIRST = "on";
    P.env.IMAGE_PURCHASES = "off";
    const sent = await runDraftVerify({ mode: "send", slug: P.slug, picker: "sonnet", spend: "yes", maxCredits: 20, message: "Change the Visit page heading to Come and see us.", expectRevisions: 1, expectHeld: [] }, io);
    for (const k of ["isolation.pointer", "isolation.liveScript", "isolation.draft", "preview.preview", "money"]) assert.equal(sent.checks[k] && sent.checks[k].verdict, "pass", k + ": " + JSON.stringify(sent.checks[k]) + " " + JSON.stringify(sent.refused));
    assert.equal(sent.checks["switch.draftFirst.jobObserved"].verdict, "unverified", "the container's observed switch was passed without a probe");
    assert.notEqual(sent.exit, 1, JSON.stringify(sent.verdict));

    // A ROW CHANGE SAVED AFTER: a later revision the approval must keep out.
    const rowSent = await runDraftVerify({ mode: "send", slug: P.slug, picker: "sonnet", spend: "yes", maxCredits: 20, message: "Make the Dark Rye £5.60.", expectRevisions: 1, expectHeld: ["row"] }, io);
    assert.equal(rowSent.checks["isolation.held"].verdict, "pass", JSON.stringify(rowSent.checks));
    const revs = rowSent.readings.draftAfter.revisions;
    const pageRev = revs[revs.length - 2].revision;
    const pub = await runDraftVerify({ mode: "publish", slug: P.slug, publish: "yes", revision: pageRev }, io);
    for (const k of ["publish.answer", "publish.pointer", "publish.liveScript", "publish.journal", "publish.drafted", "publish.later", "publish.repeat", "money"]) assert.equal(pub.checks[k] && pub.checks[k].verdict, "pass", k + ": " + JSON.stringify(pub.checks[k]));
    assert.equal(Number(db.rows("loaves").find((l) => l.id === 2).price), 5.2, "the later row revision went live with the earlier approval");
    const rec = await runDraftVerify({ mode: "recovery", slug: P.slug }, io);
    for (const k of ["recovery.notes", "recovery.journal", "recovery.aligned"]) assert.equal(rec.checks[k].verdict, "pass", k + ": " + JSON.stringify(rec.checks[k]));
    // PUBLISH WITHOUT ITS OPT-IN: refused, nothing published.
    const live = P.readObj("current/" + P.slug + ".json");
    const no = await runDraftVerify({ mode: "publish", slug: P.slug, publish: "", revision: revs[revs.length - 1].revision }, io);
    assert.equal(no.exit, 2);
    assert.equal(P.readObj("current/" + P.slug + ".json"), live, "a refused publish moved the pointer");
    await P.settle();
  } finally { P.close(); compiler.uninstall(); }
});

// ── DV4 ─────────────────────────────────────────────────────────────────────

test("DV4 MEDIA — a recording replaced under draft-first through the real routes is held; the live address plays the original and the preview the replacement; with mutate not yes nothing is written", async () => {
  const worker = await loadWorker();
  const slug = "dv-media";
  const store = mediaBucket();
  // THE LIVE ADDRESS'S FILES ARE THE SITE'S OWN WORKER'S (2026-10-28: the
  // site's own Worker), so the live script stand-in serves them, from the
  // site's bucket, through the template's real handler.
  const env = { ...envFor(store), DRAFT_FIRST: "on", IMAGE_PURCHASES: "off", SITE_WORKERS: await siteWorkersServingFiles(store) };
  const pre = buildPrefix(slug, "01790500000000-aaaaaa");
  await store.put(pre + MANIFEST_FILE, JSON.stringify({ files: ["index.html"], worker: true, build: "b0" }));
  await store.put(pre + SERVER_FILE, "export default {}");
  await store.put("current/" + slug + ".json", JSON.stringify({ version: "01790500000000-aaaaaa", build: "b0", parent: "", job: null, activatedAt: "x" }));
  const tone = new Uint8Array(readFileSync(new URL("./fixtures/media/tone.mp3", import.meta.url)));
  const other = new Uint8Array(tone); for (let i = other.length - 64; i < other.length; i++) other[i] ^= 0x5a;
  await withWire({}, async () => {
    const send = async (method, host, path, { json, body } = {}) => {
      const init = { method, headers: { Authorization: "Bearer t" } };
      if (json !== undefined) { init.body = JSON.stringify(json); init.headers["content-type"] = "application/json"; }
      if (body !== undefined) { init.body = body; init.headers["content-length"] = String(body.length); }
      const res = await worker.fetch(new Request("https://" + host + path, init), env, makeCtx());
      const buf = new Uint8Array(await res.arrayBuffer());
      let parsed = null; try { parsed = JSON.parse(new TextDecoder().decode(buf)); } catch { parsed = null; }
      return { status: res.status, body: parsed, bytes: buf };
    };
    const io = {
      call: (method, path, o) => send(method, "gofarther.dev", path, o),
      fetchPage: async (url) => { const u = new URL(url); return send("GET", u.host, u.pathname); },
      sleep: async () => {}, now: () => Date.now(), log: () => {},
      media: { bytes: tone, other, name: "dv tone.mp3" },
    };
    const refused = await runDraftVerify({ mode: "media", slug, mutate: "" }, io);
    assert.equal(refused.exit, 2);
    assert.equal(store.calls.filter((c) => c === "createMultipartUpload").length, 0, "a refused media press wrote to the library");
    const r = await runDraftVerify({ mode: "media", slug, mutate: "yes" }, io);
    for (const k of ["media.upload", "media.held", "media.live", "media.preview"]) assert.equal(r.checks[k] && r.checks[k].verdict, "pass", k + ": " + JSON.stringify(r.checks[k]));
  });
});

// ── DV6 (2026-10-17, the live batch's media) ─────────────────────────────────

test("DV6 THE LIVE BATCH'S MEDIA — media-setup uploads the video, audio and disposable fixtures (each served live whole and by range, none held, no revision saved, the FILES line printed); media-held holds both replacements and the deletion, cancels a longer upload, keeps live byte for byte and the pointer still, while the preview plays the replacements and 404s the deleted file; media-check reads the published state; refusals write nothing", async () => {
  const worker = await loadWorker();
  const slug = "dv-media-batch";
  const store = mediaBucket();
  const env = { ...envFor(store), DRAFT_FIRST: "on", IMAGE_PURCHASES: "off", SITE_WORKERS: await siteWorkersServingFiles(store, { version: "01790500000000-aaaaaa" }) };
  // (2026-10-28: the site's own Worker serves the live address's files; see DV4.)
  const pre = buildPrefix(slug, "01790500000000-aaaaaa");
  await store.put(pre + MANIFEST_FILE, JSON.stringify({ files: ["index.html"], worker: true, build: "b0" }));
  await store.put(pre + SERVER_FILE, "export default {}");
  await store.put("current/" + slug + ".json", JSON.stringify({ version: "01790500000000-aaaaaa", build: "b0", parent: "", job: null, activatedAt: "x" }));
  const fx = (f) => new Uint8Array(readFileSync(new URL("./fixtures/media/" + f, import.meta.url)));
  const fixtures = { video: fx("clip.mp4"), audio: fx("tone.mp3"), disposable: fx("tone.m4a"), videoB: fx("clip-b.mp4"), audioB: fx("tone-b.mp3") };
  assert.ok(fixtures.videoB.length !== fixtures.video.length || fixtures.videoB.some((x, i) => x !== fixtures.video[i]), "the replacement video is the original: this case tests nothing");
  await withWire({}, async () => {
    const send = async (method, host, path, { json, body, range } = {}) => {
      const init = { method, headers: { Authorization: "Bearer t" } };
      if (range) init.headers.range = range;
      if (json !== undefined) { init.body = JSON.stringify(json); init.headers["content-type"] = "application/json"; }
      if (body !== undefined) { init.body = body; init.headers["content-length"] = String(body.length); }
      const res = await worker.fetch(new Request("https://" + host + path, init), env, makeCtx());
      const buf = new Uint8Array(await res.arrayBuffer());
      let parsed = null; try { parsed = JSON.parse(new TextDecoder().decode(buf)); } catch { parsed = null; }
      return { status: res.status, body: parsed, bytes: buf, headers: res.headers };
    };
    const lines = [];
    const io = {
      call: (method, path, o) => send(method, "gofarther.dev", path, o),
      fetchPage: async (url, o = {}) => { const u = new URL(url); return send("GET", u.host, u.pathname, { range: o.range }); },
      sleep: async () => {}, now: () => Date.now(), log: (l) => lines.push(l), fixtures,
    };
    // REFUSALS FIRST: no mutate, and the FILES box missing — nothing written.
    assert.equal((await runDraftVerify({ mode: "media-setup", slug, mutate: "" }, io)).exit, 2);
    assert.equal(store.calls.filter((c) => c === "createMultipartUpload").length, 0, "a refused setup wrote to the library");
    assert.equal(readBoxes({ DV_MODE: "media-held", DV_SITE: slug, DV_MUTATE: "yes" }).ok, false, "media-held ran without its FILES box");
    assert.equal(readBoxes({ DV_MODE: "media-setup", DV_SITE: slug, DV_FILES: "video=" + "a".repeat(32) + ".mp4" }).ok, false, "a FILES box beside media-setup was taken");
    // SETUP.
    const set = await runDraftVerify({ mode: "media-setup", slug, mutate: "yes" }, io);
    for (const [k, c] of Object.entries(set.checks)) if (k.startsWith("setup.")) assert.equal(c.verdict, "pass", k + ": " + JSON.stringify(c));
    for (const role of ["video", "audio", "disposable"]) for (const k of ["upload", "notHeld", "live.whole", "live.range"]) assert.ok(set.checks["setup." + role + "." + k], "no " + role + " " + k + " check");
    assert.equal(set.checks["setup.noRevision"].verdict, "pass");
    const filesLine = lines.find((l) => l.startsWith("FILES "));
    assert.ok(filesLine, "the FILES line was not printed");
    const boxes = readBoxes({ DV_MODE: "media-held", DV_SITE: slug, DV_MUTATE: "yes", DV_FILES: filesLine.slice(6) });
    assert.equal(boxes.ok, true, JSON.stringify(boxes));
    // HELD.
    const held = await runDraftVerify(boxes.opts, io);
    for (const [k, c] of Object.entries(held.checks)) if (k.startsWith("held.")) assert.equal(c.verdict, "pass", k + ": " + JSON.stringify(c));
    for (const k of ["held.video.replace", "held.audio.replace", "held.disposable.delete", "held.cancel", "held.live.video.whole", "held.live.audio.range", "held.live.disposable.whole", "held.pointer", "held.preview.video.whole", "held.preview.audio.range", "held.preview.disposable"]) assert.ok(held.checks[k], "no " + k + " check");
    // THE READER IS ALIVE: before Publish, media-check fails (live still plays the originals, the disposable file is still there).
    const early = await runDraftVerify(readBoxes({ DV_MODE: "media-check", DV_SITE: slug, DV_FILES: filesLine.slice(6) }).opts, io);
    assert.deepEqual([early.checks["check.live.video.whole"].verdict, early.checks["check.live.audio.whole"].verdict, early.checks["check.live.disposable"].verdict], ["fail", "fail", "fail"], JSON.stringify(early.checks));
    // PUBLISH THE NEWEST, THEN CHECK.
    const revs = held.readings.draftAfter.revisions;
    const newest = revs[revs.length - 1];
    const pub = await io.call("POST", "/api/site/" + slug + "/publish", { json: { revision: newest.revision, version: newest.version } });
    assert.ok(pub.status < 300, "publish answered " + pub.status + " " + JSON.stringify(pub.body));
    await io.call("GET", "/api/site/" + slug + "/draft?inspect=1");
    const checkBoxes = readBoxes({ DV_MODE: "media-check", DV_SITE: slug, DV_FILES: filesLine.slice(6) });
    const chk = await runDraftVerify(checkBoxes.opts, io);
    for (const k of ["check.live.video.whole", "check.live.video.range", "check.live.audio.whole", "check.live.audio.range", "check.live.disposable"]) assert.equal(chk.checks[k] && chk.checks[k].verdict, "pass", k + ": " + JSON.stringify(chk.checks[k]));
  });
});

test("DV7 EACH MEDIA CHECK FAILS ON A WRONG ANSWER — a range answered 200 is no seek; a new upload held, a deleted file the preview still serves, a cancelled upload that still completes and a live version that moved each fail, never pass", async () => {
  const fx = (f) => new Uint8Array(readFileSync(new URL("./fixtures/media/" + f, import.meta.url)));
  const fixtures = { video: fx("clip.mp4"), audio: fx("tone.mp3"), disposable: fx("tone.m4a"), videoB: fx("clip-b.mp4"), audioB: fx("tone-b.mp3") };
  const N = (c) => c.repeat(32);
  const files = { video: N("a") + ".mp4", audio: N("b") + ".mp3", disposable: N("c") + ".m4a" };
  // ONE SCRIPTED SERVER, WRONG IN EVERY WAY THE CHECKS GUARD.
  let version = 0;
  const bytesAt = (url) => /--draft-/.test(url)
    ? (url.endsWith(files.video) ? fixtures.videoB : url.endsWith(files.audio) ? fixtures.audioB : fixtures.disposable)
    : (url.endsWith(files.video) ? fixtures.video : url.endsWith(files.audio) ? fixtures.audio : fixtures.disposable);
  let uploads = 0;
  const io = {
    sleep: async () => {}, now: () => Date.now(), log: () => {}, fixtures,
    call: async (method, path, o = {}) => {
      if (path.startsWith("/api/site/runtime")) return { status: 200, body: { draftFirst: true, parallelWrites: true, imagePurchases: false } };
      if (path === "/api/credits") return { status: 200, body: { balance: 50 } };
      if (path.includes("/draft?inspect=1")) return { status: 200, body: { ok: true, inspect: {}, state: "idle", revision: 3, applied: 0, revisions: [], preview: "https://s--draft-t.gofarther.app/" } };
      if (method === "POST" && /\/media$/.test(path)) return { status: 200, body: { session: "s" + (++uploads), parts: 1, partBytes: 8 * 1024 * 1024 } };
      if (method === "PUT") return { status: 200, body: { etag: "e" } };
      if (method === "DELETE" && path.includes("/media/")) return { status: 200, body: { ok: true } };
      if (method === "DELETE") return { status: 200, body: { ok: true, held: true, draft: { revision: 4 } } };
      if (path.endsWith("/complete")) {
        return { status: 200, body: { ok: true, name: N(String(uploads % 10)) + ".mp4", url: "/u/s/x.mp4", held: true, replaces: uploads <= 2 ? [files.video, files.audio][uploads - 1] : undefined, draft: { revision: 3 } } };
      }
      return { status: 404, body: null };
    },
    fetchPage: async (url, o = {}) => {
      if (url.endsWith("/")) return { status: 200, headers: new Headers({ "x-site-version": "v" + (version++) }) };
      const b = bytesAt(url);
      // A RANGE ANSWERED 200 WITH THE WHOLE FILE; the deleted file still served.
      return { status: 200, headers: new Headers(), bytes: o.range ? b : b };
    },
  };
  const held = await runDraftVerify({ mode: "media-held", slug: "s", mutate: "yes", files }, io);
  assert.equal(held.checks["held.live.video.range"].verdict, "fail", "a range answered 200 passed as a seek");
  assert.equal(held.checks["held.preview.disposable"].verdict, "fail", "a deleted file the preview still serves passed");
  assert.equal(held.checks["held.cancel"].verdict, "fail", "a cancelled upload that still completed passed");
  assert.equal(held.checks["held.pointer"].verdict, "fail", "a live version that moved passed");
  // A NEW UPLOAD THAT CAME BACK HELD.
  const set = await runDraftVerify({ mode: "media-setup", slug: "s", mutate: "yes" }, io);
  assert.equal(set.checks["setup.video.notHeld"].verdict, "fail", "a held new upload passed");
});

// ── DV5 ─────────────────────────────────────────────────────────────────────

test("DV5 MISSING EVIDENCE IS UNVERIFIED — a balance not read is unverified, an overspend fails; a run whose checks all passed exits 0, one with an unverified check 3, a failure 1, a refusal 2", () => {
  assert.equal(moneyCheck(null, 10, 5).verdict, "unverified");
  assert.equal(moneyCheck(20, 10, 5).verdict, "fail");
  assert.equal(moneyCheck(20, 16, 5).verdict, "pass");
  assert.equal(moneyCheck(20, 20, 0).verdict, "pass");
  assert.equal(finish({ checks: { a: { verdict: "pass", why: "" } } }).exit, 0);
  assert.equal(finish({ checks: { a: { verdict: "pass", why: "" }, b: { verdict: "unverified", why: "" } } }).exit, 3);
  assert.equal(finish({ checks: { a: { verdict: "fail", why: "" }, b: { verdict: "unverified", why: "" } } }).exit, 1);
  assert.equal(finish({ checks: {}, refused: ["x"] }).exit, 2);
  assert.equal(finish({ checks: {} }).exit, 3, "no check at all passed");
  // THE WORKFLOW IS DISPATCH-ONLY, every box wired, and states its opt-ins.
  const wf = readFileSync(new URL("../.github/workflows/draft-verify.yml", import.meta.url), "utf8");
  assert.match(wf, /\non:\n  workflow_dispatch:/);
  assert.doesNotMatch(wf, /\n  push:|\n  pull_request:|\n  schedule:/);
  for (const k of ["MODE", "SITE", "MESSAGE", "EXPECT_REVISIONS", "EXPECT_HELD", "SPEND", "MAX_CREDITS", "MUTATE", "PUBLISH", "REVISION", "PICKER"]) {
    assert.match(wf, new RegExp("DV_" + k + ": \\$\\{\\{ github\\.event\\.inputs\\.[a-z_]+ \\}\\}"), "box " + k + " is not wired");
  }
});
