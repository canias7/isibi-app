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
  describeBatch, batchRefusal,
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

test("the workflow gives the batch alone a longer limit that covers its worst case, and every other run keeps 45", () => {
  const m = /timeout-minutes:\s*\$\{\{\s*github\.event\.inputs\.ui_scenario == '([^']+)' && (\d+) \|\| (\d+)\s*\}\}/.exec(FLOW);
  assert.ok(m, "the workflow's limit is not the batch's expression");
  assert.equal(m[1], BATCH_NAME);
  const batchMin = Number(m[2]), otherMin = Number(m[3]);
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
  assert.match(box, /description: 'REQUEST BATCH ONLY \(rq-batch\):[^']*100[^']*'/);
  assert.match(box, /required: false\n {8}default: ''/);
  assert.match(FLOW, /CANARY_BATCH_SPENT:\s*\$\{\{\s*github\.event\.inputs\.batch_spent\s*\}\}/);
  // The box never arms spending.
  assert.doesNotMatch(FLOW.match(/CANARY_SPEND:.*/)[0], /batch_spent/);
  // The scenario box names the mode.
  const sAt = FLOW.indexOf("\n      ui_scenario:\n");
  const sBox = FLOW.slice(sAt, FLOW.indexOf("\n      batch_spent:\n", sAt));
  assert.match((sBox.match(/description: '([^']*)'/) || [])[1] || "", /rq-batch \(rq-1-classes to rq-5-away in order in this one run/);
  // One canary step, as before: the script hands the mode on itself.
  assert.equal(FLOW.split("run: node scripts/edit-canary.mjs").length - 1, 1);
  assert.doesNotMatch(FLOW, /canary-batch\.mjs\s*$/m, "the workflow runs the batch module directly");
});

test("the canary hands the mode on before anything is signed in, and refuses the batch's box beside any other run", () => {
  const ui = CANARY.indexOf('const UI = String(process.env.CANARY_UI || "").trim();');
  const hand = CANARY.indexOf("if (UI === BATCH_NAME) process.exit(await runBatchMain(process.env));");
  const box = CANARY.indexOf('if (String(process.env.CANARY_BATCH_SPENT || "").trim()) {');
  const need = CANARY.indexOf("if (!EMAIL || !SERVICE_KEY || (!CANARY && !READ_JOB)) {");
  const signIn = CANARY.indexOf("/auth/v1/admin/generate_link");
  for (const [n, i] of Object.entries({ ui, hand, box, need, signIn })) assert.ok(i > 0, `${n} not found`);
  assert.ok(ui < hand && hand < box && box < need && need < signIn, "the hand-on or the box's refusal is not above the sign-in");
  assert.match(CANARY, /import \{ BATCH_NAME, runBatchMain \} from "\.\/canary-batch\.mjs";/);
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

function driven({ codes = {}, spends = {}, records = {}, spent0 = 4, spend = true } = {}) {
  const calls = [];
  const logs = [];
  let bal = 133;
  return {
    calls, logs,
    run: () => runBatch({
      spent0, spend,
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
