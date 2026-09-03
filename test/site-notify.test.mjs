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

// ---------------------------------------------------- the mailer is a binding now
//
// Cloudflare Email Service replaced Go Farther on 2026-07-30. The reason it is
// worth a test rather than just an edit: the Worker sends through a BINDING, and a
// binding that has not been provisioned is `undefined` rather than an error — so
// the failure mode of getting this wrong is a TypeError on a public endpoint, not
// a clear "mail is not configured".
test("the Worker sends through the EMAIL binding, with no API token anywhere", async () => {
  const fs = await import("node:fs");
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

  assert.match(worker, /env\.EMAIL\.send\(/, "mail must go through the binding");
  // No token, and that is the point of using Cloudflare here: nothing to mint,
  // upload on every deploy, or rotate.
  assert.ok(!/GO_FARTHER/.test(worker), "the retired provider must be gone");
  assert.ok(!/api\.cloudflare\.com[^"']*email/.test(worker),
    "the Worker must not reach the REST API — that is only for the Edge Function, which cannot use a binding");

  // Guarded, or an unprovisioned binding is a TypeError rather than a refusal.
  assert.match(worker, /if \(!env\.EMAIL\) throw new Error\("mail not configured/,
    "sendMail must say so when the binding is absent");
});

// ------------------------------------------- OUR SENDER IS NOT A SITE FEATURE
//
// THE RULE (owner's call, 2026-08-09): `env.EMAIL` is for platform mail to our
// own account holders. NOTHING THE BUILDER MAKES MAY TOUCH IT. A published site
// emails through the key its owner pasted into that site's Secrets — the
// confirmation to the visitor, the SMS, and the notification to the owner alike.
//
// It was not that way. `notifyOwnerOfSubmission` sent on `env.EMAIL` and fires
// on every `collect` insert on every published site, so customer sites spent our
// own 200/day allowance — THE SAME ALLOWANCE THE LOGIN CODE DEPENDS ON. One busy
// booking form could have stopped people signing in to the platform.
//
// Derived, not a list: every caller of our sender is found and checked against
// the one place allowed to have it, so a new one added later fails here rather
// than silently reintroducing the coupling.
test("nothing on a published site's path can reach OUR sender", async () => {
  const fs = await import("node:fs");
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

  // Which function each `sendMail(env` call sits in — the nearest `function` or
  // `const x = ` declaration above it.
  //
  // `(?<!function )` matters: `async function sendMail(env, …)` is the
  // DECLARATION, and counting it reports `sendMail`'s own neighbour as a caller.
  // The first draft did exactly that and named an innocent function.
  const callers = [];
  for (const m of worker.matchAll(/(?<!function )\bsendMail\(env\b/g)) {
    const before = worker.slice(0, m.index);
    const fn = [...before.matchAll(/\n(?:async )?function ([A-Za-z_]\w*)\s*\(/g)].pop();
    callers.push(fn ? fn[1] : "(top level)");
  }
  assert.ok(callers.length, "no sendMail call found at all — this test stopped checking anything");
  assert.ok(!callers.includes("sendMail"), "the declaration is being counted as a call");

  // `mailDomainLive` is a PLATFORM notice to a Go Farther account holder about
  // their own account — the certificate for their domain is issued — and fires
  // once per domain, ever. It is the login code's neighbour, not a site feature.
  assert.deepEqual([...new Set(callers)].sort(), ["mailDomainLive"],
    "something other than the platform notice sends on our own EMAIL binding — " +
    "if it is reachable from a published site it must use that site's own key");

  // And the notification specifically: it goes out on the SITE's provider.
  const i = worker.indexOf("function notifyOwnerOfSubmission(");
  assert.ok(i > 0, "notifyOwnerOfSubmission moved — rescope this");
  const body = worker.slice(i, worker.indexOf("\n}", worker.indexOf("waitUntil(p)", i)));
  assert.ok(!/env\.EMAIL|sendMail\(/.test(body),
    "the owner notification is back on our sender — every booking on every site " +
    "would spend the quota the login code needs");
  assert.match(body, /pickProvider\(/, "it must choose the site owner's own provider");
  assert.match(body, /postProviderEmail\(/, "…and post through it");

  // AND IT MUST SAY WHICH HALF IS MISSING. Without these, a site with no key
  // still fails — on `picked.provider` — but the reason logged is "Cannot read
  // properties of null", so an owner who pasted a key and forgot EMAIL_FROM
  // cannot be told which one. Anchored on the CONDITION, not the message: a
  // mutation to `if (false)` leaves every one of those strings in place, which
  // is how it survived the first sweep.
  assert.match(body, /if \(!picked\) throw/, "a missing provider key must be named, not hit as a null read");
  assert.match(body, /if \(!from\) throw/, "a missing EMAIL_FROM must be named too — it is the commoner mistake");
  // The vault is read through ONE function, shared with the visitor confirmation:
  // two readers of one vault are two things that can disagree about which key is
  // live, which is this codebase's most repeated failure.
  assert.match(body, /siteMailSecrets\(/, "it must read the site's vault through the shared reader");
  const conf = worker.slice(worker.indexOf("function confirmSubmitter("), worker.indexOf("function confirmSubmitter(") + 1200);
  assert.match(conf, /loadSecrets: siteMailSecrets\(/,
    "the confirmation stopped using the shared vault reader — now there are two");

  // AND THE JOBS RUNNER, which was the hand-rolled THIRD copy (2026-08-13
  // audit): same four names, same loop, one provider away from telling an
  // owner "no key in Secrets" while their confirmations sent fine on that
  // key. Landmark-bounded, never a byte count — the window runs to the next
  // top-level declaration, so comments added above `credentials` cannot push
  // it out of range (this file's recurring own-goal).
  // RE-ANCHORED 2026-09-03: the deps live in `jobDeps` now — one builder
  // shared by the cron and the owner's run-now — so the window is that
  // function, to the next top-level declaration as before.
  const rStart = worker.indexOf("function jobDeps(env, row");
  assert.ok(rStart > 0, "jobDeps moved — rescope this");
  const rTail = worker.slice(rStart + 10);
  const rEnd = rTail.search(/\n(?:async )?function |\nconst [A-Z]/);
  assert.ok(rEnd > 0, "no landmark after the runner — the window is unbounded");
  const runner = worker.slice(rStart, rStart + 10 + rEnd);
  assert.match(runner, /credentials: async \(\) => \{[^}]*siteMailSecrets\(/,
    "the jobs runner's credentials dep must read the vault through the shared reader");

  // The strongest form: the four vault names are enumerated ONCE in the whole
  // Worker — inside siteMailSecrets — so a fourth copy added anywhere fails
  // here whatever the function around it is called.
  const enumerations = [...worker.matchAll(/"RESEND_KEY"/g)];
  assert.equal(enumerations.length, 1,
    "the mail-vault names are enumerated more than once in worker.js — a second reader has appeared");
  const readerAt = worker.indexOf("function siteMailSecrets(");
  assert.ok(readerAt > 0, "siteMailSecrets moved — rescope this");
  assert.ok(enumerations[0].index > readerAt && enumerations[0].index < readerAt + 2000,
    "the one enumeration of the vault names is not inside siteMailSecrets");
});

test("wrangler declares the binding the Worker calls", async () => {
  // Derived at both ends: the code above asserts the Worker uses `env.EMAIL`, and
  // this asserts something actually binds that name. Either half alone passes on a
  // Worker that calls a binding nobody declared.
  const fs = await import("node:fs");
  const wr = fs.readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  assert.match(wr, /"send_email":\s*\[\s*\{\s*"name":\s*"EMAIL"\s*\}/,
    "wrangler.jsonc must declare send_email with the name the Worker uses");
});

test("every message carries a plain-text part", async () => {
  // A message with no text/plain alternative scores worse with spam filters, and a
  // booking notification in somebody's junk folder is the same as one never sent.
  const fs = await import("node:fs");
  const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const i = worker.indexOf("async function sendMail(");
  assert.ok(i > 0, "sendMail moved");
  const body = worker.slice(i, worker.indexOf("\n}", i));
  // \btext: not /text:/ — the first draft matched `_text:` as well, so renaming the
  // field to something the API ignores passed the test.
  assert.match(body, /\btext:/, "sendMail must always send a text part: " + body);
  assert.match(body, /replace\(\/<\[\^>\]\+>\/g/, "and derive one from the html when the caller gave none");
});
