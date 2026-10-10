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

test("MPH 1 — THE PHOTO SERVICE REFUSES (an empty balance): the page and its other work are kept; the photographs milestone says the photograph was NOT made, by its description; every line written after it is told it is still not made; no fact ever says it was made, placed or is on the page; and it is not charged", async () => {
  await withPlatform({ slug: slugOf("refused"), ...BASE() }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    const s = await settle(P, r.key);
    // THE SUCCESSFUL WORK IS KEPT: the Visit change and the new page.
    assert.ok(P.page("visit.tsx").includes(TIKTOK_TO), "the independent part did not finish");
    const bakers = P.page("bakers.tsx") || "";
    assert.match(bakers, /Meet the Bakers/, "the new page was not kept");
    assert.ok(!bakers.includes("@@IMG"), "a token was left in the published source");
    assert.match(bakers, /<SafeImage src=""/, "the frame is not left empty: " + bakers);
    assert.ok(P.imageLog.length >= 1, "the photo service was never asked");
    // THE PART IS PARTIAL ON CODE EVIDENCE (2026-10-10): no designer wrote a
    // requirement here, and the photograph it designed was not made.
    assert.deepEqual(s.rec.parts.map((p) => p.status), ["done", "partial"], JSON.stringify(s.rec.parts.map((p) => [p.status, p.why, p.notDone])));
    assert.deepEqual(s.rec.parts[1].notDone, [{ what: BENCH, why: "photo-not-made" }]);

    const addJob = runJobs(P, r.key, 1)[0];
    const rec = P.progressOf(addJob.id);
    assert.ok(rec, "the addition kept no progress record");
    const stages = rec.marks.map((m) => m.stage);
    assert.ok(stages.includes("pages") && stages.includes("photos") && stages.includes("publish"), stages.join(","));
    assert.ok(stages.indexOf("pages") < stages.indexOf("photos") && stages.indexOf("photos") < stages.indexOf("publish"), stages.join(","));
    const all = factsOf(rec);
    // BEFORE THE PURCHASE: still to make, not on the page.
    const toMake = all.find((f) => f.stage === "pages" && f.text.includes(BENCH));
    assert.ok(toMake, "the pages milestone does not say the photograph is still to make: " + JSON.stringify(all.filter((f) => f.stage === "pages")));
    assert.equal(toMake.state, "next");
    assert.match(toMake.text, /not on the page yet/);
    // AFTER IT: not made, by its description.
    const notMade = all.find((f) => f.stage === "photos" && f.text.includes(BENCH));
    assert.ok(notMade, "no photographs fact for the refused photograph");
    assert.equal(notMade.state, "notdone");
    assert.match(notMade.text, /could not be made/);
    // NOTHING CLAIMS IT.
    for (const f of all.filter((x) => x.text.includes(BENCH))) {
      assert.ok(["next", "notdone"].includes(f.state), "a fact states the refused photograph as " + f.state + ": " + f.text);
      assert.doesNotMatch(f.text, /was made|put on the page|placed/i, f.text);
    }

    // EVERY LINE AFTER THE PHOTOGRAPHS MILESTONE IS TOLD IT IS STILL NOT
    // MADE: a line per milestone, and the pages and photographs milestones in
    // one line (the not-made fact then shares a batch with the page's facts).
    for (const skip of [[], ["pages"]]) {
      const every = skip.join(",") || "milestone";
      const { texts } = replayLines(rec, { skip });
      const { at, later } = afterNotMade(texts, notMade);
      assert.ok(at >= 0, "no line was handed the not-made fact (every " + every + ")");
      assert.ok(later.length >= 1, "no line came after the not-made fact (every " + every + "): the check would be empty");
      for (const t of later) {
        const [ctx] = t.split("WHAT HAS HAPPENED SINCE");
        assert.match(ctx, /NOT DONE IN THIS WORK/, "a later line was not told what is still not made:\n" + t);
        assert.ok(ctx.includes(BENCH), "a later line's missing list does not name the photograph:\n" + t);
      }
      // AND NO LINE IS EVER HANDED THE PHOTOGRAPH AS MADE.
      for (const t of texts) assert.doesNotMatch(t, /\((?:prepared|applied|doing|designed)\) [^\n]*three bakers shaping loaves/, t);
    }
    // THE ADDITION WAS NOT CHARGED FOR THE PHOTOGRAPH (its own reserve, #5).
    assert.deepEqual(reserveOf(P, addJob.id).filter((e) => e.ref.endsWith("#5")), [], "the photograph that was not made was charged");
  });
});

