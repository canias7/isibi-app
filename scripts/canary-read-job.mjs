// READ ONE EXISTING EDIT JOB AND ITS RECORDS. Nothing else.
//
// ── WHY THIS EXISTS ────────────────────────────────────────────────────────
//
// Run 14's write-up said the edit "was never billed" on the strength of the
// balance moving 77 → 75 — the routing call's 2 — and that is an inference the
// number cannot support. **A net movement of 2 is equally consistent with a
// routing call of 2 and an edit that was charged 20 and refunded 20.** The
// ledger is what separates them and nothing here had ever read it.
//
// ── WHAT IT MAY DO, AND THE BOUND IS THE POINT ─────────────────────────────
//
// READ-ONLY, AND NOT BY DISCIPLINE. It is handed exactly two readers — a
// Supabase GET and a poll GET — so there is nothing in scope to POST with. It
// cannot route, cannot edit, cannot replay, cannot cancel and cannot retry,
// because none of those verbs is reachable from what it was given. A promise
// in a comment would be the weaker form of the same claim.
//
// ⚠ THE POLL ROUTE'S OWN `DELETE` IS A CANCEL, so this only ever sends GET —
// and `edit-canary.mjs` hands it a reader already bound to the method.

import { replyStateOf, modelTextOf, questionOf } from "./canary-replies.mjs";

/**
 * WHAT `billing` MEANS, AND IT IS THE ONE FIELD THAT ANSWERS THE MONEY
 * QUESTION DIRECTLY.
 *
 * `edit_jobs.billing` is constrained to exactly these five, so an unknown
 * value is a schema change rather than a case to guess at — and it says so
 * rather than falling into the most reassuring branch.
 */
export function billingMeans(billing) {
  switch (String(billing || "")) {
    case "none": return { charged: false, refunded: false, says: "no reservation was ever taken — this job never reached a paid rung" };
    case "reserved": return { charged: true, refunded: false, says: "a reservation was taken and never finalized — the money is held, not settled" };
    case "finalized": return { charged: true, refunded: false, says: "the edit was CHARGED and the charge stands" };
    case "refunded": return { charged: true, refunded: true, says: "the edit WAS charged and the charge was reversed" };
    case "exempt": return { charged: false, refunded: false, says: "exempt — a founder account takes no debit and writes no row" };
    default: return { charged: null, refunded: null, says: `unrecognised billing state ${JSON.stringify(billing)} — the schema moved; do not guess` };
  }
}

/**
 * THE LEDGER IS THE AUTHORITY, AND THE BALANCE IS NOT.
 *
 * `credit_events` carries one row per movement with its own `ref`, `reason`,
 * `delta` and `balance_after`. Summing the deltas for a job's refs answers
 * what a before/after balance reading structurally cannot: **whether the net
 * zero was no charge at all, or a charge and its reversal.**
 *
 * ── AND THE READ'S OWN STATE IS AN ARGUMENT, NOT A NOTE ────────────────────
 *
 * ⚠ THIS ANSWERED *"nothing was debited under it"* ON A 503 (owner,
 * 2026-09-21). A failed read handed back `[]`, the emptiness was read as a
 * FACT ABOUT THE ACCOUNT, and the refusal survived only as a note printed
 * underneath — so the one line anybody reads said the opposite of the truth,
 * on the instrument built for exactly this distinction. **This file's own
 * recorded trap** (*cannot-tell must never read as a value*), committed in
 * the round that quotes it.
 *
 * So `read` is REQUIRED to license any claim: `{ok: true}` for a read that
 * really answered, anything else — a status, a malformed body, nothing passed
 * at all — is `unknown`, where `charged` and `refunded` are **`null` rather
 * than `false`**. An absent argument is unknown too, because a caller that
 * forgot to pass one is exactly a caller that cannot vouch for the rows.
 */
