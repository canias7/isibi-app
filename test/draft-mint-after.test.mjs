// A DRAFT MINTED BY A CLOCK AHEAD OF THIS ONE (2026-10-16): under draft-first a
// publish mints its version after the draft's (`mintForDraft`), so an edit run
// by an isolate whose clock is behind still saves as the newest draft. Before
// it, the edit saved as older on every try: refused, run again alone, and lost
// again until it failed.
//
//   DMA1  through the real request driver: the draft stands at a version an
//         hour in the future (a real build); a text edit then runs, saves as
//         the newest revision on its first try (no overlap re-run), its change
//         is in the draft, the live site does not move
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, T } from "./fixtures/request-flow.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { DRAFT_KEY } from "../site-draft.mjs";
import { buildPrefix } from "../site-builds.mjs";

blockNetwork();

const bare = (t) => (t == null ? t : String(t).replace(/\n[ \t]+$/, ""));
const TT_FROM = "Follow us on TikTok at @oldloaf";
const TT_TO = "Follow us on TikTok at @harbourloaf";
const HEAD_FROM = "Come to the bakery";
const HEAD_TO = "Come and see us";
const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1></section>");
const VISIT = pageSrc("/visit", "<section className=\"come\"><h1>" + HEAD_FROM + "</h1><p>" + TT_FROM + "</p></section>");
const ROUTE_TEXT = { intent: "edit", layer: "text", page: "/visit", targets: [{ change: 0, writes: ["page:/visit"] }] };
const said = (args) => String(args.messages[0].content);
const lineId = (args, file, line) => {
  const at = said(args).split("\n").find((l) => l.includes("[" + file + "] " + line));
  return Number(String(at || "-1.").split(".")[0]);
};

test("DMA1 A DRAFT MINTED AN HOUR AHEAD — an edit run afterwards saves as the newest revision on its first try, its change in the draft, nothing live", async () => {
  const compiler = installCompiler();
  const P = platform({
    slug: "dma-" + Math.random().toString(16).slice(2, 8), pages: [{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }], liveScripts: true, balance: 400,
    answers: {
      route: () => ROUTE_TEXT,
      [T.text]: (args) => (/heading/.test(said(args)) ? { edits: [{ id: lineId(args, "visit.tsx", HEAD_FROM), to: HEAD_TO }] } : { edits: [{ id: lineId(args, "visit.tsx", TT_FROM), to: TT_TO }] }),
    },
  });
  const live = () => { const t = P.readObj("current/" + P.slug + ".json"); return t ? JSON.parse(bare(t)).version : null; };
  try {
    const r0 = await sendMessage(P, { message: "Change our TikTok link on the Visit page to @harbourloaf." });
    await settle(P, r0.key, { rounds: 20 });
    const v0 = live();
    assert.ok(v0, "the first edit published nothing");
    // THE DRAFT, AS ANOTHER ISOLATE'S CLOCK AN HOUR AHEAD LEFT IT: a real build
    // (the live version's files) under a version an hour in the future.
    const ahead = String(Date.now() + 3_600_000).padStart(14, "0") + "-ahead0";
    for (const [key, o] of [...P.objects.entries()]) {
      if (key.startsWith(buildPrefix(P.slug, v0))) await P.bucket.put(buildPrefix(P.slug, ahead) + key.slice(buildPrefix(P.slug, v0).length), o.body);
    }
    await P.bucket.put(DRAFT_KEY(P.slug), JSON.stringify({ v: 2, version: ahead, build: "", base: v0, job: null, at: new Date().toISOString(), history: [], preview: "aaaaaaaaaaaa", rev: 1, revs: [{ n: 1, version: ahead, at: new Date().toISOString(), job: null }], applied: 0, refs: {} }));
    P.env.DRAFT_FIRST = "on";

    const r1 = await sendMessage(P, { message: "Change the Visit page heading to Come and see us." });
    const { rec } = await settle(P, r1.key, { rounds: 20 });
    assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(rec.parts[0].overlapRuns || 0, 0, "the edit lost to the newer draft and ran again — its version was not minted after the draft's");
    assert.equal(P.jobsOf(r1.key).filter((j) => j.op === "edit").length, 1);
    const d = JSON.parse(bare(P.readObj(DRAFT_KEY(P.slug))));
    assert.equal(d.revs.length, 2, JSON.stringify(d.revs));
    assert.ok(d.version > ahead, "the edit's version does not sort after the draft it followed: " + d.version + " vs " + ahead);
    assert.equal(d.version, d.revs[1].version);
    assert.ok(P.page("visit.tsx").includes(HEAD_TO), "the edit's change is not in the draft's editable copy");
    assert.equal(live(), v0, "the live pointer moved before Publish");
    await P.settle();
    assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for");
  } finally { P.close(); compiler.uninstall(); }
});
