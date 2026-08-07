import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { normalizeSms, toE164, fillSms, pickSmsProvider, sendSms, SMS_PROVIDERS, MAX_BODY } from "../site-sms.mjs";

const TABLE = {
  access: "collect",
  columns: [{ name: "who" }, { name: "mobile" }, { name: "slot" }],
  sms: { to: "mobile", body: "Booked for {slot}, {who}." },
};
const ROW = { id: 4, who: "Ada", mobile: "+44 7700 900123", slot: "14:00" };
const KEYS = { TWILIO_SID: "AC123", TWILIO_TOKEN: "tok", SMS_FROM: "+15005550006" };

function deps(over = {}) {
  const sent = [];
  const d = {
    loadSecrets: async () => KEYS,
    send: async (m) => { sent.push(m); return { ok: true, status: 201 }; },
    ...over,
  };
  d.sent = sent;
  return d;
}
const go = (d, over = {}) => sendSms(d, { def: TABLE, row: ROW, slug: "barber", ...over });

// ------------------------------------------------------------------- numbers

test("toE164 accepts a real international number, however it was typed", () => {
  for (const s of ["+447700900123", "+44 7700 900123", "+44 (7700) 900-123", "+44.7700.900123"]) {
    assert.equal(toE164(s), "+447700900123", s);
  }
});

test("toE164 REFUSES anything it would have to guess about", () => {
  // A local number is a different real number in a dozen countries, and a
  // wrong-but-valid number delivers somebody's booking details to a stranger.
  // That is worse than not sending, so nothing is inferred.
  for (const s of ["07700900123", "7700900123", "", null, undefined, "not a number",
    "+44770090012x", "+44 7700 900123 ext 4",
    // TWO NUMBERS THAT WOULD CONCATENATE INTO ONE VALID ONE. Written as
    // `+1 555 0000, +1 555 1111` this passed on LENGTH — twenty digits — so a
    // mutation ADDING the comma to the allowed alphabet survived the whole
    // suite while `+1555000, +1444` would have been sent as `+15550001444`,
    // a real number belonging to a stranger.
    // ISOLATING THE SEPARATOR, which took two attempts. `+1555000, +1444` is
    // refused because of its SECOND `+`, not its comma — so a mutation adding
    // `,` to the allowed alphabet survived that case too. Only a string whose
    // sole illegal character is the separator holds the property, and with the
    // comma allowed this one becomes `+15550001444`: a real number belonging to
    // somebody who never filled in the form.
    "+1555000,1444", "+1555000;1444", "+1555000/1444", "+1555000_1444"]) {
    assert.equal(toE164(s), null, JSON.stringify(s));
  }
});

test("toE164 bounds the length in both directions", () => {
  assert.equal(toE164("+1234567"), null, "7 digits is too short");
  assert.equal(toE164("+12345678"), "+12345678", "8 is the floor");
  assert.equal(toE164("+" + "1".repeat(15)), "+" + "1".repeat(15), "15 is the ceiling");
  assert.equal(toE164("+" + "1".repeat(16)), null, "16 is refused");
});

// -------------------------------------------------------------- declarations

test("the template form resolves against the table's real columns", () => {
  assert.deepEqual(normalizeSms(TABLE), { to: "mobile", body: "Booked for {slot}, {who}." });
});

test("a half-valid declaration is refused rather than half-applied", () => {
  // It would publish a site that looks as though it texts and does not, and
  // nobody finds out until a customer says they never got one.
  const bad = (sms) => normalizeSms({ ...TABLE, sms });
  assert.equal(bad({ to: "no_such_column", body: "hi" }), null, "a column the table lacks");
  assert.equal(bad({ to: "mobile" }), null, "no body");
  assert.equal(bad({ body: "hi" }), null, "no recipient");
  assert.equal(bad({ to: "_secret", body: "hi" }), null, "an internal column");
  assert.equal(normalizeSms({ ...TABLE, sms: null }), null);
  assert.equal(normalizeSms({ ...TABLE, sms: [] }), null, "an array is not a declaration");
});

test("the function form is a name and nothing else", () => {
  assert.deepEqual(normalizeSms({ ...TABLE, sms: { fn: "sms_booking" } }), { fn: "sms_booking" });
  // It wins over the template fields, so a declaration cannot be half of each.
  assert.deepEqual(normalizeSms({ ...TABLE, sms: { fn: "sms_booking", to: "mobile", body: "x" } }), { fn: "sms_booking" });
  for (const fn of ["_private", "9x", "a b", "x".repeat(60), "drop table"]) {
    assert.equal(normalizeSms({ ...TABLE, sms: { fn } }), null, fn);
  }
});

test("fillSms substitutes from the row and never leaves a token behind", () => {
  assert.equal(fillSms("Booked for {slot}, {who}.", ROW), "Booked for 14:00, Ada.");
  assert.equal(fillSms("Hi {nothing}!", ROW), "Hi !");
  assert.equal(fillSms("x".repeat(MAX_BODY + 50), ROW).length, MAX_BODY);
});

