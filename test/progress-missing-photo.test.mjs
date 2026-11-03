// A PHOTOGRAPH THAT WAS NOT MADE STAYS MISSING IN EVERY LATER PROGRESS LINE
// (2026-10-10, after the approved Add-on press, Actions run 38049499667).
//
// The press added a Meet the Bakers page with its menu links, and its one
// photograph was planned, offered and not made: the photo service's balance
// was empty (the owner confirmed it). At 356 s a model-written progress line
// still said the page was added "with a photograph of you shaping loaves at
// the bench". The writer had been told nothing about the photograph: no
// milestone came from the purchase, and the customer's own words, which ask
// for one, were the only thing it read about it.
//
// The fix keeps the lines model-written and grounds them in results:
//   - the pages milestone says each photograph is still to make, not on the
//     page yet;
//   - a photographs milestone, from the purchase's own result, says each one
//     made (placed, not published) or NOT MADE (`notdone`) by its
//     description, on the success, thrown and nothing-affordable paths;
//   - every later line's request lists everything not made so far ("STILL
//     NOT MADE"), after the earlier updates, so nothing written later takes
//     it back;
//   - the writer is told that what was asked for is not what was made.
//
// These cases drive the REAL Worker (routing, the add-on route, the queue
// consumer, the request driver, the progress writer's real request) against
// `test/fixtures/request-flow.mjs`, with the network blocked and the photo
// service refusing as an empty balance does (403). The build path's half is
// BLD 13 in `test/build-parallel.test.mjs`.
//
// ⚠ SUPPLIED-MODEL, STAND-IN-SERVICE PROOF ONLY: the writer here answers each
// fact as given. What it proves is what the writer is TOLD, on every line; a
// real model's wording is not measured by any test here.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { platform, sendMessage, settle, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { blockNetwork, unexpected } from "./fixtures/no-network.mjs";
import {
  addonPhotosFacts, addonPagesFacts, missingFacts, progressContext, progressRequest, buildStepFacts, buildPhotoOutcome,
  PROGRESS_SYSTEM, openRecord, appendMark,
} from "../builder/site-progress.mjs";
import { pictureOutcomes, photosNotMade } from "../builder/site-images.mjs";
import { replayLines, afterNotMade } from "./fixtures/progress-replay.mjs";

blockNetwork();

const slugOf = (k) => "mph-" + k + "-" + Math.random().toString(16).slice(2, 8);
async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try {
    const out = await fn(P);
    await P.settle();
    assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for");
    return out;
  } finally { P.close(); compiler.uninstall(); }
}

const TIKTOK_LINE = "Follow us on TikTok at @oldloaf";
const TIKTOK_TO = "Follow us on TikTok at @harbourloaf";
const VISIT_TT = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>" + TIKTOK_LINE + "</p></section>");
const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1><p>Bread from the harbour, every morning.</p></section>");
const PAGES = [{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT_TT }];
const TIKTOK = "Change our TikTok link on the Visit page to @harbourloaf";
const ADD = "add a Meet the Bakers page with a photograph of us shaping loaves at the bench";
const BENCH = "three bakers shaping loaves at a long wooden bench at night";
const TOKEN = "@@IMG:" + BENCH + "@@";
const MSG = TIKTOK + ", and " + ADD + ".";
const BAKERS = "import { createFileRoute } from '@tanstack/react-router'\n"
  + "import { SafeImage } from '@/components/safe-image'\n"
  + "export const Route = createFileRoute('/bakers')({ component: Page })\n"
  + "function Page(){ return <main><h1>Meet the Bakers</h1><SafeImage src=\"" + TOKEN + "\" alt=\"three bakers at the bench\" ratio=\"4/3\" /><p>We bake through the night.</p></main> }\n";
