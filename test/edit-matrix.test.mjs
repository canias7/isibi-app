// The two halves of the matrix that are not unit-testable anywhere else:
// what the committed database check covers, and what the probe may touch.
//
// ── WHY THE DATABASE HALF IS A SQL FILE AND NOT A TEST ────────────────────
//
// `on conflict do nothing`, a conditional UPDATE and a row lock all look
// correct at rest and only differ under a second caller — so the only honest
// way to assert them is to DRIVE the real functions against the real database,
// in sequence, reading the balance between every step. That is
// `scripts/edit-rpc-check.sql`, which ends with `raise exception` so the whole
// thing rolls back and is safe to run against production.
//
// It cannot run under `node --test` (there is no Postgres here and no mint
// key), so what this file guards is that it has not silently LOST a case. A
// check file that quietly shrinks is worse than none: it keeps reporting a
// pass for properties it no longer looks at.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SQL = readFileSync(new URL("../scripts/edit-rpc-check.sql", import.meta.url), "utf8");
const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");

test("the database check still drives every function the flag depends on", () => {
  // DERIVED FROM THE APPLIED SQL, not from a list typed here — a function added
  // to the path and never driven is exactly the gap this is for.
  const rpcs = readFileSync(new URL("../supabase/applied/20260901110952_edit_job_rpcs.sql", import.meta.url), "utf8");
  const defined = [...rpcs.matchAll(/create or replace function public\.(edit_[a-z_]+)\(/g)].map((m) => m[1]);
  assert.ok(defined.length >= 13, `only ${defined.length} functions found in the applied SQL`);
  const undriven = defined.filter((fn) => !SQL.includes("public." + fn + "("));
  assert.deepEqual(undriven, [], `these RPCs are never driven by the check: ${undriven.join(", ")}`);
});

test("the check still covers every property the flag cannot ship without", () => {
  // Each of these is a MONEY or a LIVE-SITE property, named by the failure
  // message the check raises. Matched on the message rather than on a line
  // number, so the checks can be reordered freely.
  const must = [
    "a duplicate POST made a second job",
    "a second delivery claimed a leased job",
    "a replayed charge debited twice",
    "a second rung did not charge",
    "finalized an unpublished job",
    "a stranger renewed the lease",
    "double refund",
    "auto-refunded a mid-publish job",
    "the sweep refunded a publishing job",
    "a site under review accepted an edit",
    "a job under review was claimed",
    "a committed edit was refunded",
    "refunded a published edit",
    "MINTED CREDITS",
    // Stage 1b (2026-09-05): the two refund RPCs refuse a founder and still pay
    // a customer — sections 14b and 16b, driven as each in turn.
    "credit_back paid a founder",
    "refund_charge paid a founder",
    "credit_back no longer pays a customer back",
    "refund_charge no longer pays a customer back",
    "a charge was refunded twice",
    // Stage 1c (2026-09-05): the explicit debit and its reversal — sections
    // 14c (a founder is exempt, no row, nothing reversed) and 17 (the debit's
    // row, a repeat with prior, refused whole, partial and short, reversals
    // bounded by the debit, a repeat reversal, a stranger's reversal).
    "credit_debit debited a founder, or did not say exempt",
    "credit_reverse paid a founder with no debit row",
    "a retried debit charged again",
    "a bill above the balance was not refused whole",
    "a partial debit did not take what was there",
    "a reversal was not bounded by the debit",
    "a retried reversal paid twice",
    "another account reversed a ref that is not its own",
  ];
  for (const m of must) {
    assert.ok(SQL.includes(m), `the database check no longer proves: ${m}`);
  }
  // AND IT STILL ROLLS BACK. Without the unconditional raise at the end this
  // file stops being safe to run against production the moment somebody does.
  assert.match(SQL, /raise exception E'ALL % CHECKS PASSED/,
    "the check no longer ends in a raise, so it would COMMIT against production");
  assert.match(SQL, /update private\.mint set key_hash = keep;/,
    "the check no longer puts the production mint key back");
  const checks = (SQL.match(/raise exception 'FAIL/g) || []).length;
  assert.ok(checks >= 30, `only ${checks} assertions left in the check — it has been thinned out`);
});

test("the wall probe reaches no model, no publish and no ledger", () => {
  // ── WHAT THE PROBE IS ALLOWED TO TOUCH, STATED HONESTLY ────────────────
  //
  // It DOES reach the container now, and that is the measurement rather than a
  // leak: `sub` exists to time a Worker holding an outbound fetch, which is the
  // shape an edit has, and the container is the only far end we own that can
  // hold one. What it must never reach is anything that SPENDS — a model call,
  // a publish, or the ledger — because a probe that can spend money is not a
  // probe, and this one is run on a schedule nobody watches.
  const a = W.indexOf('url.pathname === "/api/_slow"');
  assert.ok(a > 0, "the probe route is gone");
  const b = W.indexOf('url.pathname === "/api/_hold"', a) > a
    ? W.indexOf('url.pathname === "/api/_hold"', a)
    : W.indexOf("if (url.pathname ===", a + 200);
  assert.ok(b > a, "could not find the end of the probe route");
  const route = W.slice(a, b);
  for (const forbidden of [
    "callBuilderModel", "anthropicMessages", "askRequest",
    "collectCredits", "use_credits", "editRpc", "readCredits",
    "recompileAndPublish", "publishSpine", "writeSiteDistToR2", "putSiteWorker",
    "buildAndPublishPages", "provisionNeon",
  ]) {
    assert.ok(!route.includes(forbidden), `the probe reaches ${forbidden} — a probe that can spend is not a probe`);
  }
  // AND THE OBSERVER: the window must really contain the route, or the absence
  // above is true of an empty string as well.
  assert.ok(route.includes("mode: \"burn\"") && route.includes("mode: \"sub\""),
    "the probe window came out without the route in it");
  // The one container endpoint it may use does no work of its own.
  assert.ok(route.includes("/slowreply"), "the sub mode no longer reaches the endpoint that waits");
  assert.ok(!route.includes("http://build/build"), "the probe reaches the container's BUILD endpoint");
});

test("the probe is behind auth and bounded", () => {
  const a = W.indexOf('url.pathname === "/api/_slow"');
  const route = W.slice(a, a + 2000);
  assert.match(route, /authUser\(request\)/, "the probe is open to anybody");
  assert.match(route, /Math\.min\(MAX, Number\(url\.searchParams\.get\("ms"\)\)/,
    "the probe's duration is unbounded — an open request that pins a Worker for as long as it likes");
});