export function ledgerVerdict(rows, read) {
  const ok = !!(read && read.ok === true);
  const list = Array.isArray(rows) ? rows : [];
  if (!ok) {
    const why = read && read.status ? ` (${read.status})` : read && read.why ? ` (${read.why})` : "";
    return {
      rows: list.length, debits: null, refunds: null, net: null,
      charged: null, refunded: null, readable: false,
      // NEVER A NUMBER HERE. A partial list is not a smaller ledger, and a
      // sum over one would be a figure with no standing that reads exactly
      // like a measured one.
      says: `BILLING UNKNOWN — the ledger could not be read${why}, so whether this job was charged is not established either way`,
    };
  }
  if (!list.length) return { rows: 0, debits: 0, refunds: 0, net: 0, charged: false, refunded: false, readable: true, says: "the ledger READ CLEAN and names no row for this job — nothing was debited under it" };
  let debits = 0, refunds = 0;
  for (const r of list) {
    const d = Number(r && r.delta);
    if (!Number.isFinite(d)) continue;
    if (d < 0) debits += -d; else refunds += d;
  }
  const net = refunds - debits;
  return {
    rows: list.length, debits, refunds, net,
    charged: debits > 0,
    refunded: refunds > 0,
    // ⚠ `readable` IS A PROPERTY OF THE READ, NEVER OF THE ROW COUNT, and this
    // branch omitted it — so it was `undefined`, and `describeJob` gates the
    // per-transaction lines on it. The one case that HAS rows to list was the
    // one case that never listed them: every `at / kind / reason / delta /
    // balance_after / ref` line silently absent, leaving the summary sentence
    // as the whole of the money evidence with nothing under it to audit.
    //
    // It survived because the two branches that DO set it are the two with
    // nothing to print, so no output ever looked wrong — and the shape demo
    // that would have shown it was generated and not read.
    readable: true,
    says: debits > 0 && refunds >= debits
      ? `CHARGED ${debits} AND REFUNDED ${refunds} — the net of ${net} is not the same as never charged`
      : debits > 0
        ? `charged ${debits}${refunds ? `, of which ${refunds} was refunded` : ", with no refund"}`
        : "credited only — no debit is recorded under this job",
  };
}

/**
 * DID THE JOB ANSWER, AND DID THE OLD WATCH IGNORE IT?
 *
 * The question run 14 left open. A stored reply at a NON-2xx status under the
 * final header is precisely the shape the old loop — `if (q.status === 200)` —
 * polled straight past, so this states the answer rather than leaving it to a
 * reader to assemble.
 *
 * IT REFUSES TO ANSWER WITHOUT THE STATUS. "There is a result" and "the result
 * had a failing status" are different claims, and a missing `result.status`
 * makes only the first available.
 */
export function oldWatchWouldHaveSeen(row) {
  const res = row && row.result;
  if (!res || typeof res !== "object") return { settled: false, says: "no stored reply on the row — nothing the old watch could have ignored" };
  const st = Number(res.status);
  if (!Number.isFinite(st)) return { settled: false, says: "a stored reply exists but carries no readable status — cannot say what the old watch would have done" };
  if (st >= 200 && st < 300) return { settled: true, ignored: false, status: st, says: `the stored reply is ${st} — the old watch WOULD have ended on it` };
  return { settled: true, ignored: true, status: st, says: `the stored reply is ${st} — the old watch tested \`status === 200\` and polled past a COMPLETED answer` };
}

/**
 * Read the job and everything filed against it.
 *
 * `sb(path)` performs one Supabase REST GET and answers `{status, rows}`;
 * `poll()` performs one owner-session GET of the poll route and answers
 * `{status, headers, json, text}`. Both are INJECTED, which is what makes this
 * drivable and what makes the read-only bound structural.
 *
 * ⚠ `sb` MUST HAND THE PARSED BODY OVER AS IT CAME — it may not coerce a
 * non-array to `[]` on its way past. Every list check below is the caller's to
 * make reachable: a getter that normalises first answers the question this
 * module exists to ask, and answers it with the one shape that means "no
 * rows". The first cut of this module shipped with exactly that pair — a
 * correct `Array.isArray` check here and a coercing getter in
 * `scripts/edit-canary.mjs` — so the malformed-200 branch was unreachable in
 * the only place it would ever have fired, while the guards drove it happily
 * through an injected store. `test/canary-read-job.test.mjs` censuses the real
 * getter now, because a check nothing can reach is not a check.
 */