// ---------------------------------------------------------------- the sender

test("a declared text is sent through the owner's provider", async () => {
  const d = deps();
  const r = await go(d);
  assert.equal(r.sent, true);
  assert.equal(r.provider, "twilio");
  assert.deepEqual(d.sent[0], {
    provider: "twilio", key: "AC123", secret: "tok",
    from: "+15005550006", to: "+447700900123", body: "Booked for 14:00, Ada.",
  });
});

test("BOTH HALVES of a two-part credential, or that provider is skipped", () => {
  // A SID with no token is not a credential. Picking Twilio anyway means every
  // send fails against an account that looks configured, while a provider
  // further down the list that IS complete never gets tried.
  assert.equal(pickSmsProvider({ TWILIO_SID: "AC1" }), null);
  assert.equal(pickSmsProvider({ TWILIO_SID: "AC1", TWILIO_TOKEN: "  " }), null);
  assert.deepEqual(pickSmsProvider({ TWILIO_SID: "AC1", MESSAGEBIRD_KEY: "mb" }),
    { provider: "messagebird", key: "mb", secret: "" });
  assert.deepEqual(pickSmsProvider({ VONAGE_KEY: "k", VONAGE_SECRET: "s" }),
    { provider: "vonage", key: "k", secret: "s" });
  assert.equal(pickSmsProvider({}), null);
  assert.equal(pickSmsProvider(null), null);
});

test("the provider order is the owner's choice, first configured wins", () => {
  assert.deepEqual(SMS_PROVIDERS.map((p) => p.provider), ["twilio", "messagebird", "vonage"]);
  const all = { ...KEYS, MESSAGEBIRD_KEY: "mb", VONAGE_KEY: "k", VONAGE_SECRET: "s" };
  assert.equal(pickSmsProvider(all).provider, "twilio");
});

test("NEVER THROWS, whatever goes wrong", async () => {
  // The booking already succeeded. A broken SMS account must not be
  // indistinguishable from a broken form.
  for (const over of [
    { loadSecrets: async () => { throw new Error("vault down"); } },
    { send: async () => { throw new Error("network"); } },
    { send: async () => null },
    { send: async () => ({ ok: false, status: 402 }) },
  ]) {
    const r = await go(deps(over));
    assert.equal(r.sent, false, JSON.stringify(Object.keys(over)));
    assert.ok(r.reason);
  }
});

test("a failure reason never quotes the request", async () => {
  // A provider client's error can quote the request, and the request carries
  // the account credential.
  const r = await go(deps({ send: async () => { const e = new Error("POST failed for AC123:tok"); e.name = "TypeError"; throw e; } }));
  assert.equal(r.sent, false);
  assert.ok(!r.reason.includes("AC123") && !r.reason.includes("tok"), r.reason);
});

test("nothing is sent without a provider, and that is not an error", async () => {
  const d = deps({ loadSecrets: async () => ({ SMS_FROM: "+15005550006" }) });
  const r = await go(d);
  assert.equal(r.sent, false);
  assert.equal(r.reason, "no provider key in Secrets");
  assert.equal(d.sent.length, 0);
});

test("the SENDER is the owner's, and ours is never substituted", async () => {
  const d = deps({ loadSecrets: async () => ({ TWILIO_SID: "AC1", TWILIO_TOKEN: "t" }) });
  const r = await go(d);
  assert.equal(r.sent, false);
  assert.match(r.reason, /SMS_FROM/);
  assert.equal(d.sent.length, 0);
});

test("an alphanumeric sender id is allowed where a number is not", async () => {
  // Several countries permit "SHARPFADE" as a sender, and it is what a small
  // business actually wants to appear as.
  const d = deps({ loadSecrets: async () => ({ ...KEYS, SMS_FROM: "SHARPFADE" }) });
  assert.equal((await go(d)).sent, true);
  assert.equal(d.sent[0].from, "SHARPFADE");
  // …but not something that is neither.
  const bad = deps({ loadSecrets: async () => ({ ...KEYS, SMS_FROM: "way too long a name" }) });
  assert.equal((await go(bad)).sent, false);
});

test("a number that cannot be resolved is not sent to", async () => {
  const d = deps();
  const r = await go(d, { row: { ...ROW, mobile: "07700900123" } });
  assert.equal(r.sent, false);
  assert.equal(r.reason, "no usable number");
  assert.equal(d.sent.length, 0);
});

test("`collect` only, matching the mail path", async () => {
  for (const access of ["user", "feed", "display", "admin"]) {
    const r = await go(deps(), { def: { ...TABLE, access } });
    assert.equal(r.sent, false, access);
    assert.equal(r.reason, "not a collect table");
  }
});

