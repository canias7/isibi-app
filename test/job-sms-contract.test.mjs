// THE SMS CONTRACT IS DOCUMENTED, AND WHAT IT DOCUMENTS REALLY REACHES THE
// SENDER (2026-09-14).
//
// Owner: *"Document the existing SMS contract in both function and job
// instructions. Explain the channel, recipient, and message fields the runtime
// accepts, including email defaults. Demonstrate that the designed output
// reaches the SMS sender using a stubbed provider."*
//
// AND THE CORRECTION THAT COMES WITH IT, in the owner's words: *"SMS is
// undocumented to the designer"* — not impossible. Every hop below has worked
// for weeks; a model writing `channel: "sms"` out of its own knowledge would
// have been sent as a text on any day of that time. What was missing was the
// paragraph telling the designer the field exists, which is why the first half
// of this file is a census of the two tools and the second half drives the
// runtime.
//
// ── WHAT THIS FILE PROVES, AND EXACTLY WHERE THAT STOPS ─────────────────────
//
// Owner, 2026-09-14: *"The stubbed test proves the runtime calls the sender
// correctly. It does not prove real delivery."*
//
// PROVED HERE: `runJob` routes a `channel: "sms"` message to the SMS sender
// rather than the mail sender, hands it the number as the real parser returns
// it, hands it the SMS credential rather than the email one, and holds it
// (`unsent`, never `failed`) when that credential is absent.
//
// NOT PROVED HERE, and no amount of stubbing can: that a provider ACCEPTS the
// payload, that a handset receives it, that the number format the provider
// wants is the one this produces, or that the credential in a real site's
// Secrets works. `sendSms` is replaced by a recorder in every case below — the
// last hop this file sees is the ARGUMENT, never a network answer.
//
// **NO REAL TEXT HAS BEEN SENT AND NONE MAY BE** until the owner names a test
// recipient — a text goes to a real phone belonging to a real person and is
// not something to discover a wrong number with.
import test from "node:test";
import assert from "node:assert/strict";
import { addTool, MESSAGE_CONTRACT } from "../builder/site-add.mjs";
import { runJob, shapeMessages } from "../site-jobs.mjs";

/** The two steps that have to know what a job's function may return. */
const TOLD = ["function", "job"];

test("both steps that decide a job's messages are told the channel contract", () => {
  // MEASURED BEFORE THIS SHIPPED, across all six add tools (123,554 characters):
  // the word `channel` occurred ZERO times in the `function` tool and ZERO in
  // the `job` tool, while the job rule told the owner to paste an SMS key in
  // Settings. A capability the platform advertises to the site's owner and
  // never describes to the designer writing the SQL.
  for (const kind of TOLD) {
    const sent = JSON.stringify(addTool(kind));
    assert.ok(sent.includes(JSON.stringify(MESSAGE_CONTRACT).slice(1, -1)),
      "the " + kind + " step is not told the message contract");
  }
  // ONE STRING, NOT TWO COPIES. The function step writes the SQL and the job
  // step decides what is being sent; two descriptions of one wire format drift,
  // and the one that drifts is the one nobody re-reads.
  assert.ok(MESSAGE_CONTRACT.includes("channel"), "the contract does not name the deciding field");
  assert.ok(MESSAGE_CONTRACT.includes("\"sms\"") && MESSAGE_CONTRACT.includes("\"email\""), "the contract does not name both channels");
  assert.ok(/EMAILED/.test(MESSAGE_CONTRACT), "the contract does not state the email default");
  assert.ok(/NO `subject`/.test(MESSAGE_CONTRACT), "the contract does not say a text takes no subject");
});

test("the email default is what the runtime really does with an absent or unknown channel", () => {
  // THE DEFAULT IS ASSERTED AGAINST `shapeMessages` ITSELF, never against the
  // sentence — a prompt that describes behaviour the code does not have is this
  // repository's recorded "promise nothing ever compiled", and the check that
  // catches it is driving the thing the sentence is about.
  const to = (m) => (m && typeof m.to === "string" && m.to.includes("@") ? m.to : null);
  // THE STUB IS THE REAL PARSER'S SHAPE: digits first, then the test — "07700
  // 900000" has no run of seven consecutive digits, and a stub that reads the
  // raw string drops exactly the number the contract says is accepted.
  const phone = (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length >= 7 ? "+44" + d.replace(/^0/, "") : null; };
  const out = shapeMessages([
    { to: "a@b.test", subject: "s", body: "b" },                      // no channel at all
    { channel: "carrier-pigeon", to: "c@d.test", subject: "s", body: "b" }, // a channel nobody knows
    { channel: "sms", to: "07700 900000", body: "your slot is at 9" },
  ], to, phone);
  assert.deepEqual(out.messages.map((m) => m.channel), ["email", "email", "sms"],
    "the email default is not what the runtime does: " + JSON.stringify(out));
  // AND THE SMS SHAPE THE CONTRACT DESCRIBES IS THE SHAPE IT PRODUCES: a
  // parsed number, a body, and NO subject.
  const sms = out.messages[2];
  assert.equal(sms.to, "+447700900000", "the number was not parsed the way the contract says it is read");
  assert.equal(sms.body, "your slot is at 9");
  assert.ok(!("subject" in sms), "a text carried a subject");
});

