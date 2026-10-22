// The new row's id, found on the server (audit A12-2, A30-1, 2026-10-22).
//
// The kit's insert asks for nothing back (a collect table has no SELECT), so
// PostgREST answers 201 with an empty body and the proxy handed the senders the
// visitor's own fields, with no id. `confirm:{fn}` and `sms:{fn}` refused every
// time ("no row id to build from") and a webhook's data never carried the id.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { resolveCreatedRow, storedRowQuery, sanitizeMailHtml, runRowEffects } from "../site-row-effects.mjs";
import { sendConfirmation } from "../site-mail.mjs";
import { sendSms } from "../site-sms.mjs";

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const DEF = { name: "bookings", access: "collect", columns: ["who", "email", { name: "slot" }, "mobile"],
  confirm: { fn: "confirm_booking" }, sms: { fn: "text_booking" }, webhooks: ["created"] };

// A stand-in for the owner connection: one stored row, matched the way the SQL asks.
const ownerDb = (stored) => async (sql, params) => {
  const cols = [...sql.matchAll(/"([a-z_0-9]+)" = \?/g)].map((m) => m[1]);
  assert.match(sql, /^SELECT \* FROM "bookings" WHERE .* ORDER BY id DESC LIMIT 1$/);
  return cols.every((c, i) => String(stored[c]) === params[i]) ? [stored] : [];
};

test("an empty 201 resolves to the stored row, id included", async () => {
  const stored = { id: 91, who: "Ada", email: "ada@example.com", slot: "2026-11-01 10:00", mobile: "+447700900123", status: "new" };
  const row = await resolveCreatedRow({ def: DEF, body: "", sent: JSON.stringify({ who: "Ada", email: "ada@example.com", slot: "2026-11-01 10:00", mobile: "+447700900123" }), lookup: ownerDb(stored) });
  assert.equal(row.id, 91);
  assert.equal(row.status, "new", "the stored defaults come with it");
});

test("the function forms send, through the real proxy flow", async () => {
  const stored = { id: 91, who: "Ada", email: "ada@example.com", slot: "s1", mobile: "+447700900123" };
  const row = await resolveCreatedRow({ def: DEF, body: "", sent: JSON.stringify({ who: "Ada", email: "ada@example.com", slot: "s1", mobile: "+447700900123" }), lookup: ownerDb(stored) });
  const mails = [], texts = [], hooks = [];
  const fnIds = [];
  const mail = await sendConfirmation({
    loadSecrets: async () => ({ RESEND_KEY: "re_x", EMAIL_FROM: "hi@barber.example" }),
    send: async (m) => { mails.push(m); return { ok: true, status: 200 }; },
    callFn: async (name, id) => { fnIds.push([name, id]); return { to: "ada@example.com", subject: "Booked", body: "<p>See you</p>" }; },
  }, { def: DEF, row, slug: "s" });
  assert.equal(mail.sent, true, JSON.stringify(mail));
  const sms = await sendSms({
    loadSecrets: async () => ({ TWILIO_SID: "AC1", TWILIO_TOKEN: "t", SMS_FROM: "+447700900000" }),
    send: async (m) => { texts.push(m); return { ok: true, status: 201 }; },
    callFn: async (name, id) => { fnIds.push([name, id]); return { to: "+447700900123", body: "Booked" }; },
  }, { def: DEF, row, slug: "s" });
  assert.notEqual(sms.reason, "no row id to build from");
  assert.deepEqual(fnIds.slice(0, 2), [["confirm_booking", 91], ["text_booking", 91]]);
  runRowEffects({ notify() {}, confirm() {}, sms() {}, webhook: (a, r) => hooks.push(r) }, { def: DEF, action: "created", row, submission: true });
  assert.equal(hooks[0].id, 91, "the webhook's data carries the row id");
});

test("what was sent is matched only on declared scalar columns", () => {
  const q = storedRowQuery(DEF, { who: "Ada", id: 5, owner_id: "x", "slot; drop": "y", email: null, mobile: { a: 1 } });
  assert.equal(q.sql, 'SELECT * FROM "bookings" WHERE "who" = ? AND "email" IS NULL ORDER BY id DESC LIMIT 1');
  assert.deepEqual(q.params, ["Ada"]);
  assert.equal(storedRowQuery(DEF, { nothing: 1 }), null);
  assert.equal(storedRowQuery(DEF, [{ who: "a" }]), null);
});

test("a lookup that fails or finds nothing falls back to what was sent", async () => {
  const sent = JSON.stringify({ who: "Ada" });
  assert.deepEqual(await resolveCreatedRow({ def: DEF, body: "", sent, lookup: async () => { throw new Error("down"); } }), { who: "Ada" });
  assert.deepEqual(await resolveCreatedRow({ def: DEF, body: "", sent, lookup: async () => [] }), { who: "Ada" });
  // A representation the caller asked for, with its id, is used as it is.
  assert.deepEqual(await resolveCreatedRow({ def: DEF, body: '[{"id":3,"who":"Ada"}]', sent, lookup: async () => assert.fail("no lookup needed") }), { id: 3, who: "Ada" });
});

test("the proxy resolves a created row on the owner connection", () => {
  const at = worker.indexOf("async function proxySiteService(");
  const proxy = worker.slice(at, worker.indexOf("\n// ── Cloudflare for SaaS", at));
  assert.match(proxy, /action === "created"\) \{[\s\S]{0,600}?row = await resolveCreatedRow\(\{ def, body, sent, lookup: \(q, p\) => sqlQuery\(db, q, p\) \}\);/);
});

test("a function-form body is sanitised: no scripts, attributes or links", async () => {
  assert.equal(sanitizeMailHtml('<p onclick="x">Hi &amp; <b>Ann</b></p><script>alert(1)</script><a href="http://e">link</a> 1<2 <img src=x>'),
    "<p>Hi &amp; <b>Ann</b></p>link 1&lt;2 ");
  const mails = [];
  await sendConfirmation({
    loadSecrets: async () => ({ RESEND_KEY: "re_x", EMAIL_FROM: "hi@barber.example" }),
    send: async (m) => { mails.push(m); return { ok: true, status: 200 }; },
    callFn: async () => ({ to: "ada@example.com", subject: "s", body: '<p>Thanks <a href="https://evil.example">claim</a></p><style>p{}</style>' }),
  }, { def: DEF, row: { id: 1 }, slug: "s" });
  assert.equal(mails[0].html, "<p>Thanks claim</p>");
});
