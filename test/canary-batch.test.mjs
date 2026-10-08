// THE REQUEST BATCH IN ONE PRESS (`rq-batch`, 2026-10-04). The owner, offered
// one press for R1–R5 that stops itself before the batch's spend would pass
// 100: *"yeah do that better"*.
//
// What is held here: the order and each press's upper estimate are the plan's;
// the presses never overlap; the batch stops before a press that would not
// fit, after a press that fails, and after one whose spend cannot be read; the
// whole batch is refused before anything when its box, its site or a paid
// press's boxes are wrong; the workflow gives this mode alone a longer limit,
// which covers its worst case; and the real canary script hands the mode on
// before anything is signed in, running itself once per press with that
// press's scenario and evidence directory and without the batch's box.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { UI_SCENARIOS, UI_PRESS_MAX_MS, stepBoundMs } from "../scripts/canary-ui.mjs";
import {
  BATCH_NAME, BATCH_THRESHOLD, BATCH, BATCH_PRESS_OVERHEAD_MS, batchWorstMs, readBatchSpent, fits, spentOf, runBatch,
  describeBatch, batchRefusal, BATCH_FROM_R2_NAME, BATCH_FROM_R2, BATCH_FROM_R2_SPENT_MIN, batchOf,
} from "../scripts/canary-batch.mjs";

const ROOT = new URL("../", import.meta.url).pathname;
const PLAN = fs.readFileSync(ROOT + "docs/investigations/request-flow-rollout.md", "utf8");
const FLOW = fs.readFileSync(ROOT + ".github/workflows/edit-canary.yml", "utf8");
const CANARY = fs.readFileSync(ROOT + "scripts/edit-canary.mjs", "utf8");
const NAMES = ["rq-1-classes", "rq-2-wholesale", "rq-3-facebook", "rq-4-logo", "rq-5-away"];
const rec = (start, end) => ({ ui: { balance: { start, end } } });

// ── THE BATCH, AS THE PLAN HAS IT ─────────────────────────────────────────

test("the batch is R1 to R5 in the plan's order, each a request scenario on the bakery, each upper estimate its budget less one and the plan's own", () => {
  assert.equal(BATCH_NAME, "rq-batch");
  assert.deepEqual(BATCH.map((p) => p.name), NAMES);
  assert.equal(BATCH_THRESHOLD, 100);
  assert.match(PLAN, /\*\*The threshold of 100 is a check between presses, not a ceiling\.\*\*/, "the plan no longer names its threshold");
  for (const [i, p] of BATCH.entries()) {
    const s = UI_SCENARIOS[p.name];
    assert.equal(p.n, i + 1, `${p.name} does not carry its own number in the plan`);
    assert.ok(s, `${p.name} is not a scenario`);
    assert.equal(s.request, true, `${p.name} is not a request press`);
    assert.equal(s.site, "fold-lane-bakery");
    assert.equal(p.upper, s.budget - 1, `${p.name}'s upper estimate is not its budget less one`);
    // The plan's §7 table: "| R1 | 9–24 | …".
    const row = new RegExp(`^\\| R${i + 1}(?: \\(two messages\\))? \\| \\d+–${p.upper} \\|`, "m");
    assert.match(PLAN, row, `the plan's cost table does not give R${i + 1} the upper estimate ${p.upper}`);
  }
  // The scenario box's own name is not a scenario: the batch hands it on.
  assert.equal(UI_SCENARIOS[BATCH_NAME], undefined);
});

