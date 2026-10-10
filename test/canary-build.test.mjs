// THE FIRST-BUILD CHECK, PREPARED (2026-10-10, not pressed).
//
// Every verdict of `scripts/canary-build.mjs` on the shapes the build really
// records — the bands and design steps below are `repairbench-1`'s and
// `the-hot-plate`'s own `site_builds` rows, read 2026-10-10 — and on every
// way each can go wrong; then the whole press driven offline through
// `runBuildCheck` with an in-process stand-in for every network call.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { BUILD_CHECK, kitModulesOf, buildShapeVerdict, buildOverlapVerdict, buildOrderVerdict, buildProgressVerdict, buildFactTexts, buildClosureVerdict, buildPhotoVerdict, buildMoneyVerdict, buildPreflight, slugFreeVerdict, windowComplete, stableReading, PURCHASE_UNVERIFIED, runBuildCheck } from "../scripts/canary-build.mjs";
import { MAX_PAGES, MAX_COMPONENTS } from "../builder/site-plan.mjs";

const ROOT = new URL("../", import.meta.url).pathname;
const SLUG = BUILD_CHECK.slug;
const failed = (cs) => cs.filter((c) => !c.ok).map((c) => `${c.name}: ${c.why}`);

// THE RECORDED SHAPES. `repairbench-1` (2026-09-13): 16 design agents and 8
// bands, each pair's sum far past its wall. `the-hot-plate` (2026-10-04): a
// single-call design and no band split (`bands:sync`).
const RB_DESIGN = { s: "design", in: 23855, ms: 232324, out: 1078, graph: 16, agents: 16, waveMs: 232324, agentMs: 519892 };
const RB_BANDS = { s: "bands", ms: 0, bands: 8, parts: 0, wrote: 8, waveMs: 69459, agentMs: 416144 };
const HOT_PLATE = ["auth", "body", "gate", "design", "owner", "normalize", "provision", "schema", "seed", "merge", "fonts", "gen", "bands:sync", "img", "compile", "compile", "container", "og", "pages"].map((s) => ({ s, ms: 100 }));

// A FIRST BUILD AS THE CODE NOW MARKS IT (worker.js `buildAndPublishPages`):
// the photographs begun beside the pages, the fonts and translations started
// when the pages come back, the photographs joined, then the compile and the
// publish.
const NOW_TRACE = [
  { s: "auth", ms: 200 }, { s: "body", ms: 0 }, { s: "gate", ms: 300 },
  { s: "design", ms: 110000, in: 18000, out: 900 }, { s: "owner", ms: 500 }, { s: "normalize", ms: 2 },
  { s: "provision", ms: 150, db: 0 }, { s: "merge", ms: 400 },
  { s: "photos-alongside", ms: 5, started: 2 }, { s: "gen", ms: 200 },
  { ...RB_BANDS, ms: 70000 },
  { s: "fonts", ms: 300, beside: 1 }, { s: "img", ms: 50 },
  { s: "photos-joined", ms: 40, started: 2, used: 2, unused: 0 },
  { s: "compile", ms: 150000 }, { s: "container", ms: 77000 }, { s: "og", ms: 280 }, { s: "pages", ms: 9800 },
];

test("THE PRESS'S SPEC: a fresh slug, the brief asking for photographs, the budget and hard cap, and the plan's own limits", () => {
  assert.equal(SLUG, "copperleaf-tea-room");
  assert.match(BUILD_CHECK.brief, /photographs/);
  assert.equal(BUILD_CHECK.budget, 70);
  assert.equal(BUILD_CHECK.cap, 1018);
  assert.equal(MAX_PAGES, 1);
  assert.equal(MAX_COMPONENTS, 15);
  // NEVER A LIVE SITE OF THE ACCOUNT: reusing one revises it (CLAUDE.md's list).
  for (const live of ["fold-lane-bakery", "fretwork-1", "ashgrove-1", "the-hot-plate", "repairbench-1"]) assert.notEqual(SLUG, live);
});

// ── THE SHAPE ────────────────────────────────────────────────────────────────

const pageSrc = (mods) => `import { createFileRoute } from "@tanstack/react-router";\nimport { SiteChrome } from "@/components/ui/site-chrome";\n${mods.map((m, i) => `import { C${i} } from "@/components/ui/${m}";`).join("\n")}\nexport const Route = createFileRoute("/")({ component: P });\n`;
const src = (pages, parts = [], reads = { pages: true, parts: true, assets: true }) => ({ reads, pages, parts });

