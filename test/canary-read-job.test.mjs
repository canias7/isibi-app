// THE READ-ONLY JOB LOOKUP — `scripts/canary-read-job.mjs` and its one hop.
//
// It exists because run 14's write-up said the edit "was never billed" on the
// strength of the balance moving 77 → 75. That is a NET reading, and a net
// movement of 2 is equally consistent with a routing call of 2 and with an
// edit charged 20 and refunded 20. The ledger separates them and nothing here
// had ever read it.
//
// TWO HALVES, SPLIT THE WAY THE DEFECT WOULD BE: the decisions are DRIVEN
// (billing, the ledger, what the old watch would have seen, the reader over
// injected stores), and the wiring is a census — because a module that is
// perfect and never reached is this repository's most repeated shape.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  billingMeans, ledgerVerdict, oldWatchWouldHaveSeen, readJobRecords, describeJob,
} from "../scripts/canary-read-job.mjs";

const MOD = readFileSync(new URL("../scripts/canary-read-job.mjs", import.meta.url), "utf8");
const CANARY = readFileSync(new URL("../scripts/edit-canary.mjs", import.meta.url), "utf8");
const FLOW = readFileSync(new URL("../.github/workflows/edit-canary.yml", import.meta.url), "utf8");

/**
 * Blank whole-line `//` comments, length-preserving.
 *
 * LINE COMMENTS ONLY, AND ONLY WHOLE LINES. This repo's blanker has cost it a
 * day before by opening a false block on a `/*` inside prose; the safe reader
 * is the narrow one. Every scan below that FORBIDS a spelling runs on this,
 * because the file argues about the spellings it forbids.
 */
