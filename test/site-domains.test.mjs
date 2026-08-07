import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  normalizeHostname, isOwnHostname, claimRefusal, isApex, dnsInstructions, readStatus, OWN_ZONES,
} from "../site-domains.mjs";

// ------------------------------------------------- what a hostname reduces to

test("what people actually paste is accepted", () => {
  for (const [given, want] of [
    ["sharpfadebarbers.com", "sharpfadebarbers.com"],
    ["  SharpFadeBarbers.COM  ", "sharpfadebarbers.com"],
    ["https://sharpfadebarbers.com", "sharpfadebarbers.com"],
    ["http://www.sharpfadebarbers.com/book?x=1", "www.sharpfadebarbers.com"],
    ["sharpfadebarbers.com.", "sharpfadebarbers.com"],
    ["sharpfadebarbers.com:443", "sharpfadebarbers.com"],
    ["shop.sharpfadebarbers.co.uk", "shop.sharpfadebarbers.co.uk"],
    ["xn--caf-dma.com", "xn--caf-dma.com"],
    ["a-b-c.example.org", "a-b-c.example.org"],
  ]) {
    assert.equal(normalizeHostname(given), want, JSON.stringify(given));
  }
});

test("anything that is not one ordinary hostname is REFUSED, not repaired", () => {
  // This value becomes a routing key. A guess about what somebody meant is a
  // guess about whose traffic goes where.
  for (const bad of [
    "", " ", null, undefined, 4, {},
    "localhost", "myserver",                     // single label / reserved
    "example.test", "thing.local", "x.invalid",  // reserved TLDs
    "192.168.0.1", "8.8.8.8",                    // an address is not a name
    "*.example.com", "*.com",                    // wildcards
    "user@example.com", "https://u:p@x.com",     // credentials in the authority
    "example.com:8080",                          // a port we cannot serve
    "-example.com", "example-.com", "ex..com",   // malformed labels
    "café.com",                                  // unicode must be punycode
    "a".repeat(64) + ".com",                     // label over 63
    ("a".repeat(60) + ".").repeat(5) + "com",    // name over 253
  ]) {
    assert.equal(normalizeHostname(bad), null, JSON.stringify(bad));
  }
});

test("a hostname exactly at the limits is allowed", () => {
  // An off-by-one here refuses real domains, which is the failure nobody
  // reports because they assume they typed it wrong.
  assert.equal(normalizeHostname("a".repeat(63) + ".com"), "a".repeat(63) + ".com");
  const long = ("a".repeat(49) + ".").repeat(5) + "com";       // 253 exactly
  assert.equal(long.length, 253);
  assert.equal(normalizeHostname(long), long);
});

// ------------------------------------------- the check the platform rests on

test("NOBODY may claim one of our own names", () => {
  // Requests are routed by Host. A stored row saying `gofarther.dev → a-slug`
  // serves a stranger's site in place of the entire platform: the app, the
  // sign-in page, every API route.
  for (const ours of [
    "gofarther.dev", "www.gofarther.dev", "GoFarther.dev", "https://gofarther.dev/",
    "api.gofarther.dev", "anything.at.all.gofarther.dev", "gofarther.dev.",
  ]) {
    assert.equal(isOwnHostname(normalizeHostname(ours)), true, ours);
    assert.ok(claimRefusal(ours), ours);
  }
});

test("…and a name that merely LOOKS like ours stays claimable", () => {
  // `endsWith("gofarther.dev")` without the dot would steal these from their
  // real owners, and the suffix check is the whole mechanism.
  for (const theirs of ["notgofarther.dev", "mygofarther.dev", "gofarther.dev.evil.com", "gofarther.devious.com"]) {
    const h = normalizeHostname(theirs);
    assert.ok(h, theirs);
    assert.equal(isOwnHostname(h), false, theirs);
    assert.equal(claimRefusal(theirs), null, theirs);
  }
});

test("every zone in the list is protected, not just the first", () => {
  // Derived, so adding a second zone cannot leave it unguarded.
  for (const z of OWN_ZONES) {
    assert.equal(isOwnHostname(z), true, z);
    assert.equal(isOwnHostname("www." + z), true, z);
    assert.equal(isOwnHostname("x" + z), false, z);
  }
});

test("a refusal says something the owner can act on", () => {
  assert.match(claimRefusal("not a domain"), /domain/i);
  assert.match(claimRefusal("gofarther.dev"), /platform/i);
  assert.equal(claimRefusal("sharpfadebarbers.com"), null);
});

// ----------------------------------------------------- what the owner must do

test("apex and subdomain are told apart, because the instruction differs", () => {
  assert.equal(isApex("example.com"), true);
  assert.equal(isApex("www.example.com"), false);
  assert.equal(isApex("shop.eu.example.com"), false);
});

