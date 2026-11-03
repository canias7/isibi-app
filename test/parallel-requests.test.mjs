// ONE MESSAGE, SEVERAL TASKS, RUN SIDE BY SIDE WHERE THEY CAN BE (2026-10-08,
// the parallel-tasks batch).
//
// The owner: *"one user message can contain multiple tasks, independent tasks
// run concurrently, and tasks wait only when they need another task's result
// or would conflict with its changes."* These cases run the REAL Worker — the
// routing route that accepts the message, the queue consumer that runs each
// part's job and each part's preparation, the edit and add-on routes, the
// request's driver — against `test/fixtures/request-flow.mjs`, whose
// `edit_jobs` (with the site's lock), ledger, bucket and queue keep state as
// the real ones do. What each case checks is what happened: the site's pages,
// the request record and every job row, every model call made and when, and
// every ledger row.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY. Every model answer is supplied by the case;
// nothing here is evidence of what a real model answers, or of how long it
// takes.

import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, pump, deliver, settle, T, newKey } from "./fixtures/request-flow.mjs";
import { blockNetwork, unexpected } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import { HOME, VISIT, page as pageSrc } from "./fixtures/live-ask.mjs";
import { navSlots } from "../builder/site-nav.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "./fixtures/rows-db.mjs";

blockNetwork();

const slugOf = (k) => "pr-" + k + "-" + Math.random().toString(16).slice(2, 8);
async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  // (2026-10-09, round 4) the case ends once its background work settled
  // with the stand-ins in place, and asked for nothing they were not set up for.
  try { const out = await fn(P); await P.settle(); assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for"); return out; } finally { P.close(); compiler.uninstall(); }
}
const statuses = (rec) => rec.parts.map((p) => p.status);
const jobLine = (P, key) => P.jobsOf(key).map((j) => j.op + ":" + j.state);
const reserveOf = (P, jobId) => P.ledger.filter((e) => e.ref.startsWith(jobId + "#") && e.reason === "reserve").map((e) => -e.delta);
const calls = (P, tool) => P.modelLog.filter((m) => m.tool === tool);
/**
 * A PREPARATION TOUCHES NO MONEY AND NO JOB: every database call made while
 * the case ran names a job that was filed — a preparation that reserved,
 * charged, beat or wrote a phase under its own id would name one that never
 * was — and the ledger holds no line but a filed job's or the message's own
 * routing charge. Alive only when the case made such calls at all.
 */
function noPrepMoney(P, key) {
  const ids = new Set(P.jobs.keys());
  let seen = 0;
  for (const e of P.rpcLog) {
    const id = e.args && (e.args.p_id || e.args.p_job_id);
    if (typeof id !== "string") continue;
    seen++;
    assert.ok(ids.has(id), e.fn + " named a job that was never filed: " + id);
  }
  assert.ok(seen > 0, "no call named a job — the check saw nothing");
  for (const l of P.ledger) assert.ok([...ids].some((id) => l.ref === id || l.ref.startsWith(id + "#")) || l.ref.startsWith("route:"), "a ledger line no filed job or routing made: " + l.ref + " (" + l.reason + ")");
}

// THE OWNER'S OWN EXAMPLE: a photograph made for the home page and the TikTok
// link changed on the Visit page — independent: the link's step never reads
// the pictures, and the picture's step never reads the words.
const HOME_PIC = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1><SafeImage src=\"\" alt=\"A loaf on the counter\" ratio=\"4/3\" /><p>Bread from the harbour, every morning.</p></section>");
const TIKTOK_LINE = "Follow us on TikTok at @oldloaf";
const VISIT_TT = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>" + TIKTOK_LINE + "</p></section>");
const PIC_PAGES = [{ path: "index.tsx", source: HOME_PIC }, { path: "visit.tsx", source: VISIT_TT }];
const TIKTOK = "Change our TikTok link on the Visit page to @harbourloaf";
const PHOTO = "make a photo of a sourdough loaf for the home page";
const TIKTOK_TO = "Follow us on TikTok at @harbourloaf";
const PICTURE = { pictures: [{ page: "index.tsx", alt: "A loaf on the counter", describe: "a sourdough loaf on a wooden counter" }] };
/** The text step's answer: the line its request lists for that page, changed. */
const lineId = (args, file, line) => {
  const at = String(args.messages[0].content).split("\n").find((l) => l.includes("[" + file + "] " + line));
  return Number(String(at || "-1.").split(".")[0]);
};
const ROUTE_PIC = [
  { intent: "edit", layer: "text", page: "/visit", alsoAsked: [PHOTO], targets: [{ change: 0, writes: ["page:/visit"] }, { change: 1, writes: ["images", "page:/"] }] },
  { intent: "edit", layer: "picture", page: "/" },
];

const HOME_LINE_FROM = "Bread from the harbour, every morning.";
const HOME_LINE_TO = "Open from 8 every morning.";
const OPEN_LINE = "Change the opening line on the home page to say we open at 8";
const OTHER_LINE = "make the home page's opening line mention the photograph";

