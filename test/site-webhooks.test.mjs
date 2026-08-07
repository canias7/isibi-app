import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { firesFor, shapePayload, signPayload, deliverWebhook, MAX_FIELDS, MAX_VALUE_CHARS, MAX_PER_MINUTE } from "../site-webhooks.mjs";
import { hostIsBlocked, blockedReason } from "../site-ssrf.mjs";

const NOW = 1786070000000;
const okRes = { status: 200 };

/** Everything injected, so no decision here needs a network or a clock. */
function deps(over = {}) {
  const calls = [];
  // `status` rather than replacing `post`, because an override that swaps the
  // recorder out silently empties `calls` — which made "exactly one attempt"
  // read as zero attempts and fail on correct behaviour.
  const { status, ...rest } = over;
  const d = {
    firesFor: () => true,
    loadSecrets: async () => ({ WEBHOOK_URL: "https://hooks.example.com/x" }),
    blockedReason: (u) => blockedReason(u),
    sign: (s, b, t) => signPayload(s, b, t),
    post: async (url, init) => { calls.push({ url, init }); return status ? { status } : okRes; },
    ...rest,
  };
  d.calls = calls;
  return d;
}
const fire = (d, over = {}) =>
  deliverWebhook(d, { slug: "barber", table: "bookings", action: "created", row: { id: 4, who: "Ada" }, now: NOW, ...over });

test("a table emits only for the actions it declared", () => {
  assert.equal(firesFor({ webhooks: true }, "created"), true);
  assert.equal(firesFor({ webhooks: true }, "updated"), true);
  assert.equal(firesFor({ webhooks: ["created"] }, "created"), true);
  assert.equal(firesFor({ webhooks: ["created"] }, "deleted"), false);
  // Silence is the default for every site that never declared one, which is
  // most of them — so every shape of absence must read as no.
  for (const w of [undefined, null, false, [], 0, ""]) {
    assert.equal(firesFor({ webhooks: w }, "created"), false, JSON.stringify(w));
  }
  assert.equal(firesFor(null, "created"), false);
  // An action nobody defined is not a wildcard.
  assert.equal(firesFor({ webhooks: true }, "exfiltrated"), false);
});

test("the payload is shaped, and never carries somebody's identity", () => {
  const p = shapePayload({
    slug: "barber", table: "bookings", action: "created", at: "2026-08-07T00:00:00Z",
    row: { id: 4, who: "Ada", _fts: "ada bookings", owner_id: "d474-uuid", claim_token: "tok", note: null, paid: true },
  });
  assert.equal(p.site, "barber");
  assert.equal(p.table, "bookings");
  assert.equal(p.action, "created");
  // KEPT: the receiver needs a reference it can reconcile against.
  assert.equal(p.data.id, 4);
  assert.equal(p.data.who, "Ada");
  // Types survive rather than being stringified — a receiver checking `paid`
  // should get a boolean.
  assert.equal(p.data.paid, true);
  assert.equal(p.data.note, null);
  // A member's uuid is not ours to hand a third party they never chose, and a
  // claim token IS the credential for that row.
  for (const gone of ["_fts", "owner_id", "claim_token"]) {
    assert.equal(gone in p.data, false, gone + " must not leave our network");
  }
});

test("a huge submission cannot become a huge POST", () => {
  const row = { long: "x".repeat(MAX_VALUE_CHARS * 3) };
  for (let i = 0; i < MAX_FIELDS * 2; i++) row["f" + i] = "v";
  const p = shapePayload({ slug: "s", table: "t", action: "created", row, at: "z" });
  assert.equal(Object.keys(p.data).length, MAX_FIELDS);
  const first = Object.values(p.data).find((v) => typeof v === "string" && v.length > 100);
  if (first) assert.ok(first.length <= MAX_VALUE_CHARS, String(first.length));
});

test("an object column is stringified rather than dropped", () => {
  const p = shapePayload({ slug: "s", table: "t", action: "created", at: "z", row: { meta: { a: 1 } } });
  assert.equal(typeof p.data.meta, "string");
  assert.match(p.data.meta, /"a":1/);
});

test("THE TIMESTAMP IS INSIDE THE SIGNED MATERIAL, or a capture replays forever", async () => {
  const a = await signPayload("s3cret", '{"x":1}', 1000);
  const b = await signPayload("s3cret", '{"x":1}', 2000);
  assert.ok(a && b);
  assert.notEqual(a, b, "the same body at a different time must not sign identically");
  // And the body is signed too, or a valid signature authenticates any content.
  const c = await signPayload("s3cret", '{"x":2}', 1000);
  assert.notEqual(a, c);
  // A different secret must not verify.
  assert.notEqual(a, await signPayload("other", '{"x":1}', 1000));
  assert.match(a, /^[0-9a-f]{64}$/);
});

