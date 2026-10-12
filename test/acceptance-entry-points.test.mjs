// EVERY ACCEPTANCE ENTRY POINT, RUN AS IT IS PRESSED, WITH EVERY NETWORK CALL
// STUBBED (2026-10-11, round 4). Codex on 23861838: the routing-only
// `acceptance-split-1` branch of `scripts/edit-canary.mjs` checked only a
// minimum balance and routed at 971, and the image-free Build's "free"
// rehearsal at 971 refused before it read the runtime, so it reported no
// flags. Here the REAL scripts run in a child process under an in-process
// stub (`fixtures/canary-stub.mjs`, `fixtures/build-check-stub.mjs`) and the
// wire log says which calls were made.
//
// NO SEPARATE TEST BUDGET EXISTS. The acceptance cap (100) is a refusal, not
// a budget: at today's balance every paid acceptance press refuses, so paid
// acceptance stays blocked. Nothing here, or in the records, asks for the
// account's balance to be lowered to get past it.
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { acceptancePreflight, ACCEPTANCE_CAP } from "../scripts/canary-ui.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BATCH = "acceptance-split-1";
const PROBES = JSON.parse(readFileSync(path.join(REPO, "scripts/router-probes", BATCH + ".json"), "utf8")).probes;
const ROUTED = { ok: true, intent: "edit", layer: "text", alsoAsked: "none", cost: 2, decision: { source: "model", reasons: [], raw: { intent: "edit", layer: "text" } } };

function run(args, env, cwd = REPO) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, args, { cwd, env });
    let out = "", err = "";
    const kill = setTimeout(() => p.kill("SIGKILL"), 90_000);
    p.stdout.on("data", (c) => { out += c; });
    p.stderr.on("data", (c) => { err += c; });
    p.on("close", (code) => { clearTimeout(kill); resolve({ code, out, err }); });
  });
}
const wireOf = (f) => readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));

async function probePress(name, { balance, spend = "1" }) {
  const dir = mkdtempSync(path.join(tmpdir(), "acc-probe-" + name + "-"));
  const log = path.join(dir, "wire.jsonl");
  writeFileSync(log, "");
  const env = {
    PATH: process.env.PATH, HOME: process.env.HOME,
    OWNER_EMAIL: "owner@example.com", SUPABASE_SERVICE_KEY: "stub-key", SUPABASE_URL: "https://stub.supabase.test",
    OWNER_BASE_URL: "https://stub.worker.test", CANARY_SLUG: "stub-site", CONTROL_SLUG: "",
    CANARY_SPEND: spend, EXPECT_DEPLOY: spend === "1" ? "0123456" : "", EXPECT_IMAGE: spend === "1" ? "0123456789abcdef" : "",
    CANARY_PROBES: BATCH, CANARY_EVIDENCE_DIR: path.join(dir, "evidence"), STUB_LOG: log, STUB_BALANCE: String(balance),
    STUB_ROUTES: JSON.stringify(PROBES.map(() => ROUTED)), STUB_ROUTE: JSON.stringify(ROUTED),
  };
  const r = await run(["--import", path.join(REPO, "test/fixtures/canary-stub.mjs"), "scripts/edit-canary.mjs"], env);
  const wire = wireOf(log);
  const ev = path.join(dir, "evidence", "routing-probes.json");
  return { ...r, wire, routed: wire.filter((w) => w.path === "/api/site/route").length, unanswered: wire.filter((w) => w.status === 599).length, evidence: existsSync(ev) ? JSON.parse(readFileSync(ev, "utf8")) : null };
}

