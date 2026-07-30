// Letting the person who filled in a form come back to it.
//
// The danger here is not that the feature fails to work — that is visible. It is
// that it works too WIDELY: a token minted for one booking opening another, or a
// different table, or a different site, or being usable as a login. `collect` is
// write-only for everyone else and this is the only hole in it, so the hole has
// to be exactly one row wide.
//
// The crypto is real; only the clock is injected, because a 90-day expiry cannot
// be waited out.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sessionKey, signClaim, verifyClaim, signToken, CLAIM_TTL_SEC,
  handleClaim, claimable, claimView, CLAIM_PARAM,
} from "../site-claim.mjs";

const SECRET = "service-key-stand-in";
const NOW = 1_780_000_000_000;
const at = (ms) => ({ nowMs: ms });

const COLLECT = { name: "bookings", access: "collect", columns: ["name", "slot"] };

/** A stand-in for the row store, so no database is involved. */
function fakeStore(rows = {}) {
  const store = { ...rows };
  return {
    store,
    selectRow: async (_t, id) => store[String(id)] || null,
    cancelRow: async (_t, id) => {
      if (!store[String(id)]) return { changes: 0 };
      delete store[String(id)];
      return { changes: 1 };
    },
  };
}

const deps = (key, store, slug = "barber") => ({
  verify: (tok, table, id) => verifyClaim(key, tok, table, id, at(NOW)),
  selectRow: store.selectRow,
  cancelRow: store.cancelRow,
  _slug: slug,
});

// ------------------------------------------------------------- the token

test("a claim verifies for the row it was minted for", async () => {
  const key = await sessionKey(SECRET, "barber");
  const tok = await signClaim(key, "bookings", 7, at(NOW));
  assert.ok(await verifyClaim(key, tok, "bookings", 7, at(NOW)));
});

test("a claim for one row does NOT open its neighbour", async () => {
  const key = await sessionKey(SECRET, "barber");
  const tok = await signClaim(key, "bookings", 7, at(NOW));
  assert.equal(await verifyClaim(key, tok, "bookings", 8, at(NOW)), null);
  assert.equal(await verifyClaim(key, tok, "bookings", 6, at(NOW)), null);
});

test("a claim for one table does NOT open the same id in another", async () => {
  const key = await sessionKey(SECRET, "barber");
  const tok = await signClaim(key, "bookings", 4, at(NOW));
  assert.equal(await verifyClaim(key, tok, "enquiries", 4, at(NOW)), null);
});

test("a claim from one site is meaningless on another", async () => {
  const a = await sessionKey(SECRET, "barber");
  const b = await sessionKey(SECRET, "cafe");
  const tok = await signClaim(a, "bookings", 7, at(NOW));
  assert.equal(await verifyClaim(b, tok, "bookings", 7, at(NOW)), null);
});

test("a claim expires", async () => {
  const key = await sessionKey(SECRET, "barber");
  const tok = await signClaim(key, "bookings", 7, at(NOW));
  const justBefore = NOW + CLAIM_TTL_SEC * 1000 - 2000;
  assert.ok(await verifyClaim(key, tok, "bookings", 7, at(justBefore)));
  assert.equal(await verifyClaim(key, tok, "bookings", 7, at(NOW + CLAIM_TTL_SEC * 1000 + 2000)), null);
});

test("a tampered claim is refused", async () => {
  const key = await sessionKey(SECRET, "barber");
  const tok = await signClaim(key, "bookings", 7, at(NOW));
  const [body, sig] = tok.split(".");
  assert.equal(await verifyClaim(key, body + "." + sig.slice(0, -1) + "A", "bookings", 7, at(NOW)), null);
  assert.equal(await verifyClaim(key, "x" + body + "." + sig, "bookings", 7, at(NOW)), null);
});

test("id is compared as a string, so 4 and \"4\" are the same row", async () => {
  const key = await sessionKey(SECRET, "barber");
  const tok = await signClaim(key, "bookings", 4, at(NOW));
  assert.ok(await verifyClaim(key, tok, "bookings", "4", at(NOW)));
  // ...and a prefix is NOT.
  assert.equal(await verifyClaim(key, tok, "bookings", "40", at(NOW)), null);
  assert.equal(await verifyClaim(key, tok, "bookings", "4x", at(NOW)), null);
});

test("the table name is matched case-insensitively, both ways", async () => {
  const key = await sessionKey(SECRET, "barber");
  const tok = await signClaim(key, "Bookings", 4, at(NOW));
  assert.ok(await verifyClaim(key, tok, "bOOKINGS", 4, at(NOW)));
});

// ------------------------------------------------- the kinds stay separate