test("no URL is silence, not an error — it is the state of most sites", async () => {
  const d = deps({ loadSecrets: async () => ({}) });
  const out = await fire(d);
  assert.equal(out.sent, false);
  assert.match(out.reason, /no WEBHOOK_URL/);
  assert.equal(d.calls.length, 0, "nothing may be called without a destination");
});

test("A DESTINATION IS RE-CHECKED AT FIRE TIME, not only when it was saved", async () => {
  // The DNS-rebinding shape: a hostname resolves to whatever it resolves to
  // today, so a URL that was public when pasted can point somewhere else later.
  for (const url of [
    "http://hooks.example.com/x",          // cleartext — a customer's details
    "https://127.0.0.1/x",
    "https://169.254.169.254/latest/meta-data/",   // the expensive one
    "https://10.0.0.5/x",
    "https://[::1]/x",
    "https://2130706433/x",                // decimal-encoded loopback
    "https://metadata.google.internal/x",
    "not a url",
  ]) {
    const d = deps({ loadSecrets: async () => ({ WEBHOOK_URL: url }) });
    const out = await fire(d);
    assert.equal(out.sent, false, url + " must be refused");
    assert.match(out.reason, /destination refused/, url);
    assert.equal(d.calls.length, 0, url + " must not be called at all");
  }
});

test("a public https destination is called, with the event headers", async () => {
  const d = deps();
  const out = await fire(d);
  assert.equal(out.sent, true, JSON.stringify(out));
  assert.equal(d.calls.length, 1);
  const { init } = d.calls[0];
  assert.equal(init.method, "POST");
  assert.equal(init.headers["x-gofarther-event"], "bookings.created");
  assert.ok(init.headers["x-gofarther-timestamp"], "a receiver needs it to bound replay");
  assert.match(String(JSON.parse(init.body).data.who), /Ada/);
});

test("signed when a secret exists; unsigned is a DELIBERATE allowance", async () => {
  const signed = deps({ loadSecrets: async () => ({ WEBHOOK_URL: "https://hooks.example.com/x", WEBHOOK_SECRET: "shh" }) });
  const a = await fire(signed);
  assert.equal(a.signed, true);
  assert.match(signed.calls[0].init.headers["x-gofarther-signature"], /^v1=[0-9a-f]{64}$/);

  // Slack incoming webhooks and Zapier catch hooks have no signature support at
  // all, so requiring one makes the two destinations people actually reach for
  // unusable. It still SENDS, and reports that it was unsigned.
  const plain = deps();
  const b = await fire(plain);
  assert.equal(b.sent, true);
  assert.equal(b.signed, false);
  assert.equal("x-gofarther-signature" in plain.calls[0].init.headers, false);
});

test("a table that does not emit is never even looked up", async () => {
  let looked = false;
  const d = deps({ firesFor: () => false, loadSecrets: async () => { looked = true; return {}; } });
  const out = await fire(d);
  assert.equal(out.sent, false);
  assert.equal(looked, false, "a non-emitting table must not cost a vault read on every insert");
});

test("the rate cap is checked BEFORE the vault, and stops the call", async () => {
  let looked = false;
  const d = deps({ tooMany: async () => true, loadSecrets: async () => { looked = true; return {}; } });
  const out = await fire(d);
  assert.equal(out.sent, false);
  assert.match(out.reason, /rate capped/);
  assert.equal(looked, false, "a capped site must not pay for a decryption");
  assert.equal(d.calls.length, 0);
});

test("NOTHING THROWS — the row is already written", async () => {
  for (const broken of [
    { loadSecrets: async () => { throw new Error("vault down"); } },
    { post: async () => { throw new Error("connect ECONNREFUSED"); } },
    { sign: async () => { throw new Error("no subtle"); } },
    { firesFor: () => { throw new Error("bad def"); } },
    { blockedReason: () => { throw new Error("parse"); } },
  ]) {
    const d = deps({ loadSecrets: async () => ({ WEBHOOK_URL: "https://hooks.example.com/x", WEBHOOK_SECRET: "s" }), ...broken });
    const out = await fire(d);
    assert.equal(out.sent, false);
    assert.ok(out.reason, JSON.stringify(out));
  }
});

