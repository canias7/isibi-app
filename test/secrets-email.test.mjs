// Email setup lives in the Secrets panel (audit A12-4, 2026-10-22).
//
// The Emails card told an owner to paste a key "named e.g. RESEND_KEY", said the
// builder "wires the send as an edge function", promised welcome emails on
// signup and order receipts, and never named EMAIL_FROM, which every site
// sender requires. The owner: "all the keys go into the secrets, so you can
// delete the emails box". So the card is gone, and the Secrets panel says the
// exact names and whether the pair is complete, from the secret NAMES only.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { MAIL_PROVIDERS, recipient } from "../site-mail.mjs";
import { runJob } from "../site-jobs.mjs";

const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const start = chat.indexOf("const MAIL_KEY_NAMES");
const end = chat.indexOf("// Secrets — encrypted per-site vault.");
assert.ok(start > 0 && end > start, "the email line's landmarks moved — retarget this test");
const src = chat.slice(start, end);
const line = (names) => vm.runInNewContext(src + ";mailLine(" + JSON.stringify(names) + ")");

test("the Emails card, its opener and its panel are gone", () => {
  assert.doesNotMatch(chat, /function siteEmails\b/);
  assert.doesNotMatch(chat, /'Emails', 'Send email/);
  assert.doesNotMatch(chat, /dataset\.cloud === 'emails'/);
  assert.doesNotMatch(chat, /siteEmailModal/);
  for (const gone of [/wires the send as an edge function/i, /welcome email on signup/i, /name it e\.g\. <code>RESEND_KEY/]) assert.doesNotMatch(chat, gone);
});

test("the line names exactly the keys the senders read, and EMAIL_FROM", () => {
  assert.deepEqual(JSON.parse(vm.runInNewContext(src + ";JSON.stringify(MAIL_KEY_NAMES)")), MAIL_PROVIDERS.map((p) => p.secret));
  const html = line([]);
  for (const n of ["RESEND_KEY", "SENDGRID_KEY", "POSTMARK_KEY", "EMAIL_FROM"]) assert.ok(html.includes("<code>" + n + "</code>"), n);
  assert.match(html, /named exactly/);
  assert.match(html, /verified with that provider/);
});

test("the pair's state comes from the names: complete, key only, from only", () => {
  assert.match(line(["SENDGRID_KEY", "EMAIL_FROM", "STRIPE_SECRET_KEY"]), /Email is set up: <code>SENDGRID_KEY<\/code> and <code>EMAIL_FROM<\/code>/);
  assert.match(line(["RESEND_KEY"]), /<code>RESEND_KEY<\/code> is here but <code>EMAIL_FROM<\/code> is missing/);
  assert.match(line(["EMAIL_FROM"]), /no provider key is/);
  assert.doesNotMatch(line(["RESEND_API_KEY", "EMAIL_FROM"]), /set up/, "a key under another name is not read");
});

test("the Secrets panel shows the line from its own listing", () => {
  const at = chat.indexOf("async function siteSecrets(site)");
  const panel = chat.slice(at, chat.indexOf("\n}\n", at));
  assert.match(panel, /<div id="skMail"><\/div>/);
  assert.match(panel, /mailEl\.innerHTML = r\.ok \? mailLine\(secs\.map\(\(x\) => x && String\(x\.name \|\| ''\)\)\) : '';/);
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