test("a model-written builder decides the whole message", async () => {
  const d = deps({ callFn: async (n, id) => ({ to: "+447700900999", body: "Ready, #" + id }) });
  const r = await sendSms(d, { def: { ...TABLE, sms: { fn: "sms_booking" } }, row: ROW, slug: "barber" });
  assert.equal(r.sent, true);
  assert.equal(d.sent[0].to, "+447700900999");
  assert.equal(d.sent[0].body, "Ready, #4");
});

test("a builder's output gets no weaker checking than a template's", async () => {
  // A function returning "+1555…, +1444…" is injection exactly like a form
  // field would be, and a runaway body is a bill on the owner's account.
  const bad = { def: { ...TABLE, sms: { fn: "f" } }, row: ROW, slug: "barber" };
  // Short enough to CONCATENATE into a valid number, so this fails on the
  // separator rather than on length — the assertion that actually holds.
  assert.equal((await sendSms(deps({ callFn: async () => ({ to: "+1555000, +1444", body: "x" }) }), bad)).sent, false);
  assert.equal((await sendSms(deps({ callFn: async () => ({ to: "+447700900123", body: "" }) }), bad)).sent, false);
  assert.equal((await sendSms(deps({ callFn: async () => null }), bad)).sent, false);
  const d = deps({ callFn: async () => ({ to: "+447700900123", body: "y".repeat(MAX_BODY + 200) }) });
  assert.equal((await sendSms(d, bad)).sent, true);
  assert.equal(d.sent[0].body.length, MAX_BODY, "clipped, never sent whole");
});

test("a builder is not called without a row id", async () => {
  let called = 0;
  const d = deps({ callFn: async () => { called++; return { to: "+447700900123", body: "x" }; } });
  const r = await sendSms(d, { def: { ...TABLE, sms: { fn: "f" } }, row: { who: "Ada" }, slug: "barber" });
  assert.equal(r.sent, false);
  assert.equal(called, 0);
});

test("the same number is not texted twice in a row", async () => {
  let seen = false;
  const d = deps({ recentlySent: async () => seen, markSent: async () => { seen = true; } });
  assert.equal((await go(d)).sent, true);
  assert.equal((await go(d)).reason, "cooled down");
  assert.equal(d.sent.length, 1);
});

// ------------------------------------------------------------------- wiring

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const schema = fs.readFileSync(new URL("../site-schema.mjs", import.meta.url), "utf8");
const has = (src, re, why) => assert.ok(re.test(src), why);

test("it is on the insert path, beside the email", () => {
  has(worker, /smsSubmitter\(env, ctx, \{ slug, db, def, row/, "called on a successful POST");
  has(worker, /function smsSubmitter\(/, "and defined");
  // Independent of the mail: one provider being misconfigured must not take the
  // other with it.
  const i = worker.indexOf("confirmSubmitter(env, ctx, { slug, db, def, row");
  const j = worker.indexOf("smsSubmitter(env, ctx, { slug, db, def, row");
  assert.ok(i > 0 && j > i, "both fire, in that order");
});

test("the cooldown ledgers are SEPARATE", () => {
  // Keyed by recipient — and an address and a phone number are different
  // recipients even for the same person. Shared, an emailed confirmation would
  // suppress the text that was the reason for declaring both.
  has(worker, /const smsSeen = new Map\(\)/, "its own map");
  const i = worker.indexOf("function smsSubmitter(");
  const fn = worker.slice(i, i + 3000);
  assert.ok(/smsSeen\.get\(k\)/.test(fn), "and the sms path uses it");
  assert.ok(!/confirmSeen/.test(fn), "never the mail one");
});

test("the DESIGNER can declare it, or nothing ever sends", () => {
  const i = worker.indexOf("            sms: {");
  assert.ok(i > 0, "the design_schema field exists");
  const field = worker.slice(i, i + 3000);
  assert.ok(/internal: true/.test(field), "the builder must be internal");
  assert.ok(/international/.test(field), "and the number must be international");
  assert.ok(/costs the owner money/.test(field), "and it is not free");
});

test("a builder a visitor could call is DROPPED, like confirm's", () => {
  // Worse here than for mail: it hands out every customer's number AND spends
  // the owner's balance.
  has(schema, /if \(!t\.sms \|\| !t\.sms\.fn\) continue;/, "the cross-reference runs");
  has(schema, /if \(!f \|\| !f\.internal\) t\.sms = null;/, "and drops a public one");
  has(schema, /sms: normalizeSms\(\{ \.\.\.def, columns: cols \}\)/, "and coerceTable keeps the field at all");
});

test("Vonage's 200-on-failure is not read as success", () => {
  // Its `messages[].status` is "0" for success and an error code otherwise, so
  // the HTTP status alone reports every rejected message as sent.
  const i = worker.indexOf("async function postProviderSms(");
  assert.ok(i > 0);
  const fn = worker.slice(i, i + 2500);
  assert.ok(/String\(first\.status\) === "0"/.test(fn), "the body decides for vonage");
});
