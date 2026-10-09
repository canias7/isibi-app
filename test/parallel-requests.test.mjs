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

test("P1 OVERLAP (Edit + Edit, the owner's example) — the photograph is prepared and BOUGHT while the link part's job is still in its model call; the picture job then answers its call and its picture from that preparation — nothing asked or bought twice, both changes land, each job charged once", async () => {
  // A GATE: the link's text call does not answer until the image service has
  // been asked for the photograph — which can happen only if the picture
  // part's preparation runs while the link part's job is still inside its
  // model call. Run one after the other, the gate opens on its timeout and
  // the case fails.
  let imageAsked = null;
  const asked = new Promise((ok) => { imageAsked = ok; });
  const timeline = [];
  await withPlatform({
    slug: slugOf("p1"), pages: PIC_PAGES, images: true,
    imageWith: async () => { timeline.push(["image", Date.now()]); imageAsked(); },
    answers: {
      route: ROUTE_PIC,
      choose_pictures: PICTURE,
      [T.text]: async (args) => {
        timeline.push(["text:start", Date.now()]);
        const opened = await Promise.race([asked.then(() => true), new Promise((ok) => setTimeout(() => ok(false), 4000))]);
        timeline.push(["text:end", Date.now(), opened]);
        return { edits: [{ id: lineId(args, "visit.tsx", TIKTOK_LINE), to: TIKTOK_TO }] };
      },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: TIKTOK + ", and " + PHOTO + "." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    // ACCEPTED: part 0's job is filed and part 1 claimed for preparation, on the same write.
    const rec0 = P.record(r.key);
    assert.deepEqual(statuses(rec0), ["queued", "ready"]);
    assert.equal(rec0.parts[1].prep && rec0.parts[1].prep.state, "attempting", "part 1 was not claimed for preparation");
    const prepMsgs = P.queue.filter((m) => m.body.kind === "request-prep");
    const jobMsgs = P.queue.filter((m) => m.body.kind !== "request-prep");
    assert.equal(prepMsgs.length, 1);
    assert.equal(jobMsgs.length, 1);
    // THE QUEUE RUNS THEM SIDE BY SIDE: part 0's job, then — while it is
    // inside its model call — part 1's preparation.
    P.queue.splice(0);
    const running = deliver(P, jobMsgs[0]);
    await new Promise((ok) => setTimeout(ok, 50));
    await deliver(P, prepMsgs[0]);
    await running;
    const end = timeline.find((t) => t[0] === "text:end");
    assert.equal(end && end[2], true, "the photograph was not asked for while the link part's job was in its model call: " + JSON.stringify(timeline));
    assert.ok(timeline.findIndex((t) => t[0] === "image") < timeline.findIndex((t) => t[0] === "text:end"));
    // THE REST AS IT COMES.
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why, p.prep])));
    assert.equal(rec.parts[1].prep.outcome, "ready");
    // BOTH CHANGES: the link's words, and the photograph in the home page's frame.
    assert.ok(P.page("visit.tsx").includes(TIKTOK_TO) && !P.page("visit.tsx").includes(TIKTOK_LINE));
    assert.match(P.page("index.tsx"), /<SafeImage src="\/u\/[^"]+\.jpg" alt="A loaf on the counter"/);
    // NOTHING ASKED OR BOUGHT TWICE: the message's routing and part 1's (once,
    // in its preparation; its routing job answered from it), one text call,
    // one picture call, one photograph.
    assert.equal(calls(P, T.route).length, 2, "a routing call was made twice");
    assert.equal(calls(P, T.text).length, 1);
    assert.equal(calls(P, "choose_pictures").length, 1, "the picture call was made twice");
    assert.equal(P.imageLog.length, 1, "the photograph was bought twice");
    // THE JOBS, AND THE MONEY: each job once, each charged once — the picture
    // job for the call and the photograph its preparation made.
    assert.deepEqual(jobLine(P, r.key), ["edit:done", "route:done", "edit:done"]);
    const js = P.jobsOf(r.key);
    for (const j of js) assert.equal(reserveOf(P, j.id).length, 1, j.op + " was not charged exactly once");
    assert.ok(reserveOf(P, js[2].id)[0] > 1, "the photograph was not billed to the picture job: " + JSON.stringify(reserveOf(P, js[2].id)));
    noPrepMoney(P, r.key);
  });
});

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

