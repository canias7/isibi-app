// THE ENFORCED SPENDING BOUND IS THE ACCOUNT'S BALANCE (2026-10-11, the
// owner, on Codex's review of 542a6c34: *"spendWall reacts after charges
// appear, multiple jobs can finish between polls, and historical maximum job
// costs are not enforceable limits … provide an actually enforced test budget
// using the existing server billing/job machinery, accounting for routing,
// running work, retries and concurrent preparation without relying on an open
// browser or a surviving test runner."*).
//
// The server's charge functions refuse what the balance cannot cover, inside
// one statement on the account row (`use_credits` and the edit reserve take
// `balance >= cost` or nothing; `credit_debit` takes at most what is there —
// supabase/applied/20260901222000_live_snapshot_edit_rpcs.sql and
// 20260905161410_credit_debit_and_reverse.sql). So the account can never go
// below zero, and net credits spent from a balance of B are at most B,
// whatever the press, the browser or the runner does. The acceptance batch
// therefore sends nothing unless the balance is at most its cap
// (`capRefusal`); the owner sets the balance to that cap before the batch.
//
// These cases drive the real request driver, queue consumer and routes with
// NO browser and no press: messages delivered late, delivered twice, every
// job left to finish between reads, charges priced far above any estimate.
// The fixture's ledger mirrors the server's refusals.
//
// ⚠ The router's answers here are SUPPLIED (two independent row changes as two
// parts) — what is under test is billing, never how the live router splits a
// message.
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage, settle, deliver, pump, T } from "./fixtures/request-flow.mjs";
import { blockNetwork } from "./fixtures/no-network.mjs";
import { installCompiler } from "./fixtures/cf-containers.mjs";
import { page as pageSrc } from "./fixtures/live-ask.mjs";
import { rowsDb, BAKERY_LOAVES, LOAF_COLUMNS } from "./fixtures/rows-db.mjs";
import { UI_SCENARIOS, ACCEPTANCE_CAP, capRefusal, fundsRefusal } from "../scripts/canary-ui.mjs";
import { BUILD_CHECK_NO_IMAGES, buildPreflight } from "../scripts/canary-build.mjs";

blockNetwork();

const PAGES = [{ path: "index.tsx", source: pageSrc("/", "<section><h1>Harbour Loaf</h1></section>") }];
const LOAVES = { name: "loaves", columns: [{ name: "name", type: "text" }, { name: "description", type: "text" }, { name: "price", type: "numeric" }, { name: "photo", type: "text" }], read: "public", write: "none" };
const HOURS = { name: "hours", columns: [{ name: "day", type: "text" }, { name: "opens", type: "text" }], read: "public", write: "none" };
const db = () => rowsDb({
  tables: {
    loaves: { columns: LOAF_COLUMNS, rows: BAKERY_LOAVES, next: 12 },
    hours: { columns: [{ name: "id", type: "integer" }, { name: "day", type: "text" }, { name: "opens", type: "text" }, { name: "created_at", type: "timestamp with time zone" }], rows: [{ id: 1, day: "Monday", opens: "09:00", created_at: "2026-08-21 23:06:22" }] },
  },
  meta: { schema: JSON.stringify({ tables: [LOAVES, HOURS] }) },
});
const W0 = "open the bakery at 8 on Mondays", W1 = "make the Dark Rye £5.50";
const ANSWERS = {
  route: [
    { intent: "edit", layer: "data", alsoAsked: [W1], targets: [{ change: 0, writes: ["data:hours"] }, { change: 1, writes: ["data:loaves"] }] },
    { intent: "edit", layer: "data" },
  ],
  write_row_changes: (args) => (String(args.messages[0].content).split("WHAT THEY ASKED FOR\n")[1] || "").startsWith(W0)
    ? { changes: [{ table: "hours", id: 1, values: { opens: "08:00" } }] }
    : { changes: [{ table: "loaves", id: 2, values: { price: 5.5 } }] },
};
// A ROW CHANGE PRICED FAR ABOVE ANY ESTIMATE (a data job is about 1 credit).
const HUGE = (tool) => (tool === "write_row_changes" ? { input_tokens: 4_000_000, output_tokens: 400_000 } : null);

async function run({ balance, usageFor = null, twice = false, slug }) {
  const compiler = installCompiler();
  const d = db();
  const P = platform({ slug, pages: PAGES, db: d, balance, answers: ANSWERS, usageFor });
  try {
    const r = await sendMessage(P, { message: W0 + ", and " + W1 + "." });
    // NOBODY WATCHES: no browser, no press — the queue and the sweep alone,
    // every job left to finish before anything is read.
    const { rec } = await settle(P, r.key, { rounds: 24 });
    // A RETRY: every message the queue was sent, delivered again.
    if (twice) { for (const m of [...P.sent]) { try { await deliver(P, m); } catch { /* a redelivery the consumer refuses is fine */ } } await pump(P); }
    await P.settle();
    const debits = P.ledger.filter((e) => e.delta < 0).reduce((s, e) => s - e.delta, 0);
    const credits = P.ledger.filter((e) => e.delta > 0).reduce((s, e) => s + e.delta, 0);
    return { P, rec, debits, net: debits - credits, end: P.credits.balance, refused: P.rpcLog ? P.rpcLog.filter((x) => x && x.out && x.out.error === "insufficient").length : 0, hours: d.rows("hours")[0].opens, rye: Number(d.rows("loaves").find((l) => l.id === 2).price) };
  } finally { P.close(); compiler.uninstall(); }
}

