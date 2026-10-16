// AN ADDITION BY WHAT IT WRITES, AND ITS DATABASE MADE BESIDE ITS PAGES
// (2026-10-16, branch `codex-work-into-claude`, after Codex's review of
// `99021708`).
//
//   AB1  the plan (unit): an addition is a config or schema writer by its
//        router targets — two additions of pages overlap; an addition naming a
//        table still waits for a rules step; one naming nothing is the whole
//        site; it holds the publish turn throughout only when it writes the
//        config, or when it runs again alone after an overlap
//   AB2  through the real add-on job: the database is made BESIDE the page
//        writer — the page call is made while the project create is still
//        running — and the addition then lands, one project, charged once
//   AB2b the same with the create failing: the page writer ran, the provision
//        fails, and the answer is the provision's own (nothing published,
//        refunded) — never a page over no database
//   AB3  side by side: an addition cleared without a table (its targets name a
//        page) designs a table while another part of its request is still
//        open — refused `conflict` before anything is made, at no cost; the
//        request runs it again alone, and it lands with its table, once
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, pump, tick, T } from "./fixtures/request-flow.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "./fixtures/rows-db.mjs";
import { writtenPage } from "./fixtures/addon-route.mjs";
import { besideConflict, holdsConfig, writesConfig, writesSchema } from "../builder/request-plan.mjs";

blockNetwork();

const SIGNUP = "Add a sign-up page where people leave their name and email address";
const PAGE = (path, name) => ({ path, name, purpose: "what " + name + " is for", sections: ["a band"], components: ["section-header"] });
const TABLE = { table: [{ table: { name: "signups", access: "collect", columns: [{ name: "name", type: "text" }] }, seed: [] }] };
const until = async (cond, ms = 6000) => { const end = Date.now() + ms; while (Date.now() < end) { if (cond()) return true; await new Promise((ok) => setTimeout(ok, 10)); } return cond(); };

// ── AB1 ─────────────────────────────────────────────────────────────────────

const addon = (writes, extra = {}) => ({ n: 0, needs: [], status: "ready", phase: "run", route: { op: "addon", intent: "addon" }, targets: { writes, reads: [] }, jobs: [], ...extra });
const step = (layer, writes) => ({ n: 1, needs: [], status: "ready", phase: "run", route: { op: "edit", layer }, targets: { writes, reads: [] }, jobs: [] });

test("AB1 AN ADDITION BY ITS TARGETS — two page additions overlap; an addition naming a table waits for a rules step and for another addition naming a table; one naming nothing is the whole site; it holds the turn throughout only when it writes the config or runs again alone", () => {
  const pageA = addon(["new-page:/sign-up"]), pageB = addon(["new-page:/gift-vouchers"]);
  assert.equal(besideConflict(pageA, pageB), false, "two additions of different pages were still kept apart");
  assert.deepEqual([writesConfig(pageA), writesSchema(pageA)], [false, false]);
  assert.equal(holdsConfig(pageA), false, "a page addition still holds the turn from its first read");
  const tableA = addon(["new-page:/sign-up", "new-data:signups"]), tableB = addon(["new-data:bookings"]);
  assert.equal(writesSchema(tableA), true);
  assert.equal(besideConflict(tableA, tableB), true, "two additions that both make tables ran side by side");
  assert.equal(besideConflict(tableA, step("rules", ["data:loaves"])), true, "an addition making a table ran beside a rules step");
  assert.equal(besideConflict(pageA, step("rules", ["data:loaves"])), false, "a page addition was kept from a rules step");
  const blank = addon([]);
  assert.equal(besideConflict(blank, pageB), true, "an addition naming nothing was not the whole site");
  assert.deepEqual([writesConfig(blank), writesSchema(blank), holdsConfig(blank)], [true, true, true]);
  const look = addon(["new-page:/sign-up", "theme"]);
  assert.equal(holdsConfig(look), true, "an addition writing the look does not hold the turn");
  assert.equal(holdsConfig(addon(["new-page:/sign-up"], { serial: true })), true, "an addition running again alone does not hold the turn");
  // A LOOK STEP IS STILL A CONFIG WRITER, AND KEEPS THE TURN.
  assert.equal(besideConflict(step("look", ["theme"]), look), true);
});

// ── AB2 ─────────────────────────────────────────────────────────────────────

