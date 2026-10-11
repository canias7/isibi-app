// INDEPENDENT TASKS RUN TOGETHER UNLESS THEY NEED ANOTHER'S RESULT OR CONFLICT
// WITH ITS CHANGES (2026-10-11, Codex's reproduction on 625bf4ee: two text
// edits on separate pages, and two data edits on separate tables, declared
// non-conflicting targets yet were never prepared together, because the text
// step was planned as reading every page and the data step every table).
//
// Through the real request driver, queue consumer and routes, every model
// answer supplied, no image bought:
//   IND 1  two text edits on separate pages — the second's text call made
//          while the first's job is held inside its own; applied after the
//          first changed its page, the prepared answer is RE-BASED (no second
//          call), the job's own record says so, and both changes are kept;
//   IND 2  the same for two row changes in separate tables;
//   IND 3  controls: the same page, and the same table, still wait (no
//          preparation of the step) — both changes kept;
//   IND 4  a changed input: the first part's change now carries the words the
//          second changes, so the re-base refuses and the job asks the model
//          again against the site as it is — both changes kept.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, deliver, settle, call, T } from "./fixtures/request-flow.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "./fixtures/rows-db.mjs";
import { overlapVerdict } from "../scripts/canary-requests.mjs";

blockNetwork();

const slugOf = (k) => "ind-" + k + "-" + Math.random().toString(16).slice(2, 8);
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
const take = (P, kind) => { const ms = P.queue.filter((m) => m.body.kind === kind); for (const m of ms) P.queue.splice(P.queue.indexOf(m), 1); return ms; };
const jobsQueued = (P) => P.queue.filter((m) => m.body.kind !== "request-prep" && m.body.kind !== "edit-progress");
const viewOf = async (P, key) => { const v = await call(P, "GET", "/api/site/request/" + P.slug + "/" + key); assert.equal(v.status, 200, JSON.stringify(v.body)); return v.body.request; };
const lineId = (args, file, line) => {
  const at = String(args.messages[0].content).split("\n").find((l) => l.includes("[" + file + "] " + line));
  return Number(String(at || "-1.").split(".")[0]);
};
/** The part's OWN words: the first line of what it was asked (the whole message is quoted after them). */
const asked = (args) => (String(args.messages[0].content).split("WHAT THEY ASKED FOR\n")[1] || "").split("\n")[0];