test("P2 REVERSE ORDER (mixed Edit + Add-on) — the menu link is asked for FIRST and the page it links to second, and the model named no order: the link's part waits for the page because it refers to what that part creates; the page is made, then the link, against the menu as it then is", async () => {
  await withPlatform({
    slug: slugOf("p2"), pages: NAV_PAGES,
    answers: {
      route: [
        // The router names what each change touches and NO dependsOn: the
        // order comes from the link REFERRING to a page the other part CREATES.
        { intent: "edit", layer: "nav", alsoAsked: [ADD_PAGE], targets: [{ change: 0, writes: ["menu"], reads: ["page:/gallery"] }, { change: 1, writes: ["new-page:/gallery"] }] },
        { intent: "addon" },
        { intent: "edit", layer: "nav" },
      ],
      [T.adds]: { kinds: ["page"] }, "add:page": { page: [GALLERY_ON_HOME] }, [T.pages]: { pages: [writtenPage("/gallery")] },
      write_nav: { add: [{ to: "menu", label: "Gallery", href: "/gallery" }] },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: MENU_LINK + ", and " + ADD_PAGE + "." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const rec0 = P.record(r.key);
    // THE LINK'S PART WAITS: it needs the part that creates the page it refers to.
    assert.deepEqual(rec0.parts[0].needs, [1], "the waiting was not found from what each part touches");
    assert.deepEqual(statuses(rec0), ["blocked", "queued"]);
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    // THE PAGE FIRST, THEN THE LINK — the order the work needs, not the words'.
    assert.deepEqual(jobLine(P, r.key), ["route:done", "addon:done", "route:done", "edit:done"]);
    const js = P.jobsOf(r.key);
    assert.ok(js[2].created_at >= js[1].updated_at - 1, "the link's routing ran before the page existed");
    // AND THE LINK'S ROUTING WAS SHOWN THE PAGE THE OTHER PART MADE.
    assert.ok(calls(P, T.route)[2].text.includes("/gallery"), "the re-routed link was not shown the new page");
    assert.ok(P.pages().includes("gallery.tsx"));
    for (const m of menus(P)) assert.match(m, /Gallery \/gallery/, m);
  });
});

// ── SHARED CHANGES ARE COORDINATED ──────────────────────────────────────────

const HEAD_FROM = "Harbour Loaf";
const HEAD_TO = "Harbour Loaf Bakery";
const HEADING = "make the home page heading say Harbour Loaf Bakery";

test("P3 SHARED PAGE — two changes to the same page: the second's ROUTING is prepared beside the first's job (it writes nothing), but its STEP is not prepared while the first is still to be applied, so nothing is asked for nothing; it is then run against the page as the first left it, and BOTH changes are kept", async () => {
  await withPlatform({
    slug: slugOf("p3"),
    answers: {
      route: [
        { intent: "edit", layer: "text", page: "/", alsoAsked: [HEADING], targets: [{ change: 0, writes: ["page:/"] }, { change: 1, writes: ["page:/"] }] },
        { intent: "edit", layer: "text", page: "/" },
      ],
      [T.text]: (args) => (String(args.messages[0].content).includes("WHAT THEY ASKED FOR\n" + HEADING)
        ? { edits: [{ id: lineId(args, "index.tsx", HEAD_FROM), to: HEAD_TO }] }
        : { edits: [{ id: lineId(args, "index.tsx", HOME_LINE_FROM), to: HOME_LINE_TO }] }),
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: OPEN_LINE + ", and " + HEADING + "." });
    const rec0 = P.record(r.key);
    assert.deepEqual(statuses(rec0), ["queued", "ready"]);
    assert.equal(rec0.parts[1].prep && rec0.parts[1].prep.phase, "route", "the second part's routing was not prepared");
    const prep = P.queue.filter((m) => m.body.kind === "request-prep");
    assert.equal(prep.length, 1);
    P.queue.splice(P.queue.indexOf(prep[0]), 1);
    await deliver(P, prep[0]);
    assert.equal(P.record(r.key).parts[1].prep.outcome, "routed", "a step was prepared against a page another part is about to change");
    assert.equal(calls(P, T.text).length, 0, "the preparation asked the text step before the first change was applied");
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    // THE SECOND PART ROUTED ONCE: its routing job answered from the preparation.
    assert.equal(calls(P, T.route).length, 2, "the prepared routing was asked again");
    // BOTH CHANGES ON THE ONE PAGE: neither wrote over the other.
    const home = P.page("index.tsx");
    assert.ok(home.includes(HOME_LINE_TO) && home.includes(">" + HEAD_TO + "<"), home);
    assert.ok(!home.includes(HOME_LINE_FROM));
    // ONE TEXT CALL EACH: none made for a preparation that would have been thrown away.
    assert.equal(calls(P, T.text).length, 2);
    const js = P.jobsOf(r.key);
    for (let i = 1; i < js.length; i++) assert.ok(js[i].created_at >= js[i - 1].updated_at - 1, "a write was started while another was live");
    noPrepMoney(P, r.key);
  });
});

