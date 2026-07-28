// Telling the owner a booking arrived.
//
// A form is a public endpoint, so "every POST emails the owner" is a mail bomb
// aimed at our own customer with a trigger anyone on the internet can pull. And
// the submission is attacker-controlled text going into an HTML email. Most of
// this file is about those two things.
import { test } from "node:test";
import assert from "node:assert/strict";
import { notifyOwner, shouldNotify, submissionEmail, escapeHtml, MAX_FIELDS, COOLDOWN_MS } from "../site-notify.mjs";

function harness(over = {}) {
  const sent = [];
  const deps = {
    claim: async () => ({ ok: true, owner_uid: "owner-1", missed: 0 }),
    emailOf: async () => "owner@example.com",
    send: async (m) => { sent.push(m); },
    ...over,
  };
  return { deps, sent };
}
const fire = (deps, o = {}) => notifyOwner(deps, {
  slug: "cafe", table: "bookings", access: "collect", method: "POST",
  row: { id: 3, customer_name: "Ada", notes: "window seat" }, ...o,
});

// ───────────────────────────────────────────────────── what is worth an email

test("a form submission is notified", async () => {
  const { deps, sent } = harness();
  const r = await fire(deps);
  assert.equal(r.sent, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "owner@example.com");
  assert.match(sent[0].subject, /bookings on cafe/);
});

test("a member writing their own content is NOT", async () => {
  // A recipe or a post is somebody using the site normally. Mailing the owner
  // about each one is a notification about nothing.
  for (const access of ["user", "feed", "admin", "display"]) {
    const { deps, sent } = harness();
    const r = await fire(deps, { access });
    assert.equal(r.sent, false, access);
    assert.deepEqual(sent, []);
  }
});

test("only a create — not a read, an edit or a delete", async () => {
  for (const method of ["GET", "PATCH", "DELETE", "PUT"]) {
    const { deps, sent } = harness();
    assert.equal((await fire(deps, { method })).sent, false, method);
    assert.deepEqual(sent, []);
  }
  assert.equal(shouldNotify({ access: "collect", method: "post" }), true, "case-insensitive");
  assert.equal(shouldNotify({}), false);
});

// ─────────────────────────────────────────────────────────────── the cooldown

test("the cooldown decides, and it is the DATABASE that decides it", async () => {
  // Per-isolate memory would let every colo send its own copy of the same burst.
  const { deps, sent } = harness({ claim: async () => ({ ok: false }) });
  const r = await fire(deps);
  assert.equal(r.sent, false);
  assert.equal(r.reason, "cooling_down_or_off");
  assert.deepEqual(sent, [], "a hammered form does not become a mail bomb");
});

test("the email says how many were missed while it was quiet", async () => {
  const { deps, sent } = harness({ claim: async () => ({ ok: true, owner_uid: "u", missed: 7 }) });
  await fire(deps);
  assert.match(sent[0].html, /7 more since/);
});

test("nothing is claimed for something that was never going to be sent", async () => {
  // The cheap check comes first: a read must not cost a database write.
  let claims = 0;
  const { deps } = harness({ claim: async () => { claims++; return { ok: true, owner_uid: "u" }; } });
  await fire(deps, { method: "GET" });
  await fire(deps, { access: "display" });
  assert.equal(claims, 0);
});

// ────────────────────────────────────────────── it must never break the submit

test("a failure anywhere is reported, never thrown", async () => {
  // The booking already succeeded. A broken mailer must not look like a broken
  // form — and this runs detached, so a throw would vanish instead of logging.
  const cases = [
    ["claim_failed", { claim: async () => { throw new Error("supabase down"); } }],
    ["lookup_failed", { emailOf: async () => { throw new Error("gotrue down"); } }],
    ["send_failed", { send: async () => { throw new Error("mailer 429"); } }],
    ["no_address", { emailOf: async () => null }],
  ];
  for (const [reason, over] of cases) {
    const { deps } = harness(over);
    const r = await fire(deps);          // must not reject
    assert.equal(r.sent, false, reason);
    assert.equal(r.reason, reason);
  }
});

// ──────────────────────────────────────────────────────── the email's content

