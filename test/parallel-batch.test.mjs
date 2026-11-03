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
  // THE FILE ENDS WHERE THE REQUEST'S CONTEXT BEGINS (2026-10-22, A03-5): a
  // stub that echoed it answered a page that does not parse, which the tweak's
  // syntax check now (rightly) sends to the rewrite.
  let source = rest.slice(close + 2);
  const ctx = source.indexOf("\n\n\n");
  if (ctx >= 0) source = source.slice(0, ctx);
  return { path: rest.slice(0, close), source };
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

test("NET — no request in this file left the machine", () => {
  assert.deepEqual(unexpected().filter((u) => u.by === "blocked"), []);
});