async function buildPress(name, { balance, spend, runtime, runtimeStatus = 200 }) {
  const dir = mkdtempSync(path.join(tmpdir(), "acc-build-" + name + "-"));
  const log = path.join(dir, "wire.jsonl");
  writeFileSync(log, "");
  const env = {
    PATH: process.env.PATH, HOME: process.env.HOME,
    OWNER_EMAIL: "owner@example.com", SUPABASE_SERVICE_KEY: "stub-key", SUPABASE_ANON_KEY: "stub-anon", SUPABASE_URL: "https://stub.supabase.test",
    OWNER_BASE_URL: "https://stub.worker.test", OWNER_MODE: "check-no-images", OWNER_SPEND: spend,
    STUB_LOG: log, STUB_BALANCE: String(balance), STUB_RUNTIME: JSON.stringify(runtime), STUB_RUNTIME_STATUS: String(runtimeStatus),
  };
  const entry = `import(${JSON.stringify(path.join(REPO, "scripts/build-check.mjs"))}).then(async (m) => process.exit(await m.main()))`;
  const r = await run(["--import", path.join(REPO, "test/fixtures/build-check-stub.mjs"), "-e", entry], env, dir);
  const wire = wireOf(log);
  const recFile = path.join(dir, "build-check.json");
  return { ...r, wire, posted: wire.filter((w) => w.via === "https").length, runtimeRead: wire.some((w) => w.url.includes("/api/site/runtime")), unanswered: wire.filter((w) => w.status === 599).length, rec: existsSync(recFile) ? JSON.parse(readFileSync(recFile, "utf8")) : null };
}

const FLAGS_ON = { imagePurchases: false, design: false, graph: false, bandsEveryone: true, bands: true };

// ── THE SHARED PREFLIGHT ─────────────────────────────────────────────────────

test("acceptancePreflight: every item reported — read, enough for the estimate, within the cap; above the cap or unread is unmet, never a pass", () => {
  assert.equal(ACCEPTANCE_CAP, 100);
  const at = (balance, need) => acceptancePreflight({ balance, need }).filter((x) => !x.ok).map((x) => x.name);
  assert.deepEqual(at(971, 18), ["the balance is within the acceptance cap of 100"]);
  assert.deepEqual(at(96, 18), []);
  assert.deepEqual(at(100, 18), []);
  assert.deepEqual(at(10, 18), ["the balance covers the estimate of 18"]);
  assert.deepEqual(at(-1, 18), ["the balance was read", "the balance covers the estimate of 18", "the balance is within the acceptance cap of 100"]);
  assert.deepEqual(at(NaN, 18).length, 3);
});

// ── THE ROUTING-ONLY ACCEPTANCE BATCH, THROUGH THE REAL SCRIPT ───────────────

