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

test("the Worker reads the site's key in ready, hands the window back on a miss, and clears only its own stamp", () => {
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
  assert.match(body.slice(ready, send), /if \(!picked\) throw new Error/);
  assert.match(body.slice(ready, send), /if \(!from\) throw new Error/);
  assert.match(body, /unclaim: \(s2, c\) => unclaimNotify\(env, s2, c\),/);
  const u = w.slice(w.indexOf("async function unclaimNotify("), w.indexOf("\n}\n", w.indexOf("async function unclaimNotify(")));
  assert.ok(u.length > 50, "landmark: unclaimNotify");
  assert.match(u, /notified_at=eq\.\$\{encodeURIComponent\(at\)\}/, "another winner's stamp could be cleared");
  assert.match(u, /if \(!at\) return;/);
  assert.match(u, /JSON\.stringify\(\{ notified_at: null \}\)/);
  const c = w.slice(w.indexOf("async function claimNotify("), w.indexOf("async function unclaimNotify("));
  assert.match(c, /\{ ok: true, owner_uid: row\.uid, at: row\.notified_at \}/, "the claim does not say which stamp it set");
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