function blankLineComments(src) {
  return src.split("\n").map((l) => (/^\s*\/\//.test(l) ? " ".repeat(l.length) : l)).join("\n");
}

test("the blanker is alive and does not eat code", () => {
  const b = blankLineComments("// gone\nconst kept = 1; // tail stays\n");
  assert.match(b, /const kept = 1; \/\/ tail stays/);
  assert.doesNotMatch(b, /gone/);
  // AND IT IS ALIVE ON THE REAL FILE, or every absence below is true about
  // nothing. The module really does carry whole-line comments.
  assert.ok(MOD.split("\n").filter((l) => /^\s*\/\//.test(l)).length > 5);
});

// ── BILLING: THE ONE FIELD THAT ANSWERS THE MONEY QUESTION ────────────────

test("every billing state the column admits has its own reading", () => {
  assert.deepEqual(
    ["none", "reserved", "finalized", "refunded", "exempt"].map((s) => {
      const m = billingMeans(s);
      return [s, m.charged, m.refunded];
    }),
    [
      ["none", false, false],
      ["reserved", true, false],
      ["finalized", true, false],
      ["refunded", true, true],
      ["exempt", false, false],
    ],
  );
  // THE FIVE ARE THE CHECK CONSTRAINT'S OWN LIST. A sixth arriving is a schema
  // change, and the reader must SAY SO rather than fall into whichever branch
  // reads best — "unrecognised" is the answer, and `charged` is null and not
  // false, because cannot-tell must never read as a value.
  const odd = billingMeans("settled");
  assert.equal(odd.charged, null);
  assert.equal(odd.refunded, null);
  assert.match(odd.says, /unrecognised/i);
  assert.match(odd.says, /do not guess/i);
});

test("a refunded job is not an uncharged one, and the sentence says so", () => {
  assert.match(billingMeans("refunded").says, /WAS charged/);
  assert.match(billingMeans("refunded").says, /reversed/);
  // AND `none` IS THE ONLY STATE THAT LICENSES "never charged".
  assert.match(billingMeans("none").says, /never reached a paid rung/);
});

// ── THE LEDGER: WHAT A NET BALANCE READING STRUCTURALLY CANNOT SAY ────────
//
// `OK` IS THE READ THAT ANSWERED. Every case below that wants a number has to
// say so, because a verdict without one is UNKNOWN by construction — see the
// unreadable cases at the end of this block.
const OK = { ok: true, status: 200 };

test("a charge and its reversal are not the same as no charge", () => {
  // THE EXACT SHAPE RUN 14'S CLAIM CANNOT RULE OUT: a debit and a matching
  // refund net to zero, which from a before/after balance is indistinguishable
  // from nothing having happened at all.
  const v = ledgerVerdict([
    { delta: -20, reason: "edit", ref: "edit:JOB:pages", balance_after: 57 },
    { delta: 20, reason: "reverse", ref: "edit:JOB:pages", balance_after: 77 },
  ], OK);
  assert.equal(v.charged, true);
  assert.equal(v.refunded, true);
  assert.equal(v.debits, 20);
  assert.equal(v.refunds, 20);
  assert.equal(v.net, 0);
  assert.match(v.says, /CHARGED 20 AND REFUNDED 20/);
  assert.match(v.says, /not the same as never charged/);
});

test("no ledger rows licenses 'nothing was debited' ONLY under a read that answered", () => {
  const v = ledgerVerdict([], OK);
  assert.equal(v.rows, 0);
  assert.equal(v.charged, false);
  assert.equal(v.readable, true);
  assert.match(v.says, /READ CLEAN/);
  assert.match(v.says, /nothing was debited/);
});

test("a debit with no refund reads as charged and stays charged", () => {
  const v = ledgerVerdict([{ delta: -2, reason: "route", ref: "edit:JOB:route", balance_after: 75 }], OK);
  assert.equal(v.charged, true);
  assert.equal(v.refunded, false);
  assert.equal(v.debits, 2);
  assert.match(v.says, /charged 2/);
  assert.match(v.says, /no refund/);
  assert.doesNotMatch(v.says, /never charged/);
});

test("an unreadable delta is skipped rather than coerced", () => {
  // `Number(["3"])` is 3 and `Number("")` is 0 — both plausible and both
  // wrong here. A row whose delta cannot be read contributes nothing, and the
  // rows it sits beside are still counted.
  const v = ledgerVerdict([
    { delta: -5, ref: "a" },
    { delta: "not a number", ref: "b" },
    { delta: null, ref: "c" },
  ], OK);
  assert.equal(v.debits, 5);
  assert.equal(v.refunds, 0);
  assert.equal(v.rows, 3);
});

test("AN UNREADABLE LEDGER IS BILLING UNKNOWN, never 'nothing was charged'", () => {
  // ⚠ THE DEFECT, REPRODUCED: a 503 handed back `[]` and the emptiness was
  // read as a fact about the account. `charged` is NULL rather than false —
  // cannot-tell must never read as a value — and no arithmetic is offered,
  // because a figure beside an "unknown" reads exactly like a measured one.
  for (const read of [{ ok: false, status: 503 }, { ok: false, status: 0 }, { ok: false, status: 200, why: "not a list" }]) {
    const v = ledgerVerdict([], read);
    assert.equal(v.charged, null, `charged for ${JSON.stringify(read)}`);
    assert.equal(v.refunded, null);
    assert.equal(v.debits, null);
    assert.equal(v.readable, false);
    assert.match(v.says, /BILLING UNKNOWN/);
    assert.match(v.says, /not established either way/);
    assert.doesNotMatch(v.says, /nothing was debited/);
  }
});

test("a MISSING read argument is unknown too, and rows in hand do not rescue it", () => {
  // A caller that forgot to say whether the read answered is exactly a caller
  // that cannot vouch for the rows — so the absent argument fails CLOSED, and
  // it stays closed even with plausible-looking rows in hand.
  for (const v of [ledgerVerdict([]), ledgerVerdict(null), ledgerVerdict(undefined)]) {
    assert.equal(v.charged, null);
    assert.match(v.says, /BILLING UNKNOWN/);
  }
  const partial = ledgerVerdict([{ delta: -20, ref: "JOB#1" }], { ok: false, status: 503 });
  assert.equal(partial.charged, null, "a partial list under a refusal is not a smaller ledger");
  assert.equal(partial.debits, null);
  assert.match(partial.says, /BILLING UNKNOWN/);
});

// ── WHAT THE OLD WATCH WOULD HAVE DONE ────────────────────────────────────

test("a stored reply at a failing status is what the old watch polled past", () => {
  const seen = oldWatchWouldHaveSeen({ result: { status: 503, type: "application/json", body: "{}" } });
  assert.equal(seen.settled, true);
  assert.equal(seen.ignored, true);
  assert.equal(seen.status, 503);
  assert.match(seen.says, /COMPLETED/);
});

test("a stored 200 is one the old watch would have ended on", () => {
  const seen = oldWatchWouldHaveSeen({ result: { status: 200, body: "{}" } });
  assert.equal(seen.settled, true);
  assert.equal(seen.ignored, false);
});

test("no stored reply, and an unreadable status, are both REFUSALS to answer", () => {
  // TWO DIFFERENT ABSENCES AND NEITHER IS A VERDICT. "There is no result" and
  // "there is a result whose status cannot be read" support different next
  // steps, and collapsing either into `ignored: false` would quietly report
  // the old watch as having behaved correctly.
  const none = oldWatchWouldHaveSeen({ result: null });
  assert.equal(none.settled, false);
  assert.equal(none.ignored, undefined);
  assert.match(none.says, /nothing the old watch could have ignored/);

  const blind = oldWatchWouldHaveSeen({ result: { body: "{}" } });
  assert.equal(blind.settled, false);
  assert.equal(blind.ignored, undefined);
  assert.match(blind.says, /cannot say/i);

  assert.equal(oldWatchWouldHaveSeen(null).settled, false);
});

// ── THE READER, DRIVEN OVER INJECTED STORES ───────────────────────────────

const ROW = {
  id: "JOBID", uid: "u1", slug: "fretwork-1", op: "edit",
  state: "failed", phase: "verify", billing: "refunded", cost: 20,
  needs_review: false, created_at: "2026-09-21T09:00:00.000Z", updated_at: "2026-09-21T09:10:00.000Z",
  result: { status: 503, type: "application/json", body: JSON.stringify({ ok: false, error: "x", msg: "It did not work." }) },
  error: { kind: "x", phase: "verify" },
};

function store({ job = [ROW], ledger = [], traces = [], fail = null } = {}) {
  const asked = [];
  const sb = async (path) => {
    asked.push(path);
    if (fail && path.startsWith(fail)) return { status: 500, rows: [] };
    if (path.startsWith("edit_jobs")) return { status: 200, rows: job };
    if (path.startsWith("credit_events")) return { status: 200, rows: ledger };
    if (path.startsWith("edit_traces")) return { status: 200, rows: traces };
    return { status: 404, rows: [] };
  };
  return { sb, asked };
}

test("the reader collects the row, the ledger and the trace candidates", async () => {
  const s = store({
    ledger: [{ at: "t", kind: "debit", reason: "edit", delta: -20, balance_after: 57, ref: "edit:JOBID:pages" }],
    traces: [{ cid: "c1", slug: "fretwork-1", ended_at: "2026-09-21T09:05:00.000Z", ms: 300, ok: false, failed_phase: "verify" }],
  });
  const rec = await readJobRecords({ job: "JOBID", sb: s.sb });
  assert.equal(rec.row.id, "JOBID");
  assert.equal(rec.ledger.length, 1);
  assert.equal(rec.traces.length, 1);
  // THE LEDGER IS MATCHED ON THE JOB ID INSIDE THE REF, not on equality. Read
  // out of the RPCs: a RESERVE's ref is `<job>#<seq>` and a REFUND's is the
  // bare `<job>`, so an equality match finds the refunds and none of the
  // holds — **a refund with no debit beside it**, which reads as credits
  // appearing from nowhere. A build's is `build:<job>:<step>`, which a prefix
  // match would miss in the other direction.
  assert.ok(s.asked.some((p) => p.startsWith("credit_events") && p.includes("JOBID")));
  assert.ok(s.asked.some((p) => p.startsWith("credit_events") && p.includes("like.")));
  const q = s.asked.find((p) => p.startsWith("credit_events"));
  assert.doesNotMatch(q, /ref=eq\./, "an equality match would find the refunds and none of the reserves");
  // THE TRACES ARE BY SLUG AND WINDOW, which is not a join.
  assert.ok(s.asked.some((p) => p.startsWith("edit_traces") && p.includes("slug=eq.fretwork-1")));
  assert.ok(rec.notes.some((n) => /CANDIDATES rather than a join/.test(n)));
});

test("the absence of the instruction is SAID rather than left to be noticed", async () => {
  // The submitted ask lives in R2 under `editJobKey(<job>)`, which is a Worker
  // binding — no Supabase read and no existing route reaches it. An absence a
  // reader has to infer is the shape this repo keeps meeting, so it is on the
  // record every time.
  const rec = await readJobRecords({ job: "JOBID", sb: store().sb });
  assert.ok(rec.notes.some((n) => /R2/.test(n) && /NOT reachable/.test(n)));
});

test("a job that is not there stops, and does not report empty stores as facts", async () => {
  const s = store({ job: [] });
  const rec = await readJobRecords({ job: "NOPE", sb: s.sb });
  assert.equal(rec.row, null);
  assert.deepEqual(rec.ledger, []);
  assert.deepEqual(rec.traces, []);
  assert.ok(rec.notes.some((n) => /no edit_jobs row/.test(n)));
  // AND IT ASKED FOR NOTHING ELSE. With no row there is no slug and no window,
  // so a ledger read would be a query nobody can interpret and a trace read
  // would answer about the wrong site.
  assert.equal(s.asked.filter((p) => !p.startsWith("edit_jobs")).length, 0);
});

test("a failed ledger read is NAMED, never folded into 'no rows'", async () => {
  // THE WHOLE POINT OF THIS INSTRUMENT IS THE LEDGER. A read that threw and a
  // job with no debits answer identically as `[]`, and only one of them
  // licenses "nothing was charged".
  const s = store({ fail: "credit_events" });
  const rec = await readJobRecords({ job: "JOBID", sb: s.sb });
  assert.deepEqual(rec.ledger, []);
  assert.equal(rec.ledgerRead.ok, false, "the read's own state travels with the rows");
  assert.ok(rec.notes.some((n) => /credit_events read failed/.test(n)));
});

test("A 200 CARRYING A NON-LIST IS NOT A READ EITHER", async () => {
  // PostgREST answers an error as an OBJECT and `sb` normalises a non-array to
  // `[]`, so `status === 200` alone lets a malformed answer through wearing
  // the one shape that means "no rows".
  const sb = async (p) => p.startsWith("edit_jobs") ? { status: 200, rows: [ROW] }
    : p.startsWith("credit_events") ? { status: 200, rows: { message: "permission denied" } }
      : { status: 200, rows: [] };
  const rec = await readJobRecords({ job: "JOBID", sb });
  assert.equal(rec.ledgerRead.ok, false);
  assert.equal(rec.ledgerRead.why, "not a list");
  assert.match(describeJob(rec), /BILLING UNKNOWN/);
});

// ── THE PRINTED ACCOUNT IS WHAT ANYBODY READS, SO IT IS WHAT IS ASSERTED ──
//
// ⚠ THE DEFECT WAS ONLY EVER VISIBLE HERE. `ledgerVerdict` and the note were
// each defensible on their own; what shipped was the ACCOUNT printing
// *"nothing was debited under it"* with the failed-read note underneath it,
// and no unit case looked at the finished text.

test("the printed account says BILLING UNKNOWN when the ledger could not be read", async () => {
  const rec = await readJobRecords({ job: "JOBID", sb: store({ fail: "credit_events" }).sb });
  const out = describeJob(rec);
  const ledgerLine = out.split("\n").find((l) => l.includes("LEDGER"));
  assert.ok(ledgerLine, "the account has no LEDGER line at all");
  assert.match(ledgerLine, /BILLING UNKNOWN/);
  // THE WHOLE ACCOUNT, not only that line: the sentence must not appear
  // anywhere, because the defect was one line claiming what another denied.
  assert.doesNotMatch(out, /nothing was debited under it/);
  assert.match(out, /credit_events read failed/);
  // AND THE ROW'S OWN `billing` FIELD IS UNTOUCHED BY THE LEDGER'S FAILURE —
  // two readings, two lines, neither derived from the other.
  assert.match(out, /billing {5}refunded {2}cost 20/);
  assert.match(out, /the edit WAS charged and the charge was reversed/);
});

test("the CONTROL: a successful empty read still says nothing was debited", async () => {
  // Without this the fix above is satisfied by a reader that calls every
  // ledger unknown — which would be the same defect pointing the other way,
  // and just as useless.
  const rec = await readJobRecords({ job: "JOBID", sb: store({ ledger: [] }).sb });
  assert.equal(rec.ledgerRead.ok, true);
  const out = describeJob(rec);
  const ledgerLine = out.split("\n").find((l) => l.includes("LEDGER"));
  assert.match(ledgerLine, /READ CLEAN/);
  assert.match(ledgerLine, /nothing was debited under it/);
  assert.doesNotMatch(out, /BILLING UNKNOWN/);
  assert.doesNotMatch(out, /credit_events read failed/);
});

test("no ledger ROWS are listed under a refusal", async () => {
  // A partial body's rows beneath an "unknown" invite exactly the arithmetic
  // the line above refuses to do.
  const sb = async (p) => p.startsWith("edit_jobs") ? { status: 200, rows: [ROW] }
    : p.startsWith("credit_events") ? { status: 503, rows: [{ at: "t", kind: "debit", reason: "edit", delta: -20, balance_after: 57, ref: "JOBID#1" }] }
      : { status: 200, rows: [] };
  const rec = await readJobRecords({ job: "JOBID", sb });
  const out = describeJob(rec);
  assert.match(out, /BILLING UNKNOWN/);
  assert.doesNotMatch(out, /delta -20/, "a row printed under a refusal reads as evidence");
});

test("the poll is optional and its final header is read case-insensitively", async () => {
  const rec = await readJobRecords({
    job: "JOBID", sb: store().sb,
    poll: async () => ({ status: 503, headers: { "X-GF-Edit": "final" }, json: { ok: false }, text: "" }),
  });
  assert.equal(rec.poll.status, 503);
  // FOLD THE KEYS, NOT THE NEEDLE — folding the needle alone answers undefined
  // for `X-GF-Edit` just the same, which reads as "the server did not send it".
  assert.equal(rec.poll.final, "final");

  const without = await readJobRecords({ job: "JOBID", sb: store().sb });
  assert.equal(without.poll, null);
});

test("describeJob prints the money verdict and the old-watch reading", async () => {
  const rec = await readJobRecords({
    job: "JOBID", sb: store({
      ledger: [
        { at: "t1", kind: "debit", reason: "edit", delta: -20, balance_after: 57, ref: "edit:JOBID:pages" },
        { at: "t2", kind: "reverse", reason: "reverse", delta: 20, balance_after: 77, ref: "edit:JOBID:pages" },
      ],
    }).sb,
  });
  const out = describeJob(rec);
  assert.match(out, /JOB JOBID/);
  assert.match(out, /billing\s+refunded/);
  assert.match(out, /CHARGED 20 AND REFUNDED 20/);
  assert.match(out, /old watch.*polled past a COMPLETED answer/);
  // THE STORED REPLY'S OWN BODY IS IN THE ACCOUNT, because the customer's
  // sentence is in it and a status alone does not carry one.
  assert.match(out, /It did not work\./);
  assert.match(out, /R2/);
});

// ── THE READ-ONLY BOUND, AND IT IS A PROPERTY RATHER THAN A PROMISE ───────

test("the module has no way to write: no transport and no write verb in it", () => {
  const code = blankLineComments(MOD);
  // IT IS HANDED ITS READERS, so it holds no transport of its own. Without
  // this the bound would rest on nobody having added a `fetch` — which is a
  // claim about the future rather than about the file.
  assert.doesNotMatch(code, /\bfetch\s*\(/);
  assert.doesNotMatch(code, /require\s*\(/);
  assert.doesNotMatch(code, /node:https|node:http\b/);
  for (const verb of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.doesNotMatch(code, new RegExp(`["'\`]${verb}["'\`]`), `${verb} is reachable from the read module`);
  }
  // THE OBSERVER IS PROVED ALIVE: the scan really is looking at code, not at a
  // file the blanker emptied.
  assert.match(code, /export function billingMeans/);
  assert.match(code, /export async function readJobRecords/);
});

// ── THE WIRING HOP, WHICH IS WHERE THIS CLASS OF THING DIES ───────────────

test("the canary reaches the read mode, and STOPS before the preflight", () => {
  const src = blankLineComments(CANARY);
  const at = src.indexOf("if (READ_JOB) {");
  const pre = src.indexOf("PREFLIGHT — which code is answering");
  assert.ok(at > 0, "the read-mode branch is gone from edit-canary.mjs");
  assert.ok(pre > 0, "the preflight landmark is gone — the ordering below asserts nothing");
  // ORDER IS THE CLAIM: everything the harness can spend on lives past the
  // preflight, so a branch that exits above it cannot reach any of it.
  assert.ok(at < pre, "the read mode must branch ABOVE the preflight");
  const win = src.slice(at, pre);
  assert.match(win, /readJobRecords\(/, "the branch does not call the reader");
  assert.match(win, /describeJob\(/);
  assert.match(win, /process\.exit\(/, "the branch does not exit, so the paid half is still reachable");
  // THE SUPABASE READER HANDED OVER IS A GET. `fetch` with no `method` is a
  // GET, so the property is the ABSENCE of a method — asserted rather than
  // assumed, because adding one is a one-word change.
  assert.doesNotMatch(win, /method:/, "the read mode hands over a reader carrying a method");
});

test("the read mode does not demand a slug it does not use", () => {
  // The job row carries its own slug. Demanding one invites the caller to name
  // the wrong site and refuses a lookup for a reason unrelated to it.
  const src = blankLineComments(CANARY);
  assert.match(src, /!CANARY && !READ_JOB/);
});

test("the workflow carries the mode, and the read job beats a stale spend", () => {
  assert.match(FLOW, /read_job:/, "the workflow has no read_job input");
  assert.match(FLOW, /CANARY_READ_JOB:\s*\$\{\{\s*github\.event\.inputs\.read_job\s*\}\}/);
  // A DISPATCH THAT NAMES A JOB HAS ASKED FOR A LOOKUP. A `spend: yes` left in
  // the form from the previous press is not a second request, and the two
  // being live together on one wire is the only way this mode could cost
  // money. Settled in the workflow so the script never sees both.
  const spend = FLOW.match(/CANARY_SPEND:.*/);
  assert.ok(spend, "CANARY_SPEND is gone from the workflow");
  assert.match(spend[0], /inputs\.read_job == ''/, "a read-job dispatch can still arm the paid half");
});
