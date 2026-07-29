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
import fs from "node:fs";
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

// --------------------------------------------------------- domain allow-list
//
// "Anyone at acme.com" — the shape a team tool actually wants, and orthogonal
// to the three modes.

import { normalizeDomain, normalizeDomains, domainAllowed, MAX_DOMAINS } from "../site-invite.mjs";

test("a domain normalizes past @, case, and stray dots", () => {
  for (const v of ["acme.com", "@acme.com", "ACME.COM", " @Acme.Com ", ".acme.com."]) {
    assert.equal(normalizeDomain(v), "acme.com", JSON.stringify(v));
  }
  assert.equal(normalizeDomain("mail.acme.co.uk"), "mail.acme.co.uk");
});

test("anything that is not a domain is refused", () => {
  // No wildcards: `*.com` reads as a restriction and is not one.
  for (const v of ["", "  ", "acme", "*.acme.com", "ac me.com", "a@b.com", "-acme.com", "acme-.com", null, 7, {}]) {
    assert.equal(normalizeDomain(v), null, JSON.stringify(v));
  }
  assert.equal(normalizeDomain("a".repeat(300) + ".com"), null);
});

test("the list is deduped, normalized and capped", () => {
  assert.deepEqual(normalizeDomains(["acme.com", "@ACME.com", "other.io"]), ["acme.com", "other.io"]);
  assert.deepEqual(normalizeDomains(["acme.com", "nonsense", null]), ["acme.com"]);
  assert.equal(normalizeDomains(Array.from({ length: 50 }, (_, i) => `d${i}.com`)).length, MAX_DOMAINS);
  assert.deepEqual(normalizeDomains(null), []);
});

test("a bare string is not a one-entry list", () => {
  // It arrives as JSON out of `_meta`, so a setting written by hand can be a
  // string. Coercing it would turn a malformed config into a REAL restriction —
  // the site starts refusing everyone outside a domain nobody chose in that
  // form. Empty means the same thing as unset, which is the safe reading.
  assert.deepEqual(normalizeDomains("acme.com"), []);
  assert.deepEqual(normalizeDomains("acme.com,other.io"), [], "and it is not split on commas");
  assert.deepEqual(normalizeDomains({ 0: "acme.com", length: 1 }), [], "nor is an array-like");
});

test("an EMPTY list allows everyone", () => {
  // Opt-in: a site that never configured one must not start refusing its own
  // customers the day this shipped.
  assert.equal(domainAllowed("anyone@anywhere.com", []), true);
  assert.equal(domainAllowed("anyone@anywhere.com", null), true);
});

test("a configured list admits only those domains", () => {
  const list = ["acme.com"];
  assert.equal(domainAllowed("ada@acme.com", list), true);
  assert.equal(domainAllowed("ADA@ACME.COM", list), true);
  assert.equal(domainAllowed("ada@gmail.com", list), false);
  assert.equal(domainAllowed("", list), false);
  assert.equal(domainAllowed("no-at-sign", list), false);
});

test("a subdomain does NOT match, and neither does a lookalike", () => {
  const list = ["acme.com"];
  assert.equal(domainAllowed("ada@mail.acme.com", list), false, "conservative: the owner adds what they meant");
  // The one that matters — a suffix check would admit this.
  assert.equal(domainAllowed("ada@evil-acme.com", list), false);
  assert.equal(domainAllowed("ada@acme.com.attacker.net", list), false);
  // And an address with more than one @ takes the LAST one, as mail does.
  assert.equal(domainAllowed('"a@b"@acme.com', list), true);
});

test("a refused domain does not spend an invite", async () => {
  // An address that can never be admitted must not consume somebody's code on
  // the way to being turned away.
  const g = gate({ mode: "invite", codes: { ABCDEFGHJKLM: 3 } });
  g.domains = async () => ["acme.com"];
  const r = await checkSignup(g, { code: "ABCDEFGHJKLM", email: "ada@gmail.com" });
  assert.equal(r.status, 403);
  assert.equal(r.reason, "domain");
  assert.equal(g.codes.ABCDEFGHJKLM, 3, "untouched");
});

test("the allow-list applies in OPEN mode too", async () => {
  const g = gate({ mode: "open" });
  g.domains = async () => ["acme.com"];
  assert.equal((await checkSignup(g, { email: "ada@gmail.com" })).reason, "domain");
  assert.equal((await checkSignup(g, { email: "ada@acme.com" })).ok, true);
});

test("an unreadable domain list allows everyone rather than nobody", async () => {
  // Same reasoning as the empty list: a storage blip must not lock a site's own
  // customers out of signing up.
  const g = gate({ mode: "open" });
  g.domains = async () => { throw new Error("unreadable"); };
  assert.equal((await checkSignup(g, { email: "ada@gmail.com" })).ok, true);
});

test("a site with no domains dep behaves exactly as before", async () => {
  const g = gate({ mode: "open" });
  assert.equal((await checkSignup(g, { email: "ada@gmail.com" })).ok, true);
});

test("a minted code is STORED in the form redemption looks for", () => {
  // Invite codes had never worked on any site. `newInviteCode()` returns
  // `XXXX-XXXX-XXXX` so it can be read aloud; every redemption path runs
  // `normalizeCode` first, which strips the separators. The mint stored the
  // pretty form, so `burnInvite`'s `WHERE code=?` could never match it.
  //
  // Both halves live in worker.js and the unit tests drive a fake `burn` over
  // already-normalized codes, so nothing spanned the two. Measured live
  // 2026-07-29 — this reads the source, which is the only place the seam shows.
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const i = src.indexOf("const code = newInviteCode()");
  assert.ok(i > 0, "the invite mint moved");
  const mint = src.slice(i, i + 2000);
  assert.match(mint, /const stored = normalizeCode\(code\)/, "the mint must normalize before storing");
  // What matters is what gets BOUND, not that the normalizer is mentioned: the
  // first version of this guard passed with `stored` computed and then ignored,
  // which is precisely the live bug wearing a fix.
  const bound = mint.match(/opt\.days \? \[([a-zA-Z]+),[\s\S]*?\[([a-zA-Z]+),/);
  assert.ok(bound, "could not find the INSERT's bound parameters");
  assert.deepEqual([bound[1], bound[2]], ["stored", "stored"],
    "both INSERT paths must bind the NORMALIZED code, not the grouped one");
  // And redemption still normalizes, or fixing one half would break the other.
  const burn = src.slice(src.indexOf("async function burnInvite"), src.indexOf("async function refundInvite"));
  assert.match(burn, /WHERE code=\?/);
  assert.match(src, /normalizeCode\(code\)/);
});
