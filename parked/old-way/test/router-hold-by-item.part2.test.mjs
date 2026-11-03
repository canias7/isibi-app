// PARKED (2026-11-03, park-old-way): this whole file — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// HELD BACK BY ITEM NUMBER, NOT BY COPIED WORDS (2026-10-23, the owner).
//
// Live, saltmarsh-and-sparrow, 19:28 UTC: a 20-item numbered message was
// refused at once with `route/held-unread`. The router held part of it back by
// copying words into `alsoAsked`, reworded them, and the route could not find
// them in the message. The fix: the message is split into items by code
// (`messageItems`), shown to the router numbered, and the router names what it
// holds back by number (`heldItems`); the numbers become the customer's own
// text (`itemsToWords`) before any reader sees the answer.
//
//   HI1  a 20-item message whose supplied answer holds 5–20 by number: part 0
//        runs items 1–4 and parts 1–16 are items 5–20, verbatim; the router
//        was shown the items numbered and given the `heldItems` field
//   HI2  the words form still behaves as before: words found are held, a
//        reworded copy is still refused as unfindable
//   HI3  numbers that are not items are ignored; every item held keeps the
//        first with the answer; a non-integer is not coerced
//   HI4  an unnumbered message of several sentences is split into sentences
//   HI5  one item, or an answer to a waiting question, shows no items
//
// ⚠ SUPPLIED-MODEL PROOF ONLY: every router answer is supplied, and is the
// shape the router is told to give (`heldItems`, integers).
import test from "node:test";
import assert from "node:assert/strict";
import { platform, sendMessage } from "../../../test/fixtures/request-flow.mjs";
import { blockNetwork } from "../../../test/fixtures/no-network.mjs";
import { messageItems, heldParts } from "../../../builder/route-shared.mjs";

blockNetwork();

const ITEMS = Array.from({ length: 20 }, (_, i) => (i + 1) + ". Change the line \"Old words " + (i + 1) + "\" on the Visit page to say \"New words " + (i + 1) + "\"");
const MESSAGE = "Here is my list:\n" + ITEMS.join("\n");
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

async function routed(answer, message = MESSAGE) {
  const P = platform({ slug: "hi-" + Math.random().toString(16).slice(2, 8), answers: { route: [answer] } });
  try {
    const r = await sendMessage(P, { message });
    const rec = P.record(r.key);
    const sent = P.modelLog.filter((m) => m.tool === "route_message");
    return { r, rec, sent };
  } finally { P.close(); }
}

test("HI1 A 20-ITEM MESSAGE HELD BACK 5–20 BY NUMBER runs items 1–4 now and keeps 5–20 for later, each in the customer's own words", async () => {
  const { r, rec, sent } = await routed({ intent: "edit", layer: "text", page: "/visit", heldItems: range(5, 20) });
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 400));
  assert.notEqual(r.body && r.body.error, "held-unread");
  assert.ok(rec && Array.isArray(rec.parts), "no request was accepted: " + JSON.stringify(r.body).slice(0, 300));
  assert.equal(rec.parts.length, 17, "parts: " + rec.parts.length);
  assert.deepEqual(rec.parts[0].held, ITEMS.slice(4), "part 0 does not hold 5–20 back");
  const now = heldParts(rec.parts[0].runs, rec.parts[0].held);
  assert.equal(now.ok, true);
  assert.equal(now.run, "Here is my list:\n" + ITEMS.slice(0, 4).join("\n"));
  assert.deepEqual(rec.parts.slice(1).map((p) => p.words), ITEMS.slice(4), "the later parts are not items 5–20 verbatim");
  // THE ROUTER WAS SHOWN THE ITEMS AND THE FIELD
  assert.ok(sent.length >= 1, "the router was never asked");
  assert.ok(sent[0].text.includes("ITEM BY ITEM") && sent[0].text.includes("[20] 20. Change"), "the items were not shown");
  assert.ok(sent[0].props.includes("heldItems"), "the router was not given heldItems");
});

test("HI2 THE WORDS FORM STILL BEHAVES AS BEFORE — words found in the message are held; a reworded copy is still refused", async () => {
  const ok = await routed({ intent: "edit", layer: "text", page: "/visit", alsoAsked: ITEMS.slice(10) });
  assert.equal(ok.r.status, 200);
  assert.deepEqual(ok.rec.parts[0].held, ITEMS.slice(10));
  const bad = await routed({ intent: "edit", layer: "text", page: "/visit", alsoAsked: ["change items five to twenty on the visit page"] });
  // THE REWORDED COPY REACHES THE BROWSER AS IT CAME, and is not accepted
  // as parts: the edit route's own check (`heldParts`) refuses it, as before.
  assert.equal(bad.r.body.alsoAsked, "change items five to twenty on the visit page");
  assert.ok(!bad.rec || !Array.isArray(bad.rec.parts), "a reworded copy was accepted as parts: " + JSON.stringify(bad.rec).slice(0, 300));
  assert.equal(heldParts(MESSAGE, bad.r.body.alsoAsked).ok, false);
});

test("HI3b ALL HELD THROUGH THE ROUTE — the first item stays with the answer, the rest are later; never refused", async () => {
  const { r, rec } = await routed({ intent: "edit", layer: "text", page: "/visit", heldItems: range(1, 20) });
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
  assert.deepEqual(rec.parts[0].held, ITEMS.slice(1));
  assert.equal(rec.parts.length, 20);
});

test("HI4 AN UNNUMBERED MESSAGE OF SEVERAL SENTENCES is split into its sentences, and a held sentence is cut out exactly", async () => {
  const msg = "Make the Visit heading say Come by. Change the phone number to 0123 456. Add a gallery page with our loaves!";
  const items = messageItems(msg);
  assert.deepEqual(items.map((i) => i.text), ["Make the Visit heading say Come by.", "Change the phone number to 0123 456.", "Add a gallery page with our loaves!"]);
  const { r, rec } = await routed({ intent: "edit", layer: "text", page: "/visit", heldItems: [3] }, msg);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 300));
  assert.deepEqual(rec.parts.map((p) => p.words).slice(1), ["Add a gallery page with our loaves!"]);
});