test("P3b SHARED COMPONENT, UNRELATED WORDS — a menu change and a photograph whose words have nothing in common, but the model says both reach the site header: the photograph's step is held back from preparation until the menu change is applied (its routing, which writes nothing, is prepared); without that shared target its step is prepared at once (the control)", async () => {
  for (const shared of [true, false]) {
    await withPlatform({
      slug: slugOf("p3b"), pages: PIC_PAGES, images: true,
      answers: {
        route: [
          { intent: "edit", layer: "nav", alsoAsked: [PHOTO], targets: [{ change: 0, writes: ["menu", ...(shared ? ["component:SiteHeader"] : [])] }, { change: 1, writes: ["images", "page:/", ...(shared ? ["component:SiteHeader"] : [])] }] },
          { intent: "edit", layer: "picture", page: "/" },
        ],
        write_nav: { add: [] }, choose_pictures: PICTURE,
      },
    }, async (P) => {
      const r = await sendMessage(P, { message: "Tidy the menu, and " + PHOTO + "." });
      const prep = P.queue.filter((m) => m.body.kind === "request-prep");
      assert.equal(prep.length, 1, "the photograph's routing was not prepared");
      P.queue.splice(P.queue.indexOf(prep[0]), 1);
      await deliver(P, prep[0]);
      const out = P.record(r.key).parts[1].prep.outcome;
      assert.equal(out, shared ? "routed" : "ready", shared ? "a step sharing a component with an unapplied part was prepared" : "CONTROL: an independent step was not prepared");
      assert.equal(calls(P, "choose_pictures").length, shared ? 0 : 1);
    });
  }
});

test("P1c A PREPARED STEP THAT REFUSES — the photograph's picture step finds nothing it can fill while being prepared: the preparation ends `stopped`, charges nothing and names no job; the part's own job meets the same refusal from the recorded answer and is the one charged, once", async () => {
  await withPlatform({
    slug: slugOf("p1c"), pages: PIC_PAGES, images: true,
    answers: {
      route: ROUTE_PIC,
      choose_pictures: { pictures: [{ page: "index.tsx", alt: "A picture this page does not have", describe: "a sourdough loaf" }] },
      [T.text]: (args) => ({ edits: [{ id: lineId(args, "visit.tsx", TIKTOK_LINE), to: TIKTOK_TO }] }),
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: TIKTOK + ", and " + PHOTO + "." });
    const prep = P.queue.filter((m) => m.body.kind === "request-prep");
    assert.equal(prep.length, 1);
    P.queue.splice(P.queue.indexOf(prep[0]), 1);
    await deliver(P, prep[0]);
    assert.equal(P.record(r.key).parts[1].prep.outcome, "stopped", JSON.stringify(P.record(r.key).parts[1].prep));
    const { rec } = await settle(P, r.key);
    assert.equal(rec.parts[0].status, "done");
    assert.notEqual(rec.parts[1].status, "done", "a refused picture was called done");
    assert.equal(calls(P, "choose_pictures").length, 1, "the refused step's call was made again");
    assert.equal(P.imageLog.length, 0);
    const pic = P.jobsOf(r.key).filter((j) => j.op === "edit").pop();
    assert.equal(reserveOf(P, pic.id).length, 1, "the refusal was not charged to the part's own job, once");
    noPrepMoney(P, r.key);
  });
});