test("the workflow gives the batch and its continuation from R2 alone a longer limit that covers the worst case, and every other run keeps 45", () => {
  // The batch's two names first; a scenario with its own press limit (`pressMs`, lv-combined) may follow before the default.
  const m = /timeout-minutes:\s*\$\{\{\s*\(github\.event\.inputs\.ui_scenario == '([^']+)' \|\| github\.event\.inputs\.ui_scenario == '([^']+)'\) && (\d+) \|\| (?:github\.event\.inputs\.ui_scenario == '[^']+' && \d+ \|\| )*(\d+)\s*\}\}/.exec(FLOW);
  assert.ok(m, "the workflow's limit is not the batch's expression");
  assert.deepEqual([m[1], m[2]], [BATCH_NAME, BATCH_FROM_R2_NAME]);
  const batchMin = Number(m[3]), otherMin = Number(m[4]);
  // THE CONTINUATION IS FOUR OF THE FIVE: inside the same limit, with more to spare.
  assert.ok(batchWorstMs(BATCH_FROM_R2) < batchWorstMs(), "the continuation's worst case is not less than the whole batch's");
  assert.ok(batchWorstMs(BATCH_FROM_R2) + 15 * 60_000 <= batchMin * 60_000);
  assert.equal(otherMin, 45, "a single press's limit moved");
  assert.equal(batchMin, 180);
  // Every message at its bound and every press at its overhead, and still a
  // quarter of an hour to spare for the browser's install and the evidence.
  const worst = batchWorstMs();
  assert.equal(worst, BATCH.reduce((a, p) => a + BATCH_PRESS_OVERHEAD_MS + UI_SCENARIOS[p.name].steps.reduce((b, st) => b + stepBoundMs(st), 0), 0));
  assert.ok(worst + 15 * 60_000 <= batchMin * 60_000, `the batch's worst case is ${worst / 60_000} minutes`);
  assert.ok(worst > 100 * 60_000, "the worst case no longer counts the presses' own bounds");
  for (const p of BATCH) {
    const own = UI_SCENARIOS[p.name].steps.reduce((a, st) => a + stepBoundMs(st), 0);
    assert.ok(own <= UI_PRESS_MAX_MS, `${p.name}'s messages are bounded past one press's limit`);
  }
  assert.equal(batchWorstMs([{ name: "no-such-scenario", upper: 1 }]), Infinity, "an unknown press counted as no time at all");
  // The allowance beyond the messages stays generous: the worst case is read against the worst press.
  assert.ok(BATCH_PRESS_OVERHEAD_MS >= 5 * 60_000, `a press's overhead is allowed only ${BATCH_PRESS_OVERHEAD_MS / 60_000} minutes`);
});

test("the workflow's form carries the batch's box, hands it to the canary, names the mode, and keeps one canary step", () => {
  assert.match(FLOW, /\n {6}batch_spent:\n/, "the form has no batch box");
  const at = FLOW.indexOf("\n      batch_spent:\n");
  const box = FLOW.slice(at, FLOW.indexOf("\n      rules_allow:\n", at));
  assert.match(box, /description: 'REQUEST BATCH ONLY \(rq-batch, rq-batch-r2\):[^']*for rq-batch-r2, rq-canary and R1 cost 25 together, plus what the focused check cost[^']*100[^']*'/);
  assert.match(box, /required: false\n {8}default: ''/);
  assert.match(FLOW, /CANARY_BATCH_SPENT:\s*\$\{\{\s*github\.event\.inputs\.batch_spent\s*\}\}/);
  // The box never arms spending.
  assert.doesNotMatch(FLOW.match(/CANARY_SPEND:.*/)[0], /batch_spent/);
  // The scenario box names the mode.
  const sAt = FLOW.indexOf("\n      ui_scenario:\n");
  const sBox = FLOW.slice(sAt, FLOW.indexOf("\n      batch_spent:\n", sAt));
  assert.match((sBox.match(/description: '([^']*)'/) || [])[1] || "", /rq-batch \(rq-1-classes to rq-5-away in order in this one run/);
  assert.match((sBox.match(/description: '([^']*)'/) || [])[1] || "", /rq-batch-r2 \(its continuation: rq-2-wholesale to rq-5-away the same way, never pressing rq-canary or rq-1-classes again; fill the batch box\)/);
  // One canary step, as before: the script hands the mode on itself.
  assert.equal(FLOW.split("run: node scripts/edit-canary.mjs").length - 1, 1);
  assert.doesNotMatch(FLOW, /canary-batch\.mjs\s*$/m, "the workflow runs the batch module directly");
});

test("the canary hands the mode on before anything is signed in, and refuses the batch's box beside any other run", () => {
  const ui = CANARY.indexOf('const UI = String(process.env.CANARY_UI || "").trim();');
  const hand = CANARY.indexOf("if (batchOf(UI)) process.exit(await runBatchMain(process.env));");
  const box = CANARY.indexOf('if (String(process.env.CANARY_BATCH_SPENT || "").trim()) {');
  const need = CANARY.indexOf("if (!EMAIL || !SERVICE_KEY || (!CANARY && !READ_JOB)) {");
  const signIn = CANARY.indexOf("/auth/v1/admin/generate_link");
  for (const [n, i] of Object.entries({ ui, hand, box, need, signIn })) assert.ok(i > 0, `${n} not found`);
  assert.ok(ui < hand && hand < box && box < need && need < signIn, "the hand-on or the box's refusal is not above the sign-in");
  assert.match(CANARY, /import \{ BATCH_NAME, BATCH_FROM_R2_NAME, batchOf, runBatchMain \} from "\.\/canary-batch\.mjs";/);
});

// ── THE READERS ───────────────────────────────────────────────────────────

test("the batch's box is a whole number of credits, or a refusal that names why", () => {
  assert.deepEqual(readBatchSpent("4"), { ok: true, spent: 4 });
  assert.deepEqual(readBatchSpent(" 0 "), { ok: true, spent: 0 });
  assert.deepEqual(readBatchSpent("1234"), { ok: true, spent: 1234 });
  for (const bad of ["", "   ", "-1", "4.5", "4 credits", "abc", "12345", "0x4", "+4", "4e1"]) {
    const r = readBatchSpent(bad);
    assert.equal(r.ok, false, `${JSON.stringify(bad)} was read as a spend`);
    assert.ok(r.why.length > 10);
  }
  assert.match(readBatchSpent("").why, /blank/);
  // CANNOT-TELL NEVER READS AS A VALUE: a number or nothing is not the box's text.
  for (const bad of [undefined, null, 4, ["4"]]) assert.equal(readBatchSpent(bad).ok, false, `${JSON.stringify(bad)} was read as a spend`);
});

test("a press fits when the spend so far plus its upper estimate is at most the threshold", () => {
  assert.equal(fits({ spent: 76, upper: 24 }), true, "exactly 100 does not fit");
  assert.equal(fits({ spent: 77, upper: 24 }), false);
  assert.equal(fits({ spent: 0, upper: 0 }), true);
  assert.equal(fits({ spent: 50, upper: 30, threshold: 79 }), false);
  assert.equal(fits({ spent: 49, upper: 30, threshold: 79 }), true);
  for (const bad of [{ spent: NaN, upper: 1 }, { spent: 1, upper: NaN }, { spent: -1, upper: 1 }, { spent: 1, upper: -1 }, { spent: "4", upper: 1 }]) {
    assert.equal(fits(bad), false, `${JSON.stringify(bad)} fitted`);
  }
});

test("a press's spend is the move of the balance it read itself, or cannot-tell", () => {
  assert.equal(spentOf(rec(133, 120)), 13);
  assert.equal(spentOf(rec(120, 120)), 0);
  assert.equal(spentOf(rec(120, 121)), null, "a balance that rose was read as a spend");
  assert.equal(spentOf(rec(-1, 100)), null, "an unreadable start was read");
  assert.equal(spentOf(rec(100, -1)), null, "an unreadable end was read");
  assert.equal(spentOf(rec("133", "120")), null, "text was read as a balance");
  assert.equal(spentOf(rec(null, 120)), null);
  assert.equal(spentOf(rec(Infinity, 120)), null);
  for (const bad of [null, undefined, {}, { ui: null }, { ui: {} }, { ui: { balance: null } }, "x"]) assert.equal(spentOf(bad), null, `${JSON.stringify(bad)} was read`);
});

// ── THE BATCH, DRIVEN ─────────────────────────────────────────────────────

function driven({ codes = {}, spends = {}, records = {}, spent0 = 4, spend = true, batch } = {}) {
  const calls = [];
  const logs = [];
  let bal = 133;
  return {
    calls, logs,
    run: () => runBatch({
      spent0, spend, ...(batch ? { batch } : {}),
      runOne: async (name) => { calls.push(name); return Object.hasOwn(codes, name) ? codes[name] : 0; },
      readRecord: (name) => {
        if (Object.hasOwn(records, name)) return records[name];
        const s = Object.hasOwn(spends, name) ? spends[name] : 5;
        const r = rec(bal, bal - s); bal -= s; return r;
      },
      log: (s) => logs.push(s),
    }),
  };
}

test("every press is made in order when each passes and fits, and the batch's spend adds up", async () => {
  const d = driven({ spends: { "rq-1-classes": 14, "rq-2-wholesale": 15, "rq-3-facebook": 6, "rq-4-logo": 3, "rq-5-away": 11 } });
  const out = await d.run();
  assert.deepEqual(d.calls, NAMES);
  assert.equal(out.ok, true);
  assert.equal(out.stopped, null);
  assert.equal(out.spent, 4 + 14 + 15 + 6 + 3 + 11);
  assert.deepEqual(out.results.map((r) => r.spent), [14, 15, 6, 3, 11]);
  assert.ok(d.logs.some((l) => /R1 rq-1-classes: spent so far 4, its upper estimate 24, 28 within 100/.test(l)), d.logs.join("\n"));
  const told = describeBatch(out, { spent0: 4 });
  assert.match(told, /5 of 5 pressed; spent before 4, in this press 49, the batch 53/);
  assert.match(told, /every press was made/);
  assert.match(told, /BATCH ENDED: no press failed/);
});

test("a press that fails stops the batch: nothing after it is pressed", async () => {
  const d = driven({ codes: { "rq-2-wholesale": 1 } });
  const out = await d.run();
  assert.deepEqual(d.calls, ["rq-1-classes", "rq-2-wholesale"]);
  assert.equal(out.ok, false);
  assert.equal(out.stopped.after, "rq-2-wholesale");
  assert.match(out.stopped.why, /R2 rq-2-wholesale failed \(exit 1\), so the rest were not pressed/);
  assert.equal(out.spent, 4 + 5 + 5, "the failed press's own spend was not counted");
  const told = describeBatch(out, { spent0: 4 });
  assert.match(told, /R2 rq-2-wholesale\s+FAILED \(exit 1\)/);
  assert.match(told, /-- rq-3-facebook\s+not pressed/);
  assert.match(told, /BATCH FAILED/);
  // Any non-zero exit is a failure, the refusal's 2 among them.
  const d2 = driven({ codes: { "rq-1-classes": 2 } });
  const o2 = await d2.run();
  assert.deepEqual(d2.calls, ["rq-1-classes"]);
  assert.equal(o2.ok, false);
});

test("the batch stops before a press that would take its spend past 100, which is no failure", async () => {
  const d = driven({ spends: { "rq-1-classes": 60, "rq-2-wholesale": 20, "rq-3-facebook": 10 } });
  const out = await d.run();
  // 4 → 64 (R2 fits: 64 + 25 = 89) → 84 (R3 fits: 84 + 12 = 96) → 94; R4: 94 + 7 = 101.
  assert.deepEqual(d.calls, ["rq-1-classes", "rq-2-wholesale", "rq-3-facebook"]);
  assert.equal(out.ok, true);
  assert.equal(out.spent, 94);
  assert.equal(out.stopped.before, "rq-4-logo");
  assert.match(out.stopped.why, /the batch has spent 94; R4 rq-4-logo's upper estimate of 7 would take it to 101, past 100/);
  // And before the first press, when even that one does not fit.
  const d2 = driven({ spent0: 77 });
  const o2 = await d2.run();
  assert.deepEqual(d2.calls, []);
  assert.equal(o2.stopped.before, "rq-1-classes");
  assert.equal(o2.ok, true);
});

test("exactly 100 fits: a press whose upper estimate brings the batch to 100 is made", async () => {
  const d = driven({ spent0: 76, spends: { "rq-1-classes": 24 } });
  const out = await d.run();
  assert.deepEqual(d.calls, ["rq-1-classes"], "the press reaching exactly 100 was not made");
  assert.equal(out.spent, 100);
  assert.equal(out.stopped.before, "rq-2-wholesale");
});

test("a press whose spend cannot be read stops the batch, as a failure", async () => {
  const d = driven({ records: { "rq-1-classes": null } });
  const out = await d.run();
  assert.deepEqual(d.calls, ["rq-1-classes"]);
  assert.equal(out.ok, false);
  assert.equal(out.stopped.after, "rq-1-classes");
  assert.match(out.stopped.why, /spend could not be read off its own record/);
  assert.equal(out.results[0].spent, null);
  assert.match(describeBatch(out, { spent0: 4 }), /spent UNKNOWN/);
  const d2 = driven({ records: { "rq-2-wholesale": rec(100, 101) } });
  const o2 = await d2.run();
  assert.deepEqual(d2.calls, ["rq-1-classes", "rq-2-wholesale"]);
  assert.equal(o2.ok, false);
});

test("a rehearsal counts nothing spent, and still stops on a failure or a missing record", async () => {
  const d = driven({ spend: false, spends: { "rq-1-classes": 40, "rq-2-wholesale": 40, "rq-3-facebook": 40 } });
  const out = await d.run();
  assert.deepEqual(d.calls, NAMES, "a rehearsal's records were counted as spend");
  assert.equal(out.spent, 4);
  assert.equal(out.ok, true);
  const d2 = driven({ spend: false, records: { "rq-3-facebook": null } });
  const o2 = await d2.run();
  assert.deepEqual(d2.calls, ["rq-1-classes", "rq-2-wholesale", "rq-3-facebook"]);
  assert.equal(o2.ok, false);
  const d3 = driven({ spend: false, codes: { "rq-1-classes": 1 } });
  assert.equal((await d3.run()).ok, false);
});

test("the presses never overlap: the next starts only once the last has ended", async () => {
  const spans = [];
  let open = 0, maxOpen = 0;
  const out = await runBatch({
    spent0: 0, spend: true,
    runOne: async (name) => {
      open++; maxOpen = Math.max(maxOpen, open);
      const t = Date.now();
      await new Promise((r) => setTimeout(r, 15));
      spans.push({ name, t, end: Date.now() });
      open--;
      return 0;
    },
    readRecord: () => rec(10, 10),
  });
  assert.equal(out.ok, true);
  assert.equal(maxOpen, 1);
  for (let i = 1; i < spans.length; i++) assert.ok(spans[i].t >= spans[i - 1].end, "a press started before the last ended");
});

// ── THE WHOLE BATCH REFUSED BEFORE ANYTHING ────────────────────────────────

test("the whole batch is refused before any press when its box, its site or a paid press's boxes are wrong", () => {
  const ok = { CANARY_BATCH_SPENT: "4", CANARY_SLUG: "fold-lane-bakery", CANARY_SPEND: "1", EXPECT_DEPLOY: "f69c873c", EXPECT_IMAGE: "882477e1bbbe8cbe" };
  assert.deepEqual(batchRefusal(ok), { spent0: 4 });
  assert.match(batchRefusal({ ...ok, CANARY_BATCH_SPENT: "" }).why, /blank/);
  assert.match(batchRefusal({ ...ok, CANARY_BATCH_SPENT: undefined }).why, /not given/);
  assert.match(batchRefusal({ ...ok, CANARY_SLUG: "fretwork-1" }).why, /runs on fold-lane-bakery, and the site box says fretwork-1/);
  assert.match(batchRefusal({ ...ok, CANARY_SLUG: "" }).why, /\(blank\)/);
  assert.deepEqual(batchRefusal({ ...ok, CANARY_SLUG: " Fold-Lane-Bakery " }), { spent0: 4 });
  assert.match(batchRefusal({ ...ok, EXPECT_DEPLOY: "" }).why, /deploy sha and image boxes/);
  assert.match(batchRefusal({ ...ok, EXPECT_IMAGE: "  " }).why, /deploy sha and image boxes/);
  // A rehearsal names no version: nothing is sent.
  assert.deepEqual(batchRefusal({ ...ok, CANARY_SPEND: "0", EXPECT_DEPLOY: "", EXPECT_IMAGE: "" }), { spent0: 4 });
});

// ── THE REAL SCRIPT, END TO END, WITH A STAND-IN PRESS ────────────────────
//
// `scripts/edit-canary.mjs` itself is run, named `rq-batch`, with the press it
// runs swapped for a stand-in (`CANARY_BATCH_CHILD`) that writes the record a
// press writes, logs what it was handed, and exits as told. Nothing signs in:
// the hand-on is above the sign-in, so no secret or network is involved.

function stage() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "canary-batch-"));
  const child = path.join(dir, "press.mjs");
  fs.writeFileSync(child, `
import fs from "node:fs";
const plan = JSON.parse(process.env.STUB_PLAN || "{}");
const me = plan[process.env.CANARY_UI] || {};
const t = Date.now();
fs.mkdirSync(process.env.CANARY_EVIDENCE_DIR, { recursive: true });
await new Promise((r) => setTimeout(r, 20));
if (me.record !== false) fs.writeFileSync(process.env.CANARY_EVIDENCE_DIR + "/ui.json", JSON.stringify({ ui: { balance: { start: 100, end: 100 - (me.spent || 0) } } }));
fs.appendFileSync(process.env.STUB_LOG, JSON.stringify({ ui: process.env.CANARY_UI, evid: process.env.CANARY_EVIDENCE_DIR, box: Object.hasOwn(process.env, "CANARY_BATCH_SPENT"), childVar: Object.hasOwn(process.env, "CANARY_BATCH_CHILD"), slug: process.env.CANARY_SLUG, spend: process.env.CANARY_SPEND, t, end: Date.now() }) + "\\n");
console.log("PRESS " + process.env.CANARY_UI);
if (me.kill) process.kill(process.pid, "SIGKILL");
process.exit(me.code || 0);
`);
  return { dir, child, log: path.join(dir, "presses.jsonl"), evid: path.join(dir, "evidence") };
}

function runReal(env, st) {
  const base = { PATH: process.env.PATH, HOME: process.env.HOME };
  return spawnSync(process.execPath, [ROOT + "scripts/edit-canary.mjs"], {
    env: { ...base, CANARY_BATCH_CHILD: st.child, STUB_LOG: st.log, CANARY_EVIDENCE_DIR: st.evid, ...env },
    encoding: "utf8", timeout: 60_000,
  });
}
const pressesOf = (st) => (fs.existsSync(st.log) ? fs.readFileSync(st.log, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const PAID = { CANARY_UI: "rq-batch", CANARY_BATCH_SPENT: "4", CANARY_SLUG: "fold-lane-bakery", CANARY_SPEND: "1", EXPECT_DEPLOY: "f69c873c", EXPECT_IMAGE: "882477e1bbbe8cbe" };

test("the real canary script runs the five presses in order, one at a time, each with its own scenario and evidence, and without the batch's box", () => {
  const st = stage();
  const plan = { "rq-1-classes": { spent: 14 }, "rq-2-wholesale": { spent: 15 }, "rq-3-facebook": { spent: 6 }, "rq-4-logo": { spent: 3 }, "rq-5-away": { spent: 11 } };
  const r = runReal({ ...PAID, STUB_PLAN: JSON.stringify(plan) }, st);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const presses = pressesOf(st);
  assert.deepEqual(presses.map((p) => p.ui), NAMES);
  for (const p of presses) {
    assert.equal(p.evid, `${st.evid}/${p.ui}`);
    assert.equal(p.box, false, "a press was handed the batch's box");
    assert.equal(p.childVar, false, "a press was handed the stand-in's name");
    assert.equal(p.slug, "fold-lane-bakery");
    assert.equal(p.spend, "1");
  }
  for (let i = 1; i < presses.length; i++) assert.ok(presses[i].t >= presses[i - 1].end, "two presses overlapped");
  assert.match(r.stdout, /REQUEST BATCH — rq-1-classes, rq-2-wholesale, rq-3-facebook, rq-4-logo, rq-5-away, in that order, one at a time, on fold-lane-bakery; PAID; spent before 4/);
  assert.match(r.stdout, /PRESS rq-1-classes[\s\S]*PRESS rq-5-away/);
  assert.match(r.stdout, /5 of 5 pressed; spent before 4, in this press 49, the batch 53/);
  const batch = JSON.parse(fs.readFileSync(`${st.evid}/batch.json`, "utf8"));
  assert.equal(batch.spent, 53);
  assert.equal(batch.ok, true);
  assert.equal(batch.stopped, null);
  assert.deepEqual(batch.results.map((x) => [x.name, x.code, x.spent]), NAMES.map((n) => [n, 0, plan[n].spent]));
  assert.match(fs.readFileSync(`${st.evid}/batch.txt`, "utf8"), /BATCH ENDED: no press failed/);
  assert.equal(batch.name, BATCH_NAME);
  assert.doesNotMatch(r.stdout, /THE CONTINUATION FROM R2/, "the whole batch was told as the continuation");
});

test("the real script stops after a failed press and answers 1; before a press past 100 and answers 0", () => {
  const st = stage();
  const r = runReal({ ...PAID, STUB_PLAN: JSON.stringify({ "rq-1-classes": { spent: 10 }, "rq-2-wholesale": { spent: 9, code: 1 } }) }, st);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.deepEqual(pressesOf(st).map((p) => p.ui), ["rq-1-classes", "rq-2-wholesale"]);
  assert.match(r.stdout, /stopped after rq-2-wholesale: R2 rq-2-wholesale failed \(exit 1\)/);
  assert.match(r.stdout, /BATCH FAILED/);

  const st2 = stage();
  const r2 = runReal({ ...PAID, STUB_PLAN: JSON.stringify({ "rq-1-classes": { spent: 60 }, "rq-2-wholesale": { spent: 20 }, "rq-3-facebook": { spent: 10 } }) }, st2);
  assert.equal(r2.status, 0, r2.stdout + r2.stderr);
  assert.deepEqual(pressesOf(st2).map((p) => p.ui), ["rq-1-classes", "rq-2-wholesale", "rq-3-facebook"]);
  assert.match(r2.stdout, /STOPPING BEFORE R4 rq-4-logo: the batch has spent 94; R4 rq-4-logo's upper estimate of 7 would take it to 101, past 100/);
  assert.equal(JSON.parse(fs.readFileSync(`${st2.evid}/batch.json`, "utf8")).stopped.before, "rq-4-logo");

  const st3 = stage();
  const r3 = runReal({ ...PAID, STUB_PLAN: JSON.stringify({ "rq-1-classes": { record: false } }) }, st3);
  assert.equal(r3.status, 1, "a press with no record did not fail the batch");
  assert.deepEqual(pressesOf(st3).map((p) => p.ui), ["rq-1-classes"]);

  // A press killed by a signal (no exit code at all) is a failure, though its record says nothing was spent.
  const st4 = stage();
  const r4 = runReal({ ...PAID, STUB_PLAN: JSON.stringify({ "rq-1-classes": { spent: 0, kill: true } }) }, st4);
  assert.equal(r4.status, 1, "a press killed by a signal did not fail the batch");
  assert.deepEqual(pressesOf(st4).map((p) => p.ui), ["rq-1-classes"]);
  assert.match(r4.stdout, /R1 rq-1-classes: FAILED \(exit 1\)/);
});

test("the real script refuses the whole batch with 2 before any press, and refuses the batch's box beside any other run", () => {
  for (const [env, why] of [
    [{ ...PAID, CANARY_BATCH_SPENT: "" }, /REFUSING THE BATCH: the batch's spend so far is blank/],
    [{ ...PAID, CANARY_BATCH_SPENT: "four" }, /REFUSING THE BATCH: the batch's spend so far must be a whole number/],
    [{ ...PAID, CANARY_SLUG: "fretwork-1" }, /REFUSING THE BATCH: the batch runs on fold-lane-bakery/],
    [{ ...PAID, EXPECT_IMAGE: "" }, /REFUSING THE BATCH: a paid batch needs the deploy sha and image boxes/],
  ]) {
    const st = stage();
    const r = runReal(env, st);
    assert.equal(r.status, 2, r.stdout + r.stderr);
    assert.match(r.stderr, why);
    assert.match(r.stderr, /Nothing was signed in, pressed or charged\./);
    assert.deepEqual(pressesOf(st), [], "a press ran after the batch was refused");
  }
  // The box beside a single press refuses before the sign-in, with no secret given.
  const st = stage();
  const r = runReal({ CANARY_UI: "rq-canary", CANARY_BATCH_SPENT: "4", CANARY_SLUG: "fold-lane-bakery" }, st);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.match(r.stderr, /REFUSING: the batch's spend box is filled, but the scenario box does not name rq-batch/);
  assert.deepEqual(pressesOf(st), []);
});

// ── THE CONTINUATION FROM R2 (`rq-batch-r2`, 2026-10-04) ──────────────────
//
// The owner: *"prepare a minimal continuation option for rq-batch starting at
// R2 so we can run R2–R5 in one press after the focused check, preserving
// sequential execution, failure stops and the existing spending threshold
// without repeating R1 or rq-canary."* The same driver and the same presses;
// what is held here is that it starts at R2, never presses R1 or rq-canary,
// tells each press by its own number, stops exactly as the batch does, and
// counts its threshold from what the batch has really spent.

const R2_ON = NAMES.slice(1);

test("the continuation from R2 is R2 to R5 — the batch's own presses, numbers and upper estimates — and never R1 or rq-canary", () => {
  assert.equal(BATCH_FROM_R2_NAME, "rq-batch-r2");
  assert.deepEqual(BATCH_FROM_R2.map((p) => p.name), R2_ON);
  assert.deepEqual(BATCH_FROM_R2.map((p) => p.n), [2, 3, 4, 5]);
  for (const p of BATCH_FROM_R2) assert.ok(BATCH.includes(p), `${p.name} is a copy of the batch's press, which could drift from it`);
  assert.ok(!BATCH_FROM_R2.some((p) => p.name === "rq-1-classes" || p.name === "rq-canary"));
  assert.equal(batchOf(BATCH_NAME), BATCH);
  assert.equal(batchOf(BATCH_FROM_R2_NAME), BATCH_FROM_R2);
  for (const other of ["rq-canary", "rq-1-classes", "rq-batch-r3", "RQ-BATCH-R2", " rq-batch-r2", "", undefined, null, ["rq-batch-r2"]]) {
    assert.equal(batchOf(other), null, JSON.stringify(other) + " was read as a batch");
  }
  assert.equal(UI_SCENARIOS[BATCH_FROM_R2_NAME], undefined, "the continuation's name is a scenario, so a press could run it alone");
  // WHAT THE BATCH HAD SPENT BEFORE R2, AS RECORDED: rq-canary 4 (run 94) and R1 21 (run 95).
  assert.equal(BATCH_FROM_R2_SPENT_MIN, 4 + 21);
});

test("the continuation presses R2 to R5 in order, tells each by its own number, and adds their spend to what the batch had", async () => {
  const d = driven({ batch: BATCH_FROM_R2, spent0: 31, spends: { "rq-2-wholesale": 15, "rq-3-facebook": 6, "rq-4-logo": 3, "rq-5-away": 11 } });
  const out = await d.run();
  assert.deepEqual(d.calls, R2_ON);
  assert.equal(out.ok, true);
  assert.equal(out.stopped, null);
  assert.equal(out.spent, 31 + 15 + 6 + 3 + 11);
  assert.ok(d.logs.some((l) => /R2 rq-2-wholesale: spent so far 31, its upper estimate 25, 56 within 100/.test(l)), d.logs.join("\n"));
  assert.ok(d.logs.some((l) => /R5 rq-5-away: PASSED, spent 11; the batch has spent 66/.test(l)), d.logs.join("\n"));
  assert.ok(!d.logs.some((l) => /\bR1\b/.test(l)), "a press was told as R1");
  const told = describeBatch(out, { spent0: 31, batch: BATCH_FROM_R2 });
  assert.match(told, /4 of 4 pressed; spent before 31, in this press 35, the batch 66/);
  assert.match(told, /R2 rq-2-wholesale\s+PASSED/);
  assert.match(told, /R5 rq-5-away\s+PASSED/);
  assert.doesNotMatch(told, /rq-1-classes|\bR1\b/);
  // THE PLAN'S OWN CASE: 25 spent, the focused check at its upper estimate,
  // then R2–R5 at theirs — within 100, so every press is made.
  const check = UI_SCENARIOS["rq-menu-link"].budget - 1;
  const d2 = driven({ batch: BATCH_FROM_R2, spent0: 25 + check, spends: Object.fromEntries(BATCH_FROM_R2.map((p) => [p.name, p.upper])) });
  const o2 = await d2.run();
  assert.deepEqual(d2.calls, R2_ON);
  assert.equal(o2.spent, 25 + check + 25 + 12 + 7 + 17);
  assert.ok(o2.spent <= BATCH_THRESHOLD, `the plan's own case reaches ${o2.spent}`);
});

test("the continuation stops after a failed press, after a press whose spend cannot be read, and before a press past 100 — exactly as the batch does", async () => {
  const d = driven({ batch: BATCH_FROM_R2, spent0: 31, codes: { "rq-3-facebook": 1 } });
  const out = await d.run();
  assert.deepEqual(d.calls, ["rq-2-wholesale", "rq-3-facebook"]);
  assert.equal(out.ok, false);
  assert.equal(out.stopped.after, "rq-3-facebook");
  assert.match(out.stopped.why, /R3 rq-3-facebook failed \(exit 1\), so the rest were not pressed/);
  const told = describeBatch(out, { spent0: 31, batch: BATCH_FROM_R2 });
  assert.match(told, /R3 rq-3-facebook\s+FAILED \(exit 1\)/);
  assert.match(told, /-- rq-4-logo\s+not pressed/);
  assert.match(told, /-- rq-5-away\s+not pressed/);
  assert.match(told, /BATCH FAILED/);
  const d2 = driven({ batch: BATCH_FROM_R2, spent0: 31, records: { "rq-2-wholesale": null } });
  const o2 = await d2.run();
  assert.deepEqual(d2.calls, ["rq-2-wholesale"]);
  assert.equal(o2.ok, false);
  assert.match(o2.stopped.why, /R2 rq-2-wholesale's spend could not be read/);
  // AT THE UPPER ESTIMATES FROM 40: 65, 77, 84 — and R5's 17 would take it to 101.
  const d3 = driven({ batch: BATCH_FROM_R2, spent0: 40, spends: { "rq-2-wholesale": 25, "rq-3-facebook": 12, "rq-4-logo": 7 } });
  const o3 = await d3.run();
  assert.deepEqual(d3.calls, ["rq-2-wholesale", "rq-3-facebook", "rq-4-logo"]);
  assert.equal(o3.ok, true);
  assert.equal(o3.stopped.before, "rq-5-away");
  assert.match(o3.stopped.why, /the batch has spent 84; R5 rq-5-away's upper estimate of 17 would take it to 101, past 100/);
  // AND BEFORE R2 ITSELF, when even it does not fit.
  const d4 = driven({ batch: BATCH_FROM_R2, spent0: 76 });
  const o4 = await d4.run();
  assert.deepEqual(d4.calls, []);
  assert.equal(o4.stopped.before, "rq-2-wholesale");
  assert.match(o4.stopped.why, /R2 rq-2-wholesale's upper estimate of 25 would take it to 101/);
});

test("the continuation's box counts what rq-canary and R1 already spent: under 25 it is refused before any press, as a blank box, the wrong site or a paid press without its version are", () => {
  const ok = { CANARY_BATCH_SPENT: "31", CANARY_SLUG: "fold-lane-bakery", CANARY_SPEND: "1", EXPECT_DEPLOY: "f69c873c", EXPECT_IMAGE: "882477e1bbbe8cbe" };
  assert.deepEqual(batchRefusal(ok, BATCH_FROM_R2), { spent0: 31 });
  assert.deepEqual(batchRefusal({ ...ok, CANARY_BATCH_SPENT: "25" }, BATCH_FROM_R2), { spent0: 25 });
  for (const low of ["24", "4", "0"]) {
    assert.match(batchRefusal({ ...ok, CANARY_BATCH_SPENT: low }, BATCH_FROM_R2).why, /the continuation from R2 follows rq-canary and R1, which spent 25 between them, so the batch's spend so far is at least 25/);
  }
  // THE WHOLE BATCH KEEPS ITS OWN BOX: 4 is still its first press's spend so far.
  assert.deepEqual(batchRefusal({ ...ok, CANARY_BATCH_SPENT: "4" }), { spent0: 4 });
  assert.match(batchRefusal({ ...ok, CANARY_BATCH_SPENT: "" }, BATCH_FROM_R2).why, /blank/);
  assert.match(batchRefusal({ ...ok, CANARY_SLUG: "fretwork-1" }, BATCH_FROM_R2).why, /runs on fold-lane-bakery, and the site box says fretwork-1/);
  assert.match(batchRefusal({ ...ok, EXPECT_DEPLOY: "" }, BATCH_FROM_R2).why, /deploy sha and image boxes/);
  assert.deepEqual(batchRefusal({ ...ok, CANARY_SPEND: "0", EXPECT_DEPLOY: "", EXPECT_IMAGE: "" }, BATCH_FROM_R2), { spent0: 31 });
});

const PAID_R2 = { ...PAID, CANARY_UI: "rq-batch-r2", CANARY_BATCH_SPENT: "31" };

test("the real canary script, named rq-batch-r2, presses R2 to R5 in order, one at a time, each with its own scenario and evidence — never R1 or rq-canary — and stops and refuses as the batch does", () => {
  const st = stage();
  const plan = { "rq-2-wholesale": { spent: 15 }, "rq-3-facebook": { spent: 6 }, "rq-4-logo": { spent: 3 }, "rq-5-away": { spent: 11 } };
  const r = runReal({ ...PAID_R2, STUB_PLAN: JSON.stringify(plan) }, st);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const presses = pressesOf(st);
  assert.deepEqual(presses.map((p) => p.ui), R2_ON);
  for (const p of presses) {
    assert.equal(p.evid, `${st.evid}/${p.ui}`);
    assert.equal(p.box, false, "a press was handed the batch's box");
    assert.equal(p.childVar, false);
    assert.equal(p.slug, "fold-lane-bakery");
    assert.equal(p.spend, "1");
  }
  for (let i = 1; i < presses.length; i++) assert.ok(presses[i].t >= presses[i - 1].end, "two presses overlapped");
  assert.match(r.stdout, /REQUEST BATCH — rq-2-wholesale, rq-3-facebook, rq-4-logo, rq-5-away, in that order, one at a time, on fold-lane-bakery; PAID; spent before 31, threshold 100 between presses/);
  assert.match(r.stdout, /THE CONTINUATION FROM R2: rq-1-classes and rq-canary are done, and neither is pressed again/);
  assert.match(r.stdout, /4 of 4 pressed; spent before 31, in this press 35, the batch 66/);
  assert.doesNotMatch(r.stdout, /PRESS rq-1-classes|PRESS rq-canary/);
  const batch = JSON.parse(fs.readFileSync(`${st.evid}/batch.json`, "utf8"));
  assert.equal(batch.name, BATCH_FROM_R2_NAME);
  assert.deepEqual(batch.batch.map((p) => [p.n, p.name]), [[2, "rq-2-wholesale"], [3, "rq-3-facebook"], [4, "rq-4-logo"], [5, "rq-5-away"]]);
  assert.equal(batch.threshold, 100);
  assert.equal(batch.spent, 66);
  assert.equal(batch.ok, true);
  // A FAILED PRESS STOPS IT: nothing after it is pressed, and it answers 1.
  const st2 = stage();
  const r2 = runReal({ ...PAID_R2, STUB_PLAN: JSON.stringify({ "rq-2-wholesale": { spent: 10, code: 1 } }) }, st2);
  assert.equal(r2.status, 1, r2.stdout + r2.stderr);
  assert.deepEqual(pressesOf(st2).map((p) => p.ui), ["rq-2-wholesale"]);
  assert.match(r2.stdout, /stopped after rq-2-wholesale: R2 rq-2-wholesale failed \(exit 1\)/);
  // BEFORE A PRESS PAST 100, and it answers 0.
  const st3 = stage();
  const r3 = runReal({ ...PAID_R2, CANARY_BATCH_SPENT: "40", STUB_PLAN: JSON.stringify({ "rq-2-wholesale": { spent: 25 }, "rq-3-facebook": { spent: 12 }, "rq-4-logo": { spent: 7 } }) }, st3);
  assert.equal(r3.status, 0, r3.stdout + r3.stderr);
  assert.deepEqual(pressesOf(st3).map((p) => p.ui), ["rq-2-wholesale", "rq-3-facebook", "rq-4-logo"]);
  assert.match(r3.stdout, /STOPPING BEFORE R5 rq-5-away: the batch has spent 84; R5 rq-5-away's upper estimate of 17 would take it to 101, past 100/);
  // A BOX UNDER WHAT THE BATCH HAS SPENT: refused with 2 before any press, nothing signed in.
  const st4 = stage();
  const r4 = runReal({ ...PAID_R2, CANARY_BATCH_SPENT: "4" }, st4);
  assert.equal(r4.status, 2, r4.stdout + r4.stderr);
  assert.match(r4.stderr, /REFUSING THE BATCH: the continuation from R2 follows rq-canary and R1, which spent 25 between them/);
  assert.match(r4.stderr, /Nothing was signed in, pressed or charged\./);
  assert.deepEqual(pressesOf(st4), []);
  // AND THE BOX BESIDE A SINGLE PRESS STILL REFUSES, naming both batches.
  const st5 = stage();
  const r5 = runReal({ CANARY_UI: "rq-2-wholesale", CANARY_BATCH_SPENT: "31", CANARY_SLUG: "fold-lane-bakery" }, st5);
  assert.equal(r5.status, 2, r5.stdout + r5.stderr);
  assert.match(r5.stderr, /REFUSING: the batch's spend box is filled, but the scenario box does not name rq-batch or rq-batch-r2/);
  assert.deepEqual(pressesOf(st5), []);
});
