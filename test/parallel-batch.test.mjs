// ONE MESSAGE, SEVEN TASKS — MORE THAN THE PREPARATION LIMIT (2026-10-09,
// parallel round 5).
//
// The owner: *"run a representative mixed-request integration batch with more
// tasks than the concurrency limit: text, menu, image, page or component
// edits, and additions, including independent tasks, reverse-order
// dependencies, shared-resource conflicts, a clarification and a recoverable
// failure. Prove substantive overlap, every requested change retained,
// successful work reused, correct continuation with the browser closed, and no
// duplicate provider calls, publication or charges."*
//
// THE REAL WORKER — the routing route that accepts the message, the queue
// consumer that runs each part's job and each part's preparation, the edit and
// add-on routes, the request's driver and the cron — against
// `test/fixtures/request-flow.mjs`, whose job table (with the site's lock),
// ledger, bucket and queue keep state as the real ones do. No page is open:
// every step after the message is the queue's or the cron's, except the one
// answer to the clarifying question, which is the customer's own message.
//
// ⚠ SUPPLIED-MODEL, STAND-IN-SERVICE PROOF ONLY. Every model answer is
// supplied by the case and the image service is a stand-in on a wire that
// refuses anything else; nothing here is evidence of what a real model
// answers, of the quality of its work, or of how long anything takes live.

import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, deliver, settle, pump, tick, T } from "./fixtures/request-flow.mjs";
import { blockNetwork, unexpected } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { navSlots } from "../builder/site-nav.mjs";
import { PREP_MAX_LIVE } from "../builder/request.mjs";

blockNetwork();

const slugOf = (k) => "pb-" + k + "-" + Math.random().toString(16).slice(2, 8);
const statuses = (rec) => rec.parts.map((p) => p.status);
const calls = (P, tool) => P.modelLog.filter((m) => m.tool === tool);
const reserveOf = (P, jobId) => P.ledger.filter((e) => e.ref.startsWith(jobId + "#") && e.reason === "reserve").map((e) => -e.delta);

// ── THE SITE: three pages, each with the shared menu ────────────────────────
const NAV = (items) => "<SiteHeader links={[" + items.map(([l, h]) => "{ label: \"" + l + "\", href: \"" + h + "\" }").join(", ") + "]} />";
const MENU = [["Home", "/"], ["Visit", "/visit"], ["About", "/about"]];
const TIKTOK_LINE = "Follow us on TikTok at @oldloaf";
const TIKTOK_TO = "Follow us on TikTok at @harbourloaf";
const HOME_LINE = "Bread from the harbour, every morning.";
const HEAD_FROM = "Harbour Loaf";
const HEAD_TO = "Harbour Loaf Bakery";
const PAGES = [
  { path: "index.tsx", source: pageSrc("/", NAV(MENU) + "<section className=\"hero\"><h1>" + HEAD_FROM + "</h1><SafeImage src=\"\" alt=\"A loaf on the counter\" ratio=\"4/3\" /><p>" + HOME_LINE + "</p></section>") },
  { path: "visit.tsx", source: pageSrc("/visit", NAV(MENU) + "<section className=\"come\"><h1>Come to the bakery</h1><SafeImage src=\"\" alt=\"The shop front\" ratio=\"4/3\" /><p>" + TIKTOK_LINE + "</p></section>") },
  { path: "about.tsx", source: pageSrc("/about", NAV(MENU) + "<section className=\"story\"><h1>Our story</h1><p>Three generations of bakers.</p></section>") },
];
const ABOUT_BIG = "<h1 className=\"text-5xl\">Our story</h1>";

