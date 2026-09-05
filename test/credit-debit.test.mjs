// STAGE 1c — EXEMPTION AND DEBIT ARE EXPLICIT RESULTS (2026-09-05, owner: "ok
// go 1c").
//
// The build route paid with `use_credits`, whose answer is a balance or -1: a
// founder's call answered the 1000000 sentinel with nothing taken and the
// route read it as a debit; a short balance answered -1 and `collectCredits`
// took what it could; and every refund was a NUMBER the route remembered,
// handed to `credit_back`, which credited it whether or not it had ever been
// taken. Now the ledger says what it did — `credit_debit` answers `{ ok,
// exempt, taken, repeat, prior }` and writes a `credit_events` row under the
// build's own ref — and every reversal goes through `credit_reverse`, bounded
// by that row. Two things are proved here:
//
//   1. THE ROUTE IS DRIVEN through `worker.fetch` against a stubbed ledger,
//      because the money path is a chain of hops and a source read certifies
//      the layer below the break (the recorded trap). A founder, a balance
//      under the floor, a design call that fails, a reversal the ledger will
//      not answer, an account that cannot pay, and a duplicate delivery.
//   2. THE RECORD holds: the migration carries both functions with the
//      properties the plan named, the live snapshot's read-back equals it,
//      the check script drives both as a founder and as a customer.
//
// The SQL itself is driven against the live database by
// scripts/edit-rpc-check.sql sections 14c and 17 (ALL 78 CHECKS PASSED on the
// day), which this suite cannot reach.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { hit } from "./fixtures/worker-harness.mjs";

const WORKER = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const DIR = new URL("../supabase/applied/", import.meta.url);
const FILE = fs.readdirSync(DIR).find((f) => /^\d{14}_credit_debit_and_reverse\.sql$/.test(f));
const RAW = FILE ? fs.readFileSync(new URL(FILE, DIR), "utf8") : "";
const SNAP = fs.readFileSync(new URL("20260901222000_live_snapshot_edit_rpcs.sql", DIR), "utf8");
const CHECK = fs.readFileSync(new URL("../scripts/edit-rpc-check.sql", import.meta.url), "utf8");

const blank = (s) => s.replace(/^([ \t]*)--.*$/gm, (m) => " ".repeat(m.length));
const blankJs = (s) => s.replace(/^([ \t]*)\/\/.*$/gm, (m) => " ".repeat(m.length));

function fnBlock(src, name) {
  const head = "CREATE OR REPLACE FUNCTION public." + name + "(";
  const at = src.indexOf(head);
  assert.ok(at >= 0, name + " is not defined in the file");
  const open = src.indexOf("AS $function$", at);
  const close = src.indexOf("$function$", open + "AS $function$".length);
  assert.ok(open > at && close > open, name + " has no dollar-quoted body");
  return src.slice(at, close + "$function$".length);
}

/* ────────────────────────────── the route, driven ────────────────────────── */

// The route refuses with 501 before it reads the body unless these look
// present; `SITE_BUILD_FEE` is 2 and `buildFloor("claude-sonnet-5")` is 22, so
// a customer with 3 left after the deposit (5 before it) is under the floor and
// one with 500 is not.
const ENV = { NEON_API_KEY: "k", SUPABASE_SERVICE_KEY: "svc", ANTHROPIC_API_KEY: "k", XAI_API_KEY: "k" };
const AUTHED = { Authorization: "Bearer t", "content-type": "application/json" };
const FLOOR = 22;

/**
 * Every wire the route reaches up to and including the design call, answered
 * in shape; `debit` and `reverse` are what the ledger says. The design call
 * throws — a network fault — so the route lands in its design catch, which is
 * where the deposit's reversal lives. Unknown URLs are recorded and refused,
 * so a route that reaches something new says so instead of hanging.
 */
