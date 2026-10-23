// Audit A30-6: the visitor-write hooks ask the table's resolved pair, never the
// stored preset name. `applySiteSchema` stamps `access: "collect"` on every
// pair-declared table, so the raw string called a member-written table a
// public form, and a table anyone may write under another preset not one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { shouldNotify } from "../site-notify.mjs";
import { sendConfirmation } from "../site-mail.mjs";
import { sendSms } from "../site-sms.mjs";

// (a) a marketplace's listings, stamped `collect`, written by members only.
const MEMBERS = { name: "listings", access: "collect", read: "public", write: "own" };
// (b) a guestbook declared `display` with `write: "anyone"`: strangers post.
const GUESTBOOK = { name: "guestbook", access: "display", write: "anyone" };
const COLLECT = { name: "bookings", access: "collect" };

test("the owner is emailed for a table anyone may write, whatever its preset name says", () => {
  assert.equal(shouldNotify({ access: MEMBERS, method: "POST" }), false, "a member's own post mailed the owner");
  assert.equal(shouldNotify({ access: GUESTBOOK, method: "POST" }), true, "a stranger's post was not told");
  assert.equal(shouldNotify({ access: COLLECT, method: "POST" }), true);
  assert.equal(shouldNotify({ access: "collect", method: "POST" }), true, "a preset name still reads");
  assert.equal(shouldNotify({ access: "user", method: "POST" }), false);
});

test("the confirmation and the text are refused for a member-written table before anything else", async () => {
  for (const send of [sendConfirmation, sendSms]) {
    const out = await send({}, { def: { ...MEMBERS, confirm: { to: "email" }, sms: { to: "phone" } }, row: {}, slug: "s" });
    assert.equal(out.reason, "not a collect table", send.name);
    const open = await send({}, { def: GUESTBOOK, row: {}, slug: "s" });
    assert.notEqual(open.reason, "not a collect table", send.name + " refused a table anyone may write");
  }
});
