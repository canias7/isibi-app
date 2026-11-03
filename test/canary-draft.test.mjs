// THE DRAFT-FIRST VERIFIER, PROVED OFFLINE (2026-10-16): `scripts/canary-draft.mjs`
// judged against the real Worker (`worker.js`) over the platform's stand-ins,
// with supplied model answers. A verifier is only worth what its negative
// controls show: each check must FAIL when the property is broken and stay
// UNVERIFIED when the evidence is missing — never pass on absence.
//
//   CD1  the whole path: edits held as drafts (isolation passes, the preview
//        serves the draft), the explicit Publish named by revision (the
//        pointer and the running script move to it; pressed again it is
//        `already`), and recovery leaves nothing
//   CD2  negative: the switch off, so the edits publish — isolation FAILS
//   CD3  unavailable evidence stays unverified: an unreadable pointer, a
//        running script that sends no version, a preview with no address,
//        recovery notes that cannot be listed
//   CD4  negative: a Publish answer that claims success while the pointer and
//        the script did not move FAILS; a repeat that redoes work FAILS
//   CD5  recovery notes: a stale note FAILS, a fresh one is UNVERIFIED (an
//        upload may be in flight), none PASSES; a stopped journal FAILS
//   CD6  publishPress refuses without confirm: true and makes no call
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, call, T } from "./fixtures/request-flow.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { loadWorker, makeCtx } from "./fixtures/worker-harness.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "./fixtures/rows-db.mjs";
import {
  combine, readDraftEvidence, readPreview, draftVersion, isolationChecks, previewChecks,
  publishPress, publishChecks, recoveryChecks, switchChecks,
} from "../scripts/canary-draft.mjs";

blockNetwork();

const slugOf = (k) => "cd-" + k + "-" + Math.random().toString(16).slice(2, 8);
const TT_FROM = "Follow us on TikTok at @oldloaf";
const TT_TO = "Follow us on TikTok at @harbourloaf";
const TT_LATER = "Follow us on TikTok at @harbourloafbakery";
const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1></section>");
const VISIT = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>" + TT_FROM + "</p></section>");
const LOAVES = { name: "loaves", columns: [{ name: "name", type: "text" }, { name: "description", type: "text" }, { name: "price", type: "numeric" }, { name: "photo", type: "text" }], read: "public", write: "none" };
const ROUTE_TEXT = { intent: "edit", layer: "text", page: "/visit", targets: [{ change: 0, writes: ["page:/visit"] }] };
const ROUTE_DATA = { intent: "edit", layer: "data", targets: [{ change: 0, writes: ["data:loaves"] }] };
const lineId = (args, file, line) => {
  const at = String(args.messages[0].content).split("\n").find((l) => l.includes("[" + file + "] " + line));
  return Number(String(at || "-1.").split(".")[0]);
};

function bakery(name) {
  const compiler = installCompiler();
  const db = rowsDb({ tables: { loaves: { columns: LOAF_COLUMNS, rows: BAKERY_LOAVES, next: 12 } }, meta: { schema: JSON.stringify({ tables: [LOAVES] }) } });
  const said = (args) => String(args.messages[0].content);
  const P = platform({
    slug: slugOf(name), pages: [{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }], db, liveScripts: true, balance: 400,
    answers: {
      route: (args) => (/TikTok/.test(said(args)) ? ROUTE_TEXT : ROUTE_DATA),
      [T.text]: (args) => (/@harbourloafbakery/.test(said(args)) ? { edits: [{ id: lineId(args, "visit.tsx", TT_TO), to: TT_LATER }] } : { edits: [{ id: lineId(args, "visit.tsx", TT_FROM), to: TT_TO }] }),
      write_row_changes: (args) => {
        const m = /£(\d+\.\d+)/.exec((said(args).split("WHAT THEY ASKED FOR\n")[1] || "").split("\n")[0]);
        return { changes: [{ table: "loaves", id: 2, values: { price: m ? Number(m[1]) : 0 } }] };
      },
    },
  });
  return { P, db, compiler };
}
async function runOne(P, message) {
  const r = await sendMessage(P, { message });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  await settle(P, r.key, { rounds: 20 });
  const job = P.jobsOf(r.key).find((j) => j.op === "edit");
  assert.equal(job && job.state, "done", JSON.stringify(job && job.result).slice(0, 300));
}
/** The verifier's `api`: the owner's routes on the real Worker. */
const apiOf = (P) => (method, path, body) => call(P, method, path, body);
/** The verifier's `fetchPage`: any address, through the real Worker. */
const pageOf = (P) => async (url) => {
  const worker = await loadWorker();
  return P.run(async () => { const ctx = makeCtx(); const r = await worker.fetch(new Request(url), P.env, ctx); await Promise.allSettled(ctx.pending); return r; });
};
async function done(P, compiler) {
  await P.settle();
  assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for");
  P.close(); compiler.uninstall();
}
/** A site published once (switch off), then the switch on: answers the before-reading. */
async function liveThenDraftFirst(P) {
  await runOne(P, "Change our TikTok link on the Visit page to @harbourloaf.");
  P.env.DRAFT_FIRST = "on";
  const before = await readDraftEvidence(apiOf(P), P.slug);
  assert.ok(before.ok, before.why);
  assert.ok(before.state.inspect.pointer.version, "the site is not live before the case: " + JSON.stringify(before.state.inspect.pointer));
  return before;
}