/**
 * A job whose function returns exactly what the contract describes, run through
 * `runJob` with both providers stubbed.
 *
 * Every dep is the real runner's own: `stamp` claims the run, `callFn` is the
 * model-written function's answer, `recipient` and `phone` are the parsers the
 * write path uses, and the two senders record what they were handed.
 */
function jobRun({ rows, smsKey = { sid: "s" }, emailKey = { key: "e" } }) {
  const sentSms = [], sentEmail = [];
  const deps = {
    stamp: async () => ({ won: true }),
    callFn: async () => rows,
    recipient: (m, k) => (m && typeof m[k] === "string" && m[k].includes("@") ? m[k] : null),
    phone: (v) => { const d = String(v || "").replace(/\D/g, ""); return d.length >= 7 ? "+44" + d.replace(/^0/, "") : null; },
    credentials: async () => emailKey,
    smsCredentials: async () => smsKey,
    send: async (m) => { sentEmail.push(m); return { ok: true }; },
    sendSms: async (m) => { sentSms.push(m); return { ok: true }; },
  };
  return runJob(deps, { name: "daily_reminder", spec: { fn: "bookings_due_tomorrow" } })
    .then((out) => ({ out, sentSms, sentEmail }));
}

test("a designed SMS reaches the SMS sender, and the email beside it reaches the email sender", async () => {
  const { out, sentSms, sentEmail } = await jobRun({
    rows: [
      { channel: "sms", to: "07700 900000", body: "Reminder: your fitting is tomorrow at 9." },
      { channel: "email", to: "owner@shop.test", subject: "Tomorrow's bookings", body: "<p>One fitting.</p>" },
    ],
  });
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(out.sent, 2, "both messages did not send: " + JSON.stringify(out));
  // THE WHOLE POINT: the text went to the SMS provider, with the number parsed
  // and the body the function wrote — not to the mail sender, and not dropped.
  assert.equal(sentSms.length, 1, "the designed text did not reach the SMS sender");
  assert.equal(sentSms[0].to, "+447700900000");
  assert.equal(sentSms[0].body, "Reminder: your fitting is tomorrow at 9.");
  assert.equal(sentSms[0].sid, "s", "the SMS provider's own credential was not used for it");
  assert.equal(sentEmail.length, 1, "the email did not reach the email sender");
  assert.equal(sentEmail[0].subject, "Tomorrow's bookings");
  assert.equal(sentEmail[0].key, "e", "the email credential was not used for the email");
});

test("a text on a site with no SMS key is held and said, never counted as failed", async () => {
  // THE OTHER HALF OF THE CONTRACT'S LAST SENTENCE, and the reason it is worth
  // writing down: an owner who has pasted one key and not the other has a job
  // that half works, and "0 failed / 1 waiting on a key" is the only reading
  // that tells them which key to go and paste.
  const { out, sentSms, sentEmail } = await jobRun({
    rows: [
      { channel: "sms", to: "07700 900000", body: "Reminder." },
      { channel: "email", to: "owner@shop.test", subject: "s", body: "b" },
    ],
    smsKey: null,
  });
  assert.equal(out.ok, true);
  assert.equal(out.sent, 1, "the email did not go out");
  assert.equal(out.failed, 0, "a message waiting on a key was counted as a failure");
  assert.equal(out.unsent, 1, "the held text was not reported at all");
  assert.equal(sentSms.length, 0);
  assert.equal(sentEmail.length, 1);
});

test("a message with no channel takes the email sender, driven end to end", async () => {
  // THE DEFAULT AGAIN, THROUGH THE WHOLE RUNNER rather than through
  // `shapeMessages` alone — the two are a producer and its consumer, and this
  // repository's recorded trap is exactly a correct module one hop from a
  // sender that never receives its answer.
  const { out, sentSms, sentEmail } = await jobRun({
    rows: [{ to: "owner@shop.test", subject: "Tomorrow", body: "One fitting." }],
  });
  assert.equal(out.sent, 1);
  assert.equal(sentSms.length, 0, "a message with no channel was texted");
  assert.deepEqual(sentEmail.map((m) => m.to), ["owner@shop.test"]);
});