async function drive({ debit, reverse = { ok: true, refunded: 2, already: 0, debited: 2, repeat: false }, reverseStatus = 200 }) {
  const real = globalThis.fetch;
  const calls = { debit: [], reverse: [], other: [] };
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : (input && input.url) || String(input);
    const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
    if (url.includes("/auth/v1/user")) return json({ id: "u1", email: "a@b.c" });
    if (url.includes("/rest/v1/rpc/credit_debit")) {
      calls.debit.push(JSON.parse(String(init && init.body) || "{}"));
      return json(typeof debit === "function" ? debit(calls.debit.length) : debit);
    }
    if (url.includes("/rest/v1/rpc/credit_reverse")) {
      calls.reverse.push(JSON.parse(String(init && init.body) || "{}"));
      return reverseStatus === 200 ? json(reverse) : new Response("boom", { status: reverseStatus });
    }
    if (url.includes("/rest/v1/rpc/use_credits") || url.includes("/rest/v1/rpc/credit_back")) {
      calls.other.push(url);
      throw new Error("the build route still pays through the old ledger call: " + url);
    }
    if (url.includes("/v1/messages") || url.includes("/v1/chat/completions")) {
      throw new Error("designer unreachable (test)");
    }
    // THE ONE FREE HOP BETWEEN THE DEPOSIT AND THE DESIGN CALL: the sitelinks
    // quota (`useQuota(request, "sitelinks", 60)`), asked before the brief's
    // links are read. Not a ledger call — it moves no credits and fails open —
    // so it is answered as granted rather than counted as something unstubbed.
    if (url.includes("/rest/v1/rpc/use_quota")) return json(true);
    calls.other.push(url);
    return new Response("not stubbed", { status: 503 });
  };
  try {
    const res = await hit("/api/site/react-build", {
      method: "POST", headers: AUTHED, env: ENV,
      body: JSON.stringify({ brief: "a barber shop in Sheffield", picker: "sonnet" }),
    });
    return { status: res.status, json: res.json, calls };
  } finally { globalThis.fetch = real; }
}

test("a founder's deposit is exempt: nothing taken, no gate, nothing reversed when the design fails", async () => {
  const r = await drive({ debit: { ok: true, exempt: true, taken: 0, repeat: false } });
  assert.equal(r.calls.debit.length, 1, "the deposit was not asked of the ledger exactly once");
  const d = r.calls.debit[0];
  assert.equal(d.p_amount, 2, "the deposit is not the build fee");
  assert.match(String(d.p_ref), /^build:[^:]+:deposit$/, "the deposit ref is not the build's id plus the step");
  assert.equal(d.p_reason, "debit");
  assert.equal(d.p_partial, false, "the deposit is a gate — whole or refused");
  // Past the floor without a balance, into the design call, whose failure
  // reverses NOTHING: the ledger took nothing, and a reversal of nothing is
  // not asked (the refs ledger is empty).
  assert.equal(r.status, 503, "the design failure did not answer as one: " + JSON.stringify(r.json));
  assert.equal(r.json.stage, "design");
  assert.equal(r.json.cost, 0);
  assert.equal(r.json.refundShort, undefined);
  assert.equal(r.calls.reverse.length, 0, "a founder's non-debit was reversed: " + JSON.stringify(r.calls.reverse));
  assert.deepEqual(r.calls.other, [], "the route reached something unstubbed: " + r.calls.other.join(", "));
});

test("a customer under the floor is refused, and the deposit goes back through its own ref", async () => {
  const r = await drive({ debit: { ok: true, exempt: false, taken: 2, balance: 3, repeat: false } });
  assert.equal(r.status, 402, JSON.stringify(r.json));
  assert.equal(r.json.error, "not enough credits");
  assert.equal(r.json.cost, FLOOR, "the refusal does not name what a build needs");
  assert.match(r.json.msg, /needs about 22 credits and you have 5\b/, "the message does not quote the balance the ledger answered plus the deposit");
  assert.equal(r.calls.reverse.length, 1, "the deposit was not reversed exactly once");
  const back = r.calls.reverse[0];
  assert.equal(back.p_target, "u1");
  assert.equal(back.p_ref, r.calls.debit[0].p_ref, "the reversal is not of the deposit's own ref");
  assert.equal(back.p_reason, "floor");
  assert.equal(back.p_amount, 2);
  assert.equal(r.json.refundShort, undefined, "a reversal that landed was reported short");
});