// ── THE SEVEN TASKS, IN THE ORDER THE MESSAGE GIVES THEM ────────────────────
const W = [
  "Change our TikTok link on the Visit page to @harbourloaf", // 0 text      — runs first
  "make a photo of a sourdough loaf for the home page", //        1 picture   — independent of 0: prepared beside it
  "put a link to the gallery in the menu", //                     2 menu      — needs 6's page (REVERSE ORDER)
  "make the home page heading say Harbour Loaf Bakery", //        3 text      — shares the home page with 1 (CONFLICT)
  "add a photo of our shop front to the Visit page", //           4 picture   — shares the Visit page with 0; asks a question (CLARIFICATION)
  "make the heading on the About page bigger", //                 5 page tweak — independent: prepared beside 0 once a slot frees
  "add a gallery page", //                                        6 addition  — creates the page 2 links to
];
const MESSAGE = W[0] + ", " + W.slice(1, -1).join(", ") + ", and " + W[6] + ".";
const TARGETS = [
  { change: 0, writes: ["page:/visit"] },
  { change: 1, writes: ["images", "page:/"] },
  { change: 2, writes: ["menu"], reads: ["page:/gallery"] },
  { change: 3, writes: ["page:/"] },
  { change: 4, writes: ["images", "page:/visit"] },
  { change: 5, writes: ["page:/about"] },
  { change: 6, writes: ["new-page:/gallery"] },
];
// Each part's own routing answer, found by its words — never by call order,
// which the queue decides.
const PART_ROUTE = [
  null,
  { intent: "edit", layer: "picture", page: "/" },
  { intent: "edit", layer: "nav" },
  { intent: "edit", layer: "text", page: "/" },
  { intent: "edit", layer: "picture", page: "/visit" },
  { intent: "edit", layer: "page", page: "/about" },
  { intent: "addon" },
];
const QSHOP = { text: "Should the shop front photo be taken by day or at night?", options: ["By day", "At night"] };
const LOAF_PIC = { pictures: [{ page: "index.tsx", alt: "A loaf on the counter", describe: "a sourdough loaf on a wooden counter" }] };
const SHOP_PIC = { pictures: [{ page: "visit.tsx", alt: "The shop front", describe: "a bakery shop front on a harbour street by day" }] };
const lineId = (args, file, line) => {
  const at = String(args.messages[0].content).split("\n").find((l) => l.includes("[" + file + "] " + line));
  return Number(String(at || "-1.").split(".")[0]);
};
function shownFile(args) {
  const content = String((args && args.messages && args.messages[0] && args.messages[0].content) || "");
  const at = content.indexOf("\n\nTHE FILE (");
  if (at < 0) return null;
  const rest = content.slice(at + "\n\nTHE FILE (".length);
  const close = rest.indexOf(")\n");
  return { path: rest.slice(0, close), source: rest.slice(close + 2) };
}
/** Which task a call is for: the words right after its own heading — never the whole request, which every part's call carries for context. */
const partOf = (text, head) => {
  const at = text.indexOf(head);
  if (at < 0) return -1;
  const own = text.slice(at + head.length).split("\n")[0];
  return W.findIndex((w) => own.startsWith(w));
};
const menus = (P) => navSlots(P.pages().map((path) => ({ path, source: P.page(path) }))).map((m) => m.page + ": " + m.items.map((i) => i.label + " " + i.href).join(" | "));
const PAGE_DESIGN = { path: "/gallery", name: "Gallery", purpose: "what Gallery is for", sections: ["a band"], components: ["section-header"] };

/**
 * THE BATCH'S PLATFORM AND STAND-IN MODEL: every answer found by the task it
 * is for, every substantive call marked on `timeline`. With \`hold\`, the first
 * task's job is held inside its own model call until the independent work has
 * been done beside it (or 4 s, so a serial run fails rather than hangs).
 */
