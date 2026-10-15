// ─────────────────────────────────────────────────────────────────────────────
// THE OWNER'S OPT-IN ABOVE THE ACCEPTANCE CAP (2026-10-12)
//
// The owner, choosing the acceptance plan's §5 option A: *"go with A"* — the
// account's balance accepted as the bound for exactly P1 (the routing probe
// acceptance-split-1) and P2 (acc-page-table, or acc-table-page). One box,
// naming the balance, replaces the 100-credit cap for those presses only, and
// only while the balance read before the paid call is exactly that number.
// These cases drive the box's reading (`readBalanceOptIn`), its check
// (`optInRefusal`), the shared preflight (`acceptancePreflight`), the real
// `scripts/edit-canary.mjs` under the in-process network stub, and the
// workflow's box. The driver-level press is in test/canary-acceptance.test.mjs
// (THE OWNER'S OPT-IN).
// ─────────────────────────────────────────────────────────────────────────────
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readBalanceOptIn, optInRefusal, acceptancePreflight, BALANCE_OPT_IN, ACCEPTANCE_CAP, UI_SCENARIOS } from "../scripts/canary-ui.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BATCH = "acceptance-split-2";
const PROBES = JSON.parse(readFileSync(path.join(REPO, "scripts/router-probes", BATCH + ".json"), "utf8")).probes;
const ROUTED = { ok: true, intent: "edit", layer: "text", alsoAsked: "none", cost: 2, decision: { source: "model", reasons: [], raw: { intent: "edit", layer: "text" } } };

function run(env) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, ["--import", path.join(REPO, "test/fixtures/canary-stub.mjs"), "scripts/edit-canary.mjs"], { cwd: REPO, env });
    let out = "", err = "";
    const kill = setTimeout(() => p.kill("SIGKILL"), 90_000);
    p.stdout.on("data", (c) => { out += c; });
    p.stderr.on("data", (c) => { err += c; });
    p.on("close", (code) => { clearTimeout(kill); resolve({ code, out, err }); });
  });
}

