// The shared "row created / updated" step (audit A12-1, A30-3, 2026-10-22).
//
// An order is inserted by `handleCheckout` and marked paid by the site's Stripe
// webhook; neither passes through the data proxy, where the owner's email, the
// confirmation, the text and the webhook used to be wired. A shop that declared
// a receipt and a webhook sent neither. These tests hold the three write paths
// to ONE step, and the step to the four senders.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { runRowEffects } from "../site-row-effects.mjs";
import { tableParts, PART_SAYS } from "../builder/site-add.mjs";

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

function fnBody(src, decl) {
  const at = src.indexOf(decl);
  assert.ok(at > 0, decl + " is gone — retarget this test");
  const open = src.indexOf("{", src.indexOf(")", at));
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (!depth) return src.slice(at, i + 1); }
  }
  assert.fail("unbalanced");
}
const code = (s) => s.split("\n").map((l) => l.replace(/^\s*\/\/.*$/, "")).join("\n");

function spy() {
  const calls = [];
  return {
    calls,
    deps: {
      notify: (r) => calls.push(["notify", r]),
      confirm: (r) => calls.push(["confirm", r]),
      sms: (r) => calls.push(["sms", r]),
      webhook: (a, r) => calls.push(["webhook", a, r]),
    },
  };
}

test("a submission fires the three person-facing senders and the webhook", () => {
  const s = spy();
  runRowEffects(s.deps, { def: { name: "orders" }, action: "updated", submission: true, row: { id: 7 } });
  assert.deepEqual(s.calls.map((c) => c[0]), ["notify", "confirm", "sms", "webhook"]);
  assert.equal(s.calls[3][1], "updated");
  assert.equal(s.calls[0][1].id, 7);
});

test("a pending checkout row fires only the webhook's `created`", () => {
  const s = spy();
  runRowEffects(s.deps, { def: { name: "orders" }, action: "created", submission: false, row: { id: 3 } });
  assert.deepEqual(s.calls, [["webhook", "created", { id: 3 }]]);
});

test("one sender throwing does not stop the others", () => {
  const s = spy();
  s.deps.notify = () => { throw new Error("boom"); };
  const fired = runRowEffects(s.deps, { def: { name: "t" }, action: "created", submission: true, row: {} });
  assert.deepEqual(fired, ["confirm", "sms", "webhook"]);
});

test("the proxy, the checkout insert and the Stripe paid flip all run the shared step", () => {
  const proxy = code(fnBody(worker, "async function proxySiteService("));
  assert.match(proxy, /siteRowEffects\(env, ctx, \{[\s\S]{0,200}?submission: request\.method === "POST"/);
  const checkout = code(fnBody(worker, "async function handleCheckout("));
  const ins = checkout.indexOf("RETURNING id");
  const eff = checkout.indexOf("siteRowEffects(");
  assert.ok(ins > 0 && eff > ins, "handleCheckout must run the row step after its INSERT");
  assert.match(checkout.slice(eff, eff + 300), /action: "created", submission: false/);
  const at = worker.indexOf('url.pathname.startsWith("/api/stripe/site/")');
  assert.ok(at > 0);
  const route = code(worker.slice(at, worker.indexOf('url.pathname === "/api/stripe/webhook"', at)));
  assert.match(route, /payment_status<>'paid' RETURNING \*/, "the paid flip must read the stored row back");
  assert.match(route, /siteRowEffects\(env, ctx, \{[\s\S]{0,200}?action: "updated", submission: true, row: stored/);
  assert.match(worker, /handleCheckout\(\{[\s\S]{0,300}?\n\s*ctx,\n/, "the checkout route hands ctx to handleCheckout");
});

test("only the shared step calls the four senders", () => {
  const src = code(worker);
  const body = fnBody(src, "function siteRowEffects(");
  for (const f of ["notifyOwnerOfSubmission(", "confirmSubmitter(", "smsSubmitter(", "emitWebhook("]) {
    assert.ok(body.includes(f), "siteRowEffects must call " + f);
    const n = src.split(f).length - 1;
    assert.equal(n, 2, `${f} appears ${n} times; its definition and the shared step only`);
  }
  assert.doesNotMatch(body, /env\.EMAIL/, "a site's mail is never the platform's sender");
});

test("tableParts claims nothing a function-only table cannot do, and a paid table's notify", () => {
  const fnOnly = { name: "bookings", access: "collect", write: "none", confirm: { to: "email", subject: "s", body: "b" }, sms: { to: "m", body: "b" }, webhooks: ["created"] };
  assert.deepEqual(tableParts(fnOnly), []);
  const paid = { name: "orders", access: "collect", payment: { from: "products" }, confirm: { to: "email", subject: "s", body: "b" }, webhooks: ["created", "updated"] };
  assert.deepEqual(tableParts(paid), ["notify", "confirm", "webhooks", "payment"]);
  assert.match(PART_SAYS.notify, /paid order/);
});

test("the tool text says when a paid table's receipt fires, and that a function's rows send nothing", async () => {
  const tableSrc = fs.readFileSync(new URL("../builder/site-table.mjs", import.meta.url), "utf8");
  assert.match(tableSrc, /it is sent when the order is PAID \(that is the receipt\)/);
  assert.match(tableSrc, /Rows a FUNCTION writes/);
  assert.match(tableSrc, /`created` fires when the checkout starts/);
  assert.match(worker, /A row the function inserts sends NO owner email, confirmation, text or webhook/);
});
