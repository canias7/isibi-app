// THE PARALLEL WORK'S MISSING OFFLINE COVERAGE (2026-10-11, the evidence
// reconciliation after the duplicate-execution rounds). Each case is one the
// existing files did not hold, through the real request driver, queue
// consumer and routes (`test/fixtures/request-flow.mjs`), every model answer
// supplied and NO image bought:
//
//   PC 1  run 119's shape offline, judged by the recorded intervals alone: a
//         stored row's change (a non-image model call) prepared INSIDE another
//         part's executing text job;
//   PC 2  TWO substantive non-image steps of different parts (a row change and
//         a table rule) prepared at once, inside a third part's job, each
//         holding its call until the other's has begun;
//   PC 3  a dependent part kept still WHILE its prerequisite's job is held
//         mid-call — no preparation, no routing, no step — and run only after;
//   PC 4  a row-change preparation delivered twice at once — one call, one
//         change, one charge per job;
//   PC 5  a row-change preparation whose consumer dies inside its call,
//         recovered by the cron alone (no browser, no message from anyone) —
//         the job answered from the recovered preparation, never asking again.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY: nothing here shows what a real model answers,
// how long it takes, or that it runs this way on the platform.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, deliver, settle, call, T } from "./fixtures/request-flow.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import { navSlots } from "../builder/site-nav.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "./fixtures/rows-db.mjs";
import { overlapVerdict } from "../scripts/canary-requests.mjs";

blockNetwork();

const slugOf = (k) => "pc-" + k + "-" + Math.random().toString(16).slice(2, 8);
async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try { const out = await fn(P); await P.settle(); assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for"); return out; } finally { P.close(); compiler.uninstall(); }
}
const calls = (P, tool) => P.modelLog.filter((m) => m.tool === tool);
const statuses = (rec) => rec.parts.map((p) => p.status);
const reserveOf = (P, jobId) => P.ledger.filter((e) => e.ref.startsWith(jobId + "#") && e.reason === "reserve").map((e) => -e.delta);
const gate = () => { let open; const p = new Promise((r) => { open = r; }); return { p, open }; };
const within = (p, ms = 4000) => Promise.race([p, new Promise((ok) => setTimeout(ok, ms))]);
const lineId = (args, file, line) => {
  const at = String(args.messages[0].content).split("\n").find((l) => l.includes("[" + file + "] " + line));
  return Number(String(at || "-1.").split(".")[0]);
};
const viewOf = async (P, key) => {
  const v = await call(P, "GET", "/api/site/request/" + P.slug + "/" + key);
  assert.equal(v.status, 200, JSON.stringify(v.body));
  return v.body.request;
};
const asSteps = (key, final) => [{ sent: true, request: { key, final } }];
const take = (P, kind) => { const ms = P.queue.filter((m) => m.body.kind === kind); for (const m of ms) P.queue.splice(P.queue.indexOf(m), 1); return ms; };
const jobsQueued = (P) => P.queue.filter((m) => m.body.kind !== "request-prep" && m.body.kind !== "edit-progress");

const HEAD_FROM = "Come to the bakery";
const HEAD_TO = "Come to the harbour bakery";
const VISIT = pageSrc("/visit", "<section className=\"come\"><h1>" + HEAD_FROM + "</h1><p>We are on Harbour Street.</p></section>");
const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1><p>Bread from the harbour, every morning.</p></section>");
const PAGES = [{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }];
const HEADING = "make the Visit page heading say Come to the harbour bakery";
const RYE = "make the Dark Rye £5.50";
const HOURS_WORDS = "open the bakery at 8 on Mondays";
const MEMBERS = "let signed-in members add loaves";