test("a design call that fails reverses the deposit by ref, and the reply reads the ledger", async () => {
  const r = await drive({ debit: { ok: true, exempt: false, taken: 2, balance: 500, repeat: false } });
  assert.equal(r.status, 503, JSON.stringify(r.json));
  assert.equal(r.json.stage, "design");
  assert.equal(r.calls.reverse.length, 1, "the deposit was not reversed exactly once");
  assert.equal(r.calls.reverse[0].p_reason, "design");
  assert.equal(r.calls.reverse[0].p_amount, 2);
  assert.equal(r.calls.reverse[0].p_ref, r.calls.debit[0].p_ref);
  assert.equal(r.json.cost, 0, "the reply does not read the reversal off the ledger");
  assert.equal(r.json.refundShort, undefined);
});

test("a reversal the ledger will not answer is reported — cost stays, refundShort says so", async () => {
  const r = await drive({ debit: { ok: true, exempt: false, taken: 2, balance: 500, repeat: false }, reverseStatus: 500 });
  assert.equal(r.status, 503);
  assert.equal(r.calls.reverse.length, 1);
  assert.equal(r.json.cost, 2, "a reversal that did not land is reported as cost 0");
  assert.equal(r.json.refundShort, true, "a reversal that did not land is silent");
});

test("a reversal the ledger answers SHORT is reported the same way", async () => {
  // The ledger gave back less than asked and said so: `already` 0, `refunded`
  // 1 of the 2 owed. What stays is 1, and the reply says it.
  const r = await drive({
    debit: { ok: true, exempt: false, taken: 2, balance: 500, repeat: false },
    reverse: { ok: true, refunded: 1, already: 0, debited: 2, repeat: false },
  });
  assert.equal(r.json.cost, 1, "what the ledger says stayed is not what the reply says");
  assert.equal(r.json.refundShort, true);
});

test("a reversal that counts what an earlier attempt already returned is read as whole", async () => {
  // The ledger answers `already` 1 (an earlier delivery's reversal) and
  // `refunded` 1: together the whole deposit is back, so nothing stays and
  // nothing is short — a route reading `refunded` alone would report 1 kept.
  const r = await drive({
    debit: { ok: true, exempt: false, taken: 2, balance: 500, repeat: false },
    reverse: { ok: true, refunded: 1, already: 1, debited: 2, repeat: false },
  });
  assert.equal(r.status, 503);
  assert.equal(r.json.cost, 0, "what an earlier reversal already returned is not counted");
  assert.equal(r.json.refundShort, undefined);
});

test("an account that cannot pay the deposit is refused whole, and nothing is reversed", async () => {
  const r = await drive({ debit: { ok: false, error: "insufficient", exempt: false, taken: 0, balance: 1, repeat: false } });
  assert.equal(r.status, 402, JSON.stringify(r.json));
  assert.equal(r.json.error, "not enough credits");
  assert.match(r.json.msg, /A build needs about 22 credits\./);
  assert.equal(r.calls.reverse.length, 0, "nothing was taken, and something was reversed");
});

test("a duplicate delivery meets its own deposit row: not refused, and reversed at what the first one took", async () => {
  const r = await drive({ debit: { ok: true, exempt: false, taken: 0, repeat: true, prior: 2, balance: 498 } });
  assert.equal(r.status, 503, "a repeat was refused as unpaid: " + JSON.stringify(r.json));
  assert.equal(r.json.stage, "design");
  assert.equal(r.calls.reverse.length, 1, "the earlier delivery's deposit was not reversed by ref");
  assert.equal(r.calls.reverse[0].p_amount, 2, "the reversal is not of what the first delivery took (`prior`)");
});

/* ─────────────────────────── the route, as written ───────────────────────── */

