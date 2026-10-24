// THE STEP PREPARATION POOL IS REFILLED (2026-10-11, the validation round,
// after Codex's review of fb50298e).
//
// Codex's reproduction: one Look request with six independent page-heading
// tweaks, each on its own page. While step 1 was held, three later steps were
// prepared beside it and finished — and the two ready steps after them never
// took the freed places: they started only when step 1 finished.
// `STEP_AHEAD_MAX` capped HOW MANY steps were ever prepared, not how many ran
// at once. Now it bounds simultaneous preparation, and a finished preparation
// gives its place to the next ready step whose turn has not come.
//
// The writes still happen in order, one step at a time; each step's prepared
// calls are replayed at its turn when its request is byte for byte the one
// recorded. Through the real request driver, queue consumer, routes and job
// runner, with supplied model answers; no network.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, deliver, T } from "./fixtures/request-flow.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";

blockNetwork();

const slugOf = (k) => "sp-" + k + "-" + Math.random().toString(16).slice(2, 8);
async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try { const out = await fn(P); await P.settle(); assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for"); return out; } finally { P.close(); compiler.uninstall(); }
}
const why = (rec) => JSON.stringify(rec.parts.map((p) => [p.status, p.why]));
const once = (P) => { const refs = P.ledger.map((e) => e.ref); assert.equal(new Set(refs).size, refs.length, "a charge was made twice: " + JSON.stringify(P.ledger)); };
const shownFile = (args) => {
  const content = String((args && args.messages && args.messages[0] && args.messages[0].content) || "");
  const at = content.indexOf("\n\nTHE FILE (");
  if (at < 0) return null;
  const rest = content.slice(at + "\n\nTHE FILE (".length);
  const close = rest.indexOf(")\n");
  // THE FILE ENDS WHERE THE REQUEST'S CONTEXT BEGINS (2026-10-22, A03-5): a
  // stub that echoed it answered a page that does not parse, which the tweak's
  // syntax check now (rightly) sends to the rewrite.
  let source = rest.slice(close + 2);
  const ctx = source.indexOf("\n\n\n");
  if (ctx >= 0) source = source.slice(0, ctx);
  return { path: rest.slice(0, close), source };
};

const NAMES = ["home", "menu", "visit", "story", "order", "jobs"];
const pathOf = (n) => (n === "home" ? "/" : "/" + n);
const fileOf = (n) => (n === "home" ? "index.tsx" : n + ".tsx");
const head = (n) => "Heading " + n;
const PAGES6 = NAMES.map((n) => ({ path: fileOf(n), source: pageSrc(pathOf(n), "<section className=\"band\"><h1>" + head(n) + "</h1></section>") }));
const BIG = (n) => "<h1 className=\"text-6xl\">" + head(n) + "</h1>";
const WORDS = (n) => "make the " + n + " page heading bigger";
const SCOPES6 = NAMES.map((n) => ({ part: "shape", page: pathOf(n), words: WORDS(n) }));
const MSG6 = "Please " + NAMES.map(WORDS).join(", and ") + ".";
const nameOfFile = (f) => NAMES.find((n) => f && f.path && f.path.endsWith(fileOf(n)));

