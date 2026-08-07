// Confirming the person who submitted, on the site owner's own provider key.
//
// This is deliberately NOT another backend verb. The eight-verb runner (`read
// save fetch ai email notify checkout respond`) was the design that got deleted,
// and the standing direction is that the model writes the backend. So the split
// under test is: the MODEL owns which table, which column, the subject and the
// words; the PLATFORM owns only holding the key and opening the connection,
// because a published page is public files and Postgres has no HTTP client.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { normalizeConfirm, fill, esc, recipient, pickProvider, sendConfirmation, MAIL_PROVIDERS } from "../site-mail.mjs";
import { normalizeSchema } from "../site-schema.mjs";


// Blank comments rather than removing them, so every index still lines up with
// the real text — the rule this repo arrived at after the same mistake three
// times in one session. Both checks below scan for CODE; the first draft of each
// matched a COMMENT instead: `confirmSubmitter`'s comment names `loadSiteSecrets`
// to say it is deliberately not used, and site-mail.mjs names the eight deleted
// verbs to explain what it is not. A guard that reads prose is a guard that
// fires on an accurate explanation.
const noComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
  .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));

const TABLE = {
  name: "bookings", access: "collect",
  columns: ["customer_name", "customer_email"],
  confirm: { to: "customer_email", subject: "Booked, {customer_name}", body: "<p>See you {customer_name}.</p>" },
};
const ROW = { customer_name: "Ada", customer_email: "ada@example.com" };

const deps = (over = {}) => {
  const sent = [];
  return {
    sent,
    d: {
      loadSecrets: async () => ({ RESEND_KEY: "re_live_x", EMAIL_FROM: "hi@barber.example" }),
      send: async (m) => { sent.push(m); return { ok: true, status: 200 }; },
      ...over,
    },
  };
};

// ── what the model may declare ───────────────────────────────────────────────

test("the recipient column must be one the table actually has", () => {
  // Otherwise a site publishes looking as though it confirms, every send has no
  // address, and nobody finds out until a customer says they got nothing.
  assert.equal(normalizeConfirm({ ...TABLE, confirm: { to: "nope", subject: "s", body: "b" } }), null);
  assert.ok(normalizeConfirm(TABLE));
});

test("an internal column can never be the recipient", () => {
  assert.equal(normalizeConfirm({ name: "t", columns: ["_secrets"], confirm: { to: "_secrets", subject: "s", body: "b" } }), null);
});

test("a half-declaration is refused rather than half-applied", () => {
  for (const c of [{ to: "customer_email", subject: "", body: "b" },
                   { to: "customer_email", subject: "s", body: "" },
                   { to: "", subject: "s", body: "b" }, {}, null, [], "confirm"]) {
    assert.equal(normalizeConfirm({ ...TABLE, confirm: c }), null, JSON.stringify(c));
  }
});

// ── the values are a stranger's ──────────────────────────────────────────────

test("a submitted value is escaped into the email, never injected", () => {
  const out = fill("Hi {customer_name}", { customer_name: '<script>alert(1)</script>' });
  assert.equal(out.includes("<script>"), false, "a form field must not become markup");
  assert.match(out, /&lt;script&gt;/);
});

test("the owner's own markup still works — escaping is at substitution, not over the whole body", () => {
  assert.equal(fill("<p>Hi {customer_name}</p>", ROW), "<p>Hi Ada</p>");
});

test("an unknown placeholder empties rather than showing the customer a bug", () => {
  assert.equal(fill("Hi {frist_name}!", ROW), "Hi !");
});

test("esc covers every character that could close a tag or an attribute", () => {
  assert.equal(esc(`<>&"'`), "&lt;&gt;&amp;&quot;&#39;");
});

// ── who it goes to ───────────────────────────────────────────────────────────

test("an address carrying a comma or a newline is refused — that is header injection", () => {
  // One recipient must not become many.
  for (const bad of ["a@b.com, evil@x.com", "a@b.com\nBcc: evil@x.com", "a@b.com;evil@x.com",
                     "<a@b.com>", "a b@c.com", "nope", "@b.com", "a@b", "a@@b.com", ""]) {
    assert.equal(recipient({ e: bad }, "e"), null, JSON.stringify(bad));
  }
  assert.equal(recipient({ e: " ada@example.com " }, "e"), "ada@example.com");
});

test("a non-string value is not coerced into an address", () => {
  for (const v of [123, null, undefined, {}, []]) assert.equal(recipient({ e: v }, "e"), null);
});

// ── whose key ────────────────────────────────────────────────────────────────

test("the provider is chosen by which key the owner pasted, not by the model", () => {
  assert.deepEqual(pickProvider({ SENDGRID_KEY: "sg" }), { provider: "sendgrid", key: "sg" });
  assert.deepEqual(pickProvider({ POSTMARK_KEY: "pm" }), { provider: "postmark", key: "pm" });
  assert.equal(pickProvider({}), null);
  assert.equal(pickProvider({ RESEND_KEY: "   " }), null, "whitespace is not a key");
});

// ── sending ──────────────────────────────────────────────────────────────────

