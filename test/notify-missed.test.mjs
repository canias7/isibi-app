// Audit A12-9, the owner's choice (2026-10-23): a missed-notification counter.
// A lost claim or an email that could not go is counted; the next email sent
// says "You missed N notifications"; the count is zeroed by the winner. The
// counter fails open: no column, no change to what is sent.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { notifyOwner, submissionEmail } from "../site-notify.mjs";

const sub = { slug: "shop", table: "bookings", access: "collect", method: "POST", row: { name: "A" } };

function counter(start = 0, { broken = false } = {}) {
  const c = { n: start, calls: [] };
  c.api = {
    take: async (slug) => { c.calls.push("take:" + slug); if (broken) throw new Error("404"); const v = c.n; c.n = 0; return v; },
    add: async (slug, k) => { c.calls.push("add:" + slug + ":" + k); if (broken) throw new Error("404"); c.n += k; },
  };
  return c;
}
const base = (over = {}) => ({
  claim: async () => ({ ok: true, owner_uid: "u", at: "t" }),
  emailOf: async () => "o@x.test",
  send: async () => {},
  ...over,
});

test("a submission inside the cooldown is counted", async () => {
  const c = counter(2);
  const out = await notifyOwner(base({ claim: async () => ({ ok: false }), missed: c.api }), sub);
  assert.equal(out.reason, "cooling_down_or_off");
  assert.equal(c.n, 3);
});

test("the next email names the count once, and the count is zeroed", async () => {
  const c = counter(5);
  const sent = [];
  const out = await notifyOwner(base({ missed: c.api, send: async (m) => { sent.push(m); } }), sub);
  assert.equal(out.sent, true);
  assert.match(sent[0].html, /You missed 5 notifications since the last email\./);
  assert.equal(c.n, 0);
});

test("one missed reads in the singular, none adds no line", () => {
  assert.match(submissionEmail({ slug: "s", table: "t", row: {}, extra: 1 }).html, /You missed 1 notification since/);
  assert.doesNotMatch(submissionEmail({ slug: "s", table: "t", row: {}, extra: 0 }).html, /You missed/);
});

for (const [name, over] of [
  ["send fails", { send: async () => { throw new Error("provider 500"); } }],
  ["no sender", { ready: async () => { throw new Error("no key"); } }],
  ["no address", { emailOf: async () => null }],
  ["lookup fails", { emailOf: async () => { throw new Error("x"); } }],
]) {
  test(`a failed notification (${name}) is counted, and what was taken is handed back`, async () => {
    const c = counter(4);
    const out = await notifyOwner(base({ ...over, missed: c.api }), sub);
    assert.equal(out.sent, false);
    assert.equal(c.n, 5, "the taken four plus this one");
  });
}

test("a failed claim is counted", async () => {
  const c = counter(4);
  const out = await notifyOwner(base({ claim: async () => { throw new Error("claim 500"); }, missed: c.api }), sub);
  assert.equal(out.reason, "claim_failed");
  assert.equal(c.n, 5);
});

test("fails open: a broken counter (no column) changes nothing about the email", async () => {
  const c = counter(0, { broken: true });
  const sent = [];
  const out = await notifyOwner(base({ missed: c.api, send: async (m) => { sent.push(m); } }), sub);
  assert.equal(out.sent, true);
  assert.doesNotMatch(sent[0].html, /You missed/);
  const lostOut = await notifyOwner(base({ claim: async () => ({ ok: false }), missed: c.api }), sub);
  assert.equal(lostOut.reason, "cooling_down_or_off");
});

const w = readFileSync(new URL("../worker.js", import.meta.url), "utf8");

test("the proposed SQL adds the column and both functions, service-role only", () => {
  const sql = readFileSync(new URL("../supabase/proposed/notify_missed.sql", import.meta.url), "utf8");
  assert.match(sql, /add column if not exists notify_missed integer not null default 0/);
  assert.match(sql, /function public\.site_notify_missed_add\(p_slug text, p_n integer\)/);
  assert.match(sql, /function public\.site_notify_missed_take\(p_slug text\)/);
  assert.match(sql, /grant execute on function public\.site_notify_missed_take\(text\) to service_role/);
});