test("a receiver that refuses is reported, not retried", async () => {
  for (const status of [301, 302, 400, 401, 404, 410, 500, 503]) {
    const d = deps({ status });
    const out = await fire(d);
    assert.equal(out.sent, false, "status " + status);
    assert.equal(out.status, status);
    assert.equal(d.calls.length, 1, "exactly one attempt — there is no retry queue");
  }
});

// ── the SSRF guard, now that two callers share it ─────────────────────────────

test("the host guard refuses every encoding of a private address", () => {
  for (const h of [
    "127.0.0.1", "2130706433", "0x7f000001", "017700000001",
    "10.0.0.1", "172.16.0.1", "192.168.1.1", "100.64.0.1", "0.0.0.0",
    "169.254.169.254", "metadata.google.internal", "localhost", "foo.localhost",
    "db.internal", "printer.local", "::1", "::", "fe80::1", "fd00::1",
    "::ffff:127.0.0.1", "::ffff:7f00:1", "64:ff9b::7f00:1", "127.0.0.1.",
  ]) {
    assert.equal(hostIsBlocked(h), true, h + " must be blocked");
  }
  for (const h of ["example.com", "hooks.slack.com", "1.1.1.1", "8.8.8.8", "2606:4700::1111"]) {
    assert.equal(hostIsBlocked(h), false, h + " must be allowed");
  }
});

test("worker.js keeps NO second copy of the host guard", () => {
  // The invariant is one question, one place — the same rule `hasPublicView` and
  // `site-errors.mjs` are held to. Asserted as an EXCLUSION plus a not-orphaned
  // check, because the exclusion alone passes perfectly on a codebase where the
  // guard has simply been deleted.
  const worker = fs.readFileSync(path.join(import.meta.dirname, "..", "worker.js"), "utf8");
  assert.equal(/function hostIsBlocked\s*\(/.test(worker), false, "worker.js must import it, not restate it");
  assert.equal(/function ipv4Blocked\s*\(/.test(worker), false);
  assert.match(worker, /import \{[^}]*hostIsBlocked[^}]*\} from "\.\/site-ssrf\.mjs"/);
  // …and still USES it, or the import is decoration and safeFetch checks nothing.
  assert.match(worker, /hostIsBlocked\(/, "safeFetch must still call it");
});

test("the Worker wires the webhook to the same branch as the confirmation", () => {
  // Reachability, asserted as a chain, because this repo has shipped a feature
  // dead at one layer with the other five correct more than once.
  const worker = fs.readFileSync(path.join(import.meta.dirname, "..", "worker.js"), "utf8");
  // 1. declarable — the schema already parsed `webhooks` before any of this existed
  const schema = fs.readFileSync(path.join(import.meta.dirname, "..", "site-schema.mjs"), "utf8");
  assert.match(schema, /webhooks:/, "the normaliser must keep the declaration");
  // 2. called on the successful-POST branch, beside confirmSubmitter
  assert.match(worker, /emitWebhook\(env, ctx, \{[^}]*action: "created"/);
  // 3. the helper exists and is not merely referenced
  assert.match(worker, /function emitWebhook\(/);
  // 4. the destination comes from the VAULT and never from the schema or body —
  //    a URL a model can choose is a request generator aimed by whoever wrote
  //    the brief.
  const raw = worker.slice(worker.indexOf("function emitWebhook("), worker.indexOf("function confirmSubmitter("));
  assert.ok(raw.length > 500, "the helper must sit before confirmSubmitter, or this slice is empty");
  // COMMENTS BLANKED, NOT REMOVED, so offsets stay valid — and because these are
  // claims about CODE. Caught by mutation: the helper explains `redirect:
  // "manual"` in prose directly above the line that sets it, so switching the
  // real one to "follow" left the sentence behind and this test still passed.
  // That is the third guard in this repo to fire on a comment instead of code.
  const helper = raw
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));
  assert.match(helper, /WEBHOOK_URL/);
  assert.match(helper, /_secrets/, "it must read the site's own vault");
  assert.equal(/body\.(webhook|url)/i.test(helper), false, "never from the request");
  // 5. detached, so a slow receiver is not something a customer waits on
  assert.match(helper, /ctx\.waitUntil\(/);
  // 6. redirects are NOT followed — that would reopen the host question a hop later
  assert.match(helper, /redirect: "manual"/);
  assert.equal(/redirect: "follow"/.test(helper), false);
});