// A claim is the ONLY kind now — `site-auth.mjs` and its session, reset, pending
// and verify tokens went to Neon Auth on 2026-07-30. So the half of this section
// that asked "is a claim accepted as a session?" has nothing left to ask, and
// what remains is the direction that still matters: nothing that is not a claim
// may pass as one.
//
// Worth keeping the history in view. `verifySession` was a DENY-list (`use !==
// "reset"`), which was correct for exactly as long as `reset` was the only other
// kind — adding claim would have made every booking receipt a valid login. With
// one kind left there is nothing to confuse a claim WITH, so that whole class of
// bug goes away along with the kinds; it comes back the moment a second kind does.

test("a token with no kind at all is NOT a claim", async () => {
  const key = await sessionKey(SECRET, "barber");
  const tok = await signToken(key, { sub: "3", email: "a@b.co" }, at(NOW));
  assert.equal(await verifyClaim(key, tok, "bookings", 3, at(NOW)), null);
});

test("the kind check stands on its own, not on the table check", async () => {
  // A token carrying no `tbl` fails for two reasons at once, so it cannot show
  // that `use` is load bearing. These match the table and the row exactly and
  // differ ONLY in their kind.
  const key = await sessionKey(SECRET, "barber");
  for (const use of ["reset", "session", "verify", "2fa", "invite", ""]) {
    const tok = await signToken(key, { sub: "7", use, tbl: "bookings" }, at(NOW));
    assert.equal(await verifyClaim(key, tok, "bookings", 7, at(NOW)), null, "use=" + JSON.stringify(use));
  }
  const noKind = await signToken(key, { sub: "7", tbl: "bookings" }, at(NOW));
  assert.equal(await verifyClaim(key, noKind, "bookings", 7, at(NOW)), null);
});

test("a real claim still verifies — the checks above are not refusing everything", async () => {
  // Without this, every assertion in this section would pass on a verifyClaim
  // that returned null unconditionally.
  const key = await sessionKey(SECRET, "barber");
  const tok = await signClaim(key, "bookings", 7, at(NOW));
  const body = await verifyClaim(key, tok, "bookings", 7, at(NOW));
  assert.equal(body && body.use, "claim");
  assert.equal(body && String(body.sub), "7");
});

// ------------------------------------------------------------- which tables

test("only collect tables are claimable", () => {
  assert.equal(claimable({ access: "collect" }), true);
  for (const a of ["display", "user", "feed", "admin"]) {
    assert.equal(claimable({ access: a }), false, a + " must not be claimable");
  }
});

test("a table with no declared access is treated as collect", () => {
  assert.equal(claimable({}), true);
});

// ------------------------------------------------------------- the view

test("the view drops _fts and owner_id and keeps everything else", () => {
  const out = claimView({ id: 1, name: "Ana", slot: "14:00", _fts: "big vector", owner_id: null });
  assert.deepEqual(Object.keys(out).sort(), ["id", "name", "slot"]);
  assert.equal(out.name, "Ana");
});

test("the view keeps a column the owner changed after the fact", () => {
  const out = claimView({ id: 1, name: "Ana", status: "confirmed" });
  assert.equal(out.status, "confirmed");
});

test("the view of nothing is null, not a crash", () => {
  assert.equal(claimView(null), null);
  assert.equal(claimView("nope"), null);
});

// ------------------------------------------------------------- the handler

test("a valid claim reads back the row", async () => {
  const key = await sessionKey(SECRET, "barber");
  const store = fakeStore({ 7: { id: 7, name: "Ana", slot: "14:00", _fts: "x" } });
  const tok = await signClaim(key, "bookings", 7, at(NOW));
  const r = await handleClaim(deps(key, store), { def: COLLECT, id: "7", token: tok, method: "GET" });
  assert.equal(r.status, 200);
  assert.equal(r.body.row.name, "Ana");
  assert.equal(r.body.row._fts, undefined);
});

test("a valid claim cancels the row", async () => {
  const key = await sessionKey(SECRET, "barber");
  const store = fakeStore({ 7: { id: 7 } });
  const tok = await signClaim(key, "bookings", 7, at(NOW));
  const r = await handleClaim(deps(key, store), { def: COLLECT, id: "7", token: tok, method: "DELETE" });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(store.store["7"], undefined);
});