test("ONE PAGE, AT MOST FIFTEEN COMPONENTS: the kit modules a page imports (the chrome left out) and the components written for the site, off a whole source read", () => {
  assert.deepEqual(kitModulesOf(pageSrc(["button", "card", "button"])), ["button", "card"]);
  const ok = buildShapeVerdict(src([{ path: "src/routes/index.tsx", source: pageSrc(["hero-split", "card", "button"]) }], [{ path: "src/routes/-parts/tea-list.tsx", source: "x" }]));
  assert.deepEqual(failed(ok.checks), []);
  assert.deepEqual(ok.kit, ["button", "card", "hero-split"]);
  const fifteen = Array.from({ length: 14 }, (_, i) => `k${i}`);
  assert.deepEqual(failed(buildShapeVerdict(src([{ path: "src/routes/index.tsx", source: pageSrc(fifteen) }], [{ path: "p" }])).checks), [], "fifteen exactly was refused");
  const sixteen = buildShapeVerdict(src([{ path: "src/routes/index.tsx", source: pageSrc(fifteen) }], [{ path: "p" }, { path: "q" }]));
  assert.ok(failed(sixteen.checks).some((f) => /at most 15 components/.test(f)), "sixteen passed");
  assert.ok(failed(buildShapeVerdict(src([{ path: "a.tsx", source: pageSrc([]) }, { path: "b.tsx", source: pageSrc([]) }])).checks).some((f) => /exactly 1 page/.test(f)), "two pages passed");
  assert.ok(failed(buildShapeVerdict(src([])).checks).some((f) => /exactly 1 page/.test(f)), "no page passed");
  assert.ok(failed(buildShapeVerdict(src([{ path: "a.tsx", source: pageSrc([]) }], [], { pages: true, parts: false })).checks).some((f) => /read whole/.test(f)), "a partial read passed");
  assert.ok(failed(buildShapeVerdict(null).checks).length >= 2, "an unread source passed");
});

// ── THE OVERLAP ──────────────────────────────────────────────────────────────

test("THE OVERLAP, BY RECORDED TIME: the bands' summed calls past their wave's wall, the design agents' the same, or a photograph still being bought when the pages came back — each read off a real trace shape", () => {
  const bands = buildOverlapVerdict(NOW_TRACE);
  assert.equal(bands.ok, true);
  assert.equal(bands.by, "bands");
  assert.match(bands.detail, /8 page bands written at once: their calls took 416144 ms in all inside a 69459 ms wave/);
  const design = buildOverlapVerdict([{ s: "gate", ms: 1 }, RB_DESIGN, { s: "bands:door", ms: 0 }]);
  assert.equal(design.ok, true);
  assert.equal(design.by, "design");
  const photos = buildOverlapVerdict([{ s: "design", ms: 1 }, { s: "photos-alongside", ms: 1, started: 2 }, { s: "gen", ms: 1 }, { s: "fonts", ms: 90000, beside: 1 }, { s: "img", ms: 1 }, { s: "photos-wait", ms: 1, open: 1 }, { s: "photos-joined", ms: 9000, used: 2 }]);
  assert.equal(photos.ok, true);
  assert.equal(photos.by, "photos");
});

test("NO OVERLAP IS CLAIMED WITHOUT ITS RECORD: a single-call design and no band split (the-hot-plate), photographs finished while the pages were written, one band, a sum barely past its wall, a wait before the pages came back, and an empty or malformed trace all fail, naming what was seen", () => {
  const hot = buildOverlapVerdict(HOT_PLATE);
  assert.equal(hot.ok, false);
  assert.match(hot.why, /no recorded overlap: design in a single call \(no agents\)/);
  assert.match(buildOverlapVerdict([{ s: "gen", ms: 1 }]).why, /the trace holds no bands, design wave or photo marks/);
  const done = buildOverlapVerdict([{ s: "photos-alongside", ms: 1, started: 2 }, { s: "gen", ms: 1 }, { s: "fonts", ms: 90000 }, { s: "photos-joined", ms: 1, used: 2 }]);
  assert.equal(done.ok, false);
  assert.match(done.why, /no photograph still open when the pages came back/);
  assert.equal(buildOverlapVerdict([{ s: "bands", ms: 0, bands: 1, wrote: 1, waveMs: 50000, agentMs: 90000 }]).ok, false, "one band passed");
  assert.equal(buildOverlapVerdict([{ s: "bands", ms: 0, bands: 4, wrote: 4, waveMs: 50000, agentMs: 50500 }]).ok, false, "a sum within the slack passed");
  assert.equal(buildOverlapVerdict([{ s: "bands", ms: 0, bands: 4, wrote: 1, waveMs: 50000, agentMs: 190000 }]).ok, false, "bands that wrote one passed");
  assert.equal(buildOverlapVerdict([{ s: "design", ms: 1, agents: 1, waveMs: 100, agentMs: 5000 }]).ok, false, "one agent passed");
  assert.equal(buildOverlapVerdict([{ s: "photos-alongside", ms: 1, started: 2 }, { s: "photos-wait", ms: 1, open: 1 }, { s: "gen", ms: 1 }, { s: "fonts", ms: 1 }]).ok, false, "a wait before the pages passed");
  assert.equal(buildOverlapVerdict([{ s: "gen", ms: 1 }, { s: "fonts", ms: 1 }, { s: "photos-wait", ms: 1, open: 1 }]).ok, false, "a wait with nothing begun beside passed");
  assert.equal(buildOverlapVerdict([]).ok, false);
  assert.equal(buildOverlapVerdict(null).ok, false);
  assert.equal(buildOverlapVerdict([null, "bands", { s: 4 }, { s: "bands", bands: "8", wrote: 8, waveMs: 1, agentMs: 99999 }]).ok, false, "a malformed step passed");
});

// ── THE ORDER ────────────────────────────────────────────────────────────────