test("the build's refs: one per debit, the job's id under the queue, carried to the pages debit and stored for the resume", () => {
  const w = blankJs(WORKER);
  assert.match(w, /const billRef = "build:" \+ \(jobId \|\| crypto\.randomUUID\(\)\);/, "the ref is not the job's id under the queue");
  assert.match(w, /const debitRef = \(step\) => billRef \+ ":" \+ step;/);
  // The pages debit rides the same ref, partial, and falls back to the
  // collect for a job stored before the ref existed.
  assert.match(w, /useCredits: \(n\) => billRef \? debitCredits\(auth, n, billRef \+ ":pages", "debit", true\) : collectCredits\(auth, n\)/,
    "the pages debit is not under the build's ref");
  // The ref is in `buildArgs`, which is what the resume record stores, so a
  // resumed build debits under the SAME ref.
  const at = w.indexOf("buildArgs = {");
  const end = w.indexOf("pages = await buildAndPublishPages(env, buildArgs);", at);
  assert.ok(at > 0 && end > at, "buildArgs moved — rescope this");
  assert.match(w.slice(at, end), /\n\s+billRef,\n/, "the ref is not carried in buildArgs, so a resume would debit under a fresh one");
  assert.match(w, /models = null, billRef = null \}\) \{/, "buildAndPublishPages does not take the ref");
  // Every reversal on the route goes through the ledger of refs; the old
  // number-based refund is gone from it.
  const route = w.slice(w.indexOf("async function runSiteBuild("), w.indexOf("\n}\n", w.indexOf("async function runSiteBuild(")));
  assert.ok(route.length > 50_000, "the build route window is too small: " + route.length);
  assert.doesNotMatch(route, /creditBack\(|refundCredits\(|useCredits\(auth|collectCredits\(auth, settle/, "the route still pays or refunds through the old calls");
  assert.equal((route.match(/await refundFields\(\)/g) || []).length, 6, "the six refusals no longer all reverse through the ledger of refs");
  // What the reply carries.
  assert.match(route, /exempt: \(exempt \|\| \(pages && pages\.exempt === true\)\) \? true : undefined,/, "the reply does not carry exempt");
  // A FOUNDER IS NEVER SETTLED, and the flag that says so is set where the
  // ledger's answer is recorded. Read here rather than driven: the settle
  // runs only after a design answer, which the drive above never gives (the
  // design call is the one wire it cuts), so a settle that debited a founder
  // would pass every driven case. The spelling is the property — `exempt` is
  // the route's own flag, set from the deposit's answer, and both settle
  // branches are gated on it.
  assert.match(route, /const noteDebit = \(ref, d\) => \{\s+if \(d\.exempt\) \{ exempt = true; return; \}/, "a debit answered exempt does not set the route's flag");
  assert.match(route, /if \(settle > 0 && !exempt\) \{/, "a founder's schema is settled (debited)");
  assert.match(route, /\} else if \(settle < 0 && !exempt\) \{/, "a founder's deposit is 'given back' — a reversal of a debit that never happened");
  assert.match(route, /schemaCost = owed\(\);/, "the schema cost is not read off the ledger of refs");
});

test("the two helpers: the debit throws on a transport failure and reads every field; the reversal never throws and says so", () => {
  const w = blankJs(WORKER);
  const dAt = w.indexOf("async function debitCredits(");
  const rAt = w.indexOf("async function reverseCredits(");
  assert.ok(dAt > 0 && rAt > dAt, "the helpers moved — rescope this");
  const d = w.slice(dAt, rAt);
  assert.match(d, /rpc\/credit_debit`/, "debitCredits does not call credit_debit");
  assert.match(d, /body: JSON\.stringify\(\{ p_amount: amount, p_ref: ref, p_reason: reason, p_partial: !!partial \}\)/, "the four parameters are not all sent");
  assert.match(d, /if \(!r\.ok\) throw new Error\("credit_debit rpc " \+ r\.status\);/, "a transport failure is not thrown");
  for (const f of ["ok", "exempt", "repeat", "short", "taken", "prior", "balance", "error"]) {
    assert.ok(d.includes(f + ":"), "debitCredits drops the ledger's `" + f + "`");
  }
  const r = w.slice(rAt, w.indexOf("\n}\n", rAt));
  assert.match(r, /rpc\/credit_reverse`/, "reverseCredits does not call credit_reverse");
  assert.match(r, /body: JSON\.stringify\(\{ p_target: uid, p_ref: ref, p_reason: reason, p_amount: amount \}\)/);
  assert.match(r, /Authorization: `Bearer \$\{env\.SUPABASE_SERVICE_KEY\}`/, "the reversal is not made as the service role");
  assert.match(r, /catch \(e\) \{ console\.error\("credit_reverse failed:"/, "a thrown reversal is not logged");
  assert.match(r, /if \(!r\.ok\) \{ console\.error\("credit_reverse refused:"/, "a refused reversal is not logged");
  assert.doesNotMatch(r, /throw /, "reverseCredits throws — a refund is the recovery path");
  for (const f of ["refunded", "already", "debited", "repeat"]) {
    assert.ok(r.includes(f + ":"), "reverseCredits drops the ledger's `" + f + "`");
  }
});

/* ───────────────────────────────── the record ────────────────────────────── */

test("the migration is in the applied folder, named for the remote history, and the snapshot's read-back equals it", () => {
  assert.ok(FILE, "supabase/applied has no <version>_credit_debit_and_reverse.sql");
  for (const name of ["credit_debit", "credit_reverse"]) {
    assert.equal(fnBlock(SNAP, name), fnBlock(RAW, name), name + ": the snapshot (the database's own answer) differs from the migration");
  }
  assert.match(SNAP, /credit_debit and\s+-- credit_reverse \(stage 1c/, "the snapshot's header does not say it holds the two ledger functions");
});

test("credit_debit: exempt by the founders table before any write, a row per debit, a repeat with prior, partial only when asked", () => {
  const b = blank(fnBlock(RAW, "credit_debit"));
  const founder = b.indexOf("if exists (select 1 from private.founders f where f.user_id = uid) then");
  const grant = b.indexOf("insert into public.credits (user_id, balance) values (uid, 20)");
  const lock = b.indexOf("for update");
  const repeat = b.indexOf("select -e.delta into prior from public.credit_events e where e.ref = p_ref and e.reason = p_reason;");
  const debit = b.indexOf("update public.credits set balance = balance - took");
  const row = b.indexOf("insert into public.credit_events (uid, kind, ref, reason, delta, balance_after)");
  assert.ok(founder > 0 && grant > founder && lock > grant && repeat > lock && debit > repeat && row > debit,
    "the order is not founder → grant → lock → repeat → debit → row");
  assert.match(b, /return jsonb_build_object\('ok', true, 'exempt', true, 'taken', 0, 'repeat', false\);/, "a founder is not answered exempt with nothing taken");
  assert.match(b, /'repeat', true, 'taken', 0, 'prior', prior/, "a repeat does not say what the first one took");
  assert.match(b, /when p_partial then floor\(greatest\(have, 0\) \* 1000000\) \/ 1000000\s+else 0 end;/, "a short balance is taken in part without being asked, or never");
  assert.match(b, /'error', 'insufficient', 'taken', 0/, "a refusal is not said as insufficient with nothing taken");
  assert.match(b, /values \(uid, 'build', p_ref, p_reason, -took, bal\)/, "the row is not the build's, under the caller's ref, for what was taken");
  assert.match(b, /'short', took < p_amount/, "a partial debit does not say short");
  // THE SENTINEL, NOT THE NUMBER. `use_credits` answers a founder with
  // `return 1000000;` and a threshold read of the balance is the other way the
  // old shape comes back; the same digits in `floor(… * 1000000) / 1000000` are
  // the partial debit's rounding to a millionth, asserted present above. A
  // first draft forbade `1000000)` and false-alarmed on that arithmetic.
  assert.doesNotMatch(b, /return\s+1000000\b/, "the founder sentinel is back");
  assert.doesNotMatch(b, /\b(have|balance)\s*>=?\s*1000000\b/, "founder status is read off a balance threshold");
});

test("credit_reverse: the debit row decides, matched on the account, bounded by what is left, one reversal per reason, never the founders table", () => {
  const b = blank(fnBlock(RAW, "credit_reverse"));
  assert.doesNotMatch(b, /founders/, "the reversal reads the account's status, not the debit row");
  assert.match(b, /where e\.ref = p_ref and e\.uid = p_target and e\.delta < 0;/, "the debit is not matched on the account as well as the ref");
  assert.match(b, /if debited <= 0 then\s+return jsonb_build_object\('ok', true, 'refunded', 0, 'debited', 0, 'repeat', false\);/, "no debit does not answer 0");
  assert.match(b, /perform 1 from public\.credits where user_id = p_target for update;/, "one account's reversals are not serialised");
  assert.match(b, /give := least\(p_amount, debited - already\);/, "the reversal is not bounded by the debit less what was already returned");
  assert.match(b, /if exists \(select 1 from public\.credit_events e where e\.ref = p_ref and e\.reason = p_reason\) then\s+return jsonb_build_object\('ok', true, 'refunded', 0, 'debited', debited, 'already', already, 'repeat', true\);/,
    "a retried reversal does not answer repeat with what was already returned");
  assert.match(b, /p_reason = 'debit' or/, "a reversal may be written under the debit's own reason");
  assert.match(b, /values \(p_target, 'build', p_ref, p_reason, give, bal\)/, "the refund row is not written");
  const already = b.indexOf("select coalesce(sum(e.delta), 0) into already");
  const lock = b.indexOf("for update;");
  assert.ok(lock > 0 && already > lock, "`already` is read before the lock, so two reversals can both read nothing returned yet");
});

test("the grants: credit_debit for the signed-in caller and the service, credit_reverse for the service alone", () => {
  const sql = blank(RAW);
  assert.ok(sql.includes("revoke all on function public.credit_debit(numeric, text, text, boolean) from public, anon;"));
  assert.ok(sql.includes("grant execute on function public.credit_debit(numeric, text, text, boolean) to authenticated, service_role;"));
  assert.ok(sql.includes("revoke all on function public.credit_reverse(uuid, text, text, numeric) from public, anon, authenticated;"));
  assert.ok(sql.includes("grant execute on function public.credit_reverse(uuid, text, text, numeric) to service_role;"));
});

test("the check drives both, as a founder (14c) and then as a customer (17), against the live ledger", () => {
  const C = blank(CHECK);
  const founderOn = C.indexOf("insert into private.founders (user_id) values (u)");
  const founderOff = C.indexOf("delete from private.founders where user_id = u;");
  const at = (s) => { const i = C.indexOf(s); assert.ok(i >= 0, "the check no longer says: " + s); return i; };
  assert.ok(founderOn > 0 && founderOff > founderOn);
  const f1 = at("credit_debit debited a founder, or did not say exempt");
  const f2 = at("credit_reverse paid a founder with no debit row");
  assert.ok(founderOn < f1 && f1 < founderOff && f1 < f2 && f2 < founderOff, "the founder half does not run while the test user is a founder");
  const founder = C.slice(founderOn, founderOff);
  assert.match(founder, /r := public\.credit_debit\(3, req \|\| ':f', 'debit', false\);/);
  assert.match(founder, /a founder''s exempt debit wrote a ledger row/);
  for (const s of [
    "credit_debit did not take the bill, or read a customer as exempt",
    "the debit did not write its row",
    "a retried debit charged again, or did not say what the first took",
    "a bill above the balance was not refused whole",
    "a partial debit did not take what was there, or did not say short",
    "a reversal was not bounded by the debit",
    "a partial reversal did not give back 1",
    "the second reversal was not bounded by the debit less the first",
    "a retried reversal paid twice",
    "another account reversed a ref that is not its own",
    "expected the debit and its two reversals on the ledger",
  ]) assert.ok(at(s) > founderOff, "the customer half runs while the test user is still a founder: " + s);
});