test("submitted text cannot inject HTML into the owner's inbox", async () => {
  // Same class as the CSV injection, same discipline.
  const { deps, sent } = harness();
  await fire(deps, { row: {
    customer_name: '<script>alert(1)</script>',
    notes: '<img src=x onerror=alert(1)>',
    "<b>key</b>": "x",
  } });
  const html = sent[0].html;
  // The test is whether a TAG survives, not whether a scary substring does:
  // "onerror=" is harmless as literal text inside &lt;img …&gt;, and asserting
  // on it instead would fail on correctly-escaped output.
  assert.ok(!html.includes("<script"), html);
  assert.ok(!html.includes("<img"), html);
  assert.ok(!html.includes("<b>key</b>"), "the KEY is escaped too, not just the value");
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;b&gt;key/);
  // Nothing from the row may introduce a tag at all: every < in the output
  // belongs to markup we wrote.
  const ourTags = html.replace(/<\/?(p|table|tr|td|a|strong)\b[^>]*>/g, "");
  assert.ok(!ourTags.includes("<"), ourTags);
});

test("escaping covers quotes as well as brackets", () => {
  assert.equal(escapeHtml(`<a href="x" onclick='y'>&</a>`),
    "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;");
  assert.equal(escapeHtml(null), "");
  assert.equal(escapeHtml(undefined), "");
});

test("the subject cannot be smuggled a newline", async () => {
  // A newline in a subject is header injection in some mailers.
  const { deps, sent } = harness();
  await fire(deps, { table: "bookings" });
  assert.ok(!/[\r\n]/.test(sent[0].subject), JSON.stringify(sent[0].subject));
});

test("a form with many fields does not become a wall", async () => {
  const row = {};
  for (let i = 0; i < 40; i++) row["field_" + i] = "v" + i;
  const { deps, sent } = harness();
  await fire(deps, { row });
  const shown = (sent[0].html.match(/<tr>/g) || []).length;
  assert.equal(shown, MAX_FIELDS);
});

test("a very long value is truncated", async () => {
  const { deps, sent } = harness();
  await fire(deps, { row: { notes: "x".repeat(5000) } });
  assert.ok(sent[0].html.length < 2000, "length " + sent[0].html.length);
  assert.match(sent[0].html, /…/);
});

test("internal columns are not shown to the owner as fields", async () => {
  // Asserted on the VALUES, with distinctive ones. The key is rendered through
  // replace(/_/g," "), so `_fts` displays as " fts" and `owner_id` as "owner id"
  // — looking for the literal column name would never have fired, which is what
  // a mutation run caught this test doing.
  const { deps, sent } = harness();
  await fire(deps, { row: { id: 9, _fts: "SEARCHVECTOR", owner_id: "OWNERSTAMP", customer_name: "Ada" } });
  const html = sent[0].html;
  assert.ok(!html.includes("SEARCHVECTOR"), html);
  assert.ok(!html.includes("OWNERSTAMP"), html);
  assert.ok(!/\bfts\b/.test(html), html);
  assert.ok(!/owner id/.test(html), html);
  assert.equal((html.match(/<tr>/g) || []).length, 1, "only the one real field");
  assert.match(html, /Ada/);
});

test("an object value is readable, not [object Object]", async () => {
  const { deps, sent } = harness();
  await fire(deps, { row: { extras: { towel: true } } });
  assert.match(sent[0].html, /towel/);
});

test("the email says how to turn it off", async () => {
  // Unsolicited mail with no off switch is not something to ship.
  const { deps, sent } = harness();
  await fire(deps);
  assert.match(sent[0].html, /turn these off/i);
});

test("an empty row still produces a sane email", async () => {
  const { deps, sent } = harness();
  await fire(deps, { row: {} });
  assert.equal(sent.length, 1);
  assert.match(sent[0].html, /submitted your/);
});

test("the cooldown is a real span, not zero", () => {
  assert.ok(COOLDOWN_MS >= 60_000, String(COOLDOWN_MS));
});

test("the email names the site and the form in words a person reads", () => {
  const { subject, html } = submissionEmail({ slug: "sharp-fade", table: "table_bookings", row: {} });
  assert.equal(subject, "New table bookings on sharp-fade", "underscores are not shown to a person");
  assert.match(html, /sharp-fade/);
});
