// STAGE 1b — THE LEDGER REFUSES TO CREDIT A FOUNDER (2026-09-05, owner: "ok
// go 1b").
//
// `use_credits`, `use_credits_for` and `get_credits` answer the founder
// sentinel before any debit; until this migration `credit_back` and
// `refund_charge` credited a founder like anyone else — money given back that
// was never taken. The BEHAVIOUR is driven by scripts/edit-rpc-check.sql
// (sections 14b and 16b) against the live database, which this suite cannot
// reach (no Postgres here, no mint key). What this file guards is the RECORD
// of it, so it cannot silently shrink:
//   - the migration carries the guard in BOTH bodies, ahead of every write, and
//     reads the founders table — never a balance threshold;
//   - the live snapshot's read-back (the database's own answer) matches the
//     migration byte for byte, so a hand edit to either shows;
//   - the check still drives both functions as a founder AND as a customer,
//     in that order — a guard that refused everyone would pass the first half.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const DIR = new URL("../supabase/applied/", import.meta.url);
const FILE = fs.readdirSync(DIR).find((f) => /^\d{14}_founder_guard_on_refunds\.sql$/.test(f));
const RAW = FILE ? fs.readFileSync(new URL(FILE, DIR), "utf8") : "";
const SNAP = fs.readFileSync(new URL("20260901222000_live_snapshot_edit_rpcs.sql", DIR), "utf8");
const CHECK = fs.readFileSync(new URL("../scripts/edit-rpc-check.sql", import.meta.url), "utf8");

// Comments blanked line-wise and length-preserving: the migration explains at
// length what it refuses, naming the table and the clause it adds, and a scan
// that reads prose as SQL is the recorded trap.
const blank = (s) => s.replace(/^([ \t]*)--.*$/gm, (m) => " ".repeat(m.length));

/** One function's CREATE statement, header to closing dollar quote, out of a file. */
function fnBlock(src, name) {
  const head = "CREATE OR REPLACE FUNCTION public." + name + "(";
  const at = src.indexOf(head);
  assert.ok(at >= 0, name + " is not defined in the file");
  const open = src.indexOf("AS $function$", at);
  const close = src.indexOf("$function$", open + "AS $function$".length);
  assert.ok(open > at && close > open, name + " has no dollar-quoted body");
  return src.slice(at, close + "$function$".length);
}

test("the migration is in the applied folder, named for the remote history", () => {
  assert.ok(FILE, "supabase/applied has no <version>_founder_guard_on_refunds.sql");
  assert.ok(RAW.length > 500, "the migration file is empty");
});

test("credit_back writes only where the target is not a founder", () => {
  const cb = blank(fnBlock(RAW, "credit_back"));
  assert.equal((cb.match(/\bupdate\b/gi) || []).length, 1, "credit_back has a second write path");
  assert.doesNotMatch(cb, /\binsert\b/i, "credit_back inserts a credits row it never did");
  // THE CLAUSE IS ON THE ONE UPDATE'S WHERE, so there is no write it does not guard.
  assert.match(cb, /where user_id = target\s+and not exists \(select 1 from private\.founders f where f\.user_id = target\);/,
    "the UPDATE is not gated on the founders table");
  assert.doesNotMatch(cb, /1000000|balance\s*>=?\s*\d{4,}/, "the guard reads a balance threshold, not the founders table");
  assert.match(cb, /least\(greatest\(amount, 0\), 10\)/, "the 10-credit cap per call moved");
});

test("refund_charge refuses a founder before it touches the charge row", () => {
  const rc = blank(fnBlock(RAW, "refund_charge"));
  const guard = rc.search(/if exists \(select 1 from private\.founders f where f\.user_id = p_user\) then return 0; end if;/);
  const lock = rc.indexOf("for update");
  const mark = rc.indexOf("update public.gen_charges set refunded = true");
  const pay = rc.indexOf("update public.credits set balance = balance + c.cost");
  assert.ok(guard >= 0, "refund_charge has no founder guard");
  assert.ok(lock > 0 && mark > 0 && pay > 0, "refund_charge lost its lock, its mark or its payment");
  assert.ok(guard < lock && lock < mark && mark < pay, "the founder guard is not ahead of the row lock and both writes");
  // The WRITES, not the word: `select ... for update` carries it too (the
  // recorded flat-scan trap, met on the first run of this file).
  assert.equal((rc.match(/\bupdate public\./g) || []).length, 2, "refund_charge's writes changed in number");
  assert.doesNotMatch(rc, /1000000/, "the guard reads the sentinel, not the founders table");
});