test("SP 0 — SIX HEADING TWEAKS ON SIX PAGES, THE FIRST HELD: with the first step held, preparations refill freed places — steps 5 and 6 start before step 1 finishes; never more than three preparations at once; every heading lands; each tweak asked once; nothing charged twice", { timeout: 60000 }, async () => {
  const log = [];
  let release, live = 0, peak = 0;
  const held = new Promise((r) => { release = r; });
  const tally = {};
  await withPlatform({
    slug: slugOf("0"), pages: PAGES6, balance: 400,
    answers: {
      route: { intent: "edit", layer: "look" },
      [T.pick]: { fields: ["shape"], scopes: SCOPES6 },
      [T.tweak]: async (args) => {
        const f = shownFile(args);
        const n = nameOfFile(f);
        tally[n] = (tally[n] || 0) + 1;
        log.push(["start", n]);
        if (n === "home") {
          setTimeout(() => release(), 3000);
          await held;
        } else {
          live++; peak = Math.max(peak, live);
          await new Promise((r) => setTimeout(r, 150));
          live--;
        }
        log.push(["end", n]);
        return { source: String(f.source).replace("<h1>" + head(n) + "</h1>", BIG(n)) };
      },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: MSG6 });
    const { rec } = await settle(P, r.key);
    assert.equal(rec.parts[0].status, "done", why(rec));
    for (const n of NAMES) assert.ok(P.page(fileOf(n)).includes(BIG(n)), n + " did not land");
    const homeEnd = log.findIndex((e) => e[0] === "end" && e[1] === "home");
    for (const n of ["order", "jobs"]) {
      const at = log.findIndex((e) => e[0] === "start" && e[1] === n);
      assert.ok(at >= 0 && at < homeEnd, n + " started only after step 1 finished: " + JSON.stringify(log));
    }
    assert.ok(peak <= 3, "more than three preparations ran at once: " + peak);
    assert.deepEqual(tally, Object.fromEntries(NAMES.map((n) => [n, 1])), "a tweak was asked more than once: " + JSON.stringify(tally));
    once(P);
  });
});

// One fixture for the cases below: six heading steps; `plan` says, per page,
// how its tweak answers (a function of the call's count for that page).
async function six(k, plan, fn, extra = {}) {
  const tally = {}, log = [];
  let picks = 0;
  await withPlatform({
    slug: slugOf(k), pages: extra.pages || PAGES6, balance: 400,
    answers: {
      route: { intent: "edit", layer: "look" },
      // A RESUMED REQUEST carries only what the answer must still do (the
      // asking step's own words), so its picker names only that change — as
      // the real picker, given only those words to act on, does.
      [T.pick]: async () => {
        picks++;
        return { fields: ["shape"], scopes: picks === 1 ? (extra.scopes || SCOPES6) : (extra.scopes || SCOPES6).filter((sc) => sc.words === extra.resumed) };
      },
      [T.tweak]: async (args) => {
        const f = shownFile(args);
        const n = nameOfFile(f);
        tally[n] = (tally[n] || 0) + 1;
        log.push(["start", n, String(f.source)]);
        const out = plan[n] ? await plan[n](tally[n], f, args) : null;
        log.push(["end", n]);
        return out || { source: String(f.source).replace("<h1>" + head(n) + "</h1>", BIG(n)) };
      },
    },
  }, (P) => fn(P, { tally, log }));
}
const ms = (t) => new Promise((r) => setTimeout(r, t));

