// INDEPENDENT TASKS RUN TOGETHER UNLESS THEY NEED ANOTHER'S RESULT OR CONFLICT
// WITH ITS CHANGES (2026-10-11, Codex's reproduction on 625bf4ee: two text
// edits on separate pages, and two data edits on separate tables, declared
// non-conflicting targets yet were never prepared together, because the text
// step was planned as reading every page and the data step every table).
//
// AND A PREPARED ANSWER IS REUSED ONLY BY AN EXACT REPLAY OF WHAT ITS MODEL
// WAS SHOWN (2026-10-11, Codex's review of 1694dc88: a re-base that judged a
// change elsewhere irrelevant by its words carried a price worked out from an
// opening hour that had changed in between — 7 applied, 6 correct). A
// prepared part's step is now shown only its declared scope, says `needs`
// when what it was asked depends on anything else, and is then asked again
// with the whole site as it is when its job runs.
//
// Through the real request driver, queue consumer and routes, every model
// answer supplied, no image bought:
//   IND 1  two text edits on separate pages — the second's text call made
//          while the first's job is held inside its own; its request shows
//          only its page, and its job replays it EXACTLY (no second call);
//   IND 2  the same for two row changes in separate tables;
//   IND 3  controls: the same page, and the same table, still wait (no
//          preparation of the step) — both changes kept, every job's calls
//          counted;
//   IND 4  Codex's stale numeric case: the price is two pounds less than the
//          Monday opening hour, which the first part changes, and the router
//          declared no read — the prepared step, shown only its table, says it
//          needs more; its job asks again with the hours as they now are: 6;
//   IND 5  a dependency with no shared words (a heading in French);
//   IND 6  incomplete dependency declarations (a read naming the wrong
//          target; no targets at all): never a stale value;
//   IND 7  an image-only prepared record: the job's fresh call is counted;
//   IND 8  missing evidence stays unknown in the request view, never zero.
//
// ⚠ SUPPLIED-MODEL PROOF ONLY: the mocks below answer `needs` when what they
// are asked depends on what they were not shown. Whether a real model does so
// is not shown here.
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
async function twoTexts({ slug, route, message, answer0, answer1, check, between = null }) {
  const held = gate();
  // THE PLATFORM, for an answer that must arm a fault on it mid-job (IND 11).
  const box = {};
  await withPlatform({
    slug, pages: PAGES, progress: true,
    answers: {
      route,
      [T.text]: async (args) => {
        if (asked(args).includes(W_HEAD) || asked(args).includes(message.first)) { await within(held.p); await new Promise((ok) => setTimeout(ok, 30)); return answer0(args); }
        held.open();
        return answer1(args, box);
      },
    },
  }, async (P) => {
    box.P = P;
    const r = await sendMessage(P, { message: message.first + ", and " + message.second + "." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const preps = take(P, "request-prep");
    const jobs = jobsQueued(P);
    P.queue.splice(P.queue.indexOf(jobs[0]), 1);
    const running = deliver(P, jobs[0]);
    await new Promise((ok) => setTimeout(ok, 50));
    for (const m of preps) await deliver(P, m);
    if (between) await between(P, r);
    held.open();
    await running;
    const { rec } = await settle(P, r.key);
    await check(P, rec, r, await viewOf(P, r.key));
  });
}
/** What a job's evidence says, as the request view serves it. */
const useOf = (view, n) => {
  const u = view.parts[n].prepUse;
  assert.ok(Array.isArray(u) && u.length === 1, "part " + n + "'s job's use of its preparation is not served: " + JSON.stringify(view.parts[n]));
  return u[0];
};
const counts = (u) => ({ known: u.known, staged: u.staged, replayed: u.replayed, rebased: u.rebased, fresh: u.fresh });
// THE DIRECT EVIDENCE OF THE MODEL ASKING (v3, 2026-10-11): how many scoped
// answers the job's steps took, and how many of them said `needs` — counted
// where the step reads the answer, never inferred from a call count.
const seenOf = (u) => ({ scoped: u.scoped, needs: u.needs });
/** The step's request as its model received it: what it was shown. */
const content = (args) => String(args.messages[0].content);
const canAsk = (args) => !!(args.tools && args.tools[0] && args.tools[0].input_schema.properties.needs);

test("IND 1 — TWO TEXT EDITS ON SEPARATE PAGES RUN TOGETHER: the About line's text call is made while the Visit heading's job is held inside its own, shown only the About page; applied after the heading changed, its job replays that answer exactly (no second call) and its record says so; both changes kept, one charge per job", async () => {
  const seen = [];
  await twoTexts({
    slug: slugOf("t"), route: textRoute(W_HEAD, W_HOURS, ["page:/visit"], ["page:/about"], "/visit", "/about"),
    message: { first: W_HEAD, second: W_HOURS },
    answer0: (args) => ({ edits: [{ id: lineId(args, "visit.tsx", HEAD), to: HEAD_TO }] }),
    answer1: (args) => { seen.push(content(args)); return { edits: [{ id: lineId(args, "about.tsx", HOURS_LINE), to: HOURS_TO }] }; },
    check: async (P, rec, r, view) => {
      assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
      assert.ok(P.page("visit.tsx").includes(HEAD_TO), "the heading change was lost");
      assert.ok(P.page("about.tsx").includes(HOURS_TO), "the About change was lost");
      assert.ok(!P.page("about.tsx").includes(HOURS_LINE));
      assert.equal(calls(P, T.text).length, 2, "the About part's job asked its model again instead of using its preparation");
      assert.equal(rec.parts[1].prep.outcome, "ready", "the About part's text step was not prepared: " + JSON.stringify(rec.parts[1].prep));
      // SHOWN ONLY ITS PAGE: no word of the Visit page, the page named as not shown.
      assert.equal(seen.length, 1);
      assert.ok(!seen[0].includes("[visit.tsx]") && seen[0].includes("[about.tsx] " + HOURS_LINE), seen[0]);
      assert.match(seen[0], /NOT SHOWN[\s\S]*visit\.tsx/);
      assert.deepEqual(counts(useOf(view, 1)), { known: true, staged: "yes", replayed: 1, rebased: 0, fresh: 0 });
      // PART 0 RAN UNPREPARED: its one call counted fresh, nothing staged.
      assert.deepEqual(counts(useOf(view, 0)), { known: true, staged: "no", replayed: 0, rebased: 0, fresh: 1 });
      assert.deepEqual(seenOf(useOf(view, 1)), { scoped: 1, needs: 0 }, "the prepared step's scoped answer, which did not say needs");
      assert.deepEqual(seenOf(useOf(view, 0)), { scoped: 0, needs: 0 }, "an unprepared step is never scoped");
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

async function twoRows({ slug, writes0, writes1, targets = null, second = W_RYE, answer1 = null, rye = 5.5, prepares = true, want = ["done", "done"], check }) {
  const db = bakeryDb();
  const held = gate();
  // THE PLATFORM, for an answer that must arm a fault on it mid-job (IND 11).
  const box = {};
  await withPlatform({
    slug, pages: PAGES, db, progress: true,
    answers: {
      route: [
        { intent: "edit", layer: "data", alsoAsked: [second], targets: targets || [{ change: 0, writes: writes0 }, { change: 1, writes: writes1 }] },
        { intent: "edit", layer: "data" },
      ],
      write_row_changes: async (args) => {
        if (asked(args).includes(W_MON)) { await within(held.p, prepares ? 4000 : 300); await new Promise((ok) => setTimeout(ok, 30)); return { changes: [{ table: "hours", id: 1, values: { opens: "08:00" } }] }; }
        held.open();
        return answer1 ? answer1(args, box) : { changes: [{ table: "loaves", id: 2, values: { price: 5.5 } }] };
      },
    },
  }, async (P) => {
    box.P = P;
    const r = await sendMessage(P, { message: W_MON + ", and " + second + "." });
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
    assert.deepEqual(statuses(rec), want, JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(db.rows("hours")[0].opens, "08:00", "the hours change was lost");
    assert.equal(Number(db.rows("loaves").find((l) => l.id === 2).price), rye, "the Dark Rye's price is not the one the site as it is calls for");
    for (const j of P.jobsOf(r.key)) assert.ok(reserveOf(P, j.id).length <= 1, j.op + " charged more than once");
    await check(P, rec, r, await viewOf(P, r.key));
  });
}

test("IND 2 — TWO ROW CHANGES IN SEPARATE TABLES RUN TOGETHER: the loaves change is chosen while the hours change's job is held inside its own, shown only the loaves; applied after the hours table changed, its job replays that answer exactly (no second call), the record says so, both changes kept", async () => {
  await twoRows({
    slug: slugOf("d"), writes0: ["data:hours"], writes1: ["data:loaves"],
    answer1: (args) => {
      assert.ok(!content(args).includes("TABLE hours") && content(args).includes("TABLE loaves"), "the loaves step was shown another table: " + content(args));
      return { changes: [{ table: "loaves", id: 2, values: { price: 5.5 } }] };
    },
    check: async (P, rec, r, view) => {
      assert.equal(calls(P, "write_row_changes").length, 2, "the loaves job asked its model again instead of using its preparation");
      assert.equal(rec.parts[1].prep.outcome, "ready", JSON.stringify(rec.parts[1].prep));
      assert.deepEqual(counts(useOf(view, 1)), { known: true, staged: "yes", replayed: 1, rebased: 0, fresh: 0 });
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
    // EVERY CALL ACCOUNTED FOR: each job's own made and replayed calls.
    const made = [0, 1].map((n) => useOf(view, n)).reduce((k, u) => k + u.fresh, 0);
    const prepCalls = [view.parts[1].prepRun, ...(view.parts[1].prepRuns || [])].filter(Boolean).reduce((k, x) => Math.max(k, (x.step && x.step.calls) || 0), 0);
    assert.equal(made + prepCalls, 2, JSON.stringify(view.parts.map((p) => p.prepUse)));
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

// ── A PRICE WORKED OUT FROM WHAT ANOTHER PART CHANGES (Codex's reproduction) ──
//
// The supplied model works out what it is shown, as a model does: shown the
// hours, the Dark Rye costs two pounds less than the Monday opening hour; not
// shown them, it says it needs more (`needs`, on the scoped tool) — and with
// no such way out it would have to answer from what it saw.
const W_RYE_HOUR = "set the Dark Rye's price to two pounds less than the Monday opening hour";
const ryeFromHours = (args) => {
  const m = /day="Monday", opens="(\d+):/.exec(content(args));
  if (!m) {
    assert.ok(canAsk(args), "shown no hours and given no way to say so: " + content(args));
    return { needs: true, changes: [] };
  }
  return { changes: [{ table: "loaves", id: 2, values: { price: Number(m[1]) - 2 } }] };
};

test("IND 4 — A RESULT WORKED OUT FROM ANOTHER PART'S CHANGE IS NEVER REUSED STALE (Codex's reproduction): the hours change moves Monday from 09:00 to 08:00, the router declares no read for the price part, its preparation runs beside the hours job — shown only the loaves, it needs more; its job asks again with the hours as they now are and sets 6, not 7, and its record counts one replayed call and one fresh", async () => {
  await twoRows({
    slug: slugOf("n"), writes0: ["data:hours"], writes1: ["data:loaves"], second: W_RYE_HOUR, answer1: ryeFromHours, rye: 6,
    check: async (P, rec, r, view) => {
      assert.equal(rec.parts[1].prep.outcome, "ready", "the price part was not prepared beside the hours job: " + JSON.stringify(rec.parts[1].prep));
      assert.deepEqual(counts(useOf(view, 1)), { known: true, staged: "yes", replayed: 1, rebased: 0, fresh: 1 });
      assert.deepEqual(seenOf(useOf(view, 1)), { scoped: 1, needs: 1 }, "the scoped answer said needs, and the evidence does not say so");
      // THE FRESH CALL SAW THE HOURS AS THEY NOW ARE; THE PREPARED ONE SAW NONE.
      const rye = calls(P, "write_row_changes").filter((c) => c.text.includes(W_RYE_HOUR.slice(0, 30)) && !c.text.split("WHAT THEY ASKED FOR\n")[1].startsWith(W_MON));
      assert.ok(rye.some((c) => !c.text.includes("TABLE hours") && c.props.includes("needs")), "no scoped call for the price part");
      assert.ok(rye.at(-1).text.includes('opens="08:00"'), "the price part's last call was not shown the hours as they now are");
    },
  });
});

test("IND 5 — A DEPENDENCY WITH NO SHARED WORDS: the About heading is to say in French what the Visit heading says, and the Visit heading changes first — no word of the change appears in the answer, the router declared no read; the prepared step, shown only the About page, needs more and its job asks again: the French follows the new heading", async () => {
  const W_FR = "on the About page make the Our story heading say in French what the Visit page heading says";
  const FR = { [HEAD]: "Venez a la boulangerie", [HEAD_TO]: "Venez a la boulangerie du port" };
  await twoTexts({
    slug: slugOf("f"), route: textRoute(W_HEAD, W_FR, ["page:/visit"], ["page:/about"], "/visit", "/about"),
    message: { first: W_HEAD, second: W_FR },
    answer0: (args) => ({ edits: [{ id: lineId(args, "visit.tsx", HEAD), to: HEAD_TO }] }),
    answer1: (args) => {
      const line = content(args).split("\n").find((l) => /^\d+\. \[visit\.tsx\] Come to the/.test(l));
      if (!line) { assert.ok(canAsk(args)); return { needs: true, edits: [] }; }
      return { edits: [{ id: lineId(args, "about.tsx", "Our story"), to: FR[line.replace(/^\d+\. \[visit\.tsx\] /, "")] }] };
    },
    check: async (P, rec, r, view) => {
      assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
      assert.ok(P.page("visit.tsx").includes(HEAD_TO));
      assert.ok(P.page("about.tsx").includes(FR[HEAD_TO]), "the French does not follow the heading as it now is: " + P.page("about.tsx"));
      assert.ok(!P.page("about.tsx").includes(FR[HEAD] + "<"), "the stale French was applied");
      assert.deepEqual(counts(useOf(view, 1)), { known: true, staged: "yes", replayed: 1, rebased: 0, fresh: 1 });
      assert.deepEqual(seenOf(useOf(view, 1)), { scoped: 1, needs: 1 }, "the scoped answer said needs, and the evidence does not say so");
    },
  });
});

test("IND 6 — INCOMPLETE DEPENDENCY DECLARATIONS ARE NEVER PROOF OF INDEPENDENCE: a read naming the wrong target, and no targets at all for the price part — either way the price is worked out from the hours as they are when its job runs: 6", async () => {
  // A READ NAMED, BUT NOT THE ONE IT NEEDS.
  await twoRows({
    slug: slugOf("i1"), second: W_RYE_HOUR, answer1: ryeFromHours, rye: 6,
    targets: [{ change: 0, writes: ["data:hours"] }, { change: 1, writes: ["data:loaves"], reads: ["page:/about"] }],
    check: async (P, rec, r, view) => {
      const u = useOf(view, 1);
      assert.equal(u.known, true);
      assert.equal(u.rebased, 0);
    },
  });
  // NO TARGETS FOR THE PRICE PART AT ALL.
  await twoRows({
    slug: slugOf("i2"), second: W_RYE_HOUR, answer1: ryeFromHours, rye: 6,
    targets: [{ change: 0, writes: ["data:hours"] }],
    check: async (P, rec, r, view) => {
      const u = useOf(view, 1);
      assert.equal(u.known, true);
      assert.equal(u.rebased, 0);
    },
  });
});

test("IND 7 — AN IMAGE-ONLY PREPARED RECORD: the About part's preparation is left holding only a picture; its job has no answer to replay and asks its model — the call is counted fresh (1), never left at 0 beside a call made", async () => {
  await twoTexts({
    slug: slugOf("img"), route: textRoute(W_HEAD, W_HOURS, ["page:/visit"], ["page:/about"], "/visit", "/about"),
    message: { first: W_HEAD, second: W_HOURS },
    answer0: (args) => ({ edits: [{ id: lineId(args, "visit.tsx", HEAD), to: HEAD_TO }] }),
    answer1: (args) => ({ edits: [{ id: lineId(args, "about.tsx", HOURS_LINE), to: HOURS_TO }] }),
    between: async (P, r) => {
      const rec = P.record(r.key);
      const k = rec.parts[1].prep && rec.parts[1].prep.key;
      assert.ok(typeof k === "string" && P.objects.has(k), "the About part's preparation was not kept: " + JSON.stringify(rec.parts[1].prep));
      const o = P.objects.get(k);
      const v = JSON.parse(o.body);
      v.run = { calls: [], images: [{ d: "a loaf on the counter", url: "https://ind.example/loaf.png" }] };
      o.body = JSON.stringify(v);
    },
    check: async (P, rec, r, view) => {
      assert.deepEqual(statuses(rec), ["done", "done"]);
      assert.ok(P.page("about.tsx").includes(HOURS_TO));
      assert.equal(calls(P, T.text).length, 3, "the About job did not ask its model");
      assert.deepEqual(counts(useOf(view, 1)), { known: true, staged: "yes", replayed: 0, rebased: 0, fresh: 1 });
    },
  });
});

test("IND 8 — MISSING EVIDENCE IS UNKNOWN, NEVER ZERO: a job whose record of its calls is gone is served as not known, with no counts", async () => {
  await twoTexts({
    slug: slugOf("gone"), route: textRoute(W_HEAD, W_HOURS, ["page:/visit"], ["page:/about"], "/visit", "/about"),
    message: { first: W_HEAD, second: W_HOURS },
    answer0: (args) => ({ edits: [{ id: lineId(args, "visit.tsx", HEAD), to: HEAD_TO }] }),
    answer1: (args) => ({ edits: [{ id: lineId(args, "about.tsx", HOURS_LINE), to: HOURS_TO }] }),
    check: async (P, rec, r, view) => {
      assert.equal(useOf(view, 1).known, true, "CONTROL: the evidence was there before it was removed");
      const job = rec.parts[1].jobs.find((j) => j.kind === "run");
      assert.ok(P.objects.delete("jobs/prepared/" + job.id + ".use.json"), "the evidence was not where the Worker keeps it");
      const again = await viewOf(P, r.key);
      assert.deepEqual(useOf(again, 1), { job: job.id, known: false });
    },
  });
});

// ── A SCOPED ANSWER THAT ASKED, THEN A WIDENED CALL THAT FAILED (round 4) ────
// Codex: the evidence was noted only after the widened call succeeded, so here
// the job saved `scoped: 0, needs: 0` beside an answer that had asked. Through
// the real driver, queue consumer, job and request view: the job's replayed
// scoped answer says `needs`, its widened (fresh) call throws, and the saved
// evidence still says the answer asked. The part fails as any failed model
// call does; nothing about its outcome or charge changes.
/** The job's evidence as the Worker saved it (`jobs/prepared/<id>.use.json`). */
async function savedUse(P, id) {
  const k = "jobs/prepared/" + id + ".use.json";
  assert.ok(typeof id === "string" && P.objects.has(k), "no saved evidence for job " + id);
  const o = P.objects.get(k);
  const text = typeof o === "string" ? o : o && typeof o.text === "function" ? await o.text() : o && o.body !== undefined ? (typeof o.body === "string" ? o.body : new TextDecoder().decode(o.body)) : JSON.stringify(o);
  return JSON.parse(text);
}
const failWidened = () => { const e = new Error("upstream 529"); e.status = 529; throw e; };

test("IND 9 — DATA: the scoped answer said needs and the job's widened call failed — the saved job evidence and the request view say scoped 1, needs 1 (never 0, never not-scoped); the price is left as it was", async () => {
  let wide = 0;
  await twoRows({
    slug: slugOf("nf"), writes0: ["data:hours"], writes1: ["data:loaves"], second: W_RYE_HOUR, rye: 5.2, want: ["done", "failed"],
    answer1: (args) => {
      if (!/day="Monday", opens=/.test(content(args))) return { needs: true, changes: [] };
      if (++wide >= 2) failWidened(); // the preparation's own widened call answers; the job's fails
      return { changes: [{ table: "loaves", id: 2, values: { price: 7 } }] };
    },
    check: async (P, rec, r, view) => {
      assert.equal(rec.parts[1].prep.outcome, "ready", JSON.stringify(rec.parts[1].prep));
      assert.deepEqual(seenOf(useOf(view, 1)), { scoped: 1, needs: 1 }, "the answer that asked for context left no evidence");
      const saved = await savedUse(P, view.parts[1].prepUse[0].job);
      assert.equal(saved.v, 3);
      assert.equal(saved.scoped, 1);
      assert.equal(saved.needs, 1);
    },
  });
});

test("IND 10 — TEXT: the same for the text step — its scoped answer said needs, the job's widened call failed; the saved evidence and the view say scoped 1, needs 1, and the About line is unchanged", async () => {
  const W_FR = "on the About page make the Our story heading say in French what the Visit page heading says";
  let wide = 0;
  await twoTexts({
    slug: slugOf("tf"), route: textRoute(W_HEAD, W_FR, ["page:/visit"], ["page:/about"], "/visit", "/about"),
    message: { first: W_HEAD, second: W_FR },
    answer0: (args) => ({ edits: [{ id: lineId(args, "visit.tsx", HEAD), to: HEAD_TO }] }),
    answer1: (args) => {
      const line = content(args).split("\n").find((l) => /^\d+\. \[visit\.tsx\] Come to the/.test(l));
      if (!line) return { needs: true, edits: [] };
      if (++wide >= 2) failWidened();
      return { edits: [{ id: lineId(args, "about.tsx", "Our story"), to: "Venez" }] };
    },
    check: async (P, rec, r, view) => {
      assert.equal(rec.parts[1].status, "failed", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
      assert.ok(P.page("visit.tsx").includes(HEAD_TO));
      assert.ok(P.page("about.tsx").includes("Our story") && !P.page("about.tsx").includes("Venez"), P.page("about.tsx"));
      assert.deepEqual(seenOf(useOf(view, 1)), { scoped: 1, needs: 1 }, "the answer that asked for context left no evidence");
      const saved = await savedUse(P, view.parts[1].prepUse[0].job);
      assert.equal(saved.scoped, 1);
      assert.equal(saved.needs, 1);
    },
  });
});

// ── THE JOB HANDLER ITSELF THROWS AFTER THE SCOPED ANSWER SAID `needs` ──────
// Round 4 moved the evidence write into the job handler's `finally`, and left
// it untested with a handler that throws. Here the job's replayed scoped
// answer says `needs`, its widened call answers, and then the handler throws
// out of `handleRequest` itself: the edit route's reply throws, and so does
// the route-level catch's own reply (`Response.json`, made to throw twice for
// this case only — no product code is touched). The job fails as an escaped
// throw does ("edit queue: job failed"); the saved evidence and the request
// view must still say the answer asked.
test("IND 11 — THE HANDLER THROWS: after the scoped answer said needs, the job handler's own throw escapes handleRequest; the saved job evidence and the request view still say scoped 1, needs 1, and the part is run again as before", async () => {
  const W_FR = "on the About page make the Our story heading say in French what the Visit page heading says";
  const orig = Response.json;
  const errors = [];
  const origErr = console.error;
  console.error = (...a) => { errors.push(a.map(String).join(" ")); };
  let wide = 0, armed = false;
  try {
    await twoTexts({
      slug: slugOf("ht"), route: textRoute(W_HEAD, W_FR, ["page:/visit"], ["page:/about"], "/visit", "/about"),
      message: { first: W_HEAD, second: W_FR },
      answer0: (args) => ({ edits: [{ id: lineId(args, "visit.tsx", HEAD), to: HEAD_TO }] }),
      answer1: (args) => {
        const line = content(args).split("\n").find((l) => /^\d+\. \[visit\.tsx\] Come to the/.test(l));
        if (!line) return { needs: true, edits: [] };
        // THE JOB'S WIDENED CALL (the preparation's is the first): from here
        // the handler's next two replies throw — the route's, then its catch's.
        if (++wide === 2 && !armed) {
          armed = true;
          let n = 0;
          Response.json = function () { if (++n >= 2) Response.json = orig; throw new Error("the handler threw"); };
        }
        return { edits: [{ id: lineId(args, "about.tsx", "Our story"), to: "Venez" }] };
      },
      check: async (P, rec, r, view) => {
        assert.ok(armed, "the throw was never armed");
        assert.ok(errors.some((e) => /edit queue: job failed .*the handler threw/.test(e)), "the throw did not escape the handler: " + JSON.stringify(errors.slice(-5)));
        // RETRIES ARE UNCHANGED: the part's next job ran as it always would.
        const uses = view.parts[1].prepUse;
        assert.ok(Array.isArray(uses) && uses.length >= 1, JSON.stringify(view.parts[1]));
        // THE JOB WHOSE HANDLER THREW: its evidence is saved, and says the answer asked.
        const thrown = errors.map((e) => /edit queue: job failed ([0-9a-f]{32}) .*the handler threw/.exec(e)).find(Boolean)[1];
        const u = uses.find((x) => x.job === thrown);
        assert.ok(u, "no evidence served for the job whose handler threw: " + JSON.stringify(uses));
        assert.deepEqual({ known: u.known, scoped: u.scoped, needs: u.needs }, { known: true, scoped: 1, needs: 1 }, "the evidence did not survive the handler's throw");
        assert.ok(uses.some((x) => x.job !== thrown), "the part was not run again after the throw: " + JSON.stringify(uses));
        const saved = await savedUse(P, thrown);
        assert.equal(saved.v, 3);
        assert.equal(saved.scoped, 1);
        assert.equal(saved.needs, 1);
      },
    });
  } finally {
    Response.json = orig;
    console.error = origErr;
  }
});