test("both stay service_role only — a founder guard is moot if a client can call them", () => {
  const sql = blank(RAW);
  for (const sig of ["public.credit_back(uuid, numeric)", "public.refund_charge(text, uuid)"]) {
    assert.ok(sql.includes(`revoke all on function ${sig} from public, anon, authenticated;`), sig + " is not revoked from the client roles");
    assert.ok(sql.includes(`grant execute on function ${sig} to service_role;`), sig + " is not granted to service_role");
  }
});

test("the live snapshot's read-back matches the migration byte for byte", () => {
  // pg_get_functiondef keeps a body verbatim and prints the header in one
  // layout; the migration is written in that layout, so the two must be equal
  // — a difference is either a hand edit to the folder (the recorded drift) or
  // a live function that is not what the folder says.
  for (const name of ["credit_back", "refund_charge"]) {
    assert.equal(fnBlock(SNAP, name), fnBlock(RAW, name), name + ": the snapshot (the database's own answer) differs from the migration");
  }
  // The snapshot's own account of itself: the read-back, and these two named
  // as part of it (the header wraps, so the words are matched apart).
  assert.match(SNAP, /LIVE SNAPSHOT of every public\.edit_\* function, read out of the database with/, "the snapshot no longer says what it is");
  assert.match(SNAP, /read the same way after stage 1b's founder guard/, "the snapshot's header does not say it holds the two refund functions");
});

test("the check drives both refund RPCs as a founder, then as a customer", () => {
  // COMMENTS BLANKED FIRST: the script's own run log at the top quotes the
  // FAIL 48 message, so an unblanked indexOf found it there — before the
  // founder row exists — and read the check as running in the wrong order.
  // The recorded "prose contains the thing it forbids", on this file's first run.
  const C = blank(CHECK);
  const founderOn = C.indexOf("insert into private.founders (user_id) values (u)");
  const founderOff = C.indexOf("delete from private.founders where user_id = u;");
  assert.ok(founderOn > 0 && founderOff > founderOn, "the check no longer makes and unmakes the test user a founder");
  const at = (s) => { const i = C.indexOf(s); assert.ok(i >= 0, "the check no longer says: " + s); return i; };
  const cbF = at("credit_back paid a founder");
  const rcF = at("refund_charge paid a founder");
  const cbC = at("credit_back no longer pays a customer back");
  const rcC = at("refund_charge no longer pays a customer back");
  assert.ok(founderOn < cbF && cbF < founderOff && founderOn < rcF && rcF < founderOff,
    "the founder refund checks do not run while the test user is a founder");
  assert.ok(cbC > founderOff && rcC > founderOff, "the customer control does not run after the founder row is gone");
  // DRIVEN, NOT DESCRIBED: the calls themselves, as the founder.
  const founder = C.slice(founderOn, founderOff);
  assert.match(founder, /set_config\('request\.jwt\.claims'/, "the founder half does not impersonate the user, so use_credits cannot run");
  assert.match(founder, /public\.use_credits\(2\) <> 1000000/, "the founder half does not pin the sentinel it mirrors");
  assert.match(founder, /perform public\.credit_back\(u, 2\);/, "credit_back is not driven as a founder");
  assert.match(founder, /n := public\.refund_charge\(req, u\);/, "refund_charge is not driven as a founder");
  assert.match(founder, /marked refunded with nothing paid/, "the founder's charge row is not read back");
  // And as the customer: paid, marked, and refused a second time.
  const customer = C.slice(founderOff);
  assert.match(customer, /public\.use_credits\(2\) <> b0 - 2/, "the customer half does not prove the sentinel is NOT answered for a customer");
  assert.match(customer, /perform public\.credit_back\(u, 2\);/, "credit_back is not driven as a customer");
  assert.match(customer, /n := public\.refund_charge\(req \|\| '-c', u\);/, "refund_charge is not driven as a customer");
  assert.match(customer, /a charge was refunded twice/, "the repeat refund is not refused");
});