test("SP 1 — A GENUINE DEPENDENCY WAITS: beside the six heading steps, a picture step works on the Visit page, which the Visit heading step writes (it fills the empty frame): the picture step is not prepared beside it — it is asked once, after that step wrote, and shown the frame as it was left — while the independent heading steps are prepared; every change lands, each asked once", { timeout: 60000 }, async () => {
  const VISIT_F = pageSrc("/visit", "<section className=\"band\"><h1>" + head("visit") + "</h1><SafeImage src=\"\" alt=\"The bakery's front\" ratio=\"4/3\" /></section>");
  const pages = PAGES6.map((p) => (p.path === "visit.tsx" ? { path: p.path, source: VISIT_F } : p));
  const PHOTO = "and put a photograph of the bakery's front on the Visit page";
  const seen = [];
  let visitEnd = -1;
  const tally = {}, log = [];
  await withPlatform({
    slug: slugOf("1"), pages, images: true, balance: 400,
    answers: {
      route: { intent: "edit", layer: "look" },
      [T.pick]: { fields: ["shape", "images"], scopes: [...SCOPES6, { part: "images", page: "/visit", words: PHOTO }] },
      [T.tweak]: async (args) => {
        const f = shownFile(args);
        const n = nameOfFile(f);
        tally[n] = (tally[n] || 0) + 1;
        log.push(["start", n]);
        if (n === "visit") await ms(500);
        log.push(["end", n]);
        if (n === "visit") visitEnd = log.length;
        let src = String(f.source).replace("<h1>" + head(n) + "</h1>", BIG(n));
        if (n === "visit") src = src.replace("src=\"\"", "src=\"/u/shop/front.jpg\"");
        return { source: src };
      },
      choose_pictures: async (args) => {
        seen.push({ at: log.length, content: String(args.messages[0].content) });
        return { pictures: [{ page: "visit.tsx", alt: "The bakery's front", describe: "the front of a small bakery at dawn" }] };
      },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: MSG6 + " " + PHOTO + "." });
    const { rec } = await settle(P, r.key);
    assert.equal(rec.parts[0].status, "done", why(rec));
    assert.equal(seen.length, 1, "the picture step was prepared beside the step that writes its page");
    assert.ok(seen[0].at >= visitEnd, "the picture step was asked before the Visit step finished");
    assert.ok(!seen[0].content.includes("(empty"), "the picture step was not shown the frame as the Visit step left it");
    for (const n of NAMES) assert.ok(P.page(fileOf(n)).includes(BIG(n)), n + " did not land");
    assert.match(P.page("visit.tsx"), /<SafeImage src="\/u\/[^"]+" alt="The bakery's front"/);
    assert.deepEqual(tally, Object.fromEntries(NAMES.map((n) => [n, 1])), JSON.stringify(tally));
    assert.equal(P.imageLog.length, 1);
    once(P);
  });
});

test("SP 2 — PREPARATIONS FINISHING IN REVERSE ORDER: the later the step, the sooner its preparation finishes; every step still writes in its own order, each tweak asked once, every heading lands", { timeout: 60000 }, async () => {
  const plan = {};
  NAMES.forEach((n, i) => { plan[n] = async (c, f) => { await ms(i === 0 ? 900 : 700 - i * 100); return { source: String(f.source).replace("<h1>" + head(n) + "</h1>", BIG(n)) }; }; });
  await six("2", plan, async (P, { tally }) => {
    const r = await sendMessage(P, { message: MSG6 });
    const { rec } = await settle(P, r.key);
    assert.equal(rec.parts[0].status, "done", why(rec));
    for (const n of NAMES) assert.ok(P.page(fileOf(n)).includes(BIG(n)), n);
    assert.deepEqual(tally, Object.fromEntries(NAMES.map((n) => [n, 1])), JSON.stringify(tally));
    once(P);
  });
});

test("SP 3 — A PREPARED STEP ASKS: the fourth step's tweak asks a question while it is prepared; the steps before it write, the job stops on that one question at its turn (asked once, not twice), and after the answer only that step is asked again, shown the answer; every heading lands, nothing charged twice", { timeout: 60000 }, async () => {
  const Q = { text: "Which story heading — the big one at the top?", options: ["Yes", "No"] };
  await six("3", {
    story: async (n, f, args) => {
      if (n <= 2) return /* asks even when told it cannot, after the charge (2026-10-24) */ { source: "", question: Q };
      assert.match(JSON.stringify(args.messages), /Yes/);
      return { source: String(f.source).replace("<h1>" + head("story") + "</h1>", BIG("story")) };
    },
  }, async (P, { tally }) => {
    const r = await sendMessage(P, { message: MSG6 });
    const s1 = await settle(P, r.key);
    const q = P.question();
    assert.ok(q, "no question: " + why(s1.rec));
    assert.equal(tally.story, 2, "the prepared question was not replayed once and told once it cannot ask (2026-10-24)");
    await sendMessage(P, { message: "Yes", ask: { id: q.id, chosen: true } });
    const s2 = await settle(P, r.key);
    assert.equal(s2.rec.parts[0].resume, WORDS("story"), "the answer resumed more than the asking step's change");
    assert.equal(s2.rec.parts[0].status, "done", why(s2.rec));
    for (const n of NAMES) assert.ok(P.page(fileOf(n)).includes(BIG(n)), n + " did not land");
    assert.equal(tally.story, 3);
    assert.deepEqual(tally, { home: 1, menu: 1, visit: 1, story: 3, order: 1, jobs: 1 }, "a step was asked again: " + JSON.stringify(tally));
    once(P);
  }, { resumed: WORDS("story") });
});