export async function readJobRecords({ job, sb, poll, traceWindowMs = 30 * 60 * 1000 }) {
  // `ledgerRead` TRAVELS WITH `ledger` AND IS NEVER OPTIONAL. It opens as a
  // REFUSAL, so a path that returns early — a missing job row, a throw — hands
  // back an unknown rather than an empty ledger that reads as "nothing was
  // charged". The one state that licenses a money claim has to be EARNED.
  const out = { job, row: null, poll: null, traces: [], ledger: [], ledgerRead: { ok: false, why: "not read" }, notes: [] };

  // A 200 CARRYING A NON-LIST IS NOT A READ HERE EITHER, and the wrong
  // sentence is the expensive one: `(notAList)[0] || null` is `null`, which
  // this function goes on to report as "the job never existed, or it has been
  // pruned" — a positive claim about a job, made from a body nobody could
  // parse. The two are told apart before the row is taken.
  const jr = await sb(`edit_jobs?id=eq.${encodeURIComponent(job)}&select=*`);
  if (!jr || jr.status !== 200 || !Array.isArray(jr.rows)) {
    out.notes.push(`edit_jobs read failed (${jr && jr.status}${jr && jr.status === 200 ? ", body is not a list" : ""}) — the job's own record is UNREADABLE, which is not the same as absent`);
    return out;
  }
  out.row = jr.rows[0] || null;
  if (!out.row) { out.notes.push("no edit_jobs row with that id — the job never existed, or it has been pruned"); return out; }

  // THE LEDGER, MATCHED ON THE JOB ID INSIDE THE REF — AND A `like` IS THE
  // ONLY MATCH THAT WORKS, read out of the RPCs rather than guessed:
  //
  //   RESERVE  ref = p_id || '#' || p_seq   (`<job>#1`, `#2`, …) — one request
  //                                          makes SEVERAL sequenced holds
  //   REFUND   ref = p_id                   (the bare job id)
  //   BUILDS   ref = "build:" + jobId + ":" + step
  //
  // So an EQUALITY match finds the refunds and none of the reserves, which is
  // the worst answer this instrument could give: **a refund with no debit
  // beside it**, which reads as credits appearing from nowhere. A PREFIX match
  // has the mirror problem on the build path. The `like` finds all three.
  //
  // AND A 200 WITH A BODY THAT IS NOT A LIST IS NOT A READ EITHER. PostgREST
  // answers an error as an OBJECT, so `status === 200` alone would let a
  // malformed answer through wearing the one shape that means "no rows" — and
  // this is the read where that matters most, because the shape it would wear
  // is the one that licenses "nothing was charged".
  const lr = await sb(`credit_events?ref=like.*${encodeURIComponent(job)}*&select=*&order=at.asc`);
  if (lr && lr.status === 200 && Array.isArray(lr.rows)) {
    out.ledger = lr.rows;
    out.ledgerRead = { ok: true, status: 200 };
  } else {
    out.ledgerRead = { ok: false, status: (lr && lr.status) || 0, why: lr && lr.status === 200 ? "not a list" : "status" };
    out.notes.push(`credit_events read failed (${lr && lr.status}) — the ledger is UNKNOWN, not empty`);
  }

  // THE TRACE IS KEYED BY `cid`, NOT BY JOB ID — so it is found by the site and
  // the job's own time window, and that is a JOIN THIS SCHEMA CANNOT MAKE
  // EXACTLY. Whatever comes back is reported as candidates rather than as
  // "this job's trace", because a second edit on the same site inside the
  // window would be indistinguishable.
  if (out.row.slug && out.row.created_at) {
    const from = new Date(out.row.created_at).toISOString();
    const to = new Date(new Date(out.row.updated_at || out.row.created_at).getTime() + traceWindowMs).toISOString();
    const tr = await sb(`edit_traces?slug=eq.${encodeURIComponent(out.row.slug)}&ended_at=gte.${from}&ended_at=lte.${to}&select=*&order=ended_at.asc`);
    // `Array.isArray` HERE IS ALSO A CRASH GUARD, not only an honesty one:
    // `describeJob` does `for (const t of rec.traces)`, and an object put in
    // that field throws rather than printing anything at all.
    if (tr && tr.status === 200 && Array.isArray(tr.rows)) out.traces = tr.rows;
    else out.notes.push(`edit_traces read failed (${tr && tr.status}${tr && tr.status === 200 ? ", body is not a list" : ""}) — no trace candidate is claimed either way`);
    out.notes.push("edit_traces has no job column — the rows above are matched by slug and time window, so they are CANDIDATES rather than a join");
    // EVERY JOB ON THE SITE WHOSE RUN CAN TOUCH THE WINDOW (2026-10-12,
    // corrected after Codex's control on 3869478b). Jobs are chosen by what
    // they ran, never by when they were created: any job created before the
    // window's end that was still being updated at or after the earliest
    // moment a returned trace began. A job created at 08:00 that ended at
    // 10:04 is therefore here beside a job created at 10:00. A row with no
    // timestamps, or a page of rows as long as the limit, leaves the read
    // incomplete; unread is never "none".
    const starts = out.traces.map(traceSpan).filter(Boolean).map((x) => x.start);
    const lower = new Date(Math.min(new Date(out.row.created_at).getTime(), ...starts) - ATTRIBUTION_SLACK_MS).toISOString();
    const sj = await sb(`edit_jobs?slug=eq.${encodeURIComponent(out.row.slug)}&created_at=lte.${to}&or=(updated_at.gte.${lower},updated_at.is.null)&select=id,state,created_at,updated_at&order=created_at.asc&limit=${SIBLING_READ_LIMIT}`);
    if (sj && sj.status === 200 && Array.isArray(sj.rows)) {
      const jobs = sj.rows.filter((x) => x && typeof x.id === "string");
      const complete = jobs.length === sj.rows.length && sj.rows.length < SIBLING_READ_LIMIT && jobs.every((x) => Number.isFinite(Date.parse(x.created_at)));
      out.siblings = { ok: true, complete, ids: jobs.map((x) => x.id), jobs: jobs.map((x) => ({ id: x.id, state: x.state, created_at: x.created_at, updated_at: x.updated_at })), why: complete ? "" : sj.rows.length >= SIBLING_READ_LIMIT ? `the jobs read for the window reached its limit of ${SIBLING_READ_LIMIT}` : "a job in the window was read without its id or its creation time" };
    } else out.siblings = { ok: false, why: `edit_jobs read for the window failed (${sj && sj.status})` };
  }

  if (poll) {
    const p = await poll();
    const h = (p && p.headers) || {};
    let fin;
    for (const k of Object.keys(h)) if (String(k).toLowerCase() === "x-gf-edit") { fin = h[k]; break; }
    out.poll = { status: p && p.status, final: fin || null, body: (p && p.json) || null, text: (p && p.text) || "" };
  }

  // THE STORED INSTRUCTION IS NOT IN ANY OF THESE. `worker.js` puts the whole
  // request body in R2 under `editJobKey(jobId)`, and R2 is a Worker binding —
  // no Supabase read and no existing route reaches it. Said out loud, because
  // an absence the reader has to notice is the shape this repo keeps meeting.
  out.notes.push("the submitted instruction is stored in R2 at editJobKey(<job>) and is NOT reachable from here — it would need a new owner route, which is a product change");

  return out;
}