test("ROUTING PROBE, PAID, AT 971 (Codex's reproduction): the real canary refuses before any routing call, says paid acceptance is blocked with no test budget, and saves the unmet item — no route, nothing the stub could not answer", async () => {
  const r = await probePress("paid-971", { balance: 971 });
  assert.equal(r.code, 1, r.err + r.out.slice(-1500));
  assert.equal(r.routed, 0, "a message was routed at 971");
  assert.equal(r.unanswered, 0);
  assert.match(r.err, /REFUSING TO ROUTE: .*above this press's hard cap of 100.*Paid acceptance is blocked: no separate test budget exists/);
  assert.match(r.out, /UNMET {2}the balance is within the acceptance cap of 100/);
  assert.equal(r.evidence.acceptance, true);
  assert.equal(r.evidence.unmet.length, 1);
  assert.ok(!/lower|reset|set the balance/i.test(r.out + r.err), "the press tells the owner to change their balance");
});

test("ROUTING PROBE, REHEARSAL, AT 971: routes nothing, exits 0, and reports what a paid press would refuse on", async () => {
  const r = await probePress("rehearsal-971", { balance: 971, spend: "0" });
  assert.equal(r.code, 0, r.err);
  assert.equal(r.routed, 0);
  assert.match(r.out, /REHEARSAL — .*A paid press would refuse: .*hard cap of 100/);
  assert.equal(r.evidence.rehearsal, true);
  assert.equal(r.evidence.unmet.length, 1);
});

test("ROUTING PROBE, CONTROLS: within the cap it routes each message once and nothing else; below the estimate it refuses before routing", async () => {
  const ok = await probePress("paid-96", { balance: 96 });
  assert.equal(ok.code, 0, ok.err + ok.out.slice(-1500));
  assert.equal(ok.routed, PROBES.length);
  const low = await probePress("paid-10", { balance: 10 });
  assert.equal(low.code, 1);
  assert.equal(low.routed, 0);
  assert.match(low.err, /does not cover the estimate/);
});

// ── THE IMAGE-FREE BUILD, THROUGH THE REAL SCRIPT ───────────────────────────

test("BUILD, REHEARSAL, AT 971 (Codex's reproduction): the real script reads the runtime, reports the image switch and the account's flags, lists the unmet cap, and never posts the build", async () => {
  const r = await buildPress("rehearsal-971", { balance: 971, spend: "no", runtime: FLAGS_ON });
  assert.equal(r.code, 0, r.out + r.err);
  assert.ok(r.runtimeRead, "the runtime was not read at 971");
  assert.equal(r.posted, 0, "the build was posted");
  assert.equal(r.unanswered, 0, JSON.stringify(r.wire.filter((w) => w.status === 599)));
  assert.deepEqual(r.rec.imagesOff, { status: 200, imagePurchases: false });
  assert.deepEqual(r.rec.flags.read, { design: false, graph: false, bandsEveryone: true, bands: true });
  assert.deepEqual(r.rec.unmet, ["the balance is within the hard cap of 100"]);
  assert.match(r.out, /UNMET {2}the balance is within the hard cap of 100/);
  assert.match(r.out, /MET {4}an image-free parallel mode is already on for this account/);
});

test("BUILD, REHEARSAL, AT 971, NOTHING READY: every unmet prerequisite listed — the cap, photographs still bought, no parallel mode", async () => {
  const r = await buildPress("rehearsal-none", { balance: 971, spend: "no", runtime: { imagePurchases: true, design: false, graph: false, bandsEveryone: false, bands: false } });
  assert.equal(r.posted, 0);
  assert.deepEqual(r.rec.unmet, ["the balance is within the hard cap of 100", "the live Worker buys no photograph", "an image-free parallel mode is already on for this account"]);
});

test("BUILD, PAID, AT 971: the strict check refuses before the one paid call; CONTROL — within the cap with every prerequisite met, the paid press does post", async () => {
  const r = await buildPress("paid-971", { balance: 971, spend: "yes", runtime: FLAGS_ON });
  assert.equal(r.posted, 0, "the build was posted at 971");
  assert.match(r.out, /hard cap of 100 — nothing is sent/);
  const ok = await buildPress("paid-50", { balance: 50, spend: "yes", runtime: FLAGS_ON });
  assert.equal(ok.posted, 1, "the control never reached the paid call: " + ok.out.slice(-800));
});

// ── THE REQUEST PRESS ───────────────────────────────────────────────────────

test("REQUEST PRESSES use the same cap: every acceptance scenario carries ACCEPTANCE_CAP, and the real driver's refusal at 971 sends nothing (test/canary-acceptance.test.mjs, THE PRESS REFUSES ABOVE THE CAP)", async () => {
  const { UI_SCENARIOS } = await import("../scripts/canary-ui.mjs");
  for (const k of ["acc-pages-real", "acc-page-table", "acc-table-page", "acc-needs", "acc-mixed", "acc-addon-inner", "acc-addon-edit", "acc-addon-pair", "acc-addon-kinds"]) assert.equal(UI_SCENARIOS[k].cap, ACCEPTANCE_CAP, k);
  const src = readFileSync(path.join(REPO, "test/canary-acceptance.test.mjs"), "utf8");
  assert.ok(src.includes('test("THE PRESS REFUSES ABOVE THE CAP: a balance of 971 sends nothing; 100 sends"'), "the driver-level refusal case is gone");
});

test("NO INSTRUCTION TO LOWER OR RESET THE ACCOUNT BALANCE: the workflows and the acceptance scripts say paid acceptance is blocked with no test budget, and none tells the owner to set their balance; the committed probe batch is an acceptance batch", () => {
  const files = [".github/workflows/edit-canary.yml", ".github/workflows/build-as-owner.yml", "scripts/canary-ui.mjs", "scripts/canary-build.mjs", "scripts/edit-canary.mjs", "scripts/canary-probes.mjs"];
  const said = files.map((f) => readFileSync(path.join(REPO, f), "utf8")).join("\n");
  assert.ok(said.length > 1000, "the files were not read");
  for (const re of [/set(?:s|ting)? (?:the|your|its) (?:building account(?:'s)? )?balance to/i, /balance to exactly/i, /the cap the owner sets/i, /lower(?:ing)? (?:the|your) balance to/i]) assert.doesNotMatch(said, re);
  const ec = readFileSync(path.join(REPO, ".github/workflows/edit-canary.yml"), "utf8");
  assert.match(ec, /PAID ACCEPTANCE IS BLOCKED: no separate test budget exists/);
  assert.match(readFileSync(path.join(REPO, ".github/workflows/build-as-owner.yml"), "utf8"), /Paid acceptance is blocked: no separate test budget exists/);
  assert.equal(JSON.parse(readFileSync(path.join(REPO, "scripts/router-probes", BATCH + ".json"), "utf8")).acceptance, true);
});

test("readProbeBatch: an acceptance batch says `acceptance: true`, or leaves it out; any other value refuses the batch", async () => {
  const { readProbeBatch } = await import("../scripts/canary-probes.mjs");
  const text = readFileSync(path.join(REPO, "scripts/router-probes", BATCH + ".json"), "utf8");
  assert.equal(readProbeBatch(text, BATCH).batch.acceptance, true);
  const j = JSON.parse(text);
  for (const bad of [false, "true", 1, null]) assert.match(readProbeBatch(JSON.stringify({ ...j, acceptance: bad }), BATCH).msg || "", /acceptance is true, or left out/, JSON.stringify(bad));
  const { acceptance, ...plain } = j; void acceptance;
  assert.equal(readProbeBatch(JSON.stringify(plain), BATCH).batch.acceptance, false);
});

test("THE CURRENT INSTRUCTIONS ARE KEPT APART FROM THE HISTORY: docs/acceptance-current.md names the current predicted image and no superseded one, says paid acceptance is blocked, and asks for no balance change; the history's instruction sections are marked historical and point to it", () => {
  const cur = readFileSync(path.join(REPO, "docs/acceptance-current.md"), "utf8");
  // THE CURRENT PREDICTION (2026-10-12, on round 15's code 754c4eb4).
  assert.match(cur, /1e30b6fb56b51794/);
  for (const old of ["62b0dae10edebdf5", "9547695841a6c5ac", "f9c4097ed179c5f8", "d8f11fccd7446ba8", "15fd0e0ba5555f38", "eb7e55f950c105cc", "12c7c953c370f188", "47981cf0b832bfad", "9d5c417c92c65f99", "4b8665dd0256e3f9", "494735051df65e57", "43652f925edb50f7", "c84110ecba368cb9", "2b5ff083fe725602", "d9800cfea19e7cee", "31811cf56e30d18c", "b4fd90bc5733635b"]) assert.ok(!cur.includes(old), `the current instructions still name ${old}`);
  assert.match(cur, /Paid acceptance is blocked/);
  assert.match(cur, /Not an option\*\*: lowering or resetting the account's balance/);
  assert.match(cur, /Real images are unverified/);
  const hist = readFileSync(path.join(REPO, "docs/history/2026-10-11-acceptance-batch.md"), "utf8");
  assert.match(hist, /THIS FILE IS HISTORY, NOT INSTRUCTIONS/);
  for (const h of ["## 3. The batch, in order (round 3) — HISTORICAL", "## 4. What must happen first (the owner's) — HISTORICAL", "## 5. The presses (each the owner's, in order) — HISTORICAL"]) assert.ok(hist.includes(h), `not marked: ${h}`);
});