test("MPH 2 — CONTROL: the photograph is made: the photographs milestone says it was made and put on the page (not published), no line is told anything is still not made, and the photograph is charged once", async () => {
  await withPlatform({ slug: slugOf("made"), ...BASE({ imageWith: null }) }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    const s = await settle(P, r.key);
    assert.equal(s.rec.parts[1].status, "done", JSON.stringify(s.rec.parts.map((p) => [p.status, p.why])));
    assert.match(P.page("bakers.tsx") || "", /src="\/u\/[^"]+\.jpg"/);
    const addJob = runJobs(P, r.key, 1)[0];
    const rec = P.progressOf(addJob.id);
    const made = factsOf(rec).find((f) => f.stage === "photos" && f.text.includes(BENCH));
    assert.ok(made, "no photographs fact for the made photograph");
    assert.equal(made.state, "prepared");
    assert.match(made.text, /was made and put on the page\. Not published yet\./);
    assert.ok(!factsOf(rec).some((f) => f.state === "notdone"), "a fact says something was not made");
    for (const t of replayLines(rec).texts) assert.doesNotMatch(t, /NOT DONE IN THIS WORK/, "a line was told something is missing when nothing is");
    assert.equal(reserveOf(P, addJob.id).filter((e) => e.ref.endsWith("#5")).length, 1, "the photograph was not charged once");
  });
});

test("MPH 3 — CONTROL, A LOST ANSWER (the call left and its answer never came): nobody can tell whether it was made, so it is said as still being confirmed — never as made, and never as not made — and it is not charged", async () => {
  await withPlatform({ slug: slugOf("lost"), ...BASE({ imageWith: async () => { throw new TypeError("connection reset"); } }) }, async (P) => {
    const r = await sendMessage(P, { message: MSG });
    await settle(P, r.key);
    const addJob = runJobs(P, r.key, 1)[0];
    const rec = P.progressOf(addJob.id);
    const f = factsOf(rec).filter((x) => x.text.includes(BENCH));
    assert.ok(f.some((x) => x.stage === "publish" && x.state === "next" && /still being confirmed/.test(x.text)), JSON.stringify(f));
    assert.ok(f.every((x) => x.state === "next"), "a lost answer was said as made or not made: " + JSON.stringify(f));
    assert.ok(!factsOf(rec).some((x) => x.stage === "photos"), "a photographs milestone said something of a purchase nobody can tell");
    assert.deepEqual(reserveOf(P, addJob.id).filter((e) => e.ref.endsWith("#5")), []);
  });
});

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
  assert.match(ctx, /NOT DONE IN THIS WORK, AS IT STANDS \(each stays exactly as said here in every update; never say or suggest that any of them is on the site or was done otherwise\):\n- The photograph “three bakers shaping loaves/);
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
  assert.match(PROGRESS_SYSTEM, /Anything listed as not done stays exactly as it is said there in every update: never say or suggest that it is on the site or was done otherwise\./);
});

test("MPH 8 — the build's step: photographs not made are said as not done, counted; none missing says nothing", () => {
  const one = buildStepFacts({ s: "photos-missing", missing: 1 });
  assert.deepEqual(one.map((f) => f.state), ["notdone"]);
  assert.equal(one[0].text, "A photograph could not be made, so its place on the page is left empty.");
  assert.equal(buildStepFacts({ s: "photos-missing", missing: 3 })[0].text, "3 photographs could not be made, so their places on the pages are left empty.");
  assert.deepEqual(buildStepFacts({ s: "photos-missing", missing: 0 }), []);
  assert.deepEqual(buildStepFacts({ s: "photos-missing" }), []);
});

