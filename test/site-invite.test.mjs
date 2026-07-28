// Who is allowed to become a member of a published site.
//
// The failure that matters here is silent and total: a site the owner closed
// still taking signups, or an invite code that can be used more times than it
// says. Both look like nothing at all until somebody who should not have an
// account has one.
//
// Policy only — the atomic decrement lives in worker.js, because whether two
// racing UPDATEs can both win is a property of Postgres and not of this file.
// Everything that decides *whether* to burn is here and runs against fakes.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SIGNUP_MODES, normalizeMode, newInviteCode, normalizeCode,
  checkSignup, inviteOptions, MAX_USES, MAX_DAYS,
} from "../site-invite.mjs";

/** A stand-in for the two things the gate touches. */
function gate({ mode = "open", codes = {}, modeThrows = false } = {}) {
  const seen = [];
  return {
    seen,
    codes,
    mode: async () => { if (modeThrows) throw new Error("database unreachable"); return mode; },
    burn: async (code) => {
      seen.push(code);
      if (!(code in codes) || codes[code] <= 0) return false;
      codes[code] -= 1;
      return true;
    },
  };
}

// ------------------------------------------------------------- modes

test("the three modes are the only ones", () => {
  assert.deepEqual(SIGNUP_MODES, ["open", "invite", "closed"]);
});

test("anything unrecognised reads as open", () => {
  for (const v of [undefined, null, "", "OPEN ", "Invite", "nonsense", 7, {}]) {
    const m = normalizeMode(v);
    assert.ok(SIGNUP_MODES.includes(m), String(v));
  }
  assert.equal(normalizeMode("nonsense"), "open");
  assert.equal(normalizeMode(" INVITE "), "invite");
  assert.equal(normalizeMode("Closed"), "closed");
});

test("a site that never set a mode still takes signups", async () => {
  // Every site built before this exists in exactly this state. Closing them all
  // would break working signups on live sites.
  const g = gate({ mode: "open" });
  const r = await checkSignup(g, {});
  assert.equal(r.ok, true);
  assert.equal(g.seen.length, 0, "open mode must not touch the invite table");
});

test("closed refuses everyone, code or not", async () => {
  const g = gate({ mode: "closed", codes: { ABCDEFGHJKLM: 5 } });
  const r = await checkSignup(g, { code: "ABCD-EFGH-JKLM" });
  assert.equal(r.ok, undefined);
  assert.equal(r.status, 403);
  assert.equal(r.reason, "closed");
  assert.equal(g.seen.length, 0, "a closed site must not spend a code");
});

test("an unreadable mode fails CLOSED, with 503", async () => {
  // Guessing "open" would let a transient database blip reopen a site the owner
  // deliberately shut, and nobody would ever know.
  const g = gate({ modeThrows: true });
  const r = await checkSignup(g, { code: "ABCD-EFGH-JKLM" });
  assert.equal(r.ok, undefined);
  assert.equal(r.status, 503);
  assert.equal(r.reason, "unavailable");
  assert.equal(g.seen.length, 0);
});

// ------------------------------------------------------------- invite mode

test("invite mode refuses a signup with no code", async () => {
  const g = gate({ mode: "invite", codes: { ABCDEFGHJKLM: 1 } });
  for (const code of [undefined, null, "", "   "]) {
    const r = await checkSignup(g, { code });
    assert.equal(r.status, 403, JSON.stringify(code));
  }
  assert.equal(g.seen.length, 0, "a malformed code must never reach the database");
});

test("invite mode accepts a good code and spends exactly one use", async () => {
  const g = gate({ mode: "invite", codes: { ABCDEFGHJKLM: 2 } });
  const r = await checkSignup(g, { code: "ABCD-EFGH-JKLM" });
  assert.equal(r.ok, true);
  assert.equal(r.burned, "ABCDEFGHJKLM");
  assert.equal(g.codes.ABCDEFGHJKLM, 1);
});

test("a code stops working when its uses run out", async () => {
  const g = gate({ mode: "invite", codes: { ABCDEFGHJKLM: 1 } });
  assert.equal((await checkSignup(g, { code: "ABCDEFGHJKLM" })).ok, true);
  const second = await checkSignup(g, { code: "ABCDEFGHJKLM" });
  assert.equal(second.ok, undefined);
  assert.equal(second.status, 403);
});