const LOAVES = { name: "loaves", columns: [{ name: "name", type: "text" }, { name: "description", type: "text" }, { name: "price", type: "numeric" }, { name: "photo", type: "text" }], read: "public", write: "none" };
const HOURS = { name: "hours", columns: [{ name: "day", type: "text" }, { name: "opens", type: "text" }], read: "public", write: "none" };
const HOUR_ROWS = [{ id: 1, day: "Monday", opens: "09:00", created_at: "2026-08-21 23:06:22" }];
const HOUR_COLUMNS = [{ name: "id", type: "integer" }, { name: "day", type: "text" }, { name: "opens", type: "text" }, { name: "created_at", type: "timestamp with time zone" }];
const bakeryDb = (withHours = false) => rowsDb({
  tables: { loaves: { columns: LOAF_COLUMNS, rows: BAKERY_LOAVES, next: 12 }, ...(withHours ? { hours: { columns: HOUR_COLUMNS, rows: HOUR_ROWS } } : {}) },
  meta: { schema: JSON.stringify({ tables: withHours ? [LOAVES, HOURS] : [LOAVES] }) },
});
const rye = (db) => Number(db.rows("loaves").find((l) => l.id === 2).price);
const RYE_CHANGE = { changes: [{ table: "loaves", id: 2, values: { price: 5.5 } }] };
const HEADING_ROUTE = (others) => ({ intent: "edit", layer: "text", page: "/visit", alsoAsked: others.map((o) => o.words), targets: [{ change: 0, writes: ["page:/visit"] }, ...others.map((o, i) => ({ change: i + 1, writes: o.writes }))] });
const headingEdit = (args) => ({ edits: [{ id: lineId(args, "visit.tsx", HEAD_FROM), to: HEAD_TO }] });