const lineId = (args, file, line) => {
  const at = String(args.messages[0].content).split("\n").find((l) => l.includes("[" + file + "] " + line));
  return Number(String(at || "-1.").split(".")[0]);
};
const ROUTES = [
  { intent: "edit", layer: "text", page: "/visit", alsoAsked: [ADD], targets: [{ change: 0, writes: ["page:/visit"] }, { change: 1, writes: ["page:/bakers", "images"] }] },
  { intent: "addon" },
];
// THE PHOTO SERVICE WITH AN EMPTY BALANCE: every picture refused, as fal answers then.
const EMPTY_FAL = () => new Response(JSON.stringify({ detail: "User is locked. Reason: Exhausted balance." }), { status: 403, headers: { "content-type": "application/json" } });
const BASE = ({ imageWith = EMPTY_FAL, balance = 400, ...o } = {}) => ({
  pages: PAGES, images: true, replies: true, progress: true, balance, imageWith,
  answers: {
    route: (args, n) => ROUTES[Math.min(n, 1)],
    [T.text]: (args) => ({ edits: [{ id: lineId(args, "visit.tsx", TIKTOK_LINE), to: TIKTOK_TO }] }),
    [T.adds]: { kinds: ["page", "photo"] },
    "add:page": { page: [{ path: "/bakers", name: "Meet the Bakers", purpose: "introduce the bakers", sections: ["a photograph"], components: ["card"] }] },
    "add:photo": { photo: [{ page: "/bakers", describe: BENCH, name: "bench" }] },
    [T.pages]: { pages: [{ path: "src/routes/bakers.tsx", source: BAKERS }] },
  },
  ...o,
});
const jobsOfPart = (P, key, n) => P.jobsOf(key).filter((j) => j.idem_key.startsWith(key + "-p" + n + "-"));
const runJobs = (P, key, n) => jobsOfPart(P, key, n).filter((j) => !/\/api\/site\/route(?![\w/-])/.test(String(P.bodyOf(j.id) ? P.bodyOf(j.id).url : "")));
const reserveOf = (P, jobId) => P.ledger.filter((e) => e.ref.startsWith(jobId + "#") && e.reason === "reserve");
const factsOf = (rec) => rec.marks.flatMap((m) => m.facts.map((f) => ({ stage: m.stage, mark: m.n, ...f })));
const idNum = (id) => Number(String(id).slice(1));

// ── THE FACTS, THE MISSING LIST AND THE WRITER'S REQUEST, ONE BY ONE ───────

test("MPH 4 — addonPhotosFacts: each photograph the design asked for, by its description: made → prepared; waiting on its purchase → said at the publish, not here; refused, thrown or never offered → notdone; one description once", () => {
  const planned = [{ page: "/a", describe: "a loaf" }, { page: "/a", describe: "the shop" }, { page: "/b", describe: "the bench" }, { page: "/b", describe: "a loaf" }];
  const f = addonPhotosFacts({ planned, bought: [{ key: "a loaf", url: "/u/x.jpg" }], pending: [{ key: "the shop", d: "the shop" }] });
  assert.deepEqual(f.map((x) => x.state), ["prepared", "notdone"]);
  assert.match(f[0].text, /“a loaf” was made and put on the page/);
  assert.match(f[1].text, /“the bench” could not be made, so its place on the page is left empty/);
  // THE THROWN AND NONE-AFFORDABLE PATHS: nothing bought, nothing pending.
  assert.deepEqual(addonPhotosFacts({ planned }).map((x) => x.state), ["notdone", "notdone", "notdone"]);
  assert.deepEqual(addonPhotosFacts({ planned: [] }), []);
  assert.deepEqual(addonPhotosFacts(), []);
});

test("MPH 5 — addonPagesFacts names the photographs still to make, as not on the page yet, beside the pages; with none, nothing about photographs", () => {
  const f = addonPagesFacts({ added: ["/bakers"], photos: [{ describe: BENCH }] });
  const shot = f.find((x) => x.text.includes(BENCH));
  assert.equal(shot.state, "next");
  assert.match(shot.text, /not on the page yet/);
  assert.equal(f[f.length - 1].text, "Publish the site next.");
  assert.ok(!addonPagesFacts({ added: ["/bakers"] }).some((x) => /photograph/.test(x.text)));
  assert.deepEqual(addonPagesFacts({ photos: [{ describe: BENCH }] }), [], "photographs alone make no pages milestone");
});

const rec0 = () => openRecord({ job: "a".repeat(32), uid: "u1", slug: "fold-lane-bakery", op: "addon", run: "run-1", words: ADD, pages: ["/", "/visit"], at: 1 });
const said = (rec) => ({ ...rec, marks: rec.marks.map((m) => ({ ...m, state: "said" })) });