test("a wrong code and an exhausted code are indistinguishable", async () => {
  // Telling them apart lets somebody with a list of guesses learn which codes
  // exist, which is the entire value of a code.
  const g = gate({ mode: "invite", codes: { ABCDEFGHJKLM: 0 } });
  const spent = await checkSignup(g, { code: "ABCDEFGHJKLM" });
  const wrong = await checkSignup(g, { code: "ZZZZZZZZZZZZ" });
  assert.deepEqual(spent, wrong);
});

test("the burned code is handed back so a failed signup can refund it", async () => {
  // Without this, anyone holding a code could spend every use on it by signing
  // up repeatedly with an address that already exists.
  const g = gate({ mode: "invite", codes: { ABCDEFGHJKLM: 3 } });
  const r = await checkSignup(g, { code: "ABCDEFGHJKLM" });
  assert.equal(typeof r.burned, "string");
});

test("open mode burns nothing, so there is nothing to refund", async () => {
  const g = gate({ mode: "open", codes: { ABCDEFGHJKLM: 3 } });
  const r = await checkSignup(g, { code: "ABCDEFGHJKLM" });
  assert.equal(r.ok, true);
  assert.equal(r.burned, undefined);
  assert.equal(g.codes.ABCDEFGHJKLM, 3);
});

// ------------------------------------------------------------- codes

test("a code normalizes past case and separators", () => {
  const want = "ABCDEFGHJKLM";
  for (const v of ["ABCD-EFGH-JKLM", "abcd-efgh-jklm", "ABCDEFGHJKLM", "abcd efgh jklm", "ABCD.EFGH-JKLM"]) {
    assert.equal(normalizeCode(v), want, v);
  }
});

test("a code that could not be one is null", () => {
  for (const v of [undefined, null, "", "ABCD", "ABCDEFGHJKLMN", "ABCD-EFGH-JKL", 12345]) {
    assert.equal(normalizeCode(v), null, JSON.stringify(v));
  }
});

test("the ambiguous characters are refused, not silently mapped", () => {
  // I and O are not in the alphabet. Accepting them would mean two different
  // strings could name the same code depending on who read it out.
  assert.equal(normalizeCode("ABCDEFGHJKLI"), null);
  assert.equal(normalizeCode("ABCDEFGHJKLO"), null);
  assert.equal(normalizeCode("ABCDEFGHJKL1"), null);
  assert.equal(normalizeCode("ABCDEFGHJKL0"), null);
});

test("a minted code round-trips through its own normalizer", () => {
  for (let i = 0; i < 50; i++) {
    const code = newInviteCode();
    assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/, code);
    assert.equal(normalizeCode(code), code.replace(/-/g, ""), code);
  }
});

test("every byte value maps to a legal character", () => {
  // & 31 over a 32-character alphabet: no value can fall off the end and produce
  // `undefined` in the middle of a code.
  let n = 0;
  const code = newInviteCode(() => Uint8Array.from({ length: 12 }, () => (n++ * 37) % 256));
  assert.equal(normalizeCode(code), code.replace(/-/g, ""));
  assert.ok(!code.includes("undefined"));
});

test("two codes are not the same code", () => {
  const seen = new Set();
  for (let i = 0; i < 200; i++) seen.add(newInviteCode());
  assert.equal(seen.size, 200);
});

// ------------------------------------------------------------- owner options

test("invite options are clamped, never trusted", () => {
  assert.deepEqual(inviteOptions({ uses: 999999, days: 99999 }), { uses: MAX_USES, days: MAX_DAYS, note: "" });
  assert.equal(inviteOptions({ uses: -4 }).uses, 1);
  assert.equal(inviteOptions({ uses: "abc" }).uses, 1);
  assert.equal(inviteOptions({}).uses, 1);
  assert.equal(inviteOptions({}).days, 0, "no expiry unless asked for");
  assert.equal(inviteOptions({ note: "x".repeat(500) }).note.length, 120);
  assert.equal(inviteOptions({ note: null }).note, "");
});

test("a single-use code is the default", () => {
  assert.equal(inviteOptions({}).uses, 1);
});