test("SP 4 — A PREPARED ANSWER ITS STEP REFUSES: the third step's tweak drops the page's heading text; at its turn the answer is refused exactly as an answer made then would be — asked once, its page untouched — and every other step lands, each asked once", { timeout: 60000 }, async () => {
  const before = PAGES6.find((p) => p.path === "visit.tsx").source;
  await six("4", {
    visit: async (n, f) => ({ source: String(f.source).replace("<h1>" + head("visit") + "</h1>", "<h1 className=\"text-6xl\"></h1>") }),
  }, async (P, { tally }) => {
    const r = await sendMessage(P, { message: MSG6 });
    const { rec } = await settle(P, r.key);
    assert.equal(rec.parts[0].status, "partial", why(rec));
    assert.equal(tally.visit, 1, "the refused answer was asked again");
    assert.ok(!P.page("visit.tsx").includes("text-6xl\"></h1>"), "the refused answer was written");
    for (const n of NAMES.filter((x) => x !== "visit")) assert.ok(P.page(fileOf(n)).includes(BIG(n)), n + " did not land");
    for (const n of NAMES.filter((x) => x !== "visit")) assert.equal(tally[n], 1, n);
    assert.equal(P.page("visit.tsx"), before, "the refused step's page changed");
    once(P);
  });
});

test("SP 5 — DUPLICATE DELIVERY AND RESTART: every queued message delivered twice at once, then every message the request sent delivered again — each tweak asked once, every heading lands once, nothing charged twice", { timeout: 60000 }, async () => {
  await six("5", {}, async (P, { tally }) => {
    const r = await sendMessage(P, { message: MSG6 });
    for (let round = 0; round < 12 && P.queue.length; round++) {
      const msgs = P.queue.splice(0);
      await Promise.all(msgs.flatMap((m) => [deliver(P, m), deliver(P, { ...m, body: JSON.parse(JSON.stringify(m.body)) })]));
    }
    const { rec } = await settle(P, r.key);
    assert.equal(rec.parts[0].status, "done", why(rec));
    for (const m of [...P.sent]) await deliver(P, { ...m, body: JSON.parse(JSON.stringify(m.body)) });
    await settle(P, r.key);
    for (const n of NAMES) assert.equal(P.page(fileOf(n)).split(BIG(n)).length, 2, n);
    assert.deepEqual(tally, Object.fromEntries(NAMES.map((n) => [n, 1])), JSON.stringify(tally));
    once(P);
  });
});