// ── A QUESTION PAUSES ONLY ITS OWN TASK ─────────────────────────────────────

const QPIC = { text: "Should the photo show a whole loaf or a sliced one?", options: ["Whole", "Sliced"] };

test("P4 CLARIFICATION — a photograph whose preparation finds a question is asked FIRST, at no new model cost; the independent change goes on and is applied while it waits; the answer resumes the photograph without the message being sent again, and every call is made once", async () => {
  await withPlatform({
    slug: slugOf("p4"), pages: PIC_PAGES, images: true,
    answers: {
      route: [
        { intent: "edit", layer: "text", page: "/visit", alsoAsked: [PHOTO, OTHER_LINE], targets: [{ change: 0, writes: ["page:/visit"] }, { change: 1, writes: ["images", "page:/"] }, { change: 2, writes: ["page:/"] }] },
        { intent: "edit", layer: "picture", page: "/" },
        { intent: "edit", layer: "text", page: "/" },
        { intent: "edit", layer: "picture", page: "/", answered: true },
      ],
      choose_pictures: (args, n) => (n === 0 ? { pictures: [], question: QPIC } : PICTURE),
      [T.text]: (args) => (String(args.messages[0].content).includes("WHAT THEY ASKED FOR\n" + OTHER_LINE)
        ? { edits: [{ id: lineId(args, "index.tsx", "Bread from the harbour, every morning."), to: "Bread, and a photograph of it." }] }
        : { edits: [{ id: lineId(args, "visit.tsx", TIKTOK_LINE), to: TIKTOK_TO }] }),
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: TIKTOK + ", " + PHOTO + ", and " + OTHER_LINE + "." });
    const s1 = await settle(P, r.key);
    // THE PHOTOGRAPH WAITS ON ITS QUESTION; BOTH TEXT CHANGES ARE APPLIED.
    assert.deepEqual(statuses(s1.rec), ["done", "waiting", "done"], JSON.stringify(s1.rec.parts.map((p) => [p.status, p.why, p.prep && p.prep.outcome])));
    assert.equal(s1.rec.parts[1].prep.outcome, "ask");
    assert.ok(P.page("visit.tsx").includes(TIKTOK_TO));
    assert.ok(P.page("index.tsx").includes("Bread, and a photograph of it."));
    assert.equal(P.imageLog.length, 0, "a photograph was bought before its question was answered");
    // ASKED FIRST: the photograph's job was filed before the third part's, though it came second.
    const ids = s1.rec.parts.map((p) => p.jobs.filter((j) => j.kind === "run").map((j) => j.id));
    const order = P.jobsOf(r.key).filter((j) => j.op === "edit").map((j) => j.id);
    assert.ok(order.indexOf(ids[1][0]) < order.indexOf(ids[2][0]), "the question was not asked before the other part ran");
    // ITS QUESTION, IN THE SITE'S SLOT, FOR PART 1 — asked with the answer its preparation recorded.
    const q = P.question();
    assert.equal(q.part, 1);
    assert.equal(q.question.text, QPIC.text);
    assert.equal(calls(P, "choose_pictures").length, 1, "the question was asked of the model twice");
    // THE ANSWER RESUMES IT: the photograph is made and placed.
    await sendMessage(P, { message: "Whole", ask: { id: q.id, chosen: true } });
    const s2 = await settle(P, r.key);
    assert.deepEqual(statuses(s2.rec), ["done", "done", "done"], JSON.stringify(s2.rec.parts.map((p) => [p.status, p.why])));
    assert.match(P.page("index.tsx"), /<SafeImage src="\/u\/[^"]+\.jpg" alt="A loaf on the counter"/);
    assert.equal(calls(P, "choose_pictures").length, 2);
    assert.equal(P.imageLog.length, 1);
    noPrepMoney(P, r.key);
  });
});