/**
 * WHAT THE POLL SAYS OF THE JOB'S REPLY (2026-10-05), read by the same readers
 * as the UI canary's reply watch (`scripts/canary-replies.mjs`): written by the
 * model, still being written, failed, or none on the answer. Asked for run 97,
 * whose canary judged a reply while it was still being written: this read is
 * how to learn, afterwards and for nothing, whether it was written.
 *
 * WHAT THE READ ITSELF CAN DO, said once here and on every account: the poll
 * route never calls the model. It hands back the reply's record as it is — a
 * written reply, a failed one, nothing owed — and for a record still pending
 * past its horizon (15 minutes) it marks that record failed on the spot. A job
 * that ended more than two hours ago with no record is not asked for a reply
 * by a read (`REPLY_ASK_WINDOW_MS` in worker.js), so the answer then comes
 * back with no reply and no state, exactly as one owed nothing does: the
 * server does not tell those two apart, and neither does this. INSIDE those
 * two hours a job with no record IS asked for one by a read — the record made
 * and the reply queued, which the queue writes with a model call (ours, not
 * the customer's) — and the read answers `pending`. Run 98 read run 97's job
 * 1 h 34 min after it ended and found its reply already written.
 */
export function replyReading(poll) {
  if (!poll) return { state: "unread", says: "not polled" };
  const body = poll.body && typeof poll.body === "object" && !Array.isArray(poll.body) ? poll.body : null;
  if (poll.status !== 200 && !(poll.final === "final" && body)) return { state: "unread", says: `the poll answered HTTP ${poll.status}, so the reply's state is not known` };
  if (poll.final !== "final" || !body) return { state: "unread", says: `the poll handed back no stored answer (x-gf-edit: ${poll.final || "absent"}), so the reply's state is not known` };
  const state = replyStateOf(body);
  const asks = questionOf(body);
  switch (state) {
    case "model": return { state, says: `WRITTEN by the model: ${JSON.stringify(modelTextOf(body).slice(0, 400))}${asks ? ` (and its question: ${JSON.stringify(asks)})` : ""}` };
    case "pending": return { state, says: `still PENDING — being written${body.replyOutcome ? ` (the job's outcome: ${body.replyOutcome})` : ""}` };
    case "failed": return { state, says: "FAILED — the reply was not written; the page shows its own sentence instead" };
    case "none": return { state, says: "none: the answer is a hand-over, for which nothing is shown" };
    case "question": return { state, says: `a question with no reply on it: ${JSON.stringify(asks)}` };
    default: return { state: "plain", says: "NONE on the answer, and no state: either none was owed, or none was ever asked for (a job over two hours old with no reply record is not asked for one by a read) — the server does not say which" };
  }
}

/** One printable account, so the workflow log carries the whole answer. */
/** How far a job's row and its trace may disagree about when it ran: the trace is flushed after the job's last write. */
export const ATTRIBUTION_SLACK_MS = 60_000;
/** The most jobs one window read takes; a page this long may have been cut. */
export const SIBLING_READ_LIMIT = 200;
const TERMINAL = new Set(["done", "failed", "cancelled", "lost"]);

/** A trace's run as `{ start, end }` in ms, or null when it does not say (no end, no duration, or events dropped). */
export function traceSpan(t) {
  const end = Date.parse(t && t.ended_at);
  const ms = Number(t && t.ms);
  if (!Number.isFinite(end) || !Number.isFinite(ms) || ms < 0) return null;
  if (Array.isArray(t.events) && t.events.some((e) => e && e.p === "…")) return null;
  return { start: end - ms, end };
}

/**
 * DID ONE ADD-ON'S DESIGNERS RUN AT THE SAME TIME? (2026-10-12, the image-free
 * Add-on acceptance; attribution corrected the same day after Codex's
 * control on 3869478b.) The add-on job marks each designer `add:<kind>` start
 * and its outcome in its trace. The trace has no job column, so a trace is
 * this job's only when the evidence leaves nothing else it could be:
 *   - the job has finished, and every job on the site whose run touches the
 *     window was read, completely (`siblings.complete`), the job among them;
 *   - exactly one trace ran inside this job's own run (its creation to its
 *     last update, with `ATTRIBUTION_SLACK_MS` either side). A trace that
 *     began before this job existed is never its trace;
 *   - no other job's run touches that trace's run.
 * Then the verdict is `overlapped` or `not-overlapped`. Two traces inside
 * the run, or another job beside it, give `candidate-only`. A failed or
 * incomplete read, an unfinished job, a trace that does not say when it ran,
 * or no trace inside the run (the job's own is missing) gives `unknown`.
 * Two designers overlap when one started before the other ended. The row
 * step (`add:row`) is not a designer.
 */
export function addonDesignOverlap(rec) {
  const r = rec || {};
  if (!r.row) return { verdict: "unknown", why: "the job's record was not read" };
  if (!Array.isArray(r.traces)) return { verdict: "unknown", why: "the trace was not read" };
  const sib = r.siblings;
  if (!sib || sib.ok !== true || !Array.isArray(sib.jobs)) return { verdict: "unknown", why: (sib && sib.why) || "the jobs in the window were not read" };
  if (sib.complete !== true) return { verdict: "unknown", why: sib.why || "the jobs in the window were not read completely" };
  if (!sib.jobs.some((j) => j.id === r.job)) return { verdict: "unknown", why: "the jobs read for the window do not include this job" };
  if (!TERMINAL.has(r.row.state)) return { verdict: "unknown", why: `the job had not finished (${r.row.state || "no state"})` };
  const c0 = Date.parse(r.row.created_at), u0 = Date.parse(r.row.updated_at);
  if (!Number.isFinite(c0) || !Number.isFinite(u0)) return { verdict: "unknown", why: "the job's own run has no creation or last-update time" };
  if (!r.traces.length) return { verdict: "unknown", why: "no trace in the window" };
  const spans = r.traces.map((t) => ({ cid: t && t.cid, span: traceSpan(t), t }));
  if (spans.some((x) => !x.span)) return { verdict: "unknown", why: "a trace in the window does not say when it ran, or dropped events" };
  const intervals = (t) => {
    const out = new Map();
    for (const e of Array.isArray(t && t.events) ? t.events : []) {
      if (!e || typeof e.p !== "string" || !e.p.startsWith("add:") || e.p === "add:row" || !Number.isFinite(Number(e.ms))) continue;
      const k = e.p.slice(4), at = Number(e.ms);
      const cur = out.get(k);
      if (e.s === "start") { if (!cur) out.set(k, { kind: k, start: at, end: null }); continue; }
      if (cur && cur.end === null) cur.end = at;
    }
    return [...out.values()];
  };
  const said = spans.map((x) => `${x.cid} (${new Date(x.span.start).toISOString()}–${new Date(x.span.end).toISOString()}): ${intervals(x.t).map((i) => `${i.kind} ${i.start}-${i.end === null ? "open" : i.end}`).join(", ") || "no designer"}`).join("; ");
  const S = ATTRIBUTION_SLACK_MS;
  const inside = spans.filter((x) => x.span.start >= c0 - S && x.span.end <= u0 + S);
  if (!inside.length) return { verdict: "unknown", why: "no trace ran inside this job's own run — its trace is missing, and the traces returned belong to other runs", said };
  if (inside.length > 1) return { verdict: "candidate-only", why: `${inside.length} traces ran inside this job's run — which is its own cannot be told`, said };
  const mine = inside[0];
  const beside = sib.jobs.filter((j) => j.id !== r.job).filter((j) => {
    const c = Date.parse(j.created_at), u = Date.parse(j.updated_at);
    const end = Number.isFinite(u) ? u : Infinity;
    return c - S <= mine.span.end && end + S >= mine.span.start;
  });
  if (beside.length) return { verdict: "candidate-only", why: `${beside.length} other job(s) on the site ran while that trace ran (${beside.map((j) => j.id).join(", ")}) — it cannot be tied to this job`, said };
  const list = intervals(mine.t);
  if (list.length < 2) return { verdict: "unknown", why: `${list.length} designer(s) marked — nothing to run beside`, said, cid: mine.cid };
  const meets = [];
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const x = list[i], y = list[j];
    const xEnd = x.end === null ? Infinity : x.end, yEnd = y.end === null ? Infinity : y.end;
    if (x.start < yEnd && y.start < xEnd) meets.push(`${x.kind} and ${y.kind}`);
  }
  // `cid` NAMES THE ONE TRACE TIED TO THIS JOB (2026-10-13, K3B): a reader
  // of the picker's kinds and each designer's start reads that trace only.
  return meets.length
    ? { verdict: "overlapped", why: "", meets, said, cid: mine.cid }
    : { verdict: "not-overlapped", why: "every designer started after the one before it ended", said, cid: mine.cid };
}

export function describeJob(rec) {
  const L = [];
  const r = rec.row;
  if (!r) { L.push(`no record for ${rec.job}`); for (const n of rec.notes) L.push("  note: " + n); return L.join("\n"); }
  L.push(`JOB ${rec.job}`);
  L.push(`  slug        ${r.slug}   op ${r.op}`);
  L.push(`  state       ${r.state}${r.phase ? "  phase " + r.phase : ""}${r.needs_review ? "  NEEDS REVIEW" : ""}`);
  L.push(`  created     ${r.created_at}`);
  L.push(`  updated     ${r.updated_at}`);
  L.push(`  publish     started ${r.publish_started_at || "-"}   published ${r.published_at || "-"}`);
  L.push(`  lease       owner ${r.lease_owner || "-"}  expires ${r.lease_expires_at || "-"}  beat ${r.heartbeat_at || "-"}`);
  // THE ROW'S OWN `billing` FIELD AND THE LEDGER ARE TWO SEPARATE READINGS,
  // and they are printed as two lines that never borrow from each other. The
  // field is the job's own record of what it did; the ledger is the money that
  // moved. When both are readable they should agree, and **a disagreement is a
  // finding** — which is only visible if neither line is derived from the
  // other.
  const bill = billingMeans(r.billing);
  L.push(`  billing     ${r.billing}  cost ${r.cost}  ->  ${bill.says}`);
  if (r.error) L.push(`  error       ${JSON.stringify(r.error)}`);
  const res = r.result || null;
  L.push(`  result      ${res ? `status ${res.status} type ${res.type || "-"}` : "NONE STORED"}`);
  if (res && typeof res.body === "string") L.push(`  body        ${res.body.slice(0, 700)}`);
  const seen = oldWatchWouldHaveSeen(r);
  L.push(`  old watch   ${seen.says}`);
  const led = ledgerVerdict(rec.ledger, rec.ledgerRead);
  L.push(`  LEDGER      ${led.says}`);
  // ROWS ARE PRINTED ONLY UNDER A READ THAT ANSWERED. Under a refusal there
  // may still be rows in hand — a partial body, a retry's leftovers — and
  // listing them beneath an "unknown" invites exactly the arithmetic the line
  // above refuses to do.
  if (led.readable) for (const e of rec.ledger) L.push(`    ${e.at}  ${e.kind}  ${e.reason}  delta ${e.delta}  after ${e.balance_after}  ref ${e.ref}`);
  if (rec.poll) {
    L.push(`  poll        HTTP ${rec.poll.status}  x-gf-edit: ${rec.poll.final || "(absent)"}`);
    // THE JOB'S REPLY, AS THAT POLL HANDED IT BACK (`replyReading`).
    L.push(`  REPLY       ${replyReading(rec.poll).says}`);
  }
  for (const t of rec.traces) {
    L.push(`  trace ${t.cid}  ended ${t.ended_at}  ms ${t.ms}  ok ${t.ok}  failed_phase ${t.failed_phase || "-"}${t.err_name ? "  " + t.err_name : ""}`);
    if (t.err_msg) L.push(`    err       ${t.err_msg}`);
    if (Array.isArray(t.events)) L.push(`    events    ${t.events.map((e) => `${e.p}:${e.s}@${e.ms}`).join(" ")}`);
  }
  if (r.op === "addon" || (rec.traces || []).some((t) => Array.isArray(t && t.events) && t.events.some((e) => e && typeof e.p === "string" && e.p.startsWith("add:") && e.p !== "add:row"))) {
    const d = addonDesignOverlap(rec);
    L.push(`  DESIGNERS   ${d.verdict}${d.meets ? " (" + d.meets.join("; ") + ")" : ""}${d.why ? " — " + d.why : ""}`);
    if (d.said) L.push(`    intervals ${d.said}`);
  }
  for (const n of rec.notes) L.push("  note: " + n);
  return L.join("\n");
}