function provisioning(name, pageWriter) {
  const compiler = installCompiler();
  const P = platform({
    // A DATABASE THAT ANSWERS SQL ONCE IT IS MADE (empty, as a new one is).
    slug: "ab-" + name + "-" + Math.random().toString(16).slice(2, 8), provisions: true, db: rowsDb({ tables: {} }), balance: 400,
    answers: {
      route: [{ intent: "addon" }],
      [T.adds]: { kinds: ["table", "page"] },
      "add:table": TABLE,
      "add:page": { page: [PAGE("/sign-up", "Sign up")] },
      [T.pages]: pageWriter,
    },
  });
  return { P, compiler };
}

test("AB2 THE DATABASE IS MADE BESIDE THE PAGE WRITER — the page call is made while the project create is still running; the addition then lands with its table, one project, the job charged once", async () => {
  const seen = { atCall: null };
  let hold = null;
  const P_ = { at: null };
  const { P, compiler } = provisioning("overlap", async () => {
    // SERIAL, the project would already exist when the page call is made.
    seen.atCall = { projects: P_.at.neon.projects.length, released: hold.done === true };
    hold.done = true; hold.release();
    return { pages: [writtenPage("/sign-up")] };
  });
  try {
    P_.at = P;
    hold = P.holdNeon();
    const r = await sendMessage(P, { message: SIGNUP + "." });
    const { rec } = await settle(P, r.key, { rounds: 20 });
    assert.ok(seen.atCall, "the page writer was never called");
    assert.deepEqual(seen.atCall, { projects: 0, released: false }, "the page call was not made while the database was still being made — nothing overlapped");
    assert.equal(hold.reached, true, "the project create was never reached");
    assert.equal(rec.parts[0].status, "done", JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    const job = P.jobsOf(r.key).find((j) => j.op === "addon");
    const body = JSON.parse(job.result.body);
    assert.equal(body.ok, true, JSON.stringify(body).slice(0, 400));
    assert.deepEqual(body.tables, ["signups"]);
    assert.equal(P.neon.projects.length, 1, "not exactly one project made");
    assert.ok(P.page("sign-up.tsx"), "the page was not stored");
    assert.equal(P.ledger.filter((e) => e.ref.startsWith(job.id + "#") && e.reason === "reserve").length >= 1, true);
    assert.equal(P.ledger.filter((e) => e.ref === job.id && e.reason === "refund").length, 0, "a shipped addition was refunded");
    await P.settle();
  } finally { P.close(); compiler.uninstall(); }
});

test("AB2b A PROVISION THAT FAILS BESIDE THE PAGE WRITER — the page writer ran, the create fails: the provision's own answer, no page stored or published, the job refunded in full", async () => {
  let called = false;
  const { P, compiler } = provisioning("fail", async () => { called = true; return { pages: [writtenPage("/sign-up")] }; });
  try {
    P.failNeon((method, url) => method === "POST" && /\/projects$/.test(url));
    const live0 = P.readObj("current/" + P.slug + ".json");
    const r = await sendMessage(P, { message: SIGNUP + "." });
    await settle(P, r.key, { rounds: 20 });
    const job = P.jobsOf(r.key).find((j) => j.op === "addon");
    const body = JSON.parse(job.result.body);
    assert.equal(body.error, "provision", "the failure is not the provision's: " + JSON.stringify(body).slice(0, 300));
    assert.match(body.msg, /database/);
    assert.equal(called, true, "the page writer was not called beside the provision — this case shows no overlap");
    assert.equal(P.page("sign-up.tsx"), undefined, "a page was stored over no database");
    assert.equal(P.readObj("current/" + P.slug + ".json"), live0, "something was published");
    const took = P.ledger.filter((e) => e.ref.startsWith(job.id + "#") && e.reason === "reserve").reduce((a, e) => a - e.delta, 0);
    const back = P.ledger.filter((e) => e.ref === job.id && e.reason === "refund").reduce((a, e) => a + e.delta, 0);
    assert.equal(back, took, "the job was not refunded in full: took " + took + ", back " + back);
    await P.settle();
  } finally { P.close(); compiler.uninstall(); }
});

// ── AB3 ─────────────────────────────────────────────────────────────────────

const TT_FROM = "Follow us on TikTok at @oldloaf";
const TT_TO = "Follow us on TikTok at @harbourloaf";
const TIKTOK = "Change our TikTok link on the Visit page to @harbourloaf";
const HOME = pageSrc("/", "<section className=\"hero\"><h1>Harbour Loaf</h1></section>");
const VISIT = pageSrc("/visit", "<section className=\"come\"><h1>Come to the bakery</h1><p>" + TT_FROM + "</p></section>");
const LOAVES = { name: "loaves", columns: [{ name: "name", type: "text" }, { name: "description", type: "text" }, { name: "price", type: "numeric" }, { name: "photo", type: "text" }], read: "public", write: "none" };
const lineId = (args, file, line) => {
  const at = String(args.messages[0].content).split("\n").find((l) => l.includes("[" + file + "] " + line));
  return Number(String(at || "-1.").split(".")[0]);
};

test("AB3 AN ADDITION THAT NEEDS MORE THAN IT WAS CLEARED FOR RUNS AGAIN ALONE — side by side, cleared with a page only, it designs a table while the text part is still open: refused `conflict` before anything is made and at no cost; run again alone, it lands with its table once; both parts done", async () => {
  const compiler = installCompiler();
  const db = rowsDb({ tables: { loaves: { columns: LOAF_COLUMNS, rows: BAKERY_LOAVES, next: 12 } }, meta: { schema: JSON.stringify({ tables: [LOAVES] }) } });
  const ref = { P: null, key: null };
  let tables = 0;
  const P = platform({
    slug: "ab-guard-" + Math.random().toString(16).slice(2, 8), pages: [{ path: "index.tsx", source: HOME }, { path: "visit.tsx", source: VISIT }], db, beside: true, balance: 400,
    answers: {
      route: [
        { intent: "edit", layer: "text", page: "/visit", alsoAsked: [SIGNUP], targets: [{ change: 0, writes: ["page:/visit"] }, { change: 1, writes: ["new-page:/sign-up"] }] },
        { intent: "addon", targets: [{ change: 0, writes: ["new-page:/sign-up"] }] },
      ],
      [T.text]: async (args) => {
        // THE TEXT PART STAYS OPEN until the addition's first try has ended.
        await until(() => ref.key && ref.P.jobsOf(ref.key).some((j) => j.op === "addon" && j.result));
        return { edits: [{ id: lineId(args, "visit.tsx", TT_FROM), to: TT_TO }] };
      },
      [T.adds]: { kinds: ["table", "page"] },
      "add:table": () => { tables++; return TABLE; },
      "add:page": { page: [PAGE("/sign-up", "Sign up")] },
      [T.pages]: { pages: [writtenPage("/sign-up")] },
    },
  });
  ref.P = P;
  const creates = () => db.writes().filter((w) => /create table[^;]*signups/i.test(w.query)).length;
  try {
    const r = await sendMessage(P, { message: TIKTOK + ", and " + SIGNUP.charAt(0).toLowerCase() + SIGNUP.slice(1) + "." });
    ref.key = r.key;
    assert.equal(r.status, 200, JSON.stringify(r.body));
    // EVERYTHING AS THE QUEUE HANDS IT OVER, the text job left running beside.
    const running = [];
    for (let i = 0; i < 40; i++) {
      const m = P.queue.shift();
      if (!m) { await new Promise((ok) => setTimeout(ok, 20)); if (!P.queue.length && P.jobsOf(r.key).filter((j) => j.op === "addon" && j.state === "done").length) break; continue; }
      running.push((async () => { const { deliver } = await import("./fixtures/request-flow.mjs"); return deliver(P, m); })());
      await new Promise((ok) => setTimeout(ok, 5));
    }
    await Promise.allSettled(running);
    const { rec } = await settle(P, r.key, { rounds: 20 });
    const addons = P.jobsOf(r.key).filter((j) => j.op === "addon");
    assert.ok(addons.length >= 2, "the addition did not run again: " + JSON.stringify(addons.map((j) => String(j.result && j.result.body).slice(0, 200))));
    const first = JSON.parse(addons[0].result.body);
    assert.equal(first.error, "conflict", "the first try was not refused as an overlap: " + JSON.stringify(first).slice(0, 300));
    // REFUSED BEFORE ANY RESERVE: nothing taken, so nothing to give back.
    const net = P.ledger.filter((e) => e.ref.startsWith(addons[0].id)).reduce((a, e) => a + e.delta, 0);
    assert.equal(net, 0, "the refused try kept a charge: " + net);
    assert.ok(["refunded", "none"].includes(addons[0].billing), "the refused try was billed: " + addons[0].billing);
    assert.deepEqual(rec.parts.map((p) => p.status), ["done", "done"], JSON.stringify(rec.parts.map((p) => [p.status, p.why])));
    assert.equal(rec.parts[1].serial, true, "the addition's second try was not alone");
    assert.equal(creates() >= 1, true, "the table was never made");
    assert.ok(P.page("visit.tsx").includes(TT_TO) && P.page("sign-up.tsx"), "a part's change is missing");
    assert.ok(tables >= 2, "the second try did not design afresh");
    await P.settle();
  } finally { P.close(); compiler.uninstall(); }
});