test("MPH 9 — THE WIRING: the Worker's writer hands the record it claimed (with every milestone) to the context, so the missing list reaches every real line; the add-on marks its photographs after every purchase outcome, and the build marks the ones not made from the purchase's result", () => {
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const between = (from, to) => {
    const a = src.indexOf(from);
    assert.ok(a >= 0, "landmark missing: " + from);
    const b = src.indexOf(to, a + from.length);
    assert.ok(b > a, "landmark missing after " + from + ": " + to);
    return src.slice(a, b);
  };
  const writer = between("async function writeProgressLine(env, task, owner) {", "\n}\n");
  assert.match(writer, /const rec = claimed\.rec;/);
  assert.match(writer, /context: progressContext\(rec, \{ others \}\)/, "the writer does not hand its claimed record to the context");
  // THE ADD-ON: the success path, the thrown path and the nothing-affordable path.
  const buy = between("aPhotos = await buySitePhotos(env, {", "// ── AND THE EMPTY FRAMES THIS CHANGE REALLY ADDED");
  const marks = [...buy.matchAll(/aJob\.progress\.mark\("photos", addonPhotosFacts\(\{ planned: aFold\.photos(.*?)\}\)\)/g)].map((m) => m[1]);
  assert.equal(marks.length, 3, "the photographs milestone is not marked on all three purchase outcomes: " + JSON.stringify(marks));
  assert.ok(marks.includes(", bought: aPhotos.bought, pending: aPendingPhotos "), "the success path does not hand over what was bought and what waits");
  assert.ok(buy.indexOf("} catch (e) {") < buy.lastIndexOf('mark("photos", addonPhotosFacts({ planned: aFold.photos }))'));
  assert.match(buy, /\} else if \(aFold\.photos\.length && aJob && aJob\.progress\) \{/);
  // THE PAGES MILESTONE IS TOLD THE PHOTOGRAPHS TO MAKE.
  assert.match(src, /addonPagesFacts\(\{ added: aWorkAdded, changed: aWorkChanged, linked: .*, photos: aFold\.photos \}\)/);
  // THE BUILD: from the purchase's own result, before the photo task's join.
  const step = between("const bought = withPictureFacts(buySitePhotos(env, {", "compile: async (pages, builtParts) => {");
  assert.match(step, /const step = buildPhotoOutcome\(pictures, \{ stored \}\);\s*if \(step\) try \{ mark\?\.\("photos-missing", step\); \}/);
  // BOTH ENDINGS: the answer's pictures, and the error's with what the photo task saved.
  assert.match(step, /return bought\.then\(\(r\) => \{ sayPhotos\(r && r\.pictures, \[\]\); return r; \}, async \(e\) => \{/);
  assert.match(step, /sayPhotos\(e && e\.pictures, stored\);\s*throw e;/);
  assert.match(step, /photoTask \? await photoTask\.settled\.then\(\(rs\) => rs\.filter\(\(x\) => x && typeof x\.url === "string" && x\.url\)\.map\(\(x\) => x\.d\), \(\) => \[\]\) : \[\]/);
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

test("MPH 10 — THE LIVE REQUEST'S REQUIREMENT, REFUSED PHOTOGRAPH, THROUGH THE REAL ROUTE: the part ends partial (as live), the photograph's requirement still to do and told ONCE (no second, code-evidence entry for the same photograph), the reply writer given it, the page kept, and only the addition's reserve charged", async () => {
  await withPlatform({ slug: slugOf("live-req"), ...LIVE_SITE() }, async (P) => {
    const r = await sendMessage(P, { message: LIVE_ADD });
    const { rec } = await settle(P, r.key);
    assert.equal(rec.parts[0].status, "partial", JSON.stringify(rec.parts));
    assert.deepEqual(rec.parts[0].notDone, [{ what: PHOTO_NEED, why: "still-to-do" }], "the photograph was not told exactly once: " + JSON.stringify(rec.parts[0].notDone));
    const job = P.jobsOf(r.key).find((j) => j.op === "addon");
    const ans = P.answerOf(job);
    assert.deepEqual((ans.requirementsTold || []).map((t) => [t.need, t.told, t.state]), [[PHOTO_NEED, "still-to-do", "missing"], [PAGE_NEED, "set-up", "unverified"]]);
    assert.ok(!(ans.notAdded || []).some((n) => n.kind === "photo"), "the same photograph was told twice: " + JSON.stringify(ans.notAdded));
    assert.match(P.page("bakers.tsx") || "", /Meet the Bakers/);
    const given = P.replyLog.find((fs) => fs.some((f) => f.text.includes(PHOTO_NEED)));
    assert.ok(given, "the reply writer was never given the undone requirement");
    assert.equal(given.filter((f) => f.text.includes(PHOTO_NEED)).length, 1);
    assert.deepEqual(reserveOf(P, job.id).filter((e) => e.ref.endsWith("#5")), [], "a photograph not made was charged");
    assert.ok(reserveOf(P, job.id).length >= 1);
    assert.equal(P.imageLog.length, 1);
  });
});

test("MPH 11 — THE SAME, NO REQUIREMENT WRITTEN: the add-on's own evidence makes the part partial with the photograph not made; with the photograph made instead, the part is done and nothing is not added", async () => {
  const base = LIVE_SITE();
  const noReq = { ...base, answers: { ...base.answers, "add:page": { page: base.answers["add:page"].page }, "add:photo": { photo: base.answers["add:photo"].photo } } };
  await withPlatform({ slug: slugOf("no-req"), ...noReq }, async (P) => {
    const r = await sendMessage(P, { message: LIVE_ADD });
    const { rec } = await settle(P, r.key);
    assert.equal(rec.parts[0].status, "partial", JSON.stringify(rec.parts));
    assert.deepEqual(rec.parts[0].notDone, [{ what: BENCH, why: "photo-not-made" }]);
    const job = P.jobsOf(r.key).find((j) => j.op === "addon");
    const given = P.replyLog.find((fs) => fs.some((f) => f.text.includes(BENCH)));
    assert.ok(given && given.some((f) => /couldn't be made/.test(f.text)), "the reply writer was not given the photograph not made: " + JSON.stringify(P.replyLog));
    assert.deepEqual(reserveOf(P, job.id).filter((e) => e.ref.endsWith("#5")), []);
  });
  await withPlatform({ slug: slugOf("no-req-made"), ...noReq, imageWith: null }, async (P) => {
    const r = await sendMessage(P, { message: LIVE_ADD });
    const { rec } = await settle(P, r.key);
    assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts));
    const job = P.jobsOf(r.key).find((j) => j.op === "addon");
    assert.equal(P.answerOf(job).notAdded, undefined);
    assert.equal(reserveOf(P, job.id).filter((e) => e.ref.endsWith("#5")).length, 1);
  });
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

test("MPH 14 — THE ADD-ON'S THROWN PURCHASE: said as not confirmed, never as not made, in its milestone and its not-added entry (wiring and facts)", () => {
  const f = addonPhotosFacts({ planned: [{ describe: BENCH }, { describe: "the oven" }], unsure: [BENCH] });
  assert.deepEqual(f.map((x) => [x.state, /could not be confirmed as made/.test(x.text), /could not be made/.test(x.text)]), [["notdone", true, false], ["notdone", false, true]]);
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const a = src.indexOf("aMark(\"photos\", \"fail\", { planned: aFold.photos.length, offered: aShots.length });");
  assert.ok(a > 0);
  const tail = src.slice(a, a + 900);
  assert.match(tail, /aPhotos\.thrown = true;/);
  assert.match(tail, /addonPhotosFacts\(\{ planned: aFold\.photos, unsure: aShots\.map\(\(x\) => x\.describe\) \}\)/);
  const b = src.indexOf("const aThrewOn = aPhotos && aPhotos.thrown ? aShots.map((x) => x.describe) : [];");
  assert.ok(b > a, "the not-added entries do not read the thrown purchase");
  assert.match(src.slice(b, b + 900), /why: "purchase-unconfirmed"/);
});

test("NET — no request in this file left the machine", () => {
  assert.deepEqual(unexpected().filter((u) => u.by === "blocked"), []);
});