test("MPH 6 — missingFacts and the writer's request: a notdone fact already said, given up or set aside is listed as still not made on every later request, after the earlier updates; one in the batch being written is in the batch, not the list; a record with none lists nothing", () => {
  let rec = rec0();
  rec = appendMark(rec, { stage: "pages", facts: addonPagesFacts({ added: ["/bakers"], photos: [{ describe: BENCH }] }), at: 2 }).rec;
  rec = appendMark(rec, { stage: "photos", facts: addonPhotosFacts({ planned: [{ describe: BENCH }] }), at: 3 }).rec;
  // STILL PENDING: in the batch, not in the list.
  assert.deepEqual(missingFacts(rec), []);
  assert.doesNotMatch(progressContext(rec), /NOT DONE IN THIS WORK/);
  // SAID, AND A LATER MILESTONE: listed on the next request.
  rec = said(rec);
  rec = { ...rec, lines: [{ n: 0, at: 4, text: "I wrote the Meet the Bakers page; I couldn't make its photograph.", marks: [0, 1] }] };
  rec = appendMark(rec, { stage: "publish", facts: [{ state: "doing", text: "Publishing the site with the additions now." }], at: 5 }).rec;
  assert.equal(missingFacts(rec).length, 1);
  assert.ok(missingFacts(rec)[0].includes(BENCH));
  const ctx = progressContext(rec);
  assert.match(ctx, /NOT DONE IN THIS WORK, AS IT STANDS \(already told to them once: do not say any of them again, and never say or suggest that any of them is on the site or was done otherwise\):\n- The photograph “three bakers shaping loaves/);
  assert.ok(ctx.indexOf("WHAT YOUR EARLIER UPDATES SAID") < ctx.indexOf("NOT DONE IN THIS WORK"), "the missing list is not after the earlier updates");
  const req = progressRequest({ facts: [rec.marks[2].facts[0]], context: ctx, model: "m" });
  assert.ok(req.messages[0].content.includes("NOT DONE IN THIS WORK"), "the request does not carry the missing list");
  assert.ok(req.messages[0].content.indexOf("NOT DONE IN THIS WORK") < req.messages[0].content.indexOf("WHAT HAS HAPPENED SINCE"));
  // GIVEN UP OR SET ASIDE: still missing.
  for (const state of ["failed", "skipped"]) {
    const r2 = { ...rec, marks: rec.marks.map((m) => (m.stage === "photos" ? { ...m, state } : m)) };
    assert.equal(missingFacts(r2).length, 1, state);
  }
  // ONCE, HOWEVER MANY MILESTONES REPEAT IT.
  const twice = said(appendMark(rec, { stage: "photos", facts: addonPhotosFacts({ planned: [{ describe: BENCH }] }), at: 6 }).rec);
  assert.equal(missingFacts(twice).length, 1);
  assert.deepEqual(missingFacts(null), []);
});

test("MPH 7 — the writer's instructions: what was asked for is not what was made (no detail from the request no fact states, a photograph named), and anything still not made stays missing in every update", () => {
  assert.match(PROGRESS_SYSTEM, /What they asked for is not what was made: describe a page or anything else only with what the facts say it has, never with details from their request that no fact states, such as a photograph\./);
  assert.match(PROGRESS_SYSTEM, /Anything listed as not done stays not done: never say or suggest that it is on the site or was done otherwise\. Say it once, where it is news; never repeat it on later updates\./);
});

test("MPH 8 — the build's step: photographs not made are said as not done, counted; none missing says nothing", () => {
  const one = buildStepFacts({ s: "photos-missing", missing: 1 });
  assert.deepEqual(one.map((f) => f.state), ["notdone"]);
  assert.equal(one[0].text, "A photograph could not be made, so its place on the page is left empty.");
  assert.equal(buildStepFacts({ s: "photos-missing", missing: 3 })[0].text, "3 photographs could not be made, so their places on the pages are left empty.");
  assert.deepEqual(buildStepFacts({ s: "photos-missing", missing: 0 }), []);
  assert.deepEqual(buildStepFacts({ s: "photos-missing" }), []);
});