test("it sends, with the row's values filled in", async () => {
  const { sent, d } = deps();
  const out = await sendConfirmation(d, { def: TABLE, row: ROW, slug: "barber" });
  assert.equal(out.sent, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "ada@example.com");
  assert.equal(sent[0].subject, "Booked, Ada");
  assert.equal(sent[0].from, "hi@barber.example");
  assert.equal(sent[0].provider, "resend");
});

test("no key means nothing sent, and it is NOT an error", async () => {
  // Most sites never configure this. Bring-your-own means quiet, not broken.
  const { sent, d } = deps({ loadSecrets: async () => ({}) });
  const out = await sendConfirmation(d, { def: TABLE, row: ROW, slug: "s" });
  assert.equal(out.sent, false);
  assert.equal(out.reason, "no provider key in Secrets");
  assert.equal(sent.length, 0);
});

test("our own sender is NEVER substituted when the owner has set no from address", async () => {
  // A confirmation arriving from gofarther.dev for a barber shop is worse than
  // one that does not arrive, and it spends our sending reputation on their mail.
  const { sent, d } = deps({ loadSecrets: async () => ({ RESEND_KEY: "re_x" }) });
  const out = await sendConfirmation(d, { def: TABLE, row: ROW, slug: "s" });
  assert.equal(out.sent, false);
  assert.equal(sent.length, 0);
});

test("only a collect table confirms", async () => {
  for (const access of ["display", "user", "feed", "admin"]) {
    const { sent, d } = deps();
    const out = await sendConfirmation(d, { def: { ...TABLE, access }, row: ROW, slug: "s" });
    assert.equal(out.sent, false, access + " must not mail its submitter");
    assert.equal(sent.length, 0);
  }
});

test("it NEVER throws — the booking already succeeded", async () => {
  for (const over of [{ loadSecrets: async () => { throw new Error("vault down"); } },
                      { send: async () => { throw new Error("provider down"); } }]) {
    const { d } = deps(over);
    const out = await sendConfirmation(d, { def: TABLE, row: ROW, slug: "s" });
    assert.equal(out.sent, false);
    assert.equal(out.reason, "threw");
  }
});

test("a refusing provider is reported, not swallowed as success", async () => {
  const { d } = deps({ send: async () => ({ ok: false, status: 422 }) });
  const out = await sendConfirmation(d, { def: TABLE, row: ROW, slug: "s" });
  assert.equal(out.sent, false);
  assert.equal(out.status, 422);
});

test("the same address is not mailed twice in a row", async () => {
  const { sent, d } = deps({ recentlySent: async () => true });
  const out = await sendConfirmation(d, { def: TABLE, row: ROW, slug: "s" });
  assert.equal(out.reason, "cooled down");
  assert.equal(sent.length, 0);
});

// ── reachable, end to end ────────────────────────────────────────────────────

test("THE CHAIN: declare it, and it survives every layer to the send", () => {
  // Asserted as a chain because this repo has shipped a declarable feature that
  // did nothing FIVE times — teamScope was dead at five separate layers, and
  // four of the five links were fine each time.
  const worker = fs.readFileSync(path.join(import.meta.dirname, "..", "worker.js"), "utf8");
  const schema = fs.readFileSync(path.join(import.meta.dirname, "..", "site-schema.mjs"), "utf8");

  // 1. the designer can declare it
  const tool = worker.slice(worker.indexOf('name: "design_schema"'), worker.indexOf('tool_choice: { type: "tool", name: "design_schema" }'));
  assert.match(tool, /confirm: \{/, "the design_schema tool must offer `confirm`");

  // 2. it survives normalizeSchema's allow-list — where teamScope was silently
  //    dropped on every build while every other layer worked
  assert.match(schema, /confirm: normalizeConfirm\(/, "coerceTable must carry it");
  const norm = normalizeSchema({ tables: [TABLE] }).tables[0];
  assert.ok(norm.confirm, "the normalised table must keep confirm");
  assert.equal(norm.confirm.to, "customer_email");

  // 3. something on the write path calls it
  assert.match(worker, /confirmSubmitter\(env, ctx, \{/, "the write path must invoke it");
  assert.match(worker, /function confirmSubmitter/, "and it must be defined");

  // 4. it reads the SITE'S OWN vault, not the D1-era central table
  const fn = noComments(worker.slice(worker.indexOf("function confirmSubmitter"), worker.indexOf("function notifyOwnerOfSubmission")));
  assert.match(fn, /FROM _secrets WHERE name=\?/, "secrets come from the site's own Neon vault");
  assert.equal(/loadSiteSecrets/.test(fn), false, "loadSiteSecrets reads a central Supabase table from the D1 era");

  // 5. it is detached, so a slow provider cannot delay the visitor's response
  assert.match(fn, /ctx\.waitUntil/, "must run under waitUntil like the owner notification");
});

test("it is NOT a new verb runner — the deleted eight-verb menu stays deleted", () => {
  // The direction is that the model writes the backend. This module must own
  // exactly one capability; if it ever grows a step list it has become the thing
  // that was removed.
  const src = noComments(fs.readFileSync(path.join(import.meta.dirname, "..", "site-mail.mjs"), "utf8"));
  for (const verb of ["st.do", "steps", "checkout", "respond"]) {
    assert.equal(src.includes(verb), false, "site-mail must not grow a step menu: " + verb);
  }
  assert.equal(MAIL_PROVIDERS.length, 3, "three providers is a credential choice, not a verb list");
});
