// Audit A12-9: the owner's notification needs the owner's own mail key. A site
// without one must not spend the cooldown window, and the designer and the
// add-on judge must not be told the email happens on its own.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { notifyOwner } from "../site-notify.mjs";
import { PART_SAYS } from "../builder/site-add.mjs";

const sub = { slug: "shop", table: "bookings", access: "collect", method: "POST", row: { name: "A" } };

test("no sender: the window is handed back, nothing is looked up or sent, and the reason is named", async () => {
  const calls = [];
  const won = { ok: true, owner_uid: "u", at: "2026-10-23T10:00:00.000+00:00" };
  const out = await notifyOwner({
    claim: async () => { calls.push("claim"); return won; },
    ready: async () => { calls.push("ready"); throw new Error("no mail provider key in this site's Secrets"); },
    unclaim: async (slug, c) => { calls.push("unclaim:" + slug + ":" + c.at); },
    emailOf: async () => { calls.push("emailOf"); return "o@x.test"; },
    send: async () => { calls.push("send"); },
  }, sub);
  assert.deepEqual(calls, ["claim", "ready", "unclaim:shop:" + won.at], "the cooldown was kept for an email that could not go");
  assert.equal(out.sent, false);
  assert.equal(out.reason, "no_sender");
  assert.match(out.error, /no mail provider key/);
});

test("a site whose notifications are off, or inside the window, reads no key at all", async () => {
  let read = 0;
  const out = await notifyOwner({
    claim: async () => ({ ok: false }),
    ready: async () => { read++; return {}; },
    emailOf: async () => "o@x.test",
    send: async () => {},
  }, sub);
  assert.equal(out.reason, "cooling_down_or_off");
  assert.equal(read, 0);
});

test("a ready sender is read by the winner and handed to send", async () => {
  const order = [];
  let handed;
  const out = await notifyOwner({
    claim: async () => { order.push("claim"); return { ok: true, owner_uid: "u" }; },
    ready: async () => { order.push("ready"); return { from: "f@x.test" }; },
    unclaim: async () => { order.push("unclaim"); },
    emailOf: async () => "o@x.test",
    send: async (_m, mail) => { order.push("send"); handed = mail; },
  }, sub);
  assert.equal(out.sent, true);
  assert.deepEqual(order, ["claim", "ready", "send"]);
  assert.deepEqual(handed, { from: "f@x.test" });
});

const w = readFileSync(new URL("../worker.js", import.meta.url), "utf8");

test("the Worker reads the site's key in ready and hands the window back on a miss", async () => {
  // (2026-10-28: the site's own Worker — its window is a stamp in its own
  // bucket, `effects/notify/<slug>`; driven through `runSiteEffects`.)
  const { driveWrite, memBucket } = await import("./fixtures/site-effects-drive.mjs");
  const tables = [{ name: "bookings", access: "collect", columns: ["name"], notify: true }];
  const go = (env) => driveWrite({ tables, slug: "shop", sent: '{"name":"A"}', body: '[{"id":1,"name":"A"}]',
    env: { NOTIFY: "1", OWNER_EMAIL: "o@x.test", ...env } });
  // No key: nothing sent, and the window is handed back, so the next
  // submission after a key arrives is not held for five minutes.
  const miss = await go({ EMAIL_FROM: "shop@x.test" });
  assert.equal(miss.calls.length, 0);
  assert.equal(miss.bucket.map.has("effects/notify/shop"), false, "the cooldown was kept for an email that could not go");
  const noFrom = await go({ RESEND_KEY: "re_k" });
  assert.equal(noFrom.calls.length, 0);
  assert.equal(noFrom.bucket.map.has("effects/notify/shop"), false);
  // With the key: sent once, the stamp kept, and a second submission inside
  // the window reads no key and sends nothing.
  const B = memBucket();
  const first = await go({ RESEND_KEY: "re_k", EMAIL_FROM: "shop@x.test", SITES: B });
  assert.equal(first.calls.length, 1);
  assert.ok(B.map.has("effects/notify/shop"), "the winner's stamp stays");
  const second = await go({ RESEND_KEY: "re_k", EMAIL_FROM: "shop@x.test", SITES: B });
  assert.equal(second.calls.length, 0, "inside the window nothing is sent");
  // Notifications off: no stamp at all.
  const off = await go({ NOTIFY: "0", RESEND_KEY: "re_k", EMAIL_FROM: "shop@x.test" });
  assert.equal(off.calls.length, 0);
  assert.equal(off.bucket.map.has("effects/notify/shop"), false);
});

test("the designer and the judge are told the owner's email needs the owner's key", () => {
  assert.match(PART_SAYS.notify, /^the owner is emailed about each new row/);
  assert.match(PART_SAYS.notify, /email key and EMAIL_FROM/);
  const t = readFileSync(new URL("../builder/site-table.mjs", import.meta.url), "utf8");
  const notOwner = t.split("\n").find((l) => l.includes("Do NOT declare this to notify the OWNER"));
  assert.ok(notOwner, "landmark");
  assert.match(notOwner, /email key and EMAIL_FROM/);
  const hooks = t.split("\n").find((l) => l.includes("a site that just emails the owner does NOT need it"));
  assert.ok(hooks, "landmark");
  assert.match(hooks, /email key and EMAIL_FROM/);
});
