// THE REQUEST BATCH IN ONE PRESS (`rq-batch`, 2026-10-04, on the owner's
// word: "yeah do that better", choosing one press for R1–R5 over five).
//
// IT RUNS THE CANARY ONCE PER SCENARIO, IN ORDER, AND CHANGES NOTHING ABOUT A
// PRESS: each of R1–R5 is `scripts/edit-canary.mjs` run as its own process,
// with its own preflight, its own before-read taken just before its message,
// its own verdict, its own money check and its own evidence directory — the
// same run the form would start for that scenario. Running them together
// instead would let each press see the others' changes and charges, so they
// never overlap: the next starts only once the last has exited.
//
// AND IT STOPS ITSELF, three ways, each before anything more is spent:
//   - before a press whose upper estimate would take the batch past the
//     threshold (100): what the batch spent before this press (its own box)
//     plus what each press here spent, plus the next one's upper estimate;
//   - after a press that failed (any non-zero exit): the rest are not pressed,
//     so a fault is read before four more presses pay for it;
//   - after a press whose spend cannot be read off its own record: what the
//     batch has spent is then not known, and the direction that costs money is
//     the one to refuse.
// The threshold is checked BETWEEN presses, as the plan's own rule is: once a
// press's message is sent, nothing here stops it on cost, and the balance is
// the only hard bound.
//
// A PRESS'S SPEND is its own charges, as its money check counted them
// (`ui.json`'s `requests.money.own`: its routing calls and its jobs, each
// against the ledger), so the owner's own use of the account while the batch
// runs is not counted as the batch's. A press with no such verdict falls back
// to the move of the balance it read itself, after the app opened and after
// its messages ended — the stricter reading, since it counts everything.
// Without `spend`, every press is a rehearsal that sends nothing, so it spent
// nothing whatever its record says.
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { UI_SCENARIOS, stepBoundMs } from "./canary-ui.mjs";

export const BATCH_NAME = "rq-batch";
export const BATCH_THRESHOLD = 100;
// THE ORDER, AND EACH PRESS'S UPPER ESTIMATE, as the rollout plan's §7 has them
// (docs/investigations/request-flow-rollout.md). Each is its scenario's budget
// less one; a test holds both ties.
export const BATCH = Object.freeze([
  Object.freeze({ name: "rq-1-classes", upper: 24 }),
  Object.freeze({ name: "rq-2-wholesale", upper: 25 }),
  Object.freeze({ name: "rq-3-facebook", upper: 12 }),
  Object.freeze({ name: "rq-4-logo", upper: 7 }),
  Object.freeze({ name: "rq-5-away", upper: 17 }),
]);
// WHAT A PRESS NEEDS BEYOND ITS MESSAGES' OWN BOUNDS: the sign-in, the
// preflight and its zero-cost job, the before- and after-reads and the wait
// for the last version, and the job records. A generous allowance, so the
// workflow's limit for the batch (`timeout-minutes`) is read against the worst
// case, never the usual one.
export const BATCH_PRESS_OVERHEAD_MS = 6 * 60_000;

/** The worst case of the whole batch: every message at its bound, every press at its overhead. */
export function batchWorstMs(batch = BATCH, scenarios = UI_SCENARIOS) {
  let ms = 0;
  for (const p of batch) {
    const s = scenarios[p.name];
    ms += BATCH_PRESS_OVERHEAD_MS + (s ? s.steps.reduce((a, st) => a + stepBoundMs(st), 0) : Infinity);
  }
  return ms;
}

/** The box: credits the batch spent before this press. A whole number, or a refusal naming why. */
export function readBatchSpent(raw) {
  if (typeof raw !== "string") return { ok: false, why: "the batch's spend so far is not given" };
  const s = raw.trim();
  if (!s) return { ok: false, why: "the batch's spend so far is blank: give what the batch has spent before this press (rq-canary's 4), or 0" };
  if (!/^\d{1,4}$/.test(s)) return { ok: false, why: `the batch's spend so far must be a whole number of credits, not ${JSON.stringify(s.slice(0, 20))}` };
  return { ok: true, spent: Number(s) };
}

/** Does the next press fit: the spend so far plus its upper estimate, at most the threshold. */
export function fits({ spent, upper, threshold = BATCH_THRESHOLD }) {
  return Number.isFinite(spent) && spent >= 0 && Number.isFinite(upper) && upper >= 0 && spent + upper <= threshold;
}

/**
 * What one press spent, off its own record: its own charges where its money
 * check passed, and otherwise the balance it read after the app opened, less
 * the one it read after its messages. Null — cannot tell — for a missing
 * record, a balance that is not a number or was unreadable (-1), or a balance
 * that rose (something outside the press moved it).
 */
export function spentOf(record) {
  const m = record && typeof record === "object" && record.requests && typeof record.requests === "object" ? record.requests.money : null;
  if (m && typeof m === "object" && m.ok === true && typeof m.own === "number" && Number.isFinite(m.own) && m.own >= 0) return m.own;
  const b = record && typeof record === "object" && record.ui && typeof record.ui === "object" ? record.ui.balance : null;
  if (!b || typeof b !== "object") return null;
  const { start, end } = b;
  if (typeof start !== "number" || typeof end !== "number") return null;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < 0 || end > start) return null;
  return start - end;
}

/**
 * The batch itself: each press in order, the next only when it fits, the last
 * passed and its spend was read. `runOne(name)` runs one press to its end and
 * answers its exit code; `readRecord(name)` answers its record or null.
 */
