// PARKED (2026-11-03, park-old-way): the old-way half of test/draft-verify.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
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
import { platform, pump, tick, call as callP, T } from "../../../test/fixtures/request-flow.mjs";
import { blockNetwork } from "../../../test/fixtures/no-network.mjs";
import { installCompiler } from "../../../test/fixtures/cf-containers.mjs";
import { loadWorker, makeCtx } from "../../../test/fixtures/worker-harness.mjs";
import { page as pageSrc, withWire, envFor } from "../../../test/fixtures/live-ask.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "../../../test/fixtures/rows-db.mjs";
import { mediaBucket } from "../../../test/fixtures/r2-media.mjs";
import { siteWorkersServingFiles } from "../../../test/fixtures/site-own-files.mjs";
import { buildPrefix, MANIFEST_FILE, SERVER_FILE } from "../../../site-builds.mjs";
import { readBoxes, unmetFor, runDraftVerify, moneyCheck, finish } from "../../../scripts/draft-verify.mjs";

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