const HEAD = "Come to the bakery", HEAD_TO = "Come to the harbour bakery";
const HOURS_LINE = "Open from 9 on weekdays.", HOURS_TO = "Open from 8 on weekdays.";
const PAGES = [
  { path: "index.tsx", source: pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1><p>Bread from the harbour, every morning.</p></section>") },
  { path: "visit.tsx", source: pageSrc("/visit", "<section className=\"come\"><h1>" + HEAD + "</h1><p>We are on Harbour Street.</p></section>") },
  { path: "about.tsx", source: pageSrc("/about", "<section className=\"story\"><h1>Our story</h1><p>" + HOURS_LINE + "</p></section>") },
];
const W_HEAD = "make the Visit page heading say Come to the harbour bakery";
const W_HOURS = "on the About page say we open from 8 on weekdays";
const textRoute = (first, second, writes0, writes1, page0, page1) => [
  { intent: "edit", layer: "text", page: page0, alsoAsked: [second], targets: [{ change: 0, writes: writes0 }, { change: 1, writes: writes1 }] },
  { intent: "edit", layer: "text", page: page1 },
];

/** Two text parts; part 0's job held inside its model call until part 1's preparation has made its own. */
async function twoTexts({ slug, route, message, answer0, answer1, check }) {
  const held = gate();
  await withPlatform({
    slug, pages: PAGES, progress: true,
    answers: {
      route,
      [T.text]: async (args) => {
        if (asked(args).includes(W_HEAD) || asked(args).includes(message.first)) { await within(held.p); await new Promise((ok) => setTimeout(ok, 30)); return answer0(args); }
        held.open();
        return answer1(args);
      },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: message.first + ", and " + message.second + "." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const preps = take(P, "request-prep");
    const jobs = jobsQueued(P);
    P.queue.splice(P.queue.indexOf(jobs[0]), 1);
    const running = deliver(P, jobs[0]);
    await new Promise((ok) => setTimeout(ok, 50));
    for (const m of preps) await deliver(P, m);
    held.open();
    await running;
    const { rec } = await settle(P, r.key);
    await check(P, rec, r, await viewOf(P, r.key));
  });
}

test("IND 1 — TWO TEXT EDITS ON SEPARATE PAGES RUN TOGETHER: the About line's text call is made while the Visit heading's job is held inside its own; applied after the heading changed, the prepared answer is re-based onto the changed site (no second call) and the job's own record says re-based; both changes kept, one charge per job", async () => {
  await twoTexts({
    slug: slugOf("t"), route: textRoute(W_HEAD, W_HOURS, ["page:/visit"], ["page:/about"], "/visit", "/about"),
    message: { first: W_HEAD, second: W_HOURS },
    answer0: (args) => ({ edits: [{ id: lineId(args, "visit.tsx", HEAD), to: HEAD_TO }] }),
    answer1: (args) => ({ edits: [{ id: lineId(args, "about.tsx", HOURS_LINE), to: HOURS_TO }] }),
    check: async (P, rec, r, view) => {
      assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
      assert.ok(P.page("visit.tsx").includes(HEAD_TO), "the heading change was lost");
      assert.ok(P.page("about.tsx").includes(HOURS_TO), "the About change was lost");
      assert.ok(!P.page("about.tsx").includes(HOURS_LINE));
      assert.equal(calls(P, T.text).length, 2, "the About part's job asked its model again instead of using its preparation");
      assert.equal(rec.parts[1].prep.outcome, "ready", "the About part's text step was not prepared: " + JSON.stringify(rec.parts[1].prep));
      const use = view.parts[1].prepUse;
      assert.ok(use && use.length === 1, "the About job's use of its preparation is not served: " + JSON.stringify(view.parts[1]));
      assert.deepEqual({ replayed: use[0].replayed, rebased: use[0].rebased, fresh: use[0].fresh }, { replayed: 0, rebased: 1, fresh: 0 });
      const st = (Array.isArray(view.parts[1].prepRuns) ? view.parts[1].prepRuns : [view.parts[1].prepRun]).map((x) => x && x.step).find((s) => s && s.calls > 0);
      const run0 = view.parts[0].runs[0];
      assert.ok(st && st.from < run0.to && run0.from < st.to, "the About step did not run during the heading's job: " + JSON.stringify({ st, run0 }));
      assert.equal(overlapVerdict([{ sent: true, request: { key: r.key, final: view } }]).ok, true);
      for (const j of P.jobsOf(r.key)) assert.ok(reserveOf(P, j.id).length <= 1, j.op + " charged more than once");
    },
  });
});

const LOAVES = { name: "loaves", columns: [{ name: "name", type: "text" }, { name: "description", type: "text" }, { name: "price", type: "numeric" }, { name: "photo", type: "text" }], read: "public", write: "none" };
const HOURS = { name: "hours", columns: [{ name: "day", type: "text" }, { name: "opens", type: "text" }], read: "public", write: "none" };
const bakeryDb = () => rowsDb({
  tables: {
    loaves: { columns: LOAF_COLUMNS, rows: BAKERY_LOAVES, next: 12 },
    hours: { columns: [{ name: "id", type: "integer" }, { name: "day", type: "text" }, { name: "opens", type: "text" }, { name: "created_at", type: "timestamp with time zone" }], rows: [{ id: 1, day: "Monday", opens: "09:00", created_at: "2026-08-21 23:06:22" }] },
  },
  meta: { schema: JSON.stringify({ tables: [LOAVES, HOURS] }) },
});
const W_MON = "open the bakery at 8 on Mondays", W_RYE = "make the Dark Rye £5.50";

async function twoRows({ slug, writes0, writes1, prepares = true, check }) {
  const db = bakeryDb();
  const held = gate();
  await withPlatform({
    slug, pages: PAGES, db, progress: true,
    answers: {
      route: [
        { intent: "edit", layer: "data", alsoAsked: [W_RYE], targets: [{ change: 0, writes: writes0 }, { change: 1, writes: writes1 }] },
        { intent: "edit", layer: "data" },
      ],
      write_row_changes: async (args) => {
        if (asked(args).includes(W_MON)) { await within(held.p, prepares ? 4000 : 300); await new Promise((ok) => setTimeout(ok, 30)); return { changes: [{ table: "hours", id: 1, values: { opens: "08:00" } }] }; }
        held.open();
        return { changes: [{ table: "loaves", id: 2, values: { price: 5.5 } }] };
      },
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: W_MON + ", and " + W_RYE + "." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const preps = take(P, "request-prep");
    const jobs = jobsQueued(P);
    P.queue.splice(P.queue.indexOf(jobs[0]), 1);
    const running = deliver(P, jobs[0]);
    await new Promise((ok) => setTimeout(ok, 50));
    for (const m of preps) await deliver(P, m);
    held.open();
    await running;
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(db.rows("hours")[0].opens, "08:00", "the hours change was lost");
    assert.equal(Number(db.rows("loaves").find((l) => l.id === 2).price), 5.5, "the loaves change was lost");
    for (const j of P.jobsOf(r.key)) assert.ok(reserveOf(P, j.id).length <= 1, j.op + " charged more than once");
    await check(P, rec, r, await viewOf(P, r.key));
  });
}

test("IND 2 — TWO ROW CHANGES IN SEPARATE TABLES RUN TOGETHER: the loaves change is chosen while the hours change's job is held inside its own; applied after the hours table changed, the prepared answer is re-based (no second call), the job's record says so, both changes kept", async () => {
  await twoRows({
    slug: slugOf("d"), writes0: ["data:hours"], writes1: ["data:loaves"],
    check: async (P, rec, r, view) => {
      assert.equal(calls(P, "write_row_changes").length, 2, "the loaves job asked its model again instead of using its preparation");
      assert.equal(rec.parts[1].prep.outcome, "ready", JSON.stringify(rec.parts[1].prep));
      const use = view.parts[1].prepUse;
      assert.ok(use && use.length === 1, JSON.stringify(view.parts[1]));
      assert.deepEqual({ replayed: use[0].replayed, rebased: use[0].rebased, fresh: use[0].fresh }, { replayed: 0, rebased: 1, fresh: 0 });
      const v = overlapVerdict([{ sent: true, request: { key: r.key, final: view } }]);
      assert.equal(v.ok, true, v.why);
    },
  });
});

test("IND 3 — CONFLICTS STILL WAIT: two text edits on the SAME page, and two row changes in the SAME table, never do their step's model work beside each other — the second is prepared, if at all, only once the first was applied — and both changes are kept", async () => {
  // THE SAME PAGE.
  const W_STREET = "on the Visit page say we are on Quay Street";
  await withPlatform({
    slug: slugOf("sp"), pages: PAGES, progress: true,
    answers: {
      route: textRoute(W_HEAD, W_STREET, ["page:/visit"], ["page:/visit"], "/visit", "/visit"),
      [T.text]: (args) => (asked(args).includes(W_HEAD) ? { edits: [{ id: lineId(args, "visit.tsx", HEAD), to: HEAD_TO }] } : { edits: [{ id: lineId(args, "visit.tsx", "We are on Harbour Street."), to: "We are on Quay Street." }] }),
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: W_HEAD + ", and " + W_STREET + "." });
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"]);
    // PREPARED, IF AT ALL, ONLY ONCE THE FIRST HAD BEEN APPLIED: no model work
    // of the second's step during the first's job.
    const view = await viewOf(P, r.key);
    const run0 = view.parts[0].runs[0];
    for (const x of (Array.isArray(view.parts[1].prepRuns) ? view.parts[1].prepRuns : [view.parts[1].prepRun]).filter(Boolean)) {
      if (x.step && x.step.calls > 0) assert.ok(x.step.from >= run0.to, "a step on the same page ran beside the first's job: " + JSON.stringify({ step: x.step, run0 }));
    }
    assert.ok(P.page("visit.tsx").includes(HEAD_TO) && P.page("visit.tsx").includes("We are on Quay Street."), "a change on the shared page was lost");
    assert.equal(calls(P, T.text).length, 2);
  });
  // THE SAME TABLE.
  const db = bakeryDb();
  await withPlatform({
    slug: slugOf("st"), pages: PAGES, db, progress: true,
    answers: {
      route: [{ intent: "edit", layer: "data", alsoAsked: ["make the Country White £5"], targets: [{ change: 0, writes: ["data:loaves"] }, { change: 1, writes: ["data:loaves"] }] }, { intent: "edit", layer: "data" }],
      write_row_changes: (args) => (asked(args).includes(W_RYE) ? { changes: [{ table: "loaves", id: 2, values: { price: 5.5 } }] } : { changes: [{ table: "loaves", id: 1, values: { price: 5 } }] }),
    },
  }, async (P) => {
    const r = await sendMessage(P, { message: W_RYE + ", and make the Country White £5." });
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"]);
    const view = await viewOf(P, r.key);
    const run0 = view.parts[0].runs[0];
    for (const x of (Array.isArray(view.parts[1].prepRuns) ? view.parts[1].prepRuns : [view.parts[1].prepRun]).filter(Boolean)) {
      if (x.step && x.step.calls > 0) assert.ok(x.step.from >= run0.to, "a row change in the same table ran beside the first's job: " + JSON.stringify({ step: x.step, run0 }));
    }
    assert.equal(Number(db.rows("loaves").find((l) => l.id === 2).price), 5.5);
    assert.equal(Number(db.rows("loaves").find((l) => l.id === 1).price), 5);
    assert.equal(calls(P, "write_row_changes").length, 2);
  });
});

test("IND 4 — A CHANGED INPUT IS ASKED AGAIN: the heading's change now carries the very words the About part changes, so its prepared answer is not re-based — the About job asks its model against the site as it now is (the record says fresh), and both changes are kept", async () => {
  const CLASH_TO = "Open from 9 on weekdays — come to the harbour bakery";
  await twoTexts({
    slug: slugOf("x"), route: textRoute(W_HEAD, W_HOURS, ["page:/visit"], ["page:/about"], "/visit", "/about"),
    message: { first: W_HEAD, second: W_HOURS },
    answer0: (args) => ({ edits: [{ id: lineId(args, "visit.tsx", HEAD), to: CLASH_TO }] }),
    answer1: (args) => ({ edits: [{ id: lineId(args, "about.tsx", HOURS_LINE), to: HOURS_TO }] }),
    check: async (P, rec, r, view) => {
      assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
      assert.ok(P.page("visit.tsx").includes(CLASH_TO));
      assert.ok(P.page("about.tsx").includes(HOURS_TO));
      assert.equal(calls(P, T.text).length, 3, "the About job used a prepared answer although a change elsewhere carried its words");
      const use = view.parts[1].prepUse;
      assert.ok(use && use.length === 1, JSON.stringify(view.parts[1]));
      assert.deepEqual({ rebased: use[0].rebased, fresh: use[0].fresh }, { rebased: 0, fresh: 1 });
    },
  });
});
