// "£8" on the live key box (northline-climbing, 2026-11-02): a reason saved before the
// server read JSON escapes back reached the page through the request record and the page.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { partNeedKeys } from "../builder/request.mjs";

test("KW1 a part's saved key reason has its JSON escapes read back", () => {
  const out = partNeedKeys({ needKeys: [{ name: "STRIPE_SECRET_KEY", service: "Stripe", why: "Take the \\u00a38 payment" }] });
  assert.equal(out[0].why, "Take the £8 payment");
  assert.equal(partNeedKeys({ needKeys: [{ name: "X_KEY", why: "a\\u0000b" }] })[0].why, "a b", "an escaped control character is not kept");
});

test("KW2 the key box draws every reason and service through kcText", () => {
  const src = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  const a = src.indexOf("function kcText("), b = src.indexOf("function siteKeyCardDraw(");
  assert.ok(a > 0 && b > a);
  const kc = new Function(src.slice(a, b) + "; return kcText;")();
  assert.equal(kc("Take the \\u00a38 Kids' club payment"), "Take the £8 Kids' club payment");
  const draw = src.slice(b, src.indexOf("\n}", b));
  assert.match(draw, /esc\(kcText\(k\.why\)\)/);
  assert.match(draw, /esc\(kcText\(k\.service\)\)/);
  assert.doesNotMatch(draw, /esc\(k\.why\)/);
});