// ── THE LIVE REQUEST'S OWN REQUIREMENT, THROUGH THE REAL ROUTE (Codex's ask) ──
//
// Live (Actions run 38049499667) the part ended partial@addon because the
// designer wrote "The page shows a photograph of the bakers shaping loaves at
// the bench" and the requirement's evidence found no photograph made. The
// first fixture here wrote no requirement, so nothing marked the photograph
// undone and the part ended done. Both are now asserted: with the live
// request's requirement, it is told once, by that requirement; without one,
// the add-on's own evidence says it.
const LIVE_ADD = "Add a Meet the Bakers page with a link in the menu, introducing the three of us who bake through the night, with a photograph of us shaping loaves at the bench.";
const PHOTO_NEED = "The page shows a photograph of the bakers shaping loaves at the bench";
const PAGE_NEED = "A Meet the Bakers page with a link in the menu";
/** The requirements judge, as a model answers it: each requirement follows from the ask, and is carried by the designed thing of its own kind. */
const judgeByKind = (args) => {
  const text = (args.messages || []).filter((m) => m && m.role === "user").map((m) => (typeof m.content === "string" ? m.content : "")).join("\n");
  const at = text.indexOf("The requirements the designers wrote down, one per line:\n");
  const lines = at < 0 ? [] : text.slice(at).split("\n").slice(1).filter((l) => l.startsWith("{"));
  const items = [...text.matchAll(/^- (\S+) — /gm)].map((m) => m[1]);
  return { verdicts: lines.map((l) => { const r = JSON.parse(l); const by = items.filter((i) => i.startsWith((r.kind || "page") + ":")); return { id: r.id, follows: "asked", carried: by.length ? "yes" : "unsure", by, reason: "the designed thing of its kind" }; }) };
};
const LIVE_SITE = () => ({
  pages: [{ path: "index.tsx", source: HOME }], images: true, replies: true, balance: 400, imageWith: EMPTY_FAL,
  answers: {
    route: [{ intent: "addon" }],
    [T.adds]: { kinds: ["page", "photo"] },
    "add:page": { page: [{ path: "/bakers", name: "Meet the Bakers", purpose: "introduce the bakers", sections: ["a photograph"], components: ["card"] }],
      requirements: [{ need: PAGE_NEED, status: "covered", by: "the bakers page", item: "/bakers", kind: "page", basis: "asked", words: LIVE_ADD }] },
    "add:photo": { photo: [{ page: "/bakers", describe: BENCH, name: "bench" }],
      requirements: [{ need: PHOTO_NEED, status: "covered", by: "the photograph", item: BENCH, kind: "photo", basis: "asked", words: LIVE_ADD }] },
    [T.pages]: { pages: [{ path: "src/routes/bakers.tsx", source: BAKERS }] },
    judge_requirements: judgeByKind,
  },
});

test("MPH 12 — photosNotMade: made, waiting and unconfirmed are not \"not made\"; one a requirement names (by description, short name or page) is left to that requirement; the rest each once", () => {
  const planned = [{ page: "/a", describe: "a loaf", name: "loaf" }, { page: "/b", describe: "the shop" }, { page: "/c", describe: "the bench", name: "bench" }, { page: "/d", describe: "the oven" }, { page: "/e", describe: "the door" }, { page: "/a", describe: "a loaf" }];
  const out = photosNotMade({ planned, bought: [{ key: "the shop" }], pending: [{ key: "the oven" }], unconfirmed: ["the door"], requirements: [] });
  assert.deepEqual(out.map((x) => x.describe), ["a loaf", "the bench"]);
  assert.deepEqual(photosNotMade({ planned, requirements: [{ kind: "photo", item: "bench" }, { from: "photo", item: "/a" }] }).map((x) => x.describe), ["the shop", "the oven", "the door"]);
  assert.deepEqual(photosNotMade({ planned, requirements: [{ kind: "page", item: "/a" }] }).map((x) => x.describe), ["a loaf", "the shop", "the bench", "the oven", "the door"], "a page's requirement silenced a photograph");
  assert.deepEqual(photosNotMade(), []);
});

// ── A THROWN IMAGE STEP, FROM ITS REAL PRODUCERS ────────────────────────────
//
// No offline fault reaches either image step's exception path through the
// route: every failure inside a purchase is caught per photograph. So the
// thrown path's facts are shown from the real producer of the error's
// pictures (`pictureOutcomes` with `thrown`, what `withPictureFacts` puts on
// the error) and its wiring by the source guards (MPH 9, MPH 14).
const PLAN = { images: [{ page: "/", describe: "a loaf at dawn" }, { page: "/", describe: "the shop front" }, { page: "/", describe: "hands shaping dough" }] };

