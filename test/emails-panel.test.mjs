// The Emails panel (audit A12-4, 2026-10-22).
//
// It told an owner to paste a key "named e.g. RESEND_KEY" and that the builder
// "wires the send as an edge function", and promised welcome emails on signup.
// Every site sender refuses without EMAIL_FROM, which it never mentioned; only
// the exact names RESEND_KEY, SENDGRID_KEY and POSTMARK_KEY are read; there
// are no edge functions and no signup mail. The panel is now a checklist read
// from the site's Secrets listing (names only).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { MAIL_PROVIDERS, recipient } from "../site-mail.mjs";
import { runJob } from "../site-jobs.mjs";

const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const start = chat.indexOf("const MAIL_KEY_NAMES");
const end = chat.indexOf("// Payments — sell through the owner");
assert.ok(start > 0 && end > start, "the Emails panel's landmarks moved — retarget this test");
const panelSrc = chat.slice(start, end);

// Runs the real panel code against a minimal page and a stubbed secrets read.
async function render(secretNames, { ok = true } = {}) {
  const els = {};
  const node = () => ({ innerHTML: "", onclick: null, addEventListener() {}, remove() {}, querySelector(sel) { return (els[sel] ||= node()); } });
  const fetched = [];
  const ctx = {
    document: { getElementById: () => null, createElement: () => node(), body: { appendChild() {} } },
    apiFetch: async (u) => { fetched.push(u); return { ok, json: async () => ({ secrets: secretNames.map((name) => ({ name })) }) }; },
    sbToast() {},
  };
  vm.createContext(ctx);
  vm.runInContext(panelSrc + "\nsiteEmails({ slug: 'kiln-coffee' });", ctx);
  for (let i = 0; i < 10; i++) await new Promise((r) => setImmediate(r));
  return { html: els["#emailState"].innerHTML, fetched };
}

test("the panel names exactly the keys the senders read, and EMAIL_FROM", async () => {
  assert.deepEqual(JSON.parse(vm.runInNewContext(panelSrc + ";JSON.stringify(MAIL_KEY_NAMES)")), MAIL_PROVIDERS.map((p) => p.secret));
  const { html, fetched } = await render([]);
  assert.deepEqual(fetched, ["/api/site/kiln-coffee/secrets"]);
  for (const n of ["RESEND_KEY", "SENDGRID_KEY", "POSTMARK_KEY", "EMAIL_FROM"]) assert.ok(html.includes("<code>" + n + "</code>"), n);
  assert.match(html, /named exactly/);
  assert.match(html, /verified with that provider/);
});

test("a key without EMAIL_FROM says nothing is being sent, and which half is missing", async () => {
  const { html } = await render(["RESEND_KEY", "STRIPE_SECRET_KEY"]);
  assert.match(html, /Nothing is being sent yet: <code>EMAIL_FROM<\/code> is missing/);
  assert.match(html, /em-done[^]*Resend/);
  assert.doesNotMatch(html, /Ready/);
});

test("both halves read as ready; a failed read is said, not drawn empty", async () => {
  const both = await render(["SENDGRID_KEY", "EMAIL_FROM"]);
  assert.match(both.html, /Ready — your site sends email through SendGrid/);
  assert.equal((both.html.match(/em-step em-done/g) || []).length, 2);
  const failed = await render([], { ok: false });
  assert.match(failed.html, /Couldn’t check your email setup/);
});

test("no promise the platform does not keep", () => {
  for (const gone of [/edge function/i, /welcome email/i, /on signup/i, /e\.g\. <code>RESEND_KEY/]) assert.doesNotMatch(panelSrc, gone);
});

test("a job whose key is there and EMAIL_FROM is not names EMAIL_FROM", async () => {
  const JOB = { name: "remind", spec: { fn: "due_tomorrow" }, schedule_minutes: 1440, slug: "barber", last_run: null };
  const out = await runJob({
    stamp: async () => {},
    recipient,
    callFn: async () => [{ to: "ada@example.com", subject: "Tomorrow at 2pm", body: "<p>See you then.</p>" }],
    credentials: async () => ({ missing: "EMAIL_FROM" }),
    send: async () => assert.fail("nothing may send"),
  }, JOB);
  assert.equal(out.sent, 0);
  assert.match(out.reason, /EMAIL_FROM/);
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(worker, /if \(!String\(secrets\.EMAIL_FROM \|\| ""\)\.trim\(\)\) return \{ missing: "EMAIL_FROM" \};/);
});
