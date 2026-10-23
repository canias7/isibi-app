// Audit A12-9: the owner's notification needs the owner's own mail key. A site
// without one must not spend the cooldown window, and the designer and the
// add-on judge must not be told the email happens on its own.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { notifyOwner } from "../site-notify.mjs";
import { PART_SAYS } from "../builder/site-add.mjs";

const sub = { slug: "shop", table: "bookings", access: "collect", method: "POST", row: { name: "A" } };

test("no sender: the claim is never taken and the reason is named", async () => {
  let claimed = 0;
  const out = await notifyOwner({
    ready: async () => { throw new Error("no mail provider key in this site's Secrets"); },
    claim: async () => { claimed++; return { ok: true, owner_uid: "u" }; },
    emailOf: async () => "o@x.test",
    send: async () => {},
  }, sub);
  assert.equal(claimed, 0, "the cooldown was spent on an email that could not go");
  assert.equal(out.sent, false);
  assert.equal(out.reason, "no_sender");
  assert.match(out.error, /no mail provider key/);
});

test("a ready sender is read first and handed to send", async () => {
  const order = [];
  let handed;
  const out = await notifyOwner({
    ready: async () => { order.push("ready"); return { from: "f@x.test" }; },
    claim: async () => { order.push("claim"); return { ok: true, owner_uid: "u" }; },
    emailOf: async () => "o@x.test",
    send: async (_m, mail) => { order.push("send"); handed = mail; },
  }, sub);
  assert.equal(out.sent, true);
  assert.deepEqual(order, ["ready", "claim", "send"]);
  assert.deepEqual(handed, { from: "f@x.test" });
});

test("the Worker reads the site's key in ready, not after the claim in send", () => {
  const w = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const a = w.indexOf("function notifyOwnerOfSubmission(");
  const b = w.indexOf("\n}\n", a);
  assert.ok(a > 0 && b > a, "landmarks");
  const body = w.slice(a, b);
  const ready = body.indexOf("ready: async () => {");
  const send = body.indexOf("send: async (");
  const secrets = body.indexOf("siteMailSecrets(env, payload.db, payload.slug)");
  assert.ok(ready > 0 && send > ready, "ready and send both present, ready first");
  assert.ok(secrets > ready && secrets < send, "the site's mail key is read inside ready");
  assert.equal(body.split("siteMailSecrets(").length, 2, "the key is read once");
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