const slug = (k) => "bound-" + k + "-" + Math.random().toString(16).slice(2, 8);

test("CONTROL: with room in the balance, both row changes land and are charged — the costs this case's bound is measured against", async () => {
  const o = await run({ balance: 400, slug: slug("ok") });
  assert.equal(o.hours, "08:00");
  assert.equal(o.rye, 5.5);
  assert.ok(o.net > 0 && o.net <= 400);
  assert.ok(o.P.ledger.every((e) => e.balance_after >= 0));
});

test("CHARGES FAR ABOVE THE ESTIMATES, NOBODY WATCHING: every job priced past the balance is refused by the ledger before a row is written; the account never goes below zero and spends at most what it held", async () => {
  const B = 6;
  const o = await run({ balance: B, usageFor: HUGE, slug: slug("huge") });
  assert.ok(o.P.ledger.every((e) => e.balance_after >= 0), "the balance went below zero: " + JSON.stringify(o.P.ledger));
  assert.ok(o.end >= 0);
  assert.ok(o.net <= B, `spent ${o.net} from a balance of ${B}`);
  assert.equal(o.hours, "09:00", "a row was written by a job whose charge was refused");
  assert.equal(o.rye, 5.2, "a row was written by a job whose charge was refused");
  assert.ok(!o.P.ledger.some((e) => e.reason === "reserve" && -e.delta > B), "a reserve larger than the balance was taken");
});

test("SEVERAL JOBS FINISHING BETWEEN READS, AND EVERY MESSAGE DELIVERED TWICE: the room for exactly one job is spent once — the second job is refused, the retry charges nothing more, and the total stays within the balance", async () => {
  // THE MEASURED PRICE OF ONE PRICED-UP JOB, read off a run with room.
  const probe = await run({ balance: 100_000, usageFor: HUGE, slug: slug("probe") });
  // The routing call and the held part's routing job are small; the two row
  // jobs, priced far above any estimate, are the large reserves.
  const large = probe.P.ledger.filter((e) => e.reason === "reserve" && -e.delta > 100).map((e) => -e.delta);
  assert.equal(large.length, 2, JSON.stringify(probe.P.ledger, null, 1));
  const small = probe.debits - large.reduce((s, x) => s + x, 0);
  const B = small + Math.max(...large) + 1; // room for every small charge and ONE priced-up job, never two
  const o = await run({ balance: B, usageFor: HUGE, twice: true, slug: slug("twice") });
  assert.ok(o.P.ledger.every((e) => e.balance_after >= 0), JSON.stringify(o.P.ledger));
  assert.ok(o.net <= B, `spent ${o.net} from a balance of ${B}`);
  const taken = o.P.ledger.filter((e) => e.reason === "reserve" && -e.delta > 100);
  assert.equal(taken.length, 1, "the observer is alive: exactly one priced-up job fits, and it was charged — " + JSON.stringify(o.P.ledger));
  assert.ok(taken.length <= 1, "two priced-up jobs were charged from room for one: " + JSON.stringify(taken));
  const changed = (o.hours === "08:00" ? 1 : 0) + (o.rye === 5.5 ? 1 : 0);
  assert.ok(changed <= taken.length, "a change landed with no charge taken for it");
});

test("THE PRESS REFUSES BEFORE IT SENDS unless the account holds no more than the batch cap — the bound the ledger then enforces; the image-free Build too", () => {
  assert.equal(ACCEPTANCE_CAP, 100);
  for (const k of ["acc-page-table", "acc-table-page", "acc-needs", "acc-mixed", "acc-pages-real", "acc-addon-inner", "acc-addon-edit", "acc-addon-pair", "acc-addon-kinds"]) {
    const sc = UI_SCENARIOS[k];
    assert.ok(sc, `no ${k}`);
    assert.equal(sc.cap, ACCEPTANCE_CAP, `${k} is not bound by the batch cap`);
    assert.equal(sc.ceiling, undefined, `${k} still claims a ceiling`);
    assert.match(capRefusal({ now: 971, cap: sc.cap }), /above this press's hard cap of 100/, `${k} would send from 971`);
    assert.equal(capRefusal({ now: 100, cap: sc.cap }), "");
    assert.match(fundsRefusal({ now: 3, budget: sc.budget }), /does not cover/);
  }
  const free = { backends: { status: 200, rows: [] }, builds: { status: 200, rows: [] }, host: { status: 404 } };
  assert.equal(BUILD_CHECK_NO_IMAGES.cap, ACCEPTANCE_CAP);
  assert.match(buildPreflight({ balance: 971, budget: BUILD_CHECK_NO_IMAGES.budget, cap: BUILD_CHECK_NO_IMAGES.cap, existing: free }), /above this press's hard cap of 100/, "Codex's case: the Build sent from a balance of 971");
  assert.equal(buildPreflight({ balance: 100, budget: BUILD_CHECK_NO_IMAGES.budget, cap: BUILD_CHECK_NO_IMAGES.cap, existing: free }), "");
});