// ── A STEP WAITING ON AN EARLIER ONE STARTS WHEN THAT ONE HAS APPLIED ────────
//
// Codex's review of 4074eb38: the Visit heading and its empty frame are
// changed (step 1), the unrelated Home heading is changed with its model
// answer held (step 2), then a picture is chosen for the Visit page (step 3),
// which reads what step 1 writes. Step 1 finished first, but the picture was
// never prepared: it had been left off the queue when the queue was made, so it
// started only after the Home step. With the Visit step removed and the same
// finished Visit page stored, the picture overlapped Home.
const VISIT_EMPTY = pageSrc("/visit", "<section className=\"band\"><h1>" + head("visit") + "</h1><SafeImage src=\"\" alt=\"The bakery's front\" ratio=\"4/3\" /></section>");
const VISIT_DONE = pageSrc("/visit", "<section className=\"band\"><h1 className=\"text-6xl\">" + head("visit") + "</h1><SafeImage src=\"/u/shop/front.jpg\" alt=\"The bakery's front\" ratio=\"4/3\" /></section>");
const PHOTO_W = "and put a photograph of the bakery's front on the Visit page";
async function visitHomePicture(k, { withVisitStep }) {
  const pages = [{ path: "index.tsx", source: PAGES6[0].source }, { path: "visit.tsx", source: withVisitStep ? VISIT_EMPTY : VISIT_DONE }];
  const log = [];
  const seen = [];
  let release;
  const held = new Promise((r) => { release = r; });
  const tally = {};
  const scopes = [
    ...(withVisitStep ? [{ part: "shape", page: "/visit", words: WORDS("visit") }] : []),
    { part: "shape", page: "/", words: WORDS("home") },
    { part: "images", page: "/visit", words: PHOTO_W },
  ];
  const result = await withPlatform({
    slug: slugOf(k), pages, images: true, balance: 400,
    answers: {
      route: { intent: "edit", layer: "look" },
      [T.pick]: { fields: ["shape", "images"], scopes },
      [T.tweak]: async (args) => {
        const f = shownFile(args);
        const n = nameOfFile(f);
        tally[n] = (tally[n] || 0) + 1;
        log.push("start " + n);
        // THE HOME STEP'S ANSWER IS HELD until the picture is chosen (or 4 s).
        if (n === "home") await Promise.race([held, ms(4000)]);
        log.push("end " + n);
        let src = String(f.source).replace("<h1>" + head(n) + "</h1>", BIG(n));
        if (n === "visit") src = src.replace("src=\"\"", "src=\"/u/shop/front.jpg\"");
        return { source: src };
      },
      choose_pictures: async (args) => {
        log.push("pictures");
        seen.push(String(args.messages[0].content));
        release();
        return { pictures: [{ page: "visit.tsx", alt: "The bakery's front", describe: "the front of a small bakery at dawn" }] };
      },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: (withVisitStep ? "Please " + WORDS("visit") + ", and " : "Please ") + WORDS("home") + ", " + PHOTO_W + "." });
    const { rec } = await settle(P, r.key);
    return { rec, P, page: (f) => P.page(f), images: P.imageLog.length };
  });
  return { ...result, log, seen, tally };
}

test("SP 6 — CODEX'S REPRODUCTION: the picture step waits for the Visit step it reads, and starts the moment that step has applied — overlapping the held, unrelated Home step; it is asked once, shown the frame as the Visit step left it, and every change lands once", { timeout: 60000 }, async () => {
  const r = await visitHomePicture("6", { withVisitStep: true });
  assert.equal(r.rec.parts[0].status, "done", why(r.rec));
  assert.ok(r.log.indexOf("pictures") > r.log.indexOf("end visit"), "the picture step was prepared before the Visit step it reads had applied: " + JSON.stringify(r.log));
  assert.ok(r.log.indexOf("pictures") < r.log.indexOf("end home"), "the picture step waited for the unrelated Home step: " + JSON.stringify(r.log));
  assert.equal(r.seen.length, 1, "the picture step was asked more than once");
  assert.ok(!r.seen[0].includes("(empty"), "the picture step was not shown the frame as the Visit step left it");
  assert.deepEqual(r.tally, { visit: 1, home: 1 });
  assert.ok(r.page("index.tsx").includes(BIG("home")));
  assert.match(r.page("visit.tsx"), /<SafeImage src="\/u\/[^"]+" alt="The bakery's front"/);
  assert.equal(r.images, 1);
});

test("SP 6 control — NO VISIT STEP, THE SAME FINISHED VISIT PAGE STORED: the picture step overlaps the held Home step from the start; asked once; both land", { timeout: 60000 }, async () => {
  const r = await visitHomePicture("6c", { withVisitStep: false });
  assert.equal(r.rec.parts[0].status, "done", why(r.rec));
  assert.ok(r.log.indexOf("pictures") < r.log.indexOf("end home"), JSON.stringify(r.log));
  assert.equal(r.seen.length, 1);
  assert.equal(r.images, 1);
});