function batchPlatform({ hold = true } = {}) {
  const timeline = [];
  const mark = (what, extra = {}) => timeline.push({ what, t: Date.now(), ...extra });
  const at = (what, part) => timeline.findIndex((e) => e.what === what && (part === undefined || e.part === part));
  // THE FIRST TASK'S JOB IS HELD INSIDE ITS OWN MODEL CALL until the work that
  // does not depend on it has been done beside it: the loaf photograph bought,
  // and the two tasks whose preparation could only start once an earlier one
  // freed its slot routed (or 4 s, so a serial run fails rather than hangs).
  let bought = null, refilled = null;
  const boughtP = new Promise((ok) => { bought = ok; });
  const refilledP = new Promise((ok) => { refilled = ok; });
  const routedParts = new Set();
  // THE RECOVERABLE FAILURE: the loaf photograph is made, and storing it in the
  // library fails on every try of its preparation — the made picture is kept
  // (`generated`) and finished later from the same source, never bought again.
  let storeFails = 0;
  const P = platform({
    slug: slugOf("mix"), pages: PAGES, images: true, balance: 200,
    imageWith: async (e) => { mark("image", { prompt: e.prompt }); if (/sourdough/.test(e.prompt)) bought(); },
    answers: {
      route: (args, n) => {
        const text = String(args.messages[0].content);
        if (n === 0) { mark("route:message"); return { intent: "edit", layer: "text", page: "/visit", alsoAsked: W.slice(1), targets: TARGETS }; }
        const i = partOf(text, "THEIR MESSAGE\n");
        // THE CUSTOMER'S ANSWER to part 4's question, routed as that part.
        if (i < 0 && /^THEIR MESSAGE\nBy day/m.test(text.slice(text.indexOf("THEIR MESSAGE")))) { mark("route:answer", { part: 4 }); return { ...PART_ROUTE[4], answered: true }; }
        mark("route:part", { part: i });
        routedParts.add(i);
        if (routedParts.has(5) && routedParts.has(6)) refilled();
        return PART_ROUTE[i];
      },
      [T.text]: async (args) => {
        const text = String(args.messages[0].content);
        if (text.includes("WHAT THEY ASKED FOR\n" + W[3])) { mark("text:3"); return { edits: [{ id: lineId(args, "index.tsx", HEAD_FROM), to: HEAD_TO }] }; }
        mark("text:0:start");
        const opened = hold ? await Promise.race([Promise.all([boughtP, refilledP]).then(() => true), new Promise((ok) => setTimeout(() => ok(false), 4000))]) : null;
        mark("text:0:end", { opened });
        return { edits: [{ id: lineId(args, "visit.tsx", TIKTOK_LINE), to: TIKTOK_TO }] };
      },
      choose_pictures: (args) => {
        const text = String(args.messages[0].content);
        if (partOf(text, "WHAT THEY ASKED FOR\n") === 1) { mark("pictures:1"); return LOAF_PIC; }
        if (/By day|At night/.test(text)) { mark("pictures:4:answered"); return SHOP_PIC; }
        mark("pictures:4:ask");
        return { pictures: [], question: QSHOP };
      },
      [T.tweak]: (args) => { mark("tweak:5"); const f = shownFile(args); return { source: String(f && f.source).replace("<h1>Our story</h1>", ABOUT_BIG) }; },
      write_nav: () => { mark("nav:2"); return { add: [{ to: "menu", label: "Gallery", href: "/gallery" }] }; },
      [T.adds]: () => { mark("adds:6"); return { kinds: ["page"] }; },
      "add:page": () => { mark("design:6"); return { page: [PAGE_DESIGN] }; },
      [T.pages]: () => { mark("pages:6"); return { pages: [writtenPage("/gallery")] }; },
    },
  });
  // THE RECOVERABLE FAILURE: the loaf photograph's store fails on every try
  // of its preparation (three).
  for (let i = 0; i < 3; i++) P.failPut((k) => k.startsWith("uploads/" + P.slug + "/") && ++storeFails > 0);
  return { P, timeline, at, mark, stores: () => storeFails };
}

/**
 * THE END STATE, WHICHEVER WAY THE QUEUE RAN: every requested change on the
 * site, every model call and purchase made once, each part published at most
 * once, each job charged at most once.
 */
