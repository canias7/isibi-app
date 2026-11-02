// WHICH SERVICE (owner, 2026-11-01): "the user said email and the model assumed
// it was Resend". The agent never picks the provider: it asks, or says it must.
import test from "node:test";
import assert from "node:assert/strict";
import { SERVER_RULES } from "../builder/site-agent.mjs";
import { DOCS_HOSTS, docsAllowed } from "../builder/agent-server-tools.mjs";

test("PC1 the rules forbid choosing a provider and say to ask with ask_owner", () => {
  const r = SERVER_RULES.replace(/\s+/g, " ");
  assert.match(r, /Never choose the provider yourself/);
  assert.match(r, /names only a kind of service/);
  assert.match(r, /when ask_owner is offered, CALL ask_owner to ask which one they use before you write its code or request its key/);
  assert.match(r, /ASK WITH ask_owner, NEVER IN finish/);
  assert.match(r, /When ask_owner is not offered, write no provider's code and request no key/);
  for (const p of ["Resend", "SendGrid", "Mailgun", "Postmark", "PayPal", "Square", "Vonage"]) assert.ok(r.includes(p), p);
});

test("PC2 the docs it may read cover every email and payment provider offered", () => {
  for (const u of ["https://resend.com/docs/x", "https://www.twilio.com/docs/sendgrid/x", "https://documentation.mailgun.com/x", "https://postmarkapp.com/developer/x", "https://developer.paypal.com/docs/x", "https://developer.squareup.com/docs/x", "https://developer.vonage.com/x"]) assert.ok(docsAllowed(u).ok, u);
  assert.ok(!docsAllowed("https://postmarkapp.com/pricing").ok, "only the developer docs");
  assert.ok(DOCS_HOSTS.length >= 14);
});