// ── A FAILURE IS RETRIED WITHOUT RUNNING AGAIN WHAT WORKED ──────────────────

const PAST_LEASE = (90 + 60 + 15) * 1000;

test("P5 PARTIAL FAILURE AND RETRY — the photograph's job dies just after its charge: the sweep gives the money back and the part is run once more, answered again from its preparation — no second call, no second photograph — and the link part, already done, is not run again", async () => {
  const { tick } = await import("./fixtures/request-flow.mjs");
  await withPlatform({
    slug: slugOf("p5"), pages: PIC_PAGES, images: true,
    answers: { route: ROUTE_PIC, choose_pictures: PICTURE, [T.text]: (args) => ({ edits: [{ id: lineId(args, "visit.tsx", TIKTOK_LINE), to: TIKTOK_TO }] }) },
  }, async (P) => {
    const r = await sendMessage(P, { message: TIKTOK + ", and " + PHOTO + "." });
    // THE THIRD RESERVE THAT LANDS — the photograph's run job — and then the job is gone.
    let reserves = 0;
    P.hang("edit_reserve", (a, out) => !!out && out.ok === true && out.charged > 0 && ++reserves === 3);
    const p1 = await pump(P);
    assert.equal(p1.hung, "edit_reserve", JSON.stringify(p1));
    P.recover();
    P.advance(PAST_LEASE);
    await tick(P);
    await tick(P);
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    const runs = P.jobsOf(r.key).filter((j) => j.op === "edit");
    // THE LINK'S JOB ONCE; THE PHOTOGRAPH'S TWICE, THE FIRST LOST AND PAID BACK.
    assert.equal(runs.length, 3, runs.map((j) => j.state).join(","));
    assert.equal(runs[1].state, "lost");
    assert.equal(runs[1].billing, "refunded");
    assert.equal(runs[2].state, "done");
    assert.equal(calls(P, "choose_pictures").length, 1, "the retry asked the picture model again");
    assert.equal(P.imageLog.length, 1, "the retry bought the photograph again");
    assert.equal(calls(P, T.text).length, 1, "the finished link part was run again");
    assert.match(P.page("index.tsx"), /<SafeImage src="\/u\/[^"]+\.jpg"/);
    // CHARGED ONCE IN THE END: the lost job's charge came back.
    assert.equal(reserveOf(P, runs[2].id).length, 1);
    assert.deepEqual(P.ledger.filter((e) => e.ref === runs[1].id && e.reason === "refund").map((e) => e.delta), reserveOf(P, runs[1].id));
  });
});

// ── THE BROWSER CLOSED, THE QUEUE DELIVERING TWICE ─────────────────────────