test("cancelling twice is ok both times", async () => {
  const key = await sessionKey(SECRET, "barber");
  const store = fakeStore({ 7: { id: 7 } });
  const tok = await signClaim(key, "bookings", 7, at(NOW));
  const first = await handleClaim(deps(key, store), { def: COLLECT, id: "7", token: tok, method: "DELETE" });
  const again = await handleClaim(deps(key, store), { def: COLLECT, id: "7", token: tok, method: "DELETE" });
  assert.equal(first.body.changed, true);
  assert.equal(again.status, 200);
  assert.equal(again.body.ok, true);
  assert.equal(again.body.changed, false);
});

test("no token is a 404 and never touches the store", async () => {
  const key = await sessionKey(SECRET, "barber");
  let touched = false;
  const store = fakeStore({ 7: { id: 7 } });
  const spy = { ...store, selectRow: async (...a) => { touched = true; return store.selectRow(...a); } };
  const r = await handleClaim(deps(key, spy), { def: COLLECT, id: "7", token: "", method: "GET" });
  assert.equal(r.status, 404);
  assert.equal(touched, false);
});

test("someone else's claim does not open this row", async () => {
  const key = await sessionKey(SECRET, "barber");
  const store = fakeStore({ 7: { id: 7, name: "Ana" }, 8: { id: 8, name: "Ben" } });
  const other = await signClaim(key, "bookings", 8, at(NOW));
  const r = await handleClaim(deps(key, store), { def: COLLECT, id: "7", token: other, method: "GET" });
  assert.equal(r.status, 404);
});

test("a bad token and a missing row answer identically", async () => {
  const key = await sessionKey(SECRET, "barber");
  const store = fakeStore({ 7: { id: 7 } });
  const good = await signClaim(key, "bookings", 99, at(NOW));
  const bad = await handleClaim(deps(key, store), { def: COLLECT, id: "7", token: "forged", method: "GET" });
  const gone = await handleClaim(deps(key, store), { def: COLLECT, id: "99", token: good, method: "GET" });
  // Byte-identical: a distinct answer would say which ids exist.
  assert.equal(bad.status, gone.status);
  assert.deepEqual(bad.body, gone.body);
});

test("a non-collect table is refused even with a signature that checks out", async () => {
  const key = await sessionKey(SECRET, "barber");
  const store = fakeStore({ 7: { id: 7 } });
  const tok = await signClaim(key, "posts", 7, at(NOW));
  const r = await handleClaim(deps(key, store), {
    def: { name: "posts", access: "feed" }, id: "7", token: tok, method: "GET",
  });
  assert.equal(r.status, 404);
});

test("a non-integer id never reaches the store, even with a VALID signature", async () => {
  // Minting a real token for each bad id is the point. With an invalid token the
  // signature check refuses first and the id guard is never exercised — which is
  // how a mutation that deleted the guard entirely survived the first version of
  // this test.
  const key = await sessionKey(SECRET, "barber");
  let touched = false;
  const spy = { selectRow: async () => { touched = true; return null; }, cancelRow: async () => { touched = true; return { changes: 0 }; } };
  for (const bad of ["abc", "1;drop table x", "-1", "1.5", "  ", "7 OR 1=1"]) {
    const tok = await signClaim(key, "bookings", bad, at(NOW));
    // The signature itself is good — prove that, so the 404 below is the guard.
    assert.ok(await verifyClaim(key, tok, "bookings", bad, at(NOW)), "token for " + JSON.stringify(bad));
    for (const method of ["GET", "DELETE"]) {
      const r = await handleClaim(deps(key, spy), { def: COLLECT, id: bad, token: tok, method });
      assert.equal(r.status, 404, method + " id " + JSON.stringify(bad));
    }
  }
  assert.equal(touched, false, "no bad id may reach the database");
});

test("an empty id cannot even hold a signature", async () => {
  // Defended twice, and the outer one fires first: `verifyToken` refuses a
  // payload with no subject at all, so a claim for "" is unmintable before the
  // handler's integer guard is ever consulted.
  const key = await sessionKey(SECRET, "barber");
  const tok = await signClaim(key, "bookings", "", at(NOW));
  assert.equal(await verifyClaim(key, tok, "bookings", "", at(NOW)), null);
  const store = fakeStore({});
  const r = await handleClaim(deps(key, store), { def: COLLECT, id: "", token: tok, method: "GET" });
  assert.equal(r.status, 404);
});

test("PATCH is an honest 405, not a pretend 404", async () => {
  const key = await sessionKey(SECRET, "barber");
  const store = fakeStore({ 7: { id: 7 } });
  const tok = await signClaim(key, "bookings", 7, at(NOW));
  const r = await handleClaim(deps(key, store), { def: COLLECT, id: "7", token: tok, method: "PATCH" });
  assert.equal(r.status, 405);
});

test("the query-string name is one constant", () => {
  assert.equal(CLAIM_PARAM, "claim");
});