test("MPH 13 — buildPhotoOutcome from the real picture outcomes: refused is known not made; a lost answer is unsure; a THROWN step is unsure except what the photo task had already saved (stored, never said lost); all made says nothing", () => {
  const refusedAll = pictureOutcomes({ plan: PLAN, budget: 3, buy: { bought: [], attempted: ["a loaf at dawn", "the shop front", "hands shaping dough"], refused: ["a loaf at dawn", "the shop front", "hands shaping dough"], unresolved: [] } });
  assert.deepEqual(buildPhotoOutcome(refusedAll), { missing: 3, unsure: 0, stored: 0 });
  const mixed = pictureOutcomes({ plan: PLAN, budget: 2, buy: { bought: [{ key: "a loaf at dawn", url: "/u/x/1.jpg" }], attempted: ["a loaf at dawn", "the shop front"], refused: [], unresolved: ["the shop front"], notTried: ["hands shaping dough"] } });
  assert.deepEqual(buildPhotoOutcome(mixed), { missing: 0, unsure: 1, stored: 0 }, JSON.stringify(mixed));
  const thrown = pictureOutcomes({ plan: PLAN, budget: 3, thrown: "boom" });
  assert.ok(thrown.every((p) => p.status === "unknown" && p.why === "purchase-error"), JSON.stringify(thrown));
  assert.deepEqual(buildPhotoOutcome(thrown, { stored: ["the shop front"] }), { missing: 0, unsure: 2, stored: 1 });
  assert.deepEqual(buildPhotoOutcome(thrown), { missing: 0, unsure: 3, stored: 0 });
  const made = pictureOutcomes({ plan: PLAN, budget: 3, buy: { bought: PLAN.images.map((p, i) => ({ key: p.describe, url: "/u/x/" + i + ".jpg" })), attempted: PLAN.images.map((p) => p.describe), refused: [], unresolved: [] } });
  assert.equal(buildPhotoOutcome(made), null);
  assert.equal(buildPhotoOutcome(null), null);
  // THE FACTS EACH COUNT BECOMES, all three not done, each in its own words.
  const f = buildStepFacts({ s: "photos-missing", ...buildPhotoOutcome(thrown, { stored: ["the shop front"] }), missing: 1 });
  assert.deepEqual(f.map((x) => x.state), ["notdone", "notdone", "notdone"]);
  assert.equal(f[0].text, "A photograph could not be made, so its place on the page is left empty.");
  assert.equal(f[1].text, "2 photographs could not be confirmed as made, so their places on the pages are left empty, and they are not bought again.");
  assert.equal(f[2].text, "A photograph was made and saved, but not put on the pages.");
  // AND THEY STAY, SAID SO, ON EVERY LATER LINE.
  let rec = rec0();
  rec = said(appendMark(rec, { stage: "build-photos-missing", facts: f, at: 2 }).rec);
  assert.deepEqual(missingFacts(rec), f.map((x) => x.text));
});

test("NET — no request in this file left the machine", () => {
  assert.deepEqual(unexpected().filter((u) => u.by === "blocked"), []);
});

// THE DESIGN STEP SAYS ONLY WHAT THE DESIGN DID (2026-10-15, after run
// 38742390550: an image-free build was told it had designed "the photographs
// it will use"). Photographs are named only by the steps that make them.
test("a first build's design fact names its pages and its look, never photographs; a build that buys none is told of none", () => {
  const design = buildStepFacts({ s: "design", ms: 1 });
  assert.equal(design.length, 1);
  assert.doesNotMatch(design.map((f) => f.text).join(" "), /photo/i);
  assert.match(design[0].text, /pages and its look/);
  // AN IMAGE-FREE BUILD'S STEPS: nothing about a photograph anywhere.
  const steps = [{ s: "design" }, { s: "provision", db: 0 }, { s: "gen" }, { s: "photos-alongside", started: 0 }, { s: "photos-joined", used: 0 }, { s: "compile" }];
  const said = steps.flatMap((x) => buildStepFacts(x)).map((f) => f.text).join(" ");
  assert.ok(said.length > 0, "no facts at all — the observer is not alive");
  assert.doesNotMatch(said, /photo/i, said);
  // CONTROL: a build that does buy one is told so, by that step.
  assert.match(buildStepFacts({ s: "photos-alongside", started: 2 }).map((f) => f.text).join(" "), /2 photographs/);
});