function allKept(P, rec, key, at, timeline) {
  // ── EVERY REQUESTED CHANGE, KEPT ──
  const visit = P.page("visit.tsx"), home = P.page("index.tsx"), about = P.page("about.tsx");
  assert.ok(visit.includes(TIKTOK_TO) && !visit.includes(TIKTOK_LINE), "0: the TikTok link");
  assert.match(home, /<SafeImage src="\/u\/[^"]+\.jpg" alt="A loaf on the counter"/, "1: the loaf photograph");
  assert.ok(home.includes(">" + HEAD_TO + "<") && home.includes(HOME_LINE), "3: the heading, beside the photograph");
  assert.match(visit, /<SafeImage src="\/u\/[^"]+\.jpg" alt="The shop front"/, "4: the shop front photograph");
  assert.ok(about.includes(ABOUT_BIG) && about.includes("Three generations of bakers."), "5: the About heading, its words kept");
  assert.ok(P.pages().includes("gallery.tsx"), "6: the gallery page");
  for (const m of menus(P)) assert.equal((m.match(/Gallery \/gallery/g) || []).length, 1, "2: the menu link, once on every menu: " + m);
  // THE PAGE FIRST, THEN THE LINK — the order the work needs, not the words'.
  assert.ok(at("pages:6") < at("nav:2"), "the menu link's step ran before the page it links to existed");

  // ── NOTHING DONE TWICE ──
  // Routing: the message, each of the six parts once (prepared routings
  // answered to their routing jobs, the uncertain preparation's included),
  // and the customer's answer.
  assert.equal(calls(P, T.route).length, 8, "a routing was asked twice");
  assert.equal(timeline.filter((e) => e.what === "route:part" && e.part === 1).length, 1, "the uncertain preparation's routing was asked again");
  assert.equal(calls(P, T.text).length, 2);
  // The loaf's pictures once (its uncertain preparation's answer reused);
  // the shop's twice: the question, then the answered request.
  assert.equal(timeline.filter((e) => e.what === "pictures:1").length, 1, "the uncertain preparation's picture call was asked again");
  assert.equal(calls(P, "choose_pictures").length, 3);
  for (const tool of [T.tweak, "write_nav", T.adds, T.design, T.pages]) assert.equal(calls(P, tool).length, 1, tool + " was asked more than once");
  // Purchases: one per photograph; the loaf's made picture fetched again
  // from its source to be stored, never asked of the image service again.
  assert.equal(P.imageLog.length, 2, "a photograph was bought twice");
  assert.equal(P.imageLog.filter((e) => /sourdough/.test(e.prompt)).length, 1);
  // Publication: each part's change published at most once; the menu link
  // was already on every menu (the addition put it there), so its part is
  // satisfied with nothing published.
  const js = P.jobsOf(key);
  const published = js.filter((j) => j.published_at);
  assert.equal(published.length, 6, "publishes: " + js.map((j) => j.op + ":" + j.state + ":" + !!j.published_at).join(","));
  const byPart = new Map();
  for (const p of rec.parts) for (const j of p.jobs) byPart.set(j.id, p.n);
  const pubParts = published.map((j) => byPart.get(j.id));
  assert.equal(new Set(pubParts).size, pubParts.length, "a part was published twice: " + JSON.stringify(pubParts));
  assert.ok(!pubParts.includes(2), "the satisfied menu link was published again");
  // Charges: no job charged twice; the photographs billed once each, to the
  // jobs that placed them; the job that asked the question charged nothing.
  for (const j of js) assert.ok(reserveOf(P, j.id).length <= 1, j.op + " charged more than once");
  const photoJobs = js.filter((j) => reserveOf(P, j.id)[0] > 1);
  assert.equal(photoJobs.length, 2, "the photographs were not billed once each: " + js.map((j) => reserveOf(P, j.id)).join("|"));
  for (const l of P.ledger) assert.ok(js.some((j) => l.ref === j.id || l.ref.startsWith(j.id + "#")) || l.ref.startsWith("route:"), "a ledger line no job or routing made: " + l.ref);
}