test("DEPENDENCIES AND PUBLISH IN ORDER: the trace as the code marks it passes; each step out of its place fails, saying which", () => {
  const ok = buildOrderVerdict({ steps: NOW_TRACE, done: true, ok: true });
  assert.deepEqual(failed(ok.checks), []);
  assert.deepEqual(failed(buildOrderVerdict({ steps: HOT_PLATE, done: true, ok: true }).checks), [], "the-hot-plate's real order failed");
  const swap = (a, b) => { const t = NOW_TRACE.map((x) => ({ ...x })); const i = t.findIndex((x) => x.s === a), j = t.findIndex((x) => x.s === b); [t[i], t[j]] = [t[j], t[i]]; return t; };
  const why = (steps) => failed(buildOrderVerdict({ steps, done: true, ok: true }).checks).join("; ");
  assert.match(why(swap("provision", "gen")), /provision after the pages began/);
  assert.match(why(swap("design", "provision")), /provision before the design/);
  assert.match(why(swap("photos-joined", "compile")), /joined after the compile/);
  assert.match(why(NOW_TRACE.filter((x) => x.s !== "photos-joined")), /begun and never joined/);
  assert.match(why(NOW_TRACE.filter((x) => x.s !== "og" && x.s !== "pages")), /no publish after the compile/);
  assert.match(why(NOW_TRACE.filter((x) => x.s !== "compile")), /no compile after the pages/);
  assert.match(why(NOW_TRACE.filter((x) => x.s !== "design")), /no design step/);
  assert.match(why([]), /not read/);
  assert.match(failed(buildOrderVerdict({ steps: NOW_TRACE, done: true, ok: false }).checks).join(), /done true, ok false/);
  assert.match(failed(buildOrderVerdict({ steps: NOW_TRACE, done: false, ok: true }).checks).join(), /done false, ok true/);
});

// ── THE PROGRESS ─────────────────────────────────────────────────────────────

const LINE1 = "I've designed your tea room's page and I'm writing it now, with the photographs of the room and the cakes being made alongside.";
const LINE2 = "The page is written and both photographs are on it; I'm checking it builds and renders before it goes live.";
const goodPolls = () => [
  { ms: 0, status: 202, progress: [] },
  { ms: 6000, status: 202, progress: [{ n: 0, ms: 3000, text: LINE1 }] },
  { ms: 12000, status: 202, progress: [{ n: 0, ms: 3000, text: LINE1 }, { n: 1, ms: 90000, text: LINE2 }] },
  { ms: 18000, status: 200, progress: [{ n: 0, ms: 3000, text: LINE1 }, { n: 1, ms: 90000, text: LINE2 }] },
];