export async function runBatch({ spent0, spend, runOne, readRecord, batch = BATCH, threshold = BATCH_THRESHOLD, log = () => {} }) {
  const results = [];
  let spent = spent0;
  const end = (stopped, ok) => ({ ok, spent, results, stopped });
  for (const [i, p] of batch.entries()) {
    const tag = `R${i + 1} ${p.name}`;
    if (!fits({ spent, upper: p.upper, threshold })) {
      const why = `the batch has spent ${spent}; ${tag}'s upper estimate of ${p.upper} would take it to ${spent + p.upper}, past ${threshold}`;
      log(`\n── STOPPING BEFORE ${tag}: ${why} ──`);
      return end({ before: p.name, why }, true);
    }
    log(`\n── ${tag}: spent so far ${spent}, its upper estimate ${p.upper}, ${spent + p.upper} within ${threshold} ──\n`);
    const code = await runOne(p.name);
    const record = readRecord(p.name);
    const own = spentOf(record);
    const s = spend ? own : (record ? 0 : null);
    results.push({ name: p.name, code, spent: s });
    if (s !== null) spent += s;
    log(`\n── ${tag}: ${code === 0 ? "PASSED" : `FAILED (exit ${code})`}, spent ${s === null ? "UNKNOWN" : s}; the batch has spent ${spent} ──`);
    if (code !== 0) return end({ after: p.name, why: `${tag} failed (exit ${code}), so the rest were not pressed` }, false);
    if (s === null) return end({ after: p.name, why: `${tag}'s spend could not be read off its own record, so what the batch has spent is not known` }, false);
  }
  return end(null, true);
}

/** The batch's account, as the log and `batch.txt` print it. */
export function describeBatch(out, { spent0, threshold = BATCH_THRESHOLD, batch = BATCH } = {}) {
  const lines = [`REQUEST BATCH — ${out.results.length} of ${batch.length} pressed; spent before ${spent0}, in this press ${out.spent - spent0}, the batch ${out.spent} (threshold ${threshold}, checked between presses)`];
  for (const [i, r] of out.results.entries()) lines.push(`  R${i + 1} ${r.name.padEnd(15)} ${r.code === 0 ? "PASSED" : `FAILED (exit ${r.code})`}  spent ${r.spent === null ? "UNKNOWN" : r.spent}`);
  for (const p of batch.slice(out.results.length)) lines.push(`  -- ${p.name.padEnd(15)} not pressed`);
  lines.push(out.stopped ? `  stopped ${out.stopped.before ? "before " + out.stopped.before : "after " + out.stopped.after}: ${out.stopped.why}` : "  every press was made");
  lines.push(out.ok ? "BATCH ENDED: no press failed" : "BATCH FAILED: a press failed or its spend could not be read");
  return lines.join("\n");
}

// WHAT REFUSES THE WHOLE BATCH BEFORE ANY PRESS STARTS, with nothing signed in
// or spent: the box, the site, and — with spend — the deploy and image boxes
// every paid press demands anyway.
export function batchRefusal(env) {
  const box = readBatchSpent(env.CANARY_BATCH_SPENT);
  if (!box.ok) return { why: box.why };
  const site = String(env.CANARY_SLUG || "").trim().toLowerCase();
  for (const p of BATCH) {
    const s = UI_SCENARIOS[p.name];
    if (!s) return { why: `the batch names ${p.name}, which is not a scenario` };
    if (s.site !== site) return { why: `the batch runs on ${s.site}, and the site box says ${site || "(blank)"}` };
  }
  if (env.CANARY_SPEND === "1" && (!String(env.EXPECT_DEPLOY || "").trim() || !String(env.EXPECT_IMAGE || "").trim())) {
    return { why: "a paid batch needs the deploy sha and image boxes filled, as every paid press does" };
  }
  return { spent0: box.spent };
}

/** The CLI: refuse whole or run the batch, write its record, answer the exit code. */
export async function runBatchMain(env, { child = fileURLToPath(new URL("./edit-canary.mjs", import.meta.url)) } = {}) {
  const r = batchRefusal(env);
  if (r.why) {
    console.error(`REFUSING THE BATCH: ${r.why}. Nothing was signed in, pressed or charged.`);
    return 2;
  }
  const spend = env.CANARY_SPEND === "1";
  const evid = String(env.CANARY_EVIDENCE_DIR || "docs/edits/canary").trim();
  const script = String(env.CANARY_BATCH_CHILD || "").trim() || child;
  mkdirSync(evid, { recursive: true });
  console.log(`REQUEST BATCH — ${BATCH.map((p) => p.name).join(", ")}, in that order, one at a time, on ${env.CANARY_SLUG}; ${spend ? "PAID" : "a rehearsal: nothing is sent"}; spent before ${r.spent0}, threshold ${BATCH_THRESHOLD} between presses`);
  const runOne = (name) => new Promise((resolve) => {
    const e = { ...env, CANARY_UI: name, CANARY_EVIDENCE_DIR: `${evid}/${name}` };
    delete e.CANARY_BATCH_SPENT;
    delete e.CANARY_BATCH_CHILD;
    const p = spawn(process.execPath, [script], { env: e, stdio: "inherit" });
    p.on("error", () => resolve(1));
    p.on("close", (code, signal) => resolve(signal ? 1 : (code ?? 1)));
  });
  const readRecord = (name) => {
    try { return JSON.parse(readFileSync(`${evid}/${name}/ui.json`, "utf8")); } catch { return null; }
  };
  const out = await runBatch({ spent0: r.spent0, spend, runOne, readRecord, log: (s) => console.log(s) });
  const told = describeBatch(out, { spent0: r.spent0 });
  console.log("\n" + told);
  writeFileSync(`${evid}/batch.json`, JSON.stringify({ batch: BATCH, threshold: BATCH_THRESHOLD, spend, spent0: r.spent0, ...out }, null, 2));
  writeFileSync(`${evid}/batch.txt`, told + "\n");
  return out.ok ? 0 : 1;
}