test("BATCH — seven tasks in one message, more than the preparation limit (3): the independent work is done beside the first task's job and freed slots are refilled; the reverse-order menu link waits for the page it needs; the tasks sharing a page wait for each other; the clarifying question pauses only its task and the answer resumes it; the photograph whose store failed is finished from the same picture — every change kept, every model call and purchase made once, each part published at most once and each job charged at most once, with no page open", async () => {
  const compiler = installCompiler();
  const { P, timeline, at, stores } = batchPlatform();
  try {
    const r = await sendMessage(P, { message: MESSAGE });
    assert.equal(r.status, 200, JSON.stringify(r.body));

    // ── ACCEPTED: seven parts, the first filed, the limit's worth claimed ──
    const rec0 = P.record(r.key);
    assert.equal(rec0.parts.length, 7, "a task was lost from the message");
    assert.ok(W.length > PREP_MAX_LIVE, "the batch is not larger than the preparation limit");
    assert.deepEqual(rec0.parts[2].needs, [6], "the menu link does not wait for the page it links to (reverse order)");
    assert.equal(rec0.parts[2].status, "blocked");
    const claimed0 = rec0.parts.filter((p) => p.prep && p.prep.state === "attempting").map((p) => p.n);
    assert.equal(claimed0.length, PREP_MAX_LIVE, "the preparations claimed at acceptance are not the limit's worth: " + JSON.stringify(claimed0));
    assert.deepEqual(claimed0, [1, 3, 4]);
    assert.equal(rec0.parts[5].prep, null, "a fourth preparation was claimed past the limit");
    assert.equal(rec0.parts[6].prep, null, "a fifth preparation was claimed past the limit");

    // ── THE QUEUE RUNS THE FIRST JOB AND, BESIDE IT, EVERY PREPARATION ──
    const jobMsg = P.queue.find((m) => m.body.kind !== "request-prep");
    P.queue.splice(P.queue.indexOf(jobMsg), 1);
    const running = deliver(P, jobMsg);
    let mostLive = 0;
    const liveNow = () => P.record(r.key).parts.filter((p) => p.prep && (p.prep.state === "attempting" || p.prep.state === "running")).length;
    for (let round = 0; round < 10; round++) {
      await new Promise((ok) => setTimeout(ok, 30));
      mostLive = Math.max(mostLive, liveNow());
      const preps = P.queue.filter((m) => m.body.kind === "request-prep");
      if (!preps.length) break;
      for (const m of preps) P.queue.splice(P.queue.indexOf(m), 1);
      await Promise.all(preps.map((m) => deliver(P, m)));
      mostLive = Math.max(mostLive, liveNow());
    }
    await running;
    // SUBSTANTIVE OVERLAP: while the first task's job sat in its model call,
    // the loaf photograph was chosen AND bought, and five other tasks were
    // routed — two of them only after an earlier preparation freed its slot.
    const end0 = at("text:0:end");
    assert.equal(timeline[end0].opened, true, "the independent work was not done beside the first task's job: " + JSON.stringify(timeline.map((e) => [e.what, e.part])));
    for (const [what, part] of [["pictures:1"], ["image"], ["route:part", 1], ["route:part", 3], ["route:part", 4], ["route:part", 5], ["route:part", 6]]) {
      const k = at(what, part);
      assert.ok(k > at("text:0:start") && k < end0, what + (part === undefined ? "" : " " + part) + " was not done while the first task's job ran");
    }
    assert.ok(mostLive <= PREP_MAX_LIVE, "more preparations than the limit ran at once: " + mostLive);
    // NOT FORCED: three steps wait for an earlier change they read, and each
    // of their preparations stopped at its routing. The About page's tweak
    // reads every page (its writer's fallback is shown them all); the home
    // heading's text step shares the home page with the photograph; the shop
    // photo's step shares the Visit page with the TikTok change.
    const mid = P.record(r.key);
    for (const [n, tool] of [[5, "tweak:5"], [3, "text:3"], [4, "pictures:4:ask"]]) {
      assert.equal(at(tool), -1, tool + " was made beside an unapplied change it reads");
      assert.equal(mid.parts[n].prep && mid.parts[n].prep.outcome, "routed", "part " + n + "'s preparation: " + JSON.stringify(mid.parts[n].prep));
    }
    assert.equal(mid.parts[1].prep.outcome, "uncertain", "the loaf photograph's preparation did not end uncertain on its failed store");

    // ── THE REST, WITH NO PAGE OPEN: the queue and the cron ──
    const s1 = await settle(P, r.key, { rounds: 30 });
    assert.deepEqual(statuses(s1.rec), ["done", "done", "done", "done", "waiting", "done", "done"], JSON.stringify(s1.rec.parts.map((p) => [p.status, p.why, p.prep && p.prep.outcome])));
    // THE RECOVERABLE FAILURE, RECOVERED: the preparation ended uncertain (the
    // picture made, its store failed), and the part's job stored that picture.
    assert.equal(stores(), 3, "the store did not fail as set up");
    assert.equal(s1.rec.parts[1].prep.outcome, "uncertain");
    assert.match(P.page("index.tsx"), /<SafeImage src="\/u\/[^"]+\.jpg" alt="A loaf on the counter"/, "the made loaf photograph was not placed");
    // THE QUESTION PAUSES ONLY ITS TASK: everything else is applied.
    const q = P.question();
    assert.equal(q && q.part, 4);
    assert.equal(q.question.text, QSHOP.text);
    assert.equal(P.imageLog.length, 1, "a photograph was bought before its question was answered, or the loaf was bought again");
    await sendMessage(P, { message: "By day", ask: { id: q.id, chosen: true } });
    const s2 = await settle(P, r.key, { rounds: 30 });
    assert.deepEqual(statuses(s2.rec), Array(7).fill("done"), JSON.stringify(s2.rec.parts.map((p) => [p.status, p.why])));

    allKept(P, s2.rec, r.key, at, timeline);
    await P.settle();
    assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for");
  } finally { P.close(); compiler.uninstall(); }
});