test("THE MODEL'S OWN LINES, LIVE: served while the build ran, never a step's fixed sentence, none lost, none rewritten", () => {
  const v = buildProgressVerdict(goodPolls());
  assert.deepEqual(failed(v.checks), []);
  assert.deepEqual(v.lines.map((l) => l.n), [0, 1]);
  const facts = [...buildFactTexts()];
  assert.ok(facts.includes("Writing the pages now.") && facts.includes("Buying 2 photographs for the site while the pages are being written."), "the fixed sentences were not all gathered");
  const fact = goodPolls().map((p) => ({ ...p, progress: p.progress.map((l) => (l.n === 0 ? { ...l, text: "Writing the pages now." } : l)) }));
  assert.ok(failed(buildProgressVerdict(fact).checks).some((f) => /model's own sentence/.test(f)), "a fixed fact passed as the model's");
  const lost = goodPolls(); lost[3].progress = [{ n: 1, ms: 90000, text: LINE2 }];
  assert.ok(failed(buildProgressVerdict(lost).checks).some((f) => /gone from a later read/.test(f)), "a lost line passed");
  const rewritten = goodPolls(); rewritten[2].progress = [{ n: 0, ms: 3000, text: LINE2 }, { n: 1, ms: 90000, text: LINE2 }];
  assert.ok(failed(buildProgressVerdict(rewritten).checks).some((f) => /keeps its words/.test(f)), "a rewritten line passed");
  const late = goodPolls().map((p) => ({ ...p, progress: p.status === 202 ? [] : p.progress }));
  assert.ok(failed(buildProgressVerdict(late).checks).some((f) => /while the build still ran/.test(f)), "lines read only at the end passed");
  assert.equal(failed(buildProgressVerdict([]).checks).length, 3);
  const blank = goodPolls(); blank[1].progress = [{ n: 0, ms: 1, text: "  " }];
  assert.ok(failed(buildProgressVerdict(blank).checks).length > 0, "a blank line passed");
});

// ── THE CLOSURE ──────────────────────────────────────────────────────────────

const JOB = "c0ffee00".repeat(4);
const goodClosure = () => ({
  accepted: { status: 202, job: JOB }, senderAfter: [],
  sender: { token: "tok-a", uid: "22175f41-6fbf-49d7-b039-a65078a0141c" }, fresh: { token: "tok-b", uid: "22175f41-6fbf-49d7-b039-a65078a0141c" },
  final: { status: 200, json: { ok: true, slug: SLUG } }, site: 200,
});

test("API CONTINUATION (NOT A BROWSER-CLOSED TEST): accepted with a job, the sender silent after, a fresh sign-in of the same account reads the build's own final answer, and the site serves", () => {
  assert.deepEqual(failed(buildClosureVerdict(goodClosure())), []);
  const one = (over, re) => assert.ok(failed(buildClosureVerdict({ ...goodClosure(), ...over })).some((f) => re.test(f)), `${re} did not fail`);
  one({ accepted: { status: 200, job: "" } }, /accepted and handed back a job/);
  one({ accepted: { status: 202, job: "not-a-job" } }, /accepted and handed back a job/);
  one({ senderAfter: [{ who: "sender", name: "poll" }] }, /made no call after/);
  one({ senderAfter: undefined }, /made no call after/);
  one({ fresh: { token: "tok-a", uid: goodClosure().sender.uid } }, /signed in afresh/);
  one({ fresh: { token: "tok-b", uid: "someone-else" } }, /signed in afresh/);
  one({ fresh: null }, /signed in afresh/);
  one({ final: { status: 200, json: { ok: false, error: "compile" } } }, /final answer/);
  one({ final: null }, /final answer/);
  one({ site: 404 }, /serves its page/);
});

// ── THE PHOTOGRAPHS ──────────────────────────────────────────────────────────

const P1 = `/u/${SLUG}/aaaa1111bbbb2222cccc3333dddd4444.jpg`, P2 = `/u/${SLUG}/eeee5555ffff6666aaaa7777bbbb8888.jpg`;
const photoPage = (imgs) => [{ path: "src/routes/index.tsx", source: `export const Route = createFileRoute("/")({});\n${imgs.map((p) => `<img src="${p}" alt="x" />`).join("")}` }];
const servedHtml = (imgs) => `<html><body>${imgs.map(([p, a]) => `<img src="https://${SLUG}.gofarther.app${p}"${a === null ? "" : ` alt="${a}"`}>`).join("")}</body></html>`;
const img = { status: 200, type: "image/jpeg", bytes: 150_000 };
const goodPhotos = () => ({
  pages: photoPage([P1, P2]), served: servedHtml([[P1, "The tea room's window seats"], [P2, "A slice of dark ginger cake"]]),
  bytes: { [P1]: img, [P2]: img },
  uploads: { ok: true, files: [{ name: P1.split("/").pop(), kind: "image" }, { name: P2.split("/").pop(), kind: "image" }] },
  steps: NOW_TRACE, slug: SLUG,
});

test("THE PHOTOGRAPHS, STORED AND PLACED (purchase-once NOT verified): each placed one drawn with words and serving an image, and every stored image placed or recorded unused by the trace", () => {
  assert.deepEqual(failed(buildPhotoVerdict(goodPhotos()).checks), []);
  const one = (over, re) => assert.ok(failed(buildPhotoVerdict({ ...goodPhotos(), ...over }).checks).some((f) => re.test(f)), `${re} did not fail`);
  one({ pages: photoPage([]), served: servedHtml([]), bytes: {} }, /at least 1/);
  one({ served: servedHtml([[P1, "Window seats"], [P2, null]]) }, /words describing it/);
  one({ bytes: { [P1]: img, [P2]: { status: 404, type: "text/html", bytes: 9 } } }, /serves an image/);
  // A THIRD IMAGE NOTHING ACCOUNTS FOR: stored and never placed or recorded unused.
  const extra = { ok: true, files: [...goodPhotos().uploads.files, { name: "9999aaaa9999aaaa9999aaaa9999aaaa.jpg", kind: "image" }] };
  one({ uploads: extra }, /storage and placement only; purchase-once is not verified/);
  // THE CHECK NEVER CLAIMS A PURCHASE COUNT: its name says what it establishes.
  assert.ok(buildPhotoVerdict(goodPhotos()).checks.every((c) => !/bought once|bought twice|one purchase/.test(c.name)), "a photo check claims a purchase count");
  assert.match(PURCHASE_UNVERIFIED, /NOT VERIFIED/);
  // …WHICH PASSES WHEN THE TRACE RECORDS ONE UNUSED.
  const unusedTrace = NOW_TRACE.map((x) => (x.s === "photos-joined" ? { ...x, used: 2, unused: 1 } : x));
  assert.deepEqual(failed(buildPhotoVerdict({ ...goodPhotos(), uploads: extra, steps: unusedTrace }).checks), []);
  one({ uploads: { ok: true, files: [{ name: P1.split("/").pop(), kind: "image" }] } }, /placed but not stored/);
  one({ uploads: { ok: false, why: "status 503" } }, /uploads were read/);
  one({ uploads: null }, /uploads were read/);
});

// ── THE MONEY ────────────────────────────────────────────────────────────────

const rowsOf = (list, from = 430) => ({ ok: true, complete: true, rows: list.map((r, i) => ({ id: from + 1 + i, ...r })) });
const at = (balance, id) => ({ ok: true, balance, id });
test("THE WHOLE BALANCE MOVE, EXPLAINED: between two stable readings the complete window's rows must record exactly the move, the build's rows and every other row attributed apart, each build ref debited once", () => {
  const rows = rowsOf([{ ref: `build:${JOB}:deposit`, delta: -12 }, { ref: `build:${JOB}:design`, delta: -6 }, { ref: `build:${JOB}:pages`, delta: -30 }, { ref: `build:${JOB}:deposit`, delta: 0 }, { ref: "edit:other", delta: -2 }]);
  const m = buildMoneyVerdict({ start: at(990, 430), end: at(940, 435), rows, job: JOB });
  assert.equal(m.ok, true, m.why);
  assert.deepEqual({ spent: m.spent, recorded: m.recorded, net: m.net, other: m.other }, { spent: 50, recorded: 50, net: 48, other: 2 });
  assert.deepEqual(m.others.map((r) => r.ref), ["edit:other"]);
  assert.deepEqual(m.refs, [`build:${JOB}:deposit`, `build:${JOB}:design`, `build:${JOB}:pages`]);
  // A REVERSAL IS NOT A SECOND CHARGE, and is part of the explanation.
  assert.equal(buildMoneyVerdict({ start: at(990, 430), end: at(950, 433), rows: rowsOf([{ ref: `build:${JOB}:deposit`, delta: -12 }, { ref: `build:${JOB}:pages`, delta: -40 }, { ref: `build:${JOB}:pages`, delta: 12 }]), job: JOB }).ok, true);
  // CODEX'S REPRODUCTION: the balance moved 90 and the window records one build debit of 10.
  const codex = buildMoneyVerdict({ start: at(100, 430), end: at(10, 431), rows: rowsOf([{ ref: `build:${JOB}:pages`, delta: -10 }]), job: JOB });
  assert.equal(codex.ok, false);
  assert.match(codex.why, /the balance moved 90, the ledger window records 10: 80 unexplained/);
  // A ROW THE BALANCE NEVER MOVED FOR is unexplained the other way.
  assert.match(buildMoneyVerdict({ start: at(100, 430), end: at(90, 432), rows: rowsOf([{ ref: `build:${JOB}:pages`, delta: -10 }, { ref: "edit:x", delta: -5 }]), job: JOB }).why, /-5 unexplained/);
  assert.match(buildMoneyVerdict({ start: at(990, 430), end: at(930, 432), rows: rowsOf([{ ref: `build:${JOB}:pages`, delta: -30 }, { ref: `build:${JOB}:pages`, delta: -30 }]), job: JOB }).why, /taken twice: build:c0ffee00c0ffee00c0ffee00c0ffee00:pages ×2/);
  assert.match(buildMoneyVerdict({ start: at(990, 430), end: at(985, 431), rows: rowsOf([{ ref: "edit:x", delta: -5 }]), job: JOB }).why, /a first build is charged/);
  assert.match(buildMoneyVerdict({ start: at(990, 430), end: at(985, 431), rows: rowsOf([{ ref: `build:${JOB}x:pages`, delta: -5 }]), job: JOB }).why, /a first build is charged/, "another job's ref was counted as the build's");
  // INCOMPLETE OR UNSTEADY EVIDENCE NEVER PASSES.
  const ok = { start: at(990, 430), end: at(980, 431), rows: rowsOf([{ ref: `build:${JOB}:pages`, delta: -10 }]), job: JOB };
  assert.equal(buildMoneyVerdict(ok).ok, true);
  assert.match(buildMoneyVerdict({ ...ok, rows: { ...ok.rows, complete: false } }).why, /could not be read whole/);
  assert.match(buildMoneyVerdict({ ...ok, rows: { ok: false } }).why, /could not be read whole/);
  assert.match(buildMoneyVerdict({ ...ok, start: { ok: false } }).why, /steadily, at both ends/);
  assert.match(buildMoneyVerdict({ ...ok, end: { ok: true, balance: 980, id: "431" } }).why, /steadily, at both ends/);
  assert.match(buildMoneyVerdict({ ...ok, end: at(980, 429) }).why, /went back/);
  assert.match(buildMoneyVerdict({ ...ok, rows: rowsOf([{ ref: `build:${JOB}:pages`, delta: -10 }], 431) }).why, /outside it: 432/);
  assert.match(buildMoneyVerdict({ ...ok, rows: rowsOf([{ ref: `build:${JOB}:pages`, delta: "x" }]) }).why, /no amount/);
  assert.match(buildMoneyVerdict({ ...ok, rows: rowsOf([{ ref: `build:${JOB}:pages`, delta: null }]) }).why, /no amount/);
  assert.match(buildMoneyVerdict({ ...ok, job: "" }).why, /no job/);
});

test("A LEDGER WINDOW READ WHOLE, AND A READING TAKEN STEADILY: the range must describe every row served; the balance is kept only between two equal last-row ids", async () => {
  assert.equal(windowComplete({ status: 200, rows: [1, 2, 3], range: "0-2/3" }), true);
  assert.equal(windowComplete({ status: 200, rows: [], range: "*/0" }), true);
  assert.equal(windowComplete({ status: 206, rows: [1, 2], range: "0-1/4" }), false);
  assert.equal(windowComplete({ status: 200, rows: [1, 2], range: "0-1/4" }), false, "a partial 200 passed");
  assert.equal(windowComplete({ status: 200, rows: [1, 2], range: "0-1/*" }), false);
  assert.equal(windowComplete({ status: 200, rows: [1, 2], range: "" }), false);
  assert.equal(windowComplete({ status: 200, rows: [], range: "0-0/0" }), false);
  assert.equal(windowComplete({ status: 200, rows: [1], range: "*/1" }), false);
  assert.equal(windowComplete({ status: 200, rows: null, range: "*/0" }), false);
  let n = 0;
  const moving = { ledgerLast: async () => ({ ok: true, id: 430 + n++ }), balance: async () => 990 };
  assert.deepEqual(await stableReading(moving), { ok: false }, "a moving ledger gave a reading");
  let m = 0;
  const settles = { ledgerLast: async () => ({ ok: true, id: m++ < 1 ? 429 : 430 }), balance: async () => 990 };
  assert.deepEqual(await stableReading(settles), { ok: true, balance: 990, id: 430 });
  assert.deepEqual(await stableReading({ ledgerLast: async () => ({ ok: false }), balance: async () => 990 }), { ok: false });
  assert.deepEqual(await stableReading({ ledgerLast: async () => ({ ok: true, id: 1 }), balance: async () => null }), { ok: false });
});

const FREE = () => ({ backends: { status: 200, rows: [] }, builds: { status: 200, rows: [] }, host: { status: 404 } });
test("THE SLUG, VERIFIED FREE: the site table and the build records each answer 200 with no row, and the address 404; every unreadable, unauthorized, rate-limited, failed or ambiguous reading refuses, and the owner's source route's 404 is never enough", () => {
  assert.deepEqual(slugFreeVerdict(FREE()), { free: true, why: "" });
  assert.equal(buildPreflight({ balance: 990, budget: 70, cap: 1018, existing: FREE() }), "");
  // CODEX'S REPRODUCTION: statuses the old preflight let through.
  for (const status of [401, 403, 429, 500, 0, 404]) {
    assert.match(buildPreflight({ balance: 990, budget: 70, cap: 1018, existing: { ...FREE(), backends: { status, rows: status === 404 ? [] : null } } }), /site table could not verify the slug is free.*nothing is sent/, `backends ${status} passed`);
    assert.match(buildPreflight({ balance: 990, budget: 70, cap: 1018, existing: { ...FREE(), builds: { status, rows: null } } }), /build records could not verify.*nothing is sent/, `builds ${status} passed`);
  }
  for (const status of [200, 401, 403, 429, 500, 0]) assert.match(buildPreflight({ balance: 990, budget: 70, cap: 1018, existing: { ...FREE(), host: { status } } }), /did not answer 404/, `host ${status} passed`);
  assert.match(buildPreflight({ balance: 990, budget: 70, cap: 1018, existing: { ...FREE(), backends: { status: 200, rows: [{ slug: SLUG }] } } }), /already a site/);
  assert.match(buildPreflight({ balance: 990, budget: 70, cap: 1018, existing: { ...FREE(), backends: { status: 200, rows: { slug: SLUG } } } }), /answered no list/);
  // THE OLD SHAPE (the source route's own answer) is not a verification.
  for (const old of [{ status: 404 }, { status: 404, json: { error: "not found" } }, null, undefined]) assert.notEqual(buildPreflight({ balance: 990, budget: 70, cap: 1018, existing: old }), "", `${JSON.stringify(old)} passed`);
  assert.match(buildPreflight({ balance: 69, budget: 70, cap: 1018, existing: FREE() }), /does not cover this press's budget of 70/);
  assert.match(buildPreflight({ balance: 1019, budget: 70, cap: 1018, existing: FREE() }), /above this press's hard cap of 1018/);
  assert.match(buildPreflight({ balance: null, budget: 70, cap: 1018, existing: FREE() }), /could not be read/);
});

// ── THE PRESS, DRIVEN OFFLINE ────────────────────────────────────────────────

function stub(over = {}) {
  const calls = [];
  let clock = 0;
  let signIns = 0;
  let polled = 0;
  const src = { reads: { pages: true, parts: true, assets: true }, pages: photoPage([P1, P2]).map((p) => ({ ...p, source: pageSrc(["hero-split", "card"]) + p.source })), parts: [] };
  const io = {
    calls,
    now: () => clock,
    sleep: async (ms) => { clock += ms; },
    log: () => {},
    signIn: async () => { signIns++; return { token: `tok-${signIns}`, uid: "22175f41-6fbf-49d7-b039-a65078a0141c" }; },
    balance: async () => (calls.some((c) => c === "post") ? 940 : 990),
    ledgerLast: async () => ({ ok: true, id: calls.some((c) => c === "post") ? 432 : 430 }),
    existing: async (slug) => { calls.push(`existing:${slug}`); return FREE(); },
    post: async (t, body) => { calls.push("post"); calls.push(`post-by:${t}`); assert.equal(body.slug, SLUG); assert.equal(body.brief, BUILD_CHECK.brief); return { status: 202, json: { ok: false, stage: "resuming", job: JOB } }; },
    poll: async (t, job) => { calls.push(`poll:${t}`); assert.equal(job, JOB); const p = goodPolls()[Math.min(polled++, 3)]; return { status: p.status, json: p.status === 200 ? { ok: true, slug: SLUG, progress: p.progress } : { ok: false, pending: true, progress: p.progress } }; },
    trace: async () => ({ steps: NOW_TRACE, done: true, ok: true }),
    source: async (t) => { calls.push(`source:${t}`); return { status: 200, json: src }; },
    served: async () => ({ status: 200, html: servedHtml([[P1, "The tea room's window seats"], [P2, "A slice of dark ginger cake"]]) }),
    image: async () => img,
    uploads: async (t) => { calls.push(`uploads:${t}`); return goodPhotos().uploads; },
    ledgerWindow: async (from, to) => { assert.equal(from, 430); assert.equal(to, 432); return rowsOf([{ ref: `build:${JOB}:deposit`, delta: -12 }, { ref: `build:${JOB}:pages`, delta: -38 }]); },
    ...over,
  };
  return io;
}

test("END TO END, OFFLINE: the build is sent once by the first session, which then makes no call; a fresh sign-in follows it to its end; every check passes on the recorded overlap, order, lines, photographs and charges", async () => {
  const io = stub();
  const rec = await runBuildCheck(io, { spend: true });
  assert.equal(rec.stopped, "");
  assert.equal(rec.sent, true);
  assert.deepEqual(failed(rec.checks), []);
  assert.equal(rec.ok, true);
  assert.equal(io.calls.filter((c) => c === "post").length, 1, "the build was not sent exactly once");
  assert.ok(io.calls.includes("post-by:tok-1"), "the first session did not send it");
  assert.ok(io.calls.filter((c) => c.startsWith("poll:")).every((c) => c === "poll:tok-2"), "a poll was made by the sender");
  assert.equal(rec.overlap.by, "bands");
  assert.equal(rec.money.net, 50);
  assert.equal(rec.checks.length, 19);
  assert.ok(rec.checks.some((c) => /independent build work ran at once/.test(c.name)));
});

test("THE PRESS'S FAILURES REACH ITS VERDICT: no recorded overlap, a second session never signed in afresh, and a charge taken twice each fail the press with their own reason", async () => {
  const noOverlap = await runBuildCheck(stub({ trace: async () => ({ steps: HOT_PLATE.concat([]), done: true, ok: true }) }), { spend: true });
  assert.equal(noOverlap.ok, false);
  assert.ok(failed(noOverlap.checks).some((f) => /independent build work ran at once.*no recorded overlap/.test(f)));
  let n = 0;
  const same = await runBuildCheck(stub({ signIn: async () => { n++; return { token: "tok-same", uid: "22175f41-6fbf-49d7-b039-a65078a0141c" }; } }), { spend: true });
  assert.ok(failed(same.checks).some((f) => /signed in afresh/.test(f)));
  const twice = await runBuildCheck(stub({ ledgerWindow: async () => rowsOf([{ ref: `build:${JOB}:pages`, delta: -25 }, { ref: `build:${JOB}:pages`, delta: -25 }]) }), { spend: true });
  assert.ok(failed(twice.checks).some((f) => /taken twice/.test(f)));
  const inline = await runBuildCheck(stub({ post: async function () { this.calls.push("post"); return { status: 200, json: { ok: true, slug: SLUG } }; } }), { spend: true });
  assert.ok(failed(inline.checks).some((f) => /accepted and handed back a job/.test(f)), "an inline answer passed the closure");
});

test("THE FREE REHEARSAL AND THE REFUSALS: with spend not yes, or the balance outside the window, or the slug already a site, nothing is sent", async () => {
  const io = stub();
  const rec = await runBuildCheck(io, { spend: false });
  assert.equal(rec.sent, false);
  assert.match(rec.stopped, /preflight passed and nothing is sent/);
  assert.ok(!io.calls.includes("post"));
  for (const [over, re] of [[{ balance: async () => 60 }, /budget of 70/], [{ balance: async () => 2000 }, /hard cap of 1018/], [{ existing: async () => ({ ...FREE(), backends: { status: 200, rows: [{ slug: SLUG }] } }) }, /already a site/]]) {
    const s = stub(over);
    const r = await runBuildCheck(s, { spend: true });
    assert.equal(r.sent, false);
    assert.match(r.stopped, re);
    assert.ok(!s.calls.includes("post"), "the build was sent");
  }
});

test("THE WIRING: build-as-owner hands `check` to the build check before its own validation; the workflow offers it with its spend box and keeps its record", () => {
  const owner = fs.readFileSync(ROOT + "scripts/build-as-owner.mjs", "utf8");
  const hook = owner.indexOf('if (MODE === "check") {');
  const own = owner.indexOf('if (!EMAIL) fail("OWNER_EMAIL is not set");');
  assert.ok(hook > 0 && own > 0 && hook < own, "the check is not reached before build-as-owner's own validation");
  assert.ok(owner.includes('const { main } = await import("./build-check.mjs");'));
  const wf = fs.readFileSync(ROOT + ".github/workflows/build-as-owner.yml", "utf8");
  assert.ok(wf.includes("options: [edit, build, check]"));
  // A CHECK DISPATCHED FROM THE BRANCH never waits for a deploy of its own commit.
  const wait = wf.indexOf("- name: wait for this push's deploy");
  assert.ok(wait > 0 && wf.slice(wait, wait + 120).includes("if: github.event.inputs.mode != 'check'"), "the deploy wait would block the check");
  assert.ok(wf.includes("OWNER_SPEND: ${{ github.event.inputs.spend || 'no' }}"));
  assert.ok(wf.includes("            build-check.json"));
  const bc = fs.readFileSync(ROOT + "scripts/build-check.mjs", "utf8");
  assert.ok(bc.includes('String(process.env.OWNER_SPEND || "").trim().toLowerCase() === "yes"'), "spend is not read strictly");
  // THE LEDGER'S OWNER COLUMN IS `uid` (credits uses `user_id`): read live
  // 2026-10-10 before the approved press. A wrong column fails every ledger
  // read, so the press could never get past its own steady reading.
  const ledgerReads = bc.match(/credit_events\?[a-z_]+=eq\./g) || [];
  assert.equal(ledgerReads.length, 2, "the ledger reads were not found");
  assert.ok(ledgerReads.every((q) => q === "credit_events?uid=eq."), `a ledger read names the wrong column: ${JSON.stringify(ledgerReads)}`);
  assert.ok(bc.includes("rest/v1/credits?user_id=eq."), "the balance read lost its column");
});

// ── THE REVIEW'S REGRESSIONS, THROUGH THE REAL DRIVER (2026-10-10) ───────────

test("A FAILED SLUG LOOKUP SENDS NOTHING, through runBuildCheck: each unauthorized, forbidden, rate-limited, failed, thrown or ambiguous reading stops the press before the POST, with spend yes", async () => {
  const cases = [
    { backends: { status: 401, rows: null } }, { backends: { status: 403, rows: null } }, { backends: { status: 429, rows: null } }, { backends: { status: 500, rows: null } },
    { backends: { status: 0, rows: null } }, { builds: { status: 500, rows: null } }, { builds: { status: 200, rows: [{ slug: SLUG }] } },
    { host: { status: 200 } }, { host: { status: 0 } }, { host: { status: 503 } },
  ];
  for (const c of cases) {
    const s = stub({ existing: async () => ({ ...FREE(), ...c }) });
    const r = await runBuildCheck(s, { spend: true });
    assert.equal(r.sent, false, `${JSON.stringify(c)} was sent`);
    assert.match(r.stopped, /nothing is sent/);
    assert.ok(!s.calls.includes("post"), `${JSON.stringify(c)} reached the POST`);
  }
  // AN UNSTEADY BALANCE READING AT THE START ALSO SENDS NOTHING.
  let n = 0;
  const s = stub({ ledgerLast: async () => ({ ok: true, id: 400 + n++ }) });
  const r = await runBuildCheck(s, { spend: true });
  assert.equal(r.sent, false);
  assert.match(r.stopped, /balance could not be read/);
  assert.ok(!s.calls.includes("post"));
});

test("UNEXPLAINED SPENDING CANNOT PASS, through runBuildCheck: a balance that moved more than the complete window records, a window that cannot be shown whole, and an unsteady end reading each fail the press's money check", async () => {
  const money = (rec) => rec.checks.find((c) => /whole balance move explained/.test(c.name));
  // THE BALANCE FELL 80 MORE THAN THE LEDGER RECORDS (Codex's shape, through the driver).
  const lost = await runBuildCheck(stub({ balance: async function () { return this.calls.some((c) => c === "post") ? 860 : 990; } }), { spend: true });
  assert.equal(lost.ok, false);
  assert.match(money(lost).why, /the balance moved 130, the ledger window records 50: 80 unexplained/);
  const partial = await runBuildCheck(stub({ ledgerWindow: async () => ({ ...rowsOf([{ ref: `build:${JOB}:pages`, delta: -50 }]), complete: false }) }), { spend: true });
  assert.equal(partial.ok, false);
  assert.match(money(partial).why, /could not be read whole/);
  let after = false, k = 0;
  const unsteady = await runBuildCheck(stub({ post: async function (t, body) { this.calls.push("post"); after = true; return { status: 202, json: { ok: false, stage: "resuming", job: JOB } }; }, ledgerLast: async () => ({ ok: true, id: after ? 432 + k++ : 430 }) }), { spend: true });
  assert.equal(unsteady.ok, false);
  assert.match(money(unsteady).why, /steadily, at both ends/);
  // THE PASSING PRESS SAYS WHAT IT DID NOT VERIFY, and does not pass it.
  const good = await runBuildCheck(stub(), { spend: true });
  assert.equal(good.ok, true);
  assert.deepEqual(good.unverified, [PURCHASE_UNVERIFIED]);
  assert.ok(good.checks.every((c) => !/NOT VERIFIED/.test(c.name)));
  assert.ok(good.checks.filter((c) => /^API continuation:/.test(c.name)).length === 3, "the continuation checks are not named as API continuation");
  assert.ok(good.checks.every((c) => !/browser[- ]closed test\)$/.test(c.name) || /not a browser-closed test/.test(c.name)));
});

