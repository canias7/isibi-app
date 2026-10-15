// JOBS OF ONE REQUEST SIDE BY SIDE (2026-10-15, the concurrent-execution
// round). With `PARALLEL_WRITES=on` (the fixture's `beside`), the request driver
// files a part's job beside the jobs of its request already running when their
// targets do not conflict (builder/request-plan.mjs `clearToWrite`); the
// site's lock lets jobs of one request hold the site together
// (supabase/proposed/request_beside.sql, mirrored by the fixture); and every
// publish takes the site's publish turn and applies only its own changes onto
// the site as it is then (builder/publish-turn.mjs, worker.js
// `recompileAndPublish`). Driven through the real Worker: the queue, the job
// runner, the routes, the publish spine and the ledger, with the model's
// answers supplied and held where a case says.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, deliver, settle, T } from "./fixtures/request-flow.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";

blockNetwork();

const slugOf = (k) => "cw-" + k + "-" + Math.random().toString(16).slice(2, 8);
async function withPlatform(opts, fn) {
  const compiler = installCompiler();
  const P = platform(opts);
  try { const out = await fn(P); await P.settle(); assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for"); return out; } finally { P.close(); compiler.uninstall(); }
}
const statuses = (rec) => rec.parts.map((p) => p.status);
const calls = (P, tool) => P.modelLog.filter((m) => m.tool === tool);
const reserveOf = (P, jobId) => P.ledger.filter((e) => e.ref.startsWith(jobId + "#") && e.reason === "reserve").map((e) => -e.delta);
const lineId = (args, file, line) => {
  const at = String(args.messages[0].content).split("\n").find((l) => l.includes("[" + file + "] " + line));
  return Number(String(at || "-1.").split(".")[0]);
};
/** The part a queued job message is for, from its job row's idem key (`<key>-p<n>-<seq>`); -1 for anything else. */
const partOfMsg = (P, m) => { const id = m.body && (m.body.id || m.body.job); const j = id ? P.jobs.get(id) : null; const g = j && /-p(\d+)-\d+$/.exec(String(j.idem_key || "")); return g ? Number(g[1]) : -1; };
const P_ = { at: null };
/** Deliver what the queue holds, one message at a time, until `stop()` or nothing is left. */
async function drain(P, stop = () => false, { max = 16, each = null } = {}) {
  for (let i = 0; i < max && !stop(); i++) {
    const m = P.queue.shift();
    if (!m) { await new Promise((ok) => setTimeout(ok, 20)); if (!P.queue.length) return; continue; }
    if (each) await each(m); else await deliver(P, m);
  }
}
const editJobs = (P, key) => P.jobsOf(key).filter((j) => j.op === "edit");
const editOfPart = (P, key, n) => editJobs(P, key).filter((j) => new RegExp("-p" + n + "-\\d+$").test(j.idem_key));
const until = async (cond, ms = 4000) => { const end = Date.now() + ms; while (Date.now() < end) { if (cond()) return true; await new Promise((ok) => setTimeout(ok, 10)); } return cond(); };

const HOME_FROM = "Bread from the harbour, every morning.";
const HOME_TO = "Open from 8 every morning.";
const TT_FROM = "Follow us on TikTok at @oldloaf";
const TT_TO = "Follow us on TikTok at @harbourloaf";
const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1><p>" + HOME_FROM + "</p></section>");
const VISIT = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>" + TT_FROM + "</p></section>");
const PAGES2 = [{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }];
const TIKTOK = "Change our TikTok link on the Visit page to @harbourloaf";
const OPEN = "change the opening line on the home page to say we open at 8";
// Two text changes, each on its own page: independent.
const ROUTE_TWO_PAGES = [
  { intent: "edit", layer: "text", page: "/visit", alsoAsked: [OPEN], targets: [{ change: 0, writes: ["page:/visit"] }, { change: 1, writes: ["page:/"] }] },
  { intent: "edit", layer: "text", page: "/" },
];
const isVisitAsk = (args) => String(args.messages[0].content).includes("WHAT THEY ASKED FOR\n" + TIKTOK);

test("CW1 EXECUTION OVERLAP, BOTH OUTCOMES KEPT — two text changes on two pages of one message: the home page's job runs from its claim to its publish while the Visit page's job is still inside its model call; the Visit job then publishes from the copy it began with, and the home change is kept, not overwritten; each job charged once", async () => {
  const seen = { visitHeld: false, homeLiveWhileVisitHeld: false, leasedTogether: 0 };
  await withPlatform({
    slug: slugOf("cw1"), pages: PAGES2, beside: true,
    answers: {
      route: ROUTE_TWO_PAGES,
      [T.text]: async (args) => {
        if (isVisitAsk(args)) {
          // THE VISIT JOB'S MODEL CALL answers only once the home page's
          // change is ON THE STORED SITE — published by the other job while
          // this one holds its lease and waits inside its call.
          seen.visitHeld = true;
          const P = P_.at;
          const opened = await until(() => { const p = P.page("index.tsx"); return typeof p === "string" && p.includes(HOME_TO); }, 6000);
          seen.homeLiveWhileVisitHeld = opened;
          return { edits: [{ id: lineId(args, "visit.tsx", TT_FROM), to: TT_TO }] };
        }
        const P = P_.at;
        seen.leasedTogether = Math.max(seen.leasedTogether, [...P.jobs.values()].filter((j) => j.slug === P.slug && j.op === "edit" && j.lease_owner && j.lease_expires_at > P.now() && !["queued", "done", "failed", "cancelled", "lost"].includes(j.state)).length);
        return { edits: [{ id: lineId(args, "index.tsx", HOME_FROM), to: HOME_TO }] };
      },
    },
  }, async (P) => {
    P_.at = P;
    const r = await sendMessage(P, { message: TIKTOK + ", and " + OPEN + "." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    // Part 0's job is filed (part 1's routing may be filed beside it, since a
    // routing writes nothing); part 0's runs and is held inside its model call.
    const first = P.queue.filter((m) => m.body.kind !== "request-prep" && partOfMsg(P, m) === 0);
    assert.equal(first.length, 1, JSON.stringify(P.queue.map((m) => [m.body.kind, partOfMsg(P, m)])));
    P.queue.splice(P.queue.indexOf(first[0]), 1);
    const visitRun = deliver(P, first[0]);
    assert.ok(await until(() => seen.visitHeld), "the Visit job never reached its model call");
    // EVERYTHING ELSE AS THE QUEUE HANDS IT OVER, while the Visit job is held:
    // part 1's preparation, its routing job, its edit job — filed BESIDE the
    // running Visit job, claimed though the Visit job holds the site.
    for (let i = 0; i < 12 && !seen.homeLiveWhileVisitHeld; i++) {
      const m = P.queue.shift();
      if (!m) { await new Promise((ok) => setTimeout(ok, 20)); continue; }
      await deliver(P, m);
      if (P.page("index.tsx").includes(HOME_TO)) break;
    }
    assert.ok(P.page("index.tsx").includes(HOME_TO), "the home job did not publish while the Visit job was held: " + JSON.stringify(P.record(r.key).parts.map((p) => [p.status, p.why])) + " " + JSON.stringify(P.jobsOf(r.key).map((j) => [j.op, j.state, j.error, JSON.stringify(j.result || null).slice(0, 700)])));
    assert.ok(seen.leasedTogether >= 2 || P.jobsOf(r.key).some((j) => j.op === "edit" && j.state !== "done"), "the home job's call was not made while the Visit job held its lease");
    await visitRun;
    assert.equal(seen.homeLiveWhileVisitHeld, true, "the Visit job's call answered before the home change was published — no execution overlap");
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    // BOTH OUTCOMES KEPT: the Visit job began before the home change and
    // published after it; its publish carried only its own file.
    assert.ok(P.page("visit.tsx").includes(TT_TO) && !P.page("visit.tsx").includes(TT_FROM), "the Visit change is missing");
    assert.ok(P.page("index.tsx").includes(HOME_TO) && !P.page("index.tsx").includes(HOME_FROM), "the home change was overwritten by the Visit job's old copy");
    // EACH JOB ONCE, EACH CHARGED ONCE; the turn given back.
    const edits = P.jobsOf(r.key).filter((j) => j.op === "edit");
    assert.equal(edits.length, 2, JSON.stringify(P.jobsOf(r.key).map((j) => j.op + ":" + j.state)));
    for (const j of edits) { assert.equal(j.state, "done"); assert.equal(reserveOf(P, j.id).length, 1, "a job was not charged exactly once"); }
    const turn = P.readObj("publish-turn/" + P.slug + ".json");
    assert.ok(!turn || JSON.parse(turn).until === 0, "the site's turn was left held: " + turn);
  });
});

const HEAD_FROM = "Harbour Loaf";
const HEAD_TO = "Harbour Loaf Bakery";
const HEADING = "make the home page heading say Harbour Loaf Bakery";
const asks = (args, words) => String(args.messages[0].content).includes("WHAT THEY ASKED FOR\n" + words);

test("CW2 CONFLICTING CHANGES WAIT — two changes to the SAME page: the second part's edit job is never filed while the first is running, even with jobs side by side on; once it ends, the second runs against the first's result and both are kept", async () => {
  let release = null; const freed = new Promise((ok) => { release = ok; });
  const seen = { firstHeld: false };
  await withPlatform({
    slug: slugOf("cw2"), pages: PAGES2, beside: true,
    answers: {
      route: [
        { intent: "edit", layer: "text", page: "/", alsoAsked: [HEADING], targets: [{ change: 0, writes: ["page:/"] }, { change: 1, writes: ["page:/"] }] },
        { intent: "edit", layer: "text", page: "/" },
      ],
      [T.text]: async (args) => {
        if (asks(args, OPEN)) { seen.firstHeld = true; await freed; return { edits: [{ id: lineId(args, "index.tsx", HOME_FROM), to: HOME_TO }] }; }
        return { edits: [{ id: lineId(args, "index.tsx", HEAD_FROM), to: HEAD_TO }] };
      },
    },
  }, async (P) => {
    P_.at = P;
    const r = await sendMessage(P, { message: OPEN + ", and " + HEADING + "." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const first = P.queue.find((m) => m.body.kind !== "request-prep" && partOfMsg(P, m) === 0);
    P.queue.splice(P.queue.indexOf(first), 1);
    const run0 = deliver(P, first);
    assert.ok(await until(() => seen.firstHeld), "the first job never reached its model call");
    // EVERYTHING THE QUEUE HAS while the first job is held: the second part may
    // be prepared and routed, never written.
    await drain(P, () => false, { max: 10 });
    assert.equal(editOfPart(P, r.key, 1).length, 0, "the second part's edit job was filed while a job changing the same page ran: " + JSON.stringify(P.jobsOf(r.key).map((j) => j.op + ":" + j.state)));
    assert.equal(P.page("index.tsx").includes(HEAD_TO), false, "the second change was published while the first job ran");
    release();
    await run0;
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.ok(P.page("index.tsx").includes(HOME_TO) && P.page("index.tsx").includes(HEAD_TO), "a change is missing: " + P.page("index.tsx"));
    for (const j of editJobs(P, r.key)) assert.equal(reserveOf(P, j.id).length, 1);
  });
});

test("CW3 A DEPENDENT PART WAITS FOR ITS PREREQUISITE — the model said the home change rests on the Visit change: with jobs side by side on, the home part files no job of any kind while the Visit job runs, then runs once it is done", async () => {
  let release = null; const freed = new Promise((ok) => { release = ok; });
  const seen = { visitHeld: false, homeAskedWhileHeld: false };
  await withPlatform({
    slug: slugOf("cw3"), pages: PAGES2, beside: true,
    answers: {
      route: [
        { intent: "edit", layer: "text", page: "/visit", alsoAsked: [OPEN], targets: [{ change: 0, writes: ["page:/visit"] }, { change: 1, writes: ["page:/"] }], dependsOn: [{ change: 1, after: [0] }] },
        { intent: "edit", layer: "text", page: "/" },
      ],
      [T.text]: async (args) => {
        if (isVisitAsk(args)) { seen.visitHeld = true; await freed; return { edits: [{ id: lineId(args, "visit.tsx", TT_FROM), to: TT_TO }] }; }
        if (!seen.released) seen.homeAskedWhileHeld = true;
        return { edits: [{ id: lineId(args, "index.tsx", HOME_FROM), to: HOME_TO }] };
      },
    },
  }, async (P) => {
    P_.at = P;
    const r = await sendMessage(P, { message: TIKTOK + ", and " + OPEN + "." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(P.record(r.key).parts[1].needs, [0], "the dependency was not recorded");
    const first = P.queue.find((m) => m.body.kind !== "request-prep" && partOfMsg(P, m) === 0);
    P.queue.splice(P.queue.indexOf(first), 1);
    const run0 = deliver(P, first);
    assert.ok(await until(() => seen.visitHeld), "the Visit job never reached its model call");
    await drain(P, () => false, { max: 10 });
    assert.equal(P.jobsOf(r.key).filter((j) => /-p1-\d+$/.test(j.idem_key)).length, 0, "the dependent part filed a job before its prerequisite ended");
    assert.equal(P.record(r.key).parts[1].status, "blocked");
    assert.equal(seen.homeAskedWhileHeld, false, "the dependent part's step was asked before its prerequisite ended");
    seen.released = true;
    release();
    await run0;
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.ok(P.page("visit.tsx").includes(TT_TO) && P.page("index.tsx").includes(HOME_TO));
  });
});

test("CW4 A JOB RUNNING BESIDE ANOTHER, DELIVERED TWICE AT ONCE — the home job's message is handed to two consumers together while the Visit job is held: it runs once, publishes once, is charged once, and both changes are kept", async () => {
  const seen = { visitHeld: false };
  await withPlatform({
    slug: slugOf("cw4"), pages: PAGES2, beside: true,
    answers: {
      route: ROUTE_TWO_PAGES,
      [T.text]: async (args) => {
        if (isVisitAsk(args)) { seen.visitHeld = true; const P = P_.at; await until(() => (P.page("index.tsx") || "").includes(HOME_TO), 6000); return { edits: [{ id: lineId(args, "visit.tsx", TT_FROM), to: TT_TO }] }; }
        return { edits: [{ id: lineId(args, "index.tsx", HOME_FROM), to: HOME_TO }] };
      },
    },
  }, async (P) => {
    P_.at = P;
    const r = await sendMessage(P, { message: TIKTOK + ", and " + OPEN + "." });
    const first = P.queue.find((m) => m.body.kind !== "request-prep" && partOfMsg(P, m) === 0);
    P.queue.splice(P.queue.indexOf(first), 1);
    const run0 = deliver(P, first);
    assert.ok(await until(() => seen.visitHeld));
    let twice = 0;
    await drain(P, () => (P.page("index.tsx") || "").includes(HOME_TO), {
      max: 14,
      each: async (m) => {
        const j = m.body && P.jobs.get(m.body.id);
        if (j && j.op === "edit" && /-p1-\d+$/.test(j.idem_key)) { twice++; await Promise.all([deliver(P, m), deliver(P, m)]); }
        else await deliver(P, m);
      },
    });
    assert.equal(twice, 1, "the home job's message was not delivered twice at once");
    await run0;
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    const home = editOfPart(P, r.key, 1);
    assert.equal(home.length, 1, "the home part's job was filed twice");
    assert.equal(reserveOf(P, home[0].id).length, 1, "the home job was charged more than once");
    assert.equal((P.page("index.tsx").match(/Open from 8 every morning\./g) || []).length, 1);
    assert.ok(P.page("visit.tsx").includes(TT_TO), "the Visit change is missing");
    assert.equal(P.rpcLog.filter((e) => e.fn === "edit_may_publish" && e.args.p_id === home[0].id && e.out && e.out.granted === true).length, 1, "the home job was granted its publish more than once");
  });
});

test("CW5 A REAL OVERLAP CAUGHT AT PUBLISH — the router said the Visit change touches only the Visit page, but its job changed the home page's line too, which the home job had already published differently: the Visit job's publish is refused as a conflict, nothing it held is written, the home change stands, and its reserve is given back", async () => {
  const seen = { visitHeld: false };
  await withPlatform({
    slug: slugOf("cw5"), pages: PAGES2, beside: true,
    answers: {
      route: ROUTE_TWO_PAGES,
      [T.text]: async (args) => {
        if (isVisitAsk(args)) {
          seen.visitHeld = true;
          const P = P_.at;
          await until(() => (P.page("index.tsx") || "").includes(HOME_TO), 6000);
          return { edits: [{ id: lineId(args, "visit.tsx", TT_FROM), to: TT_TO }, { id: lineId(args, "index.tsx", HOME_FROM), to: "Open from 9 every morning." }] };
        }
        return { edits: [{ id: lineId(args, "index.tsx", HOME_FROM), to: HOME_TO }] };
      },
    },
  }, async (P) => {
    P_.at = P;
    const r = await sendMessage(P, { message: TIKTOK + ", and " + OPEN + "." });
    const first = P.queue.find((m) => m.body.kind !== "request-prep" && partOfMsg(P, m) === 0);
    P.queue.splice(P.queue.indexOf(first), 1);
    const run0 = deliver(P, first);
    assert.ok(await until(() => seen.visitHeld));
    await drain(P, () => (P.page("index.tsx") || "").includes(HOME_TO), { max: 14 });
    assert.ok(P.page("index.tsx").includes(HOME_TO), "the home job did not publish while the Visit job was held");
    await run0;
    const { rec } = await settle(P, r.key);
    assert.equal(rec.parts[1].status, "done");
    assert.equal(rec.parts[0].status, "failed", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    // NOTHING OVERWRITTEN, NOTHING OF THE REFUSED JOB WRITTEN.
    assert.ok(P.page("index.tsx").includes(HOME_TO) && !P.page("index.tsx").includes("Open from 9"), "the home change was overwritten: " + P.page("index.tsx"));
    assert.ok(P.page("visit.tsx").includes(TT_FROM), "the refused job wrote part of its change");
    const visit = editOfPart(P, r.key, 0)[0];
    assert.match(JSON.stringify(visit.result || ""), /conflict|at the same time/, "the refusal does not say it was a conflict: " + JSON.stringify(visit.result).slice(0, 300));
    // RESERVED, THEN GIVEN BACK IN FULL: the refusal is our side, never charged.
    assert.equal(visit.billing, "refunded", "the refused job was not refunded: " + visit.billing);
    const res = reserveOf(P, visit.id).reduce((a, b) => a + b, 0);
    const back = P.ledger.filter((e) => e.ref === visit.id && e.reason === "refund").reduce((a, e) => a + e.delta, 0);
    assert.ok(res > 0 && back === res, "reserved " + res + ", given back " + back);
  });
});

test("CW6 CONTROL, SWITCH OFF — the same two-page message with jobs side by side off: the home part's edit job is not filed while the Visit job runs, so nothing overlaps; both changes still land one after the other", async () => {
  const seen = { visitHeld: false, opened: null };
  await withPlatform({
    slug: slugOf("cw6"), pages: PAGES2,
    answers: {
      route: ROUTE_TWO_PAGES,
      [T.text]: async (args) => {
        if (isVisitAsk(args)) { seen.visitHeld = true; const P = P_.at; seen.opened = await until(() => (P.page("index.tsx") || "").includes(HOME_TO), 700); return { edits: [{ id: lineId(args, "visit.tsx", TT_FROM), to: TT_TO }] }; }
        return { edits: [{ id: lineId(args, "index.tsx", HOME_FROM), to: HOME_TO }] };
      },
    },
  }, async (P) => {
    P_.at = P;
    const r = await sendMessage(P, { message: TIKTOK + ", and " + OPEN + "." });
    const first = P.queue.find((m) => m.body.kind !== "request-prep" && partOfMsg(P, m) === 0);
    P.queue.splice(P.queue.indexOf(first), 1);
    const run0 = deliver(P, first);
    assert.ok(await until(() => seen.visitHeld));
    await drain(P, () => false, { max: 10 });
    // OFF, NOTHING BESIDE IT: no second job of any kind (routing included) is
    // filed while the first runs — not merely held back by the site's lock.
    assert.equal(P.jobsOf(r.key).length, 1, "with the switch off a second job of the request was filed while one ran: " + JSON.stringify(P.jobsOf(r.key).map((j) => j.op + ":" + j.state)));
    await run0;
    assert.equal(seen.opened, false, "with the switch off the home change was published while the Visit job was held");
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.ok(P.page("visit.tsx").includes(TT_TO) && P.page("index.tsx").includes(HOME_TO));
    assert.equal(P.readObj("publish-turn/" + P.slug + ".json"), null, "the publish turn was used with the switch off");
  });
});

test("CW7 ONE PUBLISH AT A TIME — the site's publish turn is held by another job: a request job with its change ready does not publish, and nothing of it reaches the site, until the turn is given back; then it publishes once", async () => {
  await withPlatform({
    slug: slugOf("cw7"), pages: PAGES2, beside: true,
    answers: {
      // The router names the page it writes, so the step is not a whole-site
      // one (which would hold the turn from its start) and takes the turn at
      // its publish.
      route: [{ intent: "edit", layer: "text", page: "/", targets: [{ change: 0, writes: ["page:/"] }] }],
      [T.text]: async (args) => ({ edits: [{ id: lineId(args, "index.tsx", HOME_FROM), to: HOME_TO }] }),
    },
  }, async (P) => {
    P_.at = P;
    const key = "publish-turn/" + P.slug + ".json";
    const held = { v: 1, owner: "job:another:o9", job: "another", at: Date.now(), until: Date.now() + 10 * 60 * 1000 };
    P.writeObj(key, JSON.stringify(held));
    const r = await sendMessage(P, { message: OPEN + "." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const m = P.queue.find((x) => x.body.kind !== "request-prep" && partOfMsg(P, x) === 0);
    P.queue.splice(P.queue.indexOf(m), 1);
    const run = deliver(P, m);
    const giveBack = () => P.writeObj(key, JSON.stringify({ ...held, until: 0 }));
    try {
    // HELD: its change is made (its model call answered) but never published.
    assert.ok(await until(() => calls(P, T.text).length >= 1), "the job never reached its model call: " + JSON.stringify({ jobs: P.jobsOf(r.key).map((j) => [j.op, j.state, j.idem_key]), parts: P.record(r.key).parts.map((p) => [p.status, p.phase]), queue: P.queue.map((x) => x.body.kind), tools: P.modelLog.map((x) => x.tool) }));
    await new Promise((ok) => setTimeout(ok, 300));
    assert.equal(P.page("index.tsx").includes(HOME_TO), false, "the job published while another held the site's turn");
    assert.equal(JSON.parse(P.readObj(key)).owner, "job:another:o9", "the held turn was taken over");
    const job = editJobs(P, r.key)[0];
    assert.ok(job && job.state !== "done", "the job ended while the turn was held");
    } finally { giveBack(); }
    // GIVEN BACK: the job takes the turn, publishes, and gives it back.
    await run;
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.ok(P.page("index.tsx").includes(HOME_TO));
    assert.equal(JSON.parse(P.readObj(key)).until, 0, "the turn was not given back");
    assert.notEqual(JSON.parse(P.readObj(key)).owner, "job:another:o9", "the job never took the turn");
    assert.equal(reserveOf(P, editJobs(P, r.key)[0].id).length, 1);
  });
});

// ── A TURN LOST TO ANOTHER JOB (2026-10-15, after review) ────────────────────
// `renewTurn` can answer no and a turn can lapse to another job; the job that
// held it must then never publish, repair, write or put back the config, or
// give back the turn that is now another's — and it ends through the ordinary
// stop: failed, its reserve refunded.
const TAKEN = (P) => ({ v: 1, owner: "job:newer:o2", job: "newer", at: Date.now(), until: Date.now() + 10 * 60 * 1000 });
const turnKeyOf = (P) => "publish-turn/" + P.slug + ".json";
const refundedOnce = (P, jobId) => P.ledger.filter((e) => e.ref === jobId && e.reason === "refund").length === 1;

test("CW8 A STALE HOLDER CANNOT PUBLISH — a whole-site step holds the site's turn from its start; inside its model call the turn lapses and another job takes it; the stale job publishes nothing, gives back nothing, and ends failed with its reserve refunded", async () => {
  const seen = { held: false }; let release = null; const freed = new Promise((ok) => { release = ok; });
  await withPlatform({
    slug: slugOf("cw8"), pages: PAGES2, beside: true,
    answers: {
      // NO PAGE NAMED: a whole-site step, which holds the turn throughout.
      route: [{ intent: "edit", layer: "text" }],
      [T.text]: async (args) => { seen.held = true; await freed; return { edits: [{ id: lineId(args, "index.tsx", HOME_FROM), to: HOME_TO }] }; },
    },
  }, async (P) => {
    P_.at = P;
    const r = await sendMessage(P, { message: OPEN + "." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const m = P.queue.find((x) => x.body.kind !== "request-prep" && partOfMsg(P, x) === 0);
    P.queue.splice(P.queue.indexOf(m), 1);
    const run = deliver(P, m);
    try {
      assert.ok(await until(() => seen.held), "the job never reached its model call");
      const mine = JSON.parse(P.readObj(turnKeyOf(P)));
      assert.match(mine.owner, /^job:/, "the whole-site step did not take the turn at its start");
      // THE TURN LAPSES AND ANOTHER JOB TAKES IT.
      P.writeObj(turnKeyOf(P), JSON.stringify(TAKEN(P)));
    } finally { release(); }
    await run;
    const turn = JSON.parse(P.readObj(turnKeyOf(P)));
    assert.equal(turn.owner, "job:newer:o2", "the stale job took the turn back or wrote over it");
    assert.ok(turn.until > Date.now(), "the stale job gave back the newer job's turn");
    assert.equal(P.page("index.tsx").includes(HOME_TO), false, "the stale job published");
    const job = editJobs(P, r.key)[0];
    assert.equal(job.state, "failed", JSON.stringify([job.state, job.error, JSON.stringify(job.result || null).slice(0, 400)]));
    assert.equal(reserveOf(P, job.id).length, 1, "the stale job's reserve");
    assert.ok(refundedOnce(P, job.id), "the stale job's reserve was not refunded exactly once: " + JSON.stringify(P.ledger.filter((e) => String(e.ref).startsWith(job.id))));
    // SAID AS WHAT HAPPENED: another change of the request had the turn —
    // never the build service restarting.
    const said = JSON.parse(job.result.body);
    assert.match(said.msg, /another change in the same request/, said.msg);
    assert.doesNotMatch(said.msg, /restarting/);
    // GIVE THE NEWER JOB'S TURN BACK, so the request can settle.
    P.writeObj(turnKeyOf(P), JSON.stringify({ ...TAKEN(P), until: 0 }));
  });
});

test("CW9 A STALE CONFIG HOLDER CANNOT PUBLISH OR PUT THE CONFIG BACK — a description change writes the config under its turn; held at its compile, the turn lapses and another job takes it and writes the config; the stale job's commit is refused, its put-back writes nothing over the newer config, the turn stays the newer job's, and the stale job is refunded", async () => {
  let release = null; const freed = new Promise((ok) => { release = ok; });
  const seen = { compiling: false };
  const compiler = installCompiler({ before: async () => { seen.compiling = true; await freed; } });
  const P = platform({
    slug: slugOf("cw9"), pages: PAGES2, beside: true,
    answers: {
      route: [{ intent: "edit", layer: "look" }],
      [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: "Change the site description to say we bake overnight sourdough" }] },
      "lane:description": "Overnight sourdough from a harbour side street.",
    },
  });
  try {
    P_.at = P;
    const r = await sendMessage(P, { message: "Change the site description to say we bake overnight sourdough." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const m = P.queue.find((x) => x.body.kind !== "request-prep" && partOfMsg(P, x) === 0);
    P.queue.splice(P.queue.indexOf(m), 1);
    const run = deliver(P, m);
    const NEWER = "The newer job's description.";
    try {
      assert.ok(await until(() => seen.compiling, 6000), "the description job never reached its compile: " + JSON.stringify(P.jobsOf(r.key).map((j) => [j.op, j.state, j.error])));
      assert.equal(P.look().description, "Overnight sourdough from a harbour side street.", "the description was not written under the turn before the compile");
      // THE TURN LAPSES; ANOTHER JOB TAKES IT AND WRITES THE CONFIG.
      P.writeObj(turnKeyOf(P), JSON.stringify(TAKEN(P)));
      const cfgKey = [...P.objects.keys()].find((k) => /config/.test(k) && k.includes(P.slug) && P.readObj(k).includes("description"));
      const cfg = JSON.parse(P.readObj(cfgKey));
      P.writeObj(cfgKey, JSON.stringify({ ...cfg, look: { ...cfg.look, description: NEWER } }));
    } finally { release(); }
    await run;
    assert.equal(P.look().description, NEWER, "the stale job wrote the config over the newer job's (its put-back ran on a turn it no longer held)");
    const turn = JSON.parse(P.readObj(turnKeyOf(P)));
    assert.equal(turn.owner, "job:newer:o2");
    assert.ok(turn.until > Date.now(), "the stale job gave back the newer job's turn");
    const job = editJobs(P, r.key)[0];
    assert.equal(job.state, "failed", JSON.stringify([job.state, JSON.stringify(job.result || null).slice(0, 400)]));
    assert.ok(!job.published_at, "the stale job published");
    assert.ok(refundedOnce(P, job.id), "the stale job's reserve was not refunded exactly once: " + JSON.stringify(P.ledger.filter((e) => String(e.ref).startsWith(job.id))));
    P.writeObj(turnKeyOf(P), JSON.stringify({ ...TAKEN(P), until: 0 }));
    await P.settle();
    assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for");
  } finally { P.close(); compiler.uninstall(); }
});

// ── A CONFIG WRITER BESIDE AN INDEPENDENT TEXT JOB (2026-10-15, after review) ─
// Beyond two page edits: a look step (the site description) rewrites the
// config and holds the site's turn from its start; a text change on the Visit
// page writes no config and runs beside it, publishing when the turn is free.
const DESC_ASK = "Change the site description to say we bake overnight sourdough";
const DESC_TO = "Overnight sourdough from a harbour side street.";
const ROUTE_LOOK_AND_TEXT = [
  // THE ROUTER NAMES WHAT EACH CHANGE WRITES: the description the look (a
  // config write, so the step holds the turn), the TikTok line its page.
  { intent: "edit", layer: "look", alsoAsked: [TIKTOK], targets: [{ change: 0, writes: ["theme"] }, { change: 1, writes: ["page:/visit"] }] },
  { intent: "edit", layer: "text", page: "/visit", targets: [{ change: 0, writes: ["page:/visit"] }] },
];
const DESCRIBE_ANSWERS = { [T.pick]: { fields: ["description"], scopes: [{ part: "description", words: DESC_ASK }] }, "lane:description": DESC_TO };

/** Deliver every queued message as it arrives, without waiting on any, until `cond()` or `ms` pass. */
async function pumpUntil(P, cond, runs, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end && !cond()) {
    const m = P.queue.shift();
    if (m) runs.push(deliver(P, m)); else await new Promise((ok) => setTimeout(ok, 15));
  }
  return cond();
}
async function lookBesideText({ failFirstLookCompile = false, laterRoutes = [] }) {
  const seen = { lookCompiling: false, visitCallWhileLookHeld: false, lookCompiles: 0, failed: 0 };
  let release = null; const freed = new Promise((ok) => { release = ok; });
  const compiler = installCompiler({
    before: async (body) => {
      // THE LOOK JOB'S COMPILE carries the new description; held until the
      // Visit job has made its model call, and refused once when asked.
      if (!JSON.stringify(body).includes(DESC_TO)) return;
      seen.lookCompiles++;
      if (seen.lookCompiles === 1) { seen.lookCompiling = true; await freed; }
      if (failFirstLookCompile && seen.lookCompiles === 1) { seen.failed++; throw new Error("the build service restarted"); }
    },
  });
  const P = platform({
    slug: slugOf(failFirstLookCompile ? "cw11" : "cw10"), pages: PAGES2, beside: true,
    answers: {
      route: [...ROUTE_LOOK_AND_TEXT, ...laterRoutes], ...DESCRIBE_ANSWERS,
      // OVERLAP, READ OFF THE STORE: the Visit job's model call is made while
      // the description job holds the site's turn (it took it at its start
      // and holds it until it ends).
      [T.text]: async (args) => {
        const t = P_.at && P_.at.readObj("publish-turn/" + P_.at.slug + ".json");
        if (t && JSON.parse(t).until > Date.now()) seen.visitCallWhileLookHeld = true;
        return { edits: [{ id: lineId(args, "visit.tsx", TT_FROM), to: TT_TO }] };
      },
    },
  });
  return { P, seen, release, compiler };
}

test("CW10 A CONFIG WRITER BESIDE A TEXT JOB — a description change (config, the turn held from its start) and a Visit-page text change from one message: the text job is filed and makes its model call while the description job holds the site's turn; the text job publishes only once the turn is given back; both changes kept, each job charged once, the turn given back", async () => {
  const { P, seen, release, compiler } = await lookBesideText({});
  try {
    P_.at = P;
    const r = await sendMessage(P, { message: DESC_ASK + ", and " + TIKTOK + "." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const runs = [];
    try {
      await pumpUntil(P, () => seen.visitCallWhileLookHeld && seen.lookCompiling, runs);
      assert.ok(seen.lookCompiling, "the description job never reached its compile");
      assert.ok(seen.visitCallWhileLookHeld, "the Visit job's model call was not made while the description job held the turn: " + JSON.stringify(P.jobsOf(r.key).map((j) => [j.op, j.state, j.idem_key])));
      // THE TURN IS THE DESCRIPTION JOB'S: the Visit change is not published yet.
      await new Promise((ok) => setTimeout(ok, 150));
      assert.equal(P.page("visit.tsx").includes(TT_TO), false, "the Visit job published while the description job held the turn");
    } finally { release(); }
    await Promise.all(runs);
    const { rec } = await settle(P, r.key);
    assert.deepEqual(statuses(rec), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(P.look().description, DESC_TO, "the description change was lost");
    assert.ok(P.page("visit.tsx").includes(TT_TO), "the Visit change was lost");
    assert.ok(P.page("index.tsx").includes(HOME_FROM), "an unrelated page changed");
    const edits = editJobs(P, r.key);
    assert.equal(edits.length, 2, JSON.stringify(P.jobsOf(r.key).map((j) => j.op + ":" + j.state)));
    for (const j of edits) { assert.equal(j.state, "done"); assert.equal(reserveOf(P, j.id).length, 1, "a job was not charged exactly once"); }
    const turn = P.readObj(turnKeyOf(P));
    assert.ok(!turn || JSON.parse(turn).until === 0, "the site's turn was left held: " + turn);
    await P.settle();
    assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for");
  } finally { P.close(); compiler.uninstall(); }
});

test("CW11 A CONFIG WRITER FAILS BESIDE A TEXT JOB, AND RECOVERS — the description job's compile fails once: its config write is put back (never published), its reserve refunded, and the Visit change publishes and is kept; the request does not run it again unasked; asked again, the description lands beside the kept Visit change, and only the new job is charged", async () => {
  // THE SECOND ASK'S ROUTING: the description alone.
  const { P, seen, release, compiler } = await lookBesideText({ failFirstLookCompile: true, laterRoutes: [{ intent: "edit", layer: "look", targets: [{ change: 0, writes: ["theme"] }] }] });
  try {
    P_.at = P;
    const r = await sendMessage(P, { message: DESC_ASK + ", and " + TIKTOK + "." });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const runs = [];
    try { assert.ok(await pumpUntil(P, () => seen.visitCallWhileLookHeld && seen.lookCompiling, runs), "the Visit job's model call was not made while the description job was held"); }
    finally { release(); }
    await Promise.all(runs);
    // THE FAILED JOB: put back, refunded; the Visit job: done and kept.
    const failed = editOfPart(P, r.key, 0)[0];
    assert.ok(failed, "no description job");
    assert.equal(seen.failed, 1, "the description job's first compile was not refused");
    assert.equal(failed.state, "failed", JSON.stringify([failed.state, JSON.stringify(failed.result || null).slice(0, 400)]));
    assert.ok(refundedOnce(P, failed.id), "the failed description job was not refunded exactly once: " + JSON.stringify(P.ledger.filter((e) => String(e.ref).startsWith(failed.id))));
    const visitJob = editOfPart(P, r.key, 1)[0];
    assert.equal(visitJob && visitJob.state, "done");
    assert.ok(P.page("visit.tsx").includes(TT_TO), "the Visit change was lost when the description job failed");
    // THE PUT-BACK: the failed job's config write is not left in place, and
    // the request does not retry an ours-side failure on its own.
    const { rec } = await settle(P, r.key, { rounds: 20 });
    assert.deepEqual(statuses(rec), ["failed", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.notEqual(P.look().description, DESC_TO, "the failed description job's config write was left in place");
    assert.equal(editOfPart(P, r.key, 0).length, 1, "the failed part was run again without being asked");
    const turn = P.readObj(turnKeyOf(P));
    assert.ok(!turn || JSON.parse(turn).until === 0, "the site's turn was left held: " + turn);
    // RECOVERY: the customer asks for the description again; it lands, the
    // Visit change stays, and only the new job is charged.
    const again = await sendMessage(P, { message: DESC_ASK + "." });
    assert.equal(again.status, 200, JSON.stringify(again.body));
    const { rec: rec2 } = await settle(P, again.key, { rounds: 20 });
    assert.deepEqual(statuses(rec2), ["done"], JSON.stringify(rec2.parts.map((p) => [p.status, p.why])));
    assert.equal(P.look().description, DESC_TO, "the description did not land on the second ask");
    assert.ok(P.page("visit.tsx").includes(TT_TO), "the Visit change did not survive the recovery");
    const retry = editJobs(P, again.key);
    assert.equal(retry.length, 1);
    assert.equal(retry[0].state, "done");
    assert.equal(reserveOf(P, retry[0].id).length, 1, "the second ask was not charged exactly once");
    assert.ok(refundedOnce(P, failed.id), "the failed job's refund changed");
    assert.equal(reserveOf(P, visitJob.id).length, 1, "the Visit job was charged again");
    await P.settle();
    assert.deepEqual(P.unexpected, [], "requests the stand-ins were not set up for");
  } finally { P.close(); compiler.uninstall(); }
});