test("BATCH 2 — EVERY MESSAGE DELIVERED TWICE, NO PAGE OPEN: the same seven tasks with the queue redelivering every message (preparations, routing jobs, run jobs, the driver's steps) and only the cron moving the rest — the same end state: every change kept, every model call and purchase once, each part published at most once, each job charged at most once", async () => {
  const compiler = installCompiler();
  const { P, timeline, at, stores } = batchPlatform({ hold: false });
  try {
    const r = await sendMessage(P, { message: MESSAGE });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const run = async () => {
      for (let i = 0; i < 40; i++) {
        if (P.queue.length) { await pump(P, { twice: true }); continue; }
        const rec = P.record(r.key);
        if (!rec || rec.ended || rec.parts.every((p) => ["done", "waiting", "failed", "cancelled"].includes(p.status))) return rec;
        await tick(P);
      }
      return P.record(r.key);
    };
    const s1 = await run();
    assert.equal(stores(), 3, "the store did not fail as set up");
    assert.deepEqual(statuses(s1), ["done", "done", "done", "done", "waiting", "done", "done"], JSON.stringify(s1.parts.map((p) => [p.status, p.why, p.prep && p.prep.outcome])));
    const q = P.question();
    assert.equal(q && q.part, 4);
    await sendMessage(P, { message: "By day", ask: { id: q.id, chosen: true } });
    const s2 = await run();
    assert.deepEqual(statuses(s2), Array(7).fill("done"), JSON.stringify(s2.parts.map((p) => [p.status, p.why])));
    allKept(P, s2, r.key, at, timeline);
    await P.settle();
    assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for");
  } finally { P.close(); compiler.uninstall(); }
});

test("NET — no request in this file left the machine", () => {
  assert.deepEqual(unexpected().filter((u) => u.by === "blocked"), []);
});

