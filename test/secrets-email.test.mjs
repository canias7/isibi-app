// Email setup lives in the Secrets panel (audit A12-4, 2026-10-22).
//
// The Emails card told an owner to paste a key "named e.g. RESEND_KEY", said the
// builder "wires the send as an edge function", promised welcome emails on
// signup and order receipts, and never named EMAIL_FROM, which every site
// sender requires. The owner: "all the keys go into the secrets, so you can
// delete the emails box". So the card is gone, and the Secrets panel says the
// exact names and whether the pair is complete, from the secret NAMES only.
//
// 2026-10-29: the platform's own mail sender went (the site agent writes a
// site's sending as its own server code), and the Secrets panel's mail line
// with it. What stays true is that the Emails card is gone.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");

test("the Emails card, its opener and its panel are gone", () => {
  assert.doesNotMatch(chat, /function siteEmails\b/);
  assert.doesNotMatch(chat, /'Emails', 'Send email/);
  assert.doesNotMatch(chat, /dataset\.cloud === 'emails'/);
  assert.doesNotMatch(chat, /siteEmailModal/);
  for (const gone of [/wires the send as an edge function/i, /welcome email on signup/i, /name it e\.g\. <code>RESEND_KEY/]) assert.doesNotMatch(chat, gone);
});