test("P6 REDELIVERY — every queued message delivered twice, no page open: one preparation's calls, one photograph, one publish per part, each job charged once", async () => {
  await withPlatform({
    slug: slugOf("p6"), pages: PIC_PAGES, images: true,
    answers: { route: ROUTE_PIC, choose_pictures: PICTURE, [T.text]: (args) => ({ edits: [{ id: lineId(args, "visit.tsx", TIKTOK_LINE), to: TIKTOK_TO }] }) },
  }, async (P) => {
    const r = await sendMessage(P, { message: TIKTOK + ", and " + PHOTO + "." });
    for (let i = 0; i < 12 && P.queue.length; i++) await pump(P, { twice: true });
    const rec = P.record(r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(calls(P, T.route).length, 2);
    assert.equal(calls(P, "choose_pictures").length, 1, "a redelivered preparation called the model again");
    assert.equal(P.imageLog.length, 1, "a redelivered preparation bought the photograph again");
    assert.equal(calls(P, T.text).length, 1);
    const js = P.jobsOf(r.key);
    assert.deepEqual(js.map((j) => j.op + ":" + j.state), ["edit:done", "route:done", "edit:done"]);
    for (const j of js) assert.equal(reserveOf(P, j.id).length, 1, j.op + " charged more than once");
    assert.equal(js.filter((j) => j.published_at).length, 2, "a part was published twice, or not at all");
  });
});

// ── ADD-ON, BESIDE AN EDIT AND BESIDE ANOTHER ADDITION ─────────────────────

test("P7 MIXED (Edit + Add-on) — the addition's routing is prepared while the edit's job is in its model call; its own work is NOT prepared beside it, because the edit changes a page and the addition's page writer reads the pages (2026-10-09; its work is prepared beside independent tasks: test/parallel-prep-paths.test.mjs); every call is made once", async () => {
  let routedAgain = null;
  const second = new Promise((ok) => { routedAgain = ok; });
  const timeline = [];
  await withPlatform({
    slug: slugOf("p7"), pages: PIC_PAGES,
    answers: {
      route: (args, n) => {
        if (n === 1) { timeline.push(["route2", Date.now()]); routedAgain(); }
        return [
          { intent: "edit", layer: "text", page: "/visit", alsoAsked: [ADD_PAGE], targets: [{ change: 0, writes: ["page:/visit"] }, { change: 1, writes: ["new-page:/gallery"] }] },
          { intent: "addon" },
        ][n];
      },
      [T.text]: async (args) => {
        const opened = await Promise.race([second.then(() => true), new Promise((ok) => setTimeout(() => ok(false), 4000))]);
        timeline.push(["text:end", Date.now(), opened]);
        return { edits: [{ id: lineId(args, "visit.tsx", TIKTOK_LINE), to: TIKTOK_TO }] };
      },
      [T.adds]: { kinds: ["page"] }, "add:page": { page: [PAGE("/gallery", "Gallery")] }, [T.pages]: { pages: [writtenPage("/gallery")] },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: TIKTOK + ", and " + ADD_PAGE + "." });
    const prep = P.queue.filter((m) => m.body.kind === "request-prep");
    const jobs = P.queue.filter((m) => m.body.kind !== "request-prep");
    assert.equal(prep.length, 1, "the addition's routing was not prepared");
    P.queue.splice(0);
    const running = deliver(P, jobs[0]);
    await new Promise((ok) => setTimeout(ok, 50));
    await deliver(P, prep[0]);
    await running;
    assert.equal((timeline.find((t) => t[0] === "text:end") || [])[2], true, "the addition's routing did not run beside the edit's job: " + JSON.stringify(timeline));
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why, p.prep])));
    assert.equal(rec.parts[1].prep.outcome, "routed", "the addition's work was prepared beside a change to a page it reads");
    assert.equal(calls(P, T.route).length, 2, "the addition was routed twice");
    // THE ADDITION'S MODEL WORK, ONCE: made by its own job, against the page as the edit left it.
    assert.equal(calls(P, T.adds).length, 1, "the add-on picker was asked twice");
    assert.equal(calls(P, T.design).length, 1, "the page designer was asked twice");
    assert.equal(calls(P, T.pages).length, 1, "the page writer was asked twice");
    assert.deepEqual(jobLine(P, r.key), ["edit:done", "route:done", "addon:done"]);
    assert.ok(P.page("visit.tsx").includes(TIKTOK_TO));
    assert.ok(P.pages().includes("gallery.tsx"));
    for (const j of P.jobsOf(r.key)) assert.equal(reserveOf(P, j.id).length, 1);
    noPrepMoney(P, r.key);
  });
});