async function press(name, { balance = 971, spend = "1", optIn = "", probes = BATCH, ui = "", slug = "stub-site" } = {}) {
  const dir = mkdtempSync(path.join(tmpdir(), "acc-optin-" + name + "-"));
  const log = path.join(dir, "wire.jsonl");
  writeFileSync(log, "");
  const env = {
    PATH: process.env.PATH, HOME: process.env.HOME,
    OWNER_EMAIL: "owner@example.com", SUPABASE_SERVICE_KEY: "stub-key", SUPABASE_URL: "https://stub.supabase.test",
    OWNER_BASE_URL: "https://stub.worker.test", CANARY_SLUG: slug, CONTROL_SLUG: "",
    CANARY_SPEND: spend, EXPECT_DEPLOY: spend === "1" ? "0123456" : "", EXPECT_IMAGE: spend === "1" ? "0123456789abcdef" : "",
    CANARY_PROBES: probes, CANARY_UI: ui, CANARY_ACCEPT_BALANCE: optIn,
    CANARY_EVIDENCE_DIR: path.join(dir, "evidence"), STUB_LOG: log, STUB_BALANCE: String(balance),
    STUB_ROUTES: JSON.stringify(PROBES.map(() => ROUTED)), STUB_ROUTE: JSON.stringify(ROUTED),
  };
  const r = await run(env);
  const wire = readFileSync(log, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const ev = path.join(dir, "evidence", "routing-probes.json");
  return { ...r, wire, routed: wire.filter((w) => w.path === "/api/site/route").length, unanswered: wire.filter((w) => w.status === 599).length, evidence: existsSync(ev) ? JSON.parse(readFileSync(ev, "utf8")) : null };
}

// ── THE BOX, READ ────────────────────────────────────────────────────────────

test("OPT-IN 1 — OPEN FOR ONE RUN (2026-10-15, the owner approved the verification batch: 'do Step 0 through Press 2 as written'): it admits acc-mixed-2 alone; blank changes nothing; a malformed number still says so; every other press refuses", () => {
  assert.deepEqual([...BALANCE_OPT_IN], ["acc-mixed-2"]);
  assert.ok(Object.isFrozen(BALANCE_OPT_IN));
  for (const blank of [undefined, null, "", "   "]) assert.deepEqual(readBalanceOptIn(blank, { probes: BATCH }), { ok: true, value: null, press: "" });
  // NOT A WHOLE NUMBER OF CREDITS.
  for (const bad of ["0", "-1", "971.5", "9 71", "abc", "1e3", "0971", "+971", "12345678", "971 credits"]) {
    const r = readBalanceOptIn(bad, { ui: "acc-mixed-2" });
    assert.equal(r.ok, false, bad);
    assert.match(r.msg, /whole credits/, bad);
  }
  // THE ONE PRESS IT ADMITS.
  const ok = readBalanceOptIn("773", { ui: "acc-mixed-2" });
  assert.equal(ok.ok, true);
  assert.equal(ok.value, 773);
  // EVERY OTHER PRESS, acc-mixed (the same message without talk) first.
  for (const other of [{ ui: "acc-mixed" }, { ui: "acc-clarify-resume" }, { ui: "acc-addon-k3b" }, { ui: "acc-isolation-page" }, { ui: "acc-isolation" }, { probes: "addon-kinds-3" }, { probes: "acceptance-split-1" }, { probes: "acceptance-split-2" }, { ui: "acc-addon-edit" }, { ui: "acc-page-table" }, { ui: "lv-parallel" }, { ui: "rq-batch" }, { probes: "router-audit-1" }, {}, { probes: BATCH, ui: "acc-mixed-2" }]) {
    const r = readBalanceOptIn("971", other);
    assert.equal(r.ok, false, JSON.stringify(other));
    assert.match(r.msg, /only for acc-mixed-2/, JSON.stringify(other));
  }
  // A NON-STRING IS NEVER COERCED INTO A NUMBER.
  assert.equal(readBalanceOptIn(971, { ui: "acc-mixed-2" }).value, null);
  assert.equal(readBalanceOptIn(["971"], { ui: "acc-mixed-2" }).value, null);
});

test("OPT-IN 2 — the check: exactly the balance named passes; any other balance, an unreadable one, or a named value that is not a whole number refuses", () => {
  assert.equal(optInRefusal({ now: 971, named: 971 }), "");
  assert.match(optInRefusal({ now: 972, named: 971 }), /balance \(972\) is not the 971 credits this press was allowed to run against/);
  assert.match(optInRefusal({ now: 970, named: 971 }), /balance \(970\) is not the 971/);
  for (const now of [NaN, -1, undefined, null]) assert.match(optInRefusal({ now, named: 971 }), /could not be read/, String(now));
  for (const named of [0, -5, 9.5, "971", null, NaN]) assert.match(optInRefusal({ now: 971, named }), /not a whole number/, String(named));
});

test("OPT-IN 3 — the shared preflight: with the box, the cap's item becomes the named balance; the read and the estimate items stand; without it, nothing changes", () => {
  const unmet = (o) => acceptancePreflight(o).filter((x) => !x.ok).map((x) => x.name);
  assert.deepEqual(unmet({ balance: 971, need: 27, optIn: 971 }), []);
  assert.deepEqual(unmet({ balance: 971, need: 27, optIn: 970 }), ["the balance is the 970 you allowed this press to run against (in place of the cap of 100)"]);
  assert.deepEqual(unmet({ balance: 20, need: 27, optIn: 20 }), ["the balance covers the estimate of 27"]);
  assert.deepEqual(unmet({ balance: -1, need: 27, optIn: 971 }).length, 3);
  // THE CAP STANDS WITHOUT IT, as before.
  assert.equal(ACCEPTANCE_CAP, 100);
  assert.deepEqual(unmet({ balance: 971, need: 27 }), ["the balance is within the acceptance cap of 100"]);
  assert.deepEqual(unmet({ balance: 971, need: 27, optIn: null }), ["the balance is within the acceptance cap of 100"]);
});

test("OPT-IN 4 — every scenario the box admits is an image-free acceptance press bound by ACCEPTANCE_CAP, so the box replaces that cap and no other", () => {
  for (const k of BALANCE_OPT_IN) {
    assert.ok(Object.hasOwn(UI_SCENARIOS, k), k);
    assert.equal(UI_SCENARIOS[k].cap, ACCEPTANCE_CAP, k);
    assert.equal(UI_SCENARIOS[k].images, "none", k);
  }
  const ui = readFileSync(path.join(REPO, "scripts/canary-ui.mjs"), "utf8");
  const a = ui.indexOf("const optedIn = balanceOptIn !== null && scenario.cap === ACCEPTANCE_CAP;");
  const b = ui.indexOf("const capped = n === 1 ? (optedIn ? optInRefusal({ now: bal, named: balanceOptIn }) : capRefusal({ now: bal, cap: scenario.cap })) : \"\";");
  assert.ok(a > 0 && b > a, "the driver's cap does not take the opt-in, or takes it for any cap");
  // THE PRESS HANDS THE DRIVER THE BOX IT READ, and reads it before the sign-in.
  const ec = readFileSync(path.join(REPO, "scripts/edit-canary.mjs"), "utf8");
  const call = ec.indexOf("const ui = await runUi({");
  assert.ok(call > 0, "the driver call is gone");
  assert.ok(ec.slice(call, ec.indexOf("\n", call)).includes("balanceOptIn: OPT_IN.value,"), "the press does not hand the driver the box");
  const read = ec.indexOf("const OPT_IN = readBalanceOptIn(process.env.CANARY_ACCEPT_BALANCE");
  const signIn = ec.indexOf("await signIn(");
  assert.ok(read > 0 && signIn > 0 && read < signIn, "the box is not read before the sign-in");
});

// ── THE REAL SCRIPT, UNDER THE STUB ─────────────────────────────────────────

test("OPT-IN 5, END TO END — the closed batch's probe (K0, acceptance-split-2) with the box refuses with exit 2 before the sign-in (the box admits acc-mixed-2 alone), and without the box still refuses at the cap before any route", async () => {
  const closed = await press("closed-batch-named", { optIn: "971" });
  assert.equal(closed.code, 2, closed.err + closed.out.slice(-800));
  assert.match(closed.err, /only for acc-mixed-2/);
  assert.equal(closed.wire.length, 0, JSON.stringify(closed.wire));
  const blocked = await press("paid-971-blank");
  assert.equal(blocked.code, 1);
  assert.equal(blocked.routed, 0);
  assert.match(blocked.err, /hard cap of 100/);
});

test("OPT-IN 7, END TO END — the box malformed, beside acc-isolation (closed with run 141), beside another scenario, or beside the request batch refuses with exit 2 before the sign-in: not one network call", async () => {
  for (const [name, o, re] of [
    ["malformed", { optIn: "971.0" }, /whole credits/],
    ["acc-isolation", { probes: "", ui: "acc-isolation", slug: "fold-lane-bakery", optIn: "971" }, /only for acc-mixed-2/],
    ["other-scenario", { probes: "", ui: "acc-addon-inner", slug: "fold-lane-bakery", optIn: "971" }, /only for acc-mixed-2/],
    ["request-batch", { probes: "", ui: "rq-batch", slug: "fold-lane-bakery", optIn: "971" }, /acceptance balance box is only for acc-mixed-2, not the request batch/],
  ]) {
    const r = await press(name, o);
    assert.equal(r.code, 2, `${name}: ${r.err}${r.out.slice(-600)}`);
    assert.match(r.err, re, name);
    assert.match(r.err, /Nothing was signed in or charged/, name);
    assert.equal(r.wire.length, 0, `${name}: ${JSON.stringify(r.wire)}`);
  }
});

// ── THE FORM ─────────────────────────────────────────────────────────────────

test("OPT-IN 8 — the workflow carries the box to the script and says it is closed", () => {
  const wf = readFileSync(path.join(REPO, ".github/workflows/edit-canary.yml"), "utf8");
  assert.match(wf, /\n {6}accept_balance:\n {8}description: 'CLOSED: no press may run above the 100-credit cap\. Leave blank; anything typed here refuses before the sign-in\.'\n {8}required: false\n {8}default: ''\n/);
  assert.match(wf, /\n {10}CANARY_ACCEPT_BALANCE: \$\{\{ github\.event\.inputs\.accept_balance \}\}\n/);
  const inputs = wf.slice(wf.indexOf("workflow_dispatch:"), wf.indexOf("\njobs:")).match(/^ {6}[a-z_]+:$/gm);
  assert.ok(inputs && inputs.length <= 25, `GitHub takes at most 25 dispatch inputs; the form has ${inputs && inputs.length}`);
});