// ── DEPENDENCY ORDER WHEN THE MESSAGE NAMES THE TASKS BACKWARDS (Edit + Add-on) ──

const NAV = (items) => "<SiteHeader links={[" + items.map(([l, h]) => "{ label: \"" + l + "\", href: \"" + h + "\" }").join(", ") + "]} />";
const MENU = [["Home", "/"], ["Visit", "/visit"]];
const NAV_PAGES = [
  { path: "index.tsx", source: pageSrc("/", NAV(MENU) + "<section className=\"hero\"><h1>Harbour Loaf</h1><p>Bread from the harbour, every morning.</p></section>") },
  { path: "visit.tsx", source: pageSrc("/visit", NAV(MENU) + "<section className=\"come\"><h1>Come to the bakery</h1><p>The shutters and the street.</p></section>") },
];
const menus = (P) => navSlots(P.pages().map((path) => ({ path, source: P.page(path) }))).map((m) => m.page + ": " + m.items.map((i) => i.label + " " + i.href).join(" | "));
const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });
const GALLERY_ON_HOME = { ...PAGE("/gallery", "Gallery"), link: { in: "page", page: "/", where: "a button in the hero band" } };
const MENU_LINK = "Put a link to the gallery in the menu";
const ADD_PAGE = "add a gallery page";

// ── SHARED CHANGES ARE COORDINATED ──────────────────────────────────────────

const HEAD_FROM = "Harbour Loaf";
const HEAD_TO = "Harbour Loaf Bakery";
const HEADING = "make the home page heading say Harbour Loaf Bakery";

// ── A QUESTION PAUSES ONLY ITS OWN TASK ─────────────────────────────────────

const QPIC = { text: "Should the photo show a whole loaf or a sliced one?", options: ["Whole", "Sliced"] };

// ── A FAILURE IS RETRIED WITHOUT RUNNING AGAIN WHAT WORKED ──────────────────

const PAST_LEASE = (90 + 60 + 15) * 1000;

// ── BUILD: THE DESIGNER'S OWN GRAPH ─────────────────────────────────────────

test("P8 BUILD — a first build's design runs as a graph through the real build route: agents that need nothing are in flight together, and each agent that needs another starts only after it has answered", async () => {
  const { driveBuild, GOOD_DESIGN } = await import("./fixtures/build-route.mjs");
  const spans = new Map();
  let live = 0, most = 0;
  const r = await driveBuild({
    body: { brief: "Harbour Loaf, a bakery in Leeds.", images: [], qa: [], chat: "c" },
    env: { DESIGN_GRAPH_EVERYONE: "1" },
    design: async (n, b) => {
      const fields = Object.keys(b.tools[0].input_schema.properties).filter((k) => k !== "question");
      const name = fields.join("+");
      const span = { start: Date.now(), end: 0 };
      spans.set(name, span);
      live++; most = Math.max(most, live);
      await new Promise((ok) => setTimeout(ok, 30));
      live--;
      span.end = Date.now();
      return { input: Object.fromEntries(fields.filter((k) => Object.hasOwn(GOOD_DESIGN, k)).map((k) => [k, GOOD_DESIGN[k]])) };
    },
  });
  assert.equal(r.reply.slug, "harbour-loaf", JSON.stringify(r.reply).slice(0, 300));
  assert.ok(spans.size > 4, "the graph did not run: " + [...spans.keys()].join(" | "));
  assert.ok(most >= 2, "no two design agents were ever in flight together");
  const find = (field) => [...spans.entries()].find(([k]) => k.split("+").includes(field));
  for (const [after, before] of [["wordmark", "brand"], ["css", "theme"], ["shape", "components"], ["behavior", "shape"]]) {
    const a = find(after), b = find(before);
    if (!a || !b) continue;
    assert.ok(a[1].start >= b[1].end, after + " started before " + before + " had answered");
  }
});

// TWO MESSAGES, TWO REQUESTS, ONE PAGE (2026-10-09, the readiness review).
// Every case above is one message. A customer can send a second message
// while the first is still running; each is its own request with its own
// driver, and a preparation checks only its own request's earlier parts. So
// the second request's step can be prepared against a page the first request
// is about to change. What must hold: the site's lock keeps the two
// requests' writes one at a time; the stale preparation is never applied (its
// request differs from the one the job makes, so the job asks again against
// the page as the first request left it); both changes are kept; each job is
// charged once and the preparation not at all.
const XR_SPEC = { tables: [{ name: "loaves", columns: [{ name: "name", type: "text" }, { name: "description", type: "text" }, { name: "price", type: "numeric" }, { name: "photo", type: "text" }], read: "public", write: "none" }] };
const RYE = "make the Dark Rye £5.50";

test("NET — no request in this file left the machine", () => {
  assert.deepEqual(unexpected().filter((u) => u.by === "blocked"), []);
});