test("PC 1 — RUN 119'S SHAPE, OFFLINE, BY INTERVALS: the Visit heading's text job held inside its model call while the Dark Rye's row change is prepared — the view's recorded intervals put the row-change step (one model call) inside the heading job's run, the canary's verdict passes on them alone, and the job answers the row change from the preparation: one call, the row changed once, by its own job", async () => {
  const db = bakeryDb();
  const headingHeld = gate();
  await withPlatform({
    slug: slugOf("p1"), pages: PAGES, db, progress: true,
    answers: {
      route: [HEADING_ROUTE([{ words: RYE, writes: ["data:loaves"] }]), { intent: "edit", layer: "data" }],
      [T.text]: async (args) => { await within(headingHeld.p); await new Promise((ok) => setTimeout(ok, 30)); return headingEdit(args); },
      write_row_changes: () => { headingHeld.open(); return RYE_CHANGE; },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: HEADING + ", and " + RYE + "." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const preps = take(P, "request-prep");
    const jobs = jobsQueued(P);
    assert.equal(preps.length, 1, "the row change was not claimed for preparation");
    assert.equal(jobs.length, 1);
    P.queue.splice(P.queue.indexOf(jobs[0]), 1);
    const running = deliver(P, jobs[0]);
    await new Promise((ok) => setTimeout(ok, 50));
    await deliver(P, preps[0]);
    assert.equal(rye(db), 5.2, "the preparation changed the row");
    await running;
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.ok(P.page("visit.tsx").includes(HEAD_TO), "the heading change was lost");
    assert.equal(rye(db), 5.5, "the row change was lost");
    assert.equal(calls(P, "write_row_changes").length, 1, "the row change was asked again by its job");
    assert.equal(P.imageLog.length, 0);
    for (const j of P.jobsOf(r.key)) assert.ok(reserveOf(P, j.id).length <= 1, j.op + " charged more than once");
    const view = await viewOf(P, r.key);
    const st = view.parts[1].prepRun && view.parts[1].prepRun.step;
    assert.ok(st && st.calls === 1, "the row change's preparation step is not recorded with its one call: " + JSON.stringify(view.parts[1].prepRun));
    const run0 = view.parts[0].runs[0];
    assert.ok(st.from >= run0.from && st.to <= run0.to, "the row-change step is not inside the heading job's run: " + JSON.stringify({ st, run0 }));
    const v = overlapVerdict(asSteps(r.key, view));
    assert.equal(v.ok, true, v.why);
    assert.deepEqual(v.overlaps.map((o) => [o.prepPart, o.runPart]), [[1, 0]]);
  });
});

// TWO DATA-LAYER STEPS ARE NEVER PREPARED TOGETHER, by design: a row change's
// and a rule's step both read every table (`stepInputs` → "data"), which any
// earlier `data:` write feeds (`builder/request-plan.mjs`). The two
// substantive non-image steps that CAN be prepared side by side inside one job
// are, for instance, a look lane and a menu change beside a row-change job.
const NAV = (items) => "<SiteHeader links={[" + items.map(([l, h]) => "{ label: \"" + l + "\", href: \"" + h + "\" }").join(", ") + "]} />";
const NAV_PAGES = [
  { path: "index.tsx", source: pageSrc("/", NAV([["Home", "/"]]) + "<section className=\"hero\"><h1>Harbour Loaf</h1><p>Bread from the harbour, every morning.</p></section>") },
  { path: "visit.tsx", source: pageSrc("/visit", NAV([["Home", "/"]]) + "<section className=\"come\"><h1>Come to the bakery</h1><p>We are on Harbour Street.</p></section>") },
];
const DESC = "change the site description to say we bake overnight sourdough";
const NEW_DESC = "Overnight sourdough from a Bristol side street.";
const MENU_ADD = "put the Visit page in the menu as Find us";
const siteObjectsWith = (P, text) => [...P.objects.entries()].filter(([k, o]) => !/^(requests|jobs)\//.test(k) && typeof o.body === "string" && o.body.includes(text)).map(([k]) => k);

test("PC 2 — TWO SUBSTANTIVE NON-IMAGE STEPS AT ONCE: inside the Dark Rye's held row-change job, the site description's look lane and the menu change are both prepared, each holding its own model call until the other's has begun — the recorded intervals of the two steps intersect each other and the row-change job's run; each job answers from its preparation (one call each), nothing of either is written before its own job, and all three changes are kept", async () => {
  const db = bakeryDb();
  const lookIn = gate(), navIn = gate(), rowHeld = gate();
  let both = 0;
  const bothIn = () => { if (++both === 2) rowHeld.open(); };
  await withPlatform({
    slug: slugOf("p2"), pages: NAV_PAGES, db, progress: true,
    answers: {
      route: [
        { intent: "edit", layer: "data", alsoAsked: [DESC, MENU_ADD], targets: [{ change: 0, writes: ["data:loaves"] }, { change: 1, writes: ["identity"] }, { change: 2, writes: ["menu"] }] },
        { intent: "edit", layer: "look" },
        { intent: "edit", layer: "nav" },
      ],
      write_row_changes: async () => { await within(rowHeld.p); await new Promise((ok) => setTimeout(ok, 30)); return RYE_CHANGE; },
      [T.pick]: async () => { lookIn.open(); bothIn(); await within(navIn.p); await new Promise((ok) => setTimeout(ok, 20)); return { fields: ["description"], scopes: [{ part: "description", words: DESC }] }; },
      "lane:description": NEW_DESC,
      write_nav: async () => { navIn.open(); bothIn(); await within(lookIn.p); await new Promise((ok) => setTimeout(ok, 20)); return { add: [{ to: "menu", label: "Find us", href: "/visit" }] }; },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: RYE + ", " + DESC + ", and " + MENU_ADD + "." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const preps = take(P, "request-prep");
    const jobs = jobsQueued(P);
    assert.equal(preps.length, 2, "both independent steps were not claimed for preparation: " + JSON.stringify(P.record(r.key).parts.map((p) => [p.status, p.prep && p.prep.state])));
    P.queue.splice(P.queue.indexOf(jobs[0]), 1);
    const running = deliver(P, jobs[0]);
    await new Promise((ok) => setTimeout(ok, 50));
    await Promise.all(preps.map((m) => deliver(P, m)));
    assert.equal(both, 2, "both steps did not reach their model calls: " + JSON.stringify(P.record(r.key).parts.map((p) => p.prep && [p.prep.outcome, p.prep.calls])));
    assert.deepEqual(siteObjectsWith(P, NEW_DESC), [], "the look's preparation stored the description");
    assert.ok(!P.page("index.tsx").includes("Find us"), "the menu's preparation wrote the menu");
    await running;
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(rye(db), 5.5, "the row change was lost");
    assert.ok(siteObjectsWith(P, NEW_DESC).length > 0, "the description change was lost");
    for (const m of navSlots(P.pages().map((path) => ({ path, source: P.page(path) })))) assert.ok(m.items.some((i) => i.label === "Find us" && i.href === "/visit"), "the menu change was lost on " + m.page);
    assert.equal(calls(P, T.pick).length, 1, "the look's picker was asked again");
    assert.equal(calls(P, T.lane).length, 1, "the description lane was asked again");
    assert.equal(calls(P, "write_nav").length, 1, "the menu step was asked again");
    assert.equal(calls(P, "write_row_changes").length, 1);
    assert.equal(P.imageLog.length, 0);
    for (const j of P.jobsOf(r.key)) assert.ok(reserveOf(P, j.id).length <= 1, j.op + " charged more than once");
    const view = await viewOf(P, r.key);
    // EVERY ATTEMPT OF A PART (`prepRuns` when it kept more than one): the menu
    // part is prepared again once its routing ran; that attempt replays the
    // first one's answer — counted as replayed, never as a model call.
    const attempts = (p) => (Array.isArray(p.prepRuns) ? p.prepRuns : [p.prepRun]).filter(Boolean);
    const modelStep = (p) => attempts(p).map((x) => x.step).find((st) => st && st.calls > 0);
    const a = modelStep(view.parts[1]), b = modelStep(view.parts[2]);
    assert.ok(a && b, "a preparation step with its model call is not recorded: " + JSON.stringify([view.parts[1], view.parts[2]].map(attempts)));
    // THE MODEL CALLS THE ATTEMPTS COUNT ARE THE ONES MADE: the look's two (its
    // lane picker and its description lane), the menu's one.
    const counted = (p) => attempts(p).reduce((k, x) => k + ((x.step && x.step.calls) || 0), 0);
    assert.equal(counted(view.parts[1]), 2, "the look's attempts count other than its two model calls");
    assert.equal(counted(view.parts[2]), 1, "the menu's attempts count other than its one model call");
    const again = attempts(view.parts[2]).filter((x) => x.step && x.step.calls === 0);
    for (const x of again) assert.ok(x.step.replayed >= 1, "a replayed step does not say it replayed");
    assert.ok(a.from < b.to && b.from < a.to, "the two prepared steps did not run at the same time: " + JSON.stringify({ a, b }));
    const run0 = view.parts[0].runs[0];
    for (const st of [a, b]) assert.ok(st.from < run0.to && run0.from < st.to, "a prepared step did not run during the row-change job: " + JSON.stringify({ st, run0 }));
    const v = overlapVerdict(asSteps(r.key, view));
    assert.equal(v.ok, true, v.why);
    assert.deepEqual(v.overlaps.map((o) => o.prepPart).sort(), [1, 2]);
  });
});

// ── PC 3: A DEPENDENT KEPT STILL WHILE ITS PREREQUISITE RUNS ─────────────────

const MENU_PAGES = [
  { path: "index.tsx", source: pageSrc("/", NAV([["Home", "/"], ["Visit", "/visit"]]) + "<section className=\"hero\"><h1>Harbour Loaf</h1><p>Bread from the harbour, every morning.</p></section>") },
  { path: "visit.tsx", source: pageSrc("/visit", NAV([["Home", "/"], ["Visit", "/visit"]]) + "<section className=\"come\"><h1>Come to the bakery</h1><p>The shutters and the street.</p></section>") },
];
const GALLERY = { path: "/gallery", name: "Gallery", purpose: "what Gallery is for", sections: ["a band"], components: ["section-header"], link: { in: "page", page: "/", where: "a button in the hero band" } };
const MENU_LINK = "Put a link to the gallery in the menu";
const ADD_PAGE = "add a gallery page";

test("PC 3 — A DEPENDENT HELD STILL MID-CALL: the menu link refers to the gallery page another part creates; while that page's writer is held inside its model call, every queued message is delivered and the cron runs — the link's part is not prepared, not routed and its menu step not asked; it is routed and run only after the page job ended, against the menu as the page left it", async () => {
  const held = gate();
  let inside = false;
  await withPlatform({
    slug: slugOf("p3"), pages: MENU_PAGES,
    answers: {
      route: [
        { intent: "edit", layer: "nav", alsoAsked: [ADD_PAGE], targets: [{ change: 0, writes: ["menu"], reads: ["page:/gallery"] }, { change: 1, writes: ["new-page:/gallery"] }] },
        { intent: "addon" },
        { intent: "edit", layer: "nav" },
      ],
      [T.adds]: { kinds: ["page"] }, "add:page": { page: [GALLERY] },
      [T.pages]: async () => { inside = true; await within(held.p); return { pages: [writtenPage("/gallery")] }; },
      write_nav: { add: [{ to: "menu", label: "Gallery", href: "/gallery" }] },
    },
  }, async (P) => {
    const { tick } = await import("./fixtures/request-flow.mjs");
    const r = await sendMessage(P, { message: MENU_LINK + ", and " + ADD_PAGE + "." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(P.record(r.key).parts[0].needs, [1]);
    const flying = [];
    const drain = async () => { while (P.queue.length) { const m = P.queue.shift(); const d = deliver(P, m); flying.push(d); await Promise.race([d, new Promise((ok) => setTimeout(ok, 30))]); } };
    for (let i = 0; i < 40 && !inside; i++) { await drain(); await new Promise((ok) => setTimeout(ok, 10)); }
    assert.equal(inside, true, "the page writer was never reached — this case is watching nothing");
    const routesAtHold = calls(P, T.route).length;
    // EVERYTHING ELSE DELIVERED, THE CRON TWICE, while the page job is held.
    for (let i = 0; i < 2; i++) { await drain(); await tick(P); await drain(); }
    const rec = P.record(r.key);
    assert.equal(rec.parts[0].status, "blocked", "the dependent left its wait while its prerequisite ran: " + rec.parts[0].status);
    assert.ok(!rec.parts[0].prep, "the dependent was prepared while its prerequisite ran: " + JSON.stringify(rec.parts[0].prep));
    assert.equal(calls(P, T.route).length, routesAtHold, "the dependent was routed while its prerequisite ran");
    assert.equal(calls(P, "write_nav").length, 0, "the dependent's menu step was asked while its prerequisite ran");
    held.open();
    await Promise.all(flying);
    const { rec: end } = await settle(P, r.key);
    assert.deepEqual(statuses(end), ["done", "done"], JSON.stringify(end.parts.map((p) => [p.status, p.why])));
    assert.equal(calls(P, "write_nav").length, 1);
    const js = P.jobsOf(r.key);
    const page = js.find((j) => j.op === "addon"), linkRoute = js.filter((j) => j.op === "route").pop();
    assert.ok(page && linkRoute && linkRoute.created_at >= page.updated_at - 1, "the link was routed before the page existed");
    for (const m of navSlots(P.pages().map((path) => ({ path, source: P.page(path) })))) assert.ok(m.items.some((i) => i.label === "Gallery" && i.href === "/gallery"), "the link is missing from " + m.page);
    for (const j of js) assert.ok(reserveOf(P, j.id).length <= 1, j.op + " charged more than once");
  });
});

// ── PC 4 AND PC 5: A ROW CHANGE'S PREPARATION, DELIVERED TWICE OR ORPHANED ──

const PREP_PAST = 10 * 60 * 1000 + 1000;

test("PC 4 — A ROW CHANGE'S PREPARATION DELIVERED TWICE AT ONCE: both deliveries arrive while the first is inside its model call — one consumer takes it, one row-change call is made, the job answers from it; the row changed once, one charge per job", async () => {
  const db = bakeryDb();
  const callHeld = gate();
  await withPlatform({
    slug: slugOf("p4"), pages: PAGES, db,
    answers: {
      route: [HEADING_ROUTE([{ words: RYE, writes: ["data:loaves"] }]), { intent: "edit", layer: "data" }],
      [T.text]: headingEdit,
      write_row_changes: async () => { await within(callHeld.p, 2000); return RYE_CHANGE; },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: HEADING + ", and " + RYE + "." });
    const [m] = take(P, "request-prep");
    assert.ok(m, "the row change was not claimed for preparation");
    const a = deliver(P, m), b = deliver(P, m);
    for (let i = 0; i < 200 && calls(P, "write_row_changes").length < 1; i++) await new Promise((ok) => setTimeout(ok, 5));
    await new Promise((ok) => setTimeout(ok, 60));
    callHeld.open();
    await Promise.all([a, b]);
    assert.equal(calls(P, "write_row_changes").length, 1, "both deliveries asked the row-change model");
    assert.equal(P.record(r.key).parts[1].prep.outcome, "ready");
    assert.equal(rye(db), 5.2, "the preparation changed the row");
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(calls(P, "write_row_changes").length, 1, "the job asked the row-change model again");
    assert.equal(rye(db), 5.5);
    assert.equal(db.log().filter((e) => /^UPDATE "loaves"/i.test(String(e.query))).length, 1, "the row was written more than once");
    for (const j of P.jobsOf(r.key)) assert.ok(reserveOf(P, j.id).length <= 1, j.op + " charged more than once");
  });
});

test("PC 5 — RECOVERY WITH THE BROWSER CLOSED: the row change's preparation consumer dies inside its model call; nothing but the queue and the cron runs after — inside its time it is not taken again, after it the cron takes it again naming the first, the new attempt asks once, and the part's job answers from it: the row changed once, one charge per job, both changes kept", async () => {
  const db = bakeryDb();
  await withPlatform({
    slug: slugOf("p5"), pages: PAGES, db,
    answers: {
      route: [HEADING_ROUTE([{ words: RYE, writes: ["data:loaves"] }]), { intent: "edit", layer: "data" }],
      [T.text]: headingEdit,
      write_row_changes: (args, n) => (n === 0 ? new Promise(() => {}) : RYE_CHANGE),
    },
  }, async (P) => {
    const { tick } = await import("./fixtures/request-flow.mjs");
    const r = await sendMessage(P, { message: HEADING + ", and " + RYE + "." });
    const [first] = take(P, "request-prep");
    deliver(P, first); // never answers: its consumer is gone
    for (let i = 0; i < 200 && calls(P, "write_row_changes").length < 1; i++) await new Promise((ok) => setTimeout(ok, 5));
    assert.equal(P.record(r.key).parts[1].prep.state, "running");
    await tick(P);
    assert.equal(P.queue.filter((m) => m.body.kind === "request-prep").length, 0, "a running attempt was taken again inside its time");
    P.advance(PREP_PAST);
    await tick(P);
    const prep = P.record(r.key).parts[1].prep;
    assert.equal(prep.prev, first.body.seq, "the new attempt does not name the one that died");
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why, p.prep && p.prep.outcome])));
    // TWO CALLS IN ALL: the dead consumer's (made, never answered) and the
    // recovered attempt's — none by the part's job.
    assert.equal(calls(P, "write_row_changes").length, 2, "the part's job asked the row-change model again, or the recovery never asked");
    assert.equal(P.record(r.key).parts[1].prep.outcome, "ready");
    assert.ok(P.page("visit.tsx").includes(HEAD_TO));
    assert.equal(rye(db), 5.5);
    assert.equal(db.log().filter((e) => /^UPDATE "loaves"/i.test(String(e.query))).length, 1, "the row was written more than once");
    for (const j of P.jobsOf(r.key)) assert.ok(reserveOf(P, j.id).length <= 1, j.op + " charged more than once");
  });
});