test("P7b ADD-ON + ADD-ON — two additions: the second's routing is NOT prepared while the first is adding a page (its router is shown the page list, which that page changes — prepared then, it would only be asked again); both pages land, every call once", async () => {
  const ADD2 = "add a contact page";
  await withPlatform({
    slug: slugOf("p7b"),
    answers: {
      route: [
        { intent: "addon", alsoAsked: [ADD2], targets: [{ change: 0, writes: ["new-page:/gallery"] }, { change: 1, writes: ["new-page:/contact"] }] },
        { intent: "addon" },
      ],
      [T.adds]: { kinds: ["page"] },
      "add:page": (args, n) => ({ page: [n === 0 ? PAGE("/gallery", "Gallery") : PAGE("/contact", "Contact")] }),
      [T.pages]: [{ pages: [writtenPage("/gallery")] }, { pages: [writtenPage("/contact")] }],
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: "Add a gallery page, and " + ADD2 + "." });
    assert.equal(P.record(r.key).parts[1].prep, null, "a routing was prepared against a page list about to change");
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.ok(P.pages().includes("gallery.tsx") && P.pages().includes("contact.tsx"), P.pages().join(","));
    assert.equal(calls(P, T.route).length, 2);
    assert.deepEqual(jobLine(P, r.key), ["addon:done", "route:done", "addon:done"]);
  });
});

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