test("CD6 PUBLISH IS NEVER PRESSED BY ACCIDENT — publishPress without confirm: true, or without a named revision and version, refuses and makes no call", async () => {
  let calls = 0;
  const api = async () => { calls++; return { status: 200, body: { ok: true } }; };
  assert.equal((await publishPress(api, "x", { revision: 1, version: "v" })).called, false);
  assert.equal((await publishPress(api, "x", { revision: 1, version: "v", confirm: "yes" })).called, false);
  assert.equal((await publishPress(api, "x", { version: "v", confirm: true })).called, false);
  assert.equal((await publishPress(api, "x", { revision: 1, confirm: true })).called, false);
  assert.equal(calls, 0, "a refused press still called the route");
  assert.equal((await publishPress(api, "x", { revision: 1, version: "v", confirm: true })).called, true);
  assert.equal(calls, 1);
});

test("CD7 THE SWITCHES BEFORE A PRESS — the Worker's reading, the job's calculated reading and the job child's observed reading are judged apart: a missing probe leaves the observed check unverified even when the calculation agrees; a calculated on beside an observed off FAILS", () => {
  const want = { draftFirst: true, parallelWrites: true };
  const rt = { draftFirst: true, parallelWrites: true, jobDraftFirst: true, jobParallelWrites: true };
  const allOn = switchChecks(rt, { probe: "env", draftFirst: true, parallelWrites: true }, want);
  assert.equal(combine(allOn).verdict, "pass", JSON.stringify(allOn));
  const noProbe = switchChecks(rt, null, want);
  assert.equal(noProbe["draftFirst.jobObserved"].verdict, "unverified");
  assert.equal(noProbe["draftFirst.jobCalculated"].verdict, "pass");
  assert.equal(combine(noProbe).verdict, "unverified");
  const split = switchChecks(rt, { probe: "env", draftFirst: false, parallelWrites: true }, want);
  assert.equal(split["draftFirst.jobObserved"].verdict, "fail");
  assert.equal(combine(split).verdict, "fail");
  const oldRoute = switchChecks({ draftFirst: true }, null, want);
  assert.equal(oldRoute["draftFirst.jobCalculated"].verdict, "unverified", "a route that reports no job field read as a value");
  assert.equal(switchChecks({}, { probe: "env", error: "the Worker module has no jobSwitches export" }, want)["draftFirst.jobObserved"].verdict, "unverified");
  const off = switchChecks({ draftFirst: false, parallelWrites: false, jobDraftFirst: false, jobParallelWrites: false }, { probe: "env", draftFirst: false, parallelWrites: false }, { draftFirst: false, parallelWrites: false });
  assert.equal(combine(off).verdict, "pass", "both off, as wanted, did not pass");
});

test("CD7b THE MONEY SWITCH (audit A25-6, 2026-10-23): the env probe's line carries IMAGE_PURCHASES as the job child reads it, and a child reading purchases on while the Worker says off FAILS; a two-switch want reads as before", async () => {
  const { envObserved, ENV_PROBE_NAMES } = await import("../builder/job-probe.mjs");
  assert.ok(ENV_PROBE_NAMES.includes("IMAGE_PURCHASES"), "the probe launch is not handed the money switch");
  const seen = envObserved(['{"probe":"env","draftFirst":true,"parallelWrites":true,"imagePurchases":true}']);
  assert.equal(seen.imagePurchases, true);
  assert.equal(Object.hasOwn(envObserved(['{"probe":"env","draftFirst":true,"parallelWrites":true}']), "imagePurchases"), false, "an older line's missing switch read as a value");
  const rt = { draftFirst: true, parallelWrites: true, jobDraftFirst: true, jobParallelWrites: true, imagePurchases: false, jobImagePurchases: false };
  const want = { draftFirst: true, parallelWrites: true, imagePurchases: false };
  const leak = switchChecks(rt, seen, want);
  assert.equal(leak["imagePurchases.jobObserved"].verdict, "fail", JSON.stringify(leak));
  assert.equal(combine(leak).verdict, "fail");
  const agreed = switchChecks(rt, { ...seen, imagePurchases: false }, want);
  assert.equal(combine(agreed).verdict, "pass", JSON.stringify(agreed));
  assert.equal(switchChecks(rt, seen, { draftFirst: true, parallelWrites: true })["imagePurchases.jobObserved"], undefined);
  // THE CONTAINER'S LINE ITSELF names the switch.
  const cj = (await import("node:fs")).readFileSync(new URL("../builder/container-job.mjs", import.meta.url), "utf8");
  assert.match(cj, /log\(\{ probe: "env", draftFirst: out\.draftFirst, parallelWrites: out\.parallelWrites, imagePurchases: out\.imagePurchases \}\)/, "the container's env line does not carry the money switch");
});