test("the apex instruction names the thing that actually blocks people", () => {
  // A plain CNAME is illegal at a zone apex, so an owner whose provider has no
  // ALIAS/ANAME/flattening cannot do what a naive instruction tells them to.
  const a = dnsInstructions("example.com", "saas.gofarther.dev");
  assert.equal(a.apex, true);
  assert.equal(a.records[0].name, "@");
  assert.equal(a.records[0].value, "saas.gofarther.dev");
  assert.match(a.records[0].note, /ALIAS|ANAME|flatten/i);
  assert.match(a.records[0].note, /www/, "and offers the way out");

  const s = dnsInstructions("www.example.com", "saas.gofarther.dev");
  assert.equal(s.apex, false);
  assert.equal(s.records[0].name, "www");
  assert.ok(!/ALIAS/i.test(s.records[0].note), "a subdomain needs none of that");
});

test("the record name is the subdomain part, however deep", () => {
  assert.equal(dnsInstructions("shop.eu.example.com", "t").records[0].name, "shop.eu");
});

test("instructions are DATA, not prose", () => {
  // The owner is about to type this into a form on another website; a
  // paragraph is the wrong shape to copy from.
  const d = dnsInstructions("www.example.com", "saas.gofarther.dev");
  assert.equal(typeof d.records[0].kind, "string");
  assert.equal(typeof d.records[0].name, "string");
  assert.equal(typeof d.records[0].value, "string");
});

// ---------------------------------------------------------------- the status

test("live means BOTH halves, because either alone serves nothing", () => {
  assert.equal(readStatus({ status: "active", ssl: { status: "active" } }).live, true);
  // Verified with no certificate serves nothing…
  assert.equal(readStatus({ status: "active", ssl: { status: "pending_validation" } }).live, false);
  // …and a certificate while DNS points elsewhere also serves nothing.
  assert.equal(readStatus({ status: "pending", ssl: { status: "active" } }).live, false);
});

test("the stage names which half is stuck", () => {
  // An owner shown one number cannot tell which of two independent things to
  // go and fix.
  assert.equal(readStatus({ status: "pending", ssl: { status: "initializing" } }).stage, "waiting for DNS");
  assert.equal(readStatus({ status: "active", ssl: { status: "pending_validation" } }).stage, "issuing the certificate");
  assert.equal(readStatus({ status: "active", ssl: { status: "active" } }).stage, "live");
});

test("pending is NOT failure, and only two things are", () => {
  // Issuing routinely takes minutes and longer while DNS propagates. Calling
  // that failed sends owners to delete and re-add, which restarts the clock.
  for (const s of ["pending", "pending_validation", "initializing", "pending_deployment", "unknown", ""]) {
    assert.equal(readStatus({ status: s, ssl: { status: s } }).failed, false, s);
  }
  assert.equal(readStatus({ status: "moved", ssl: {} }).failed, true);
  assert.equal(readStatus({ status: "deleted", ssl: {} }).failed, true);
  assert.equal(readStatus({ status: "active", ssl: { status: "timing_out" } }).failed, true);
});

test("the records still outstanding are handed over, and only while they are", () => {
  const rec = {
    status: "pending",
    ownership_verification: { type: "txt", name: "_cf-custom-hostname.example.com", value: "abc" },
    ssl: { status: "pending_validation", validation_records: [{ txt_name: "_acme-challenge.example.com", txt_value: "xyz" }] },
  };
  const r = readStatus(rec);
  assert.equal(r.pending.length, 2);
  assert.deepEqual(r.pending[0], { kind: "TXT", name: "_cf-custom-hostname.example.com", value: "abc" });
  assert.equal(r.pending[1].value, "xyz");
  // Once it is live there is nothing left for the owner to add, and showing
  // spent records reads as work outstanding.
  assert.equal(readStatus({ ...rec, status: "active", ssl: { status: "active" } }).pending.length, 0);
});

test("readStatus survives anything a provider sends", () => {
  for (const junk of [null, undefined, {}, { ssl: null }, { ssl: "no" }, { ssl: { validation_records: "no" } }, 4, []]) {
    const r = readStatus(junk);
    assert.equal(r.live, false, JSON.stringify(junk));
    assert.ok(Array.isArray(r.pending));
    assert.equal(typeof r.stage, "string");
  }
});

// ------------------------------------------------------------------- wiring

test("the module is a leaf, like site-access and site-errors", () => {
  // It is read by the request path, so an import here is an import on every
  // visitor request to a custom domain.
  const src = fs.readFileSync(new URL("../site-domains.mjs", import.meta.url), "utf8");
  assert.ok(!/^\s*import\s/m.test(src), "no imports");
});