test("XR TWO REQUESTS, ONE PAGE — a second message's step prepared while the first message's job is still to change that page: the two requests' jobs never hold the site at once, the stale preparation is not applied (its job asks again and sees the first change), both changes are kept, each job charged once and the preparation never", async () => {
  const P_ = { at: null };
  // The first request's text call is held until released, so the second
  // request's job is delivered while the first job holds the site.
  let started = null; const inA = new Promise((ok) => { started = ok; });
  let release = null; const freed = new Promise((ok) => { release = ok; });
  const db = rowsDb({ tables: { loaves: { columns: LOAF_COLUMNS, rows: BAKERY_LOAVES, next: 12 } }, meta: { schema: JSON.stringify(XR_SPEC) } });
  const jobTextLeased = [];
  await withPlatform({
    slug: slugOf("xr"),
    db,
    answers: {
      route: [
        { intent: "edit", layer: "text", page: "/" },
        { intent: "edit", layer: "data", alsoAsked: [HEADING], targets: [{ change: 0, writes: ["data:loaves"] }, { change: 1, writes: ["page:/"] }] },
        { intent: "edit", layer: "text", page: "/" },
      ],
      write_row_changes: { changes: [{ table: "loaves", id: 2, values: { price: 5.5 } }] },
      [T.text]: (args) => {
        const P = P_.at;
        // How many jobs of this site hold its lock while this call is made.
        jobTextLeased.push([...P.jobs.values()].filter((j) => j.slug === P.slug && j.lease_owner && !["queued", "done", "failed", "cancelled", "lost"].includes(j.state)).length);
        const content = String(args.messages[0].content);
        if (content.includes("WHAT THEY ASKED FOR\n" + HEADING)) return { edits: [{ id: lineId(args, "index.tsx", HEAD_FROM), to: HEAD_TO }] };
        started();
        return freed.then(() => ({ edits: [{ id: lineId(args, "index.tsx", HOME_LINE_FROM), to: HOME_LINE_TO }] }));
      },
    },
  }, async (P) => {
    P_.at = P;
    // THE FIRST MESSAGE: one change to the home page. Its job is filed, not run.
    const a = await sendMessage(P, { message: OPEN_LINE + "." });
    assert.equal(a.status, 200, JSON.stringify(a.body));
    assert.deepEqual(statuses(P.record(a.key)), ["queued"]);
    const aJob = P.queue.filter((m) => m.body.kind !== "request-prep");
    assert.equal(aJob.length, 1);
    P.queue.splice(0);
    // THE SECOND MESSAGE, sent while the first is still to run: a price, and
    // a home heading change, whose page nothing earlier in ITS OWN request
    // writes — so its step is prepared at once.
    const b = await sendMessage(P, { message: RYE + ", and " + HEADING + "." });
    assert.equal(b.status, 200, JSON.stringify(b.body));
    assert.notEqual(b.key, a.key);
    const prep = P.queue.filter((m) => m.body.kind === "request-prep");
    assert.equal(prep.length, 1, "the second request's other part was not claimed for preparation");
    P.queue.splice(P.queue.indexOf(prep[0]), 1);
    await deliver(P, prep[0]);
    assert.equal(P.record(b.key).parts[1].prep.outcome, "ready", "the step was not prepared");
    assert.equal(P.page("index.tsx").includes(HEAD_TO), false, "the preparation wrote the page");
    assert.equal(calls(P, T.text).length, 1, "the preparation made no text call");
    // THE LOCK DECIDES: the first request's job runs and is held inside its
    // model call; the second request's job, delivered meanwhile, is deferred
    // by the site's lock and runs nothing.
    const running = deliver(P, aJob[0]);
    await inA;
    const bJob = P.queue.filter((m) => m.body.kind !== "request-prep");
    assert.equal(bJob.length, 1, "the second request's first job was not filed");
    P.queue.splice(P.queue.indexOf(bJob[0]), 1);
    await deliver(P, bJob[0]);
    const bRow = P.jobsOf(b.key)[0];
    assert.ok(bRow.deferrals >= 1, "the second request's job was not deferred while the first held the site: " + JSON.stringify({ state: bRow.state, deferrals: bRow.deferrals }));
    assert.equal(Number(db.rows("loaves").find((r) => r.id === 2).price) === 5.5, false, "the second request's job ran while the first held the site");
    release();
    await running;
    const ra = await settle(P, a.key);
    const rb = await settle(P, b.key);
    assert.deepEqual(statuses(ra.rec), ["done"], JSON.stringify(ra.rec.parts.map((p) => [p.status, p.why])));
    assert.deepEqual(statuses(rb.rec), ["done", "done"], JSON.stringify(rb.rec.parts.map((p) => [p.status, p.why])));
    // THE LOCK: no job's text call was made while another job of the site held it.
    assert.ok(jobTextLeased.length >= 3, "the check saw too few calls: " + jobTextLeased.length);
    assert.ok(jobTextLeased.every((n) => n <= 1), "two jobs held the site at once: " + JSON.stringify(jobTextLeased));
    assert.ok(jobTextLeased.includes(1), "no text call was seen inside a job — the check saw nothing");
    // THE STALE PREPARATION WAS NOT APPLIED: the heading's job asked again, and
    // what it was shown carried the first request's change.
    const heading = calls(P, T.text).filter((m) => String(m.text).includes("WHAT THEY ASKED FOR\n" + HEADING));
    assert.equal(heading.length, 2, "the heading was not asked again after the page changed under it");
    assert.equal(String(heading[0].text).includes(HOME_LINE_TO), false, "the preparation already saw the first change — not the case under test");
    assert.ok(String(heading[1].text).includes(HOME_LINE_TO), "the heading's job was not shown the page as the first request left it");
    // BOTH CHANGES KEPT on the shared page, and the price.
    const home = P.page("index.tsx");
    assert.ok(home.includes(HOME_LINE_TO) && home.includes(">" + HEAD_TO + "<"), home);
    assert.ok(!home.includes(HOME_LINE_FROM));
    assert.equal(Number(db.rows("loaves").find((r) => r.id === 2).price), 5.5, "the price was not changed");
    // MONEY: one routing charge per message; each job reserved once; nothing
    // charged under a job that was never filed.
    for (const k of [a.key, b.key]) assert.equal(P.ledger.filter((e) => e.ref.startsWith("route:") && e.ref.endsWith(":" + k)).length, 1, "the routing charge for " + k);
    for (const j of [...P.jobsOf(a.key), ...P.jobsOf(b.key)]) assert.ok(reserveOf(P, j.id).length <= 1, "a job reserved twice: " + j.id);
    noPrepMoney(P, b.key);
  });
});

test("NET — no request in this file left the machine", () => {
  assert.deepEqual(unexpected().filter((u) => u.by === "blocked"), []);
});
