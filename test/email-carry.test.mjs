// Run 6 (job e440655f): an email change on the text step left `mailto:<old>`
// and other copies of the old address in the site's parts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as text from "../builder/site-text.mjs";
import { editReplyFacts } from "../builder/site-reply.mjs";

const carryEmailChange = (...a) => {
  assert.equal(typeof text.carryEmailChange, "function", "carryEmailChange is exported");
  return text.carryEmailChange(...a);
};
const OLD = "hello@driftwoodanddaughters.co.uk";
const NEW = "bookings@driftwoodanddaughters.co.uk";
const files = () => [
  { path: "src/routes/contact.tsx", source: `<p>${NEW}</p>` },
  { path: "src/components/-parts/site-footer.tsx", source: `<a href="mailto:${OLD}">${OLD}</a> <a href="tel:+441132000000">Call</a>` },
  { path: "src/components/-parts/band-27-split.tsx", source: `<a href="mailto:HELLO@driftwoodanddaughters.co.uk?subject=Booking">Email us</a>` },
  { path: "src/components/-parts/band-29-narrow.tsx", source: `const e = "${OLD}"; const x = "xhello@driftwoodanddaughters.co.uk"; const y = "${OLD}.au";` },
];
const edits = [{ path: "src/routes/contact.tsx", from: OLD, to: NEW }];

test("every exact mailto and copy of the old address becomes the new one", () => {
  const r = carryEmailChange(files(), edits);
  const all = r.pages.map((p) => p.source).join("\n");
  assert.ok(!/mailto:hello@/i.test(all));
  assert.ok(!all.includes(">" + OLD + "<") && !all.includes('"' + OLD + '"'), "visible copies carried");
  assert.ok(all.includes(">" + NEW + "<") && all.includes('"' + NEW + '"'));
  assert.ok(all.includes("mailto:" + NEW + "?subject=Booking"));
  assert.match(all, /tel:\+441132000000/);
  assert.match(all, /xhello@driftwoodanddaughters\.co\.uk/);
  assert.match(all, /hello@driftwoodanddaughters\.co\.uk\.au/);
  assert.equal(r.links.length, 2);
  assert.deepEqual(r.links.map((l) => l.file).sort(), ["src/components/-parts/band-27-split.tsx", "src/components/-parts/site-footer.tsx"]);
  assert.equal(r.links[0].to, "mailto:" + NEW);
  assert.equal(r.texts.length, 2);
  assert.equal(text.staleContactLinks(r.pages, edits).filter((s) => /^mailto:/.test(s.href)).length, 0);
});

test("non-email edits and phone edits change nothing", () => {
  const f = files();
  for (const ed of [[{ from: "Hello", to: "Hi" }], [{ from: "0113 200 0000", to: "0113 200 0001" }], [{ from: OLD, to: "not an email" }]]) {
    const r = carryEmailChange(f, ed);
    assert.deepEqual(r.pages, f);
    assert.equal(r.links.length + r.texts.length, 0);
  }
});

test("keepLinks: the visible copies change, the links keep the old address and are reported kept", () => {
  const r = carryEmailChange(files(), edits, { keepLinks: true });
  const all = r.pages.map((p) => p.source).join("\n");
  assert.ok(all.includes("mailto:" + OLD) && all.includes("mailto:HELLO@driftwoodanddaughters.co.uk?subject=Booking"));
  assert.ok(!all.includes(">" + OLD + "<") && !all.includes('"' + OLD + '"'));
  assert.equal(r.links.length, 0);
  assert.equal(r.kept.length, 2);
  const f = editReplyFacts({ ok: true, layer: "text", applied: 1, changed: [NEW], keptLinks: r.kept });
  assert.ok(JSON.stringify(f.facts).includes("mailto:" + OLD));
});

test("the reply facts name each changed link", () => {
  const r = editReplyFacts({ ok: true, layer: "text", applied: 1, changed: [NEW], links: [{ file: "src/components/-parts/site-footer.tsx", from: "mailto:" + OLD, to: "mailto:" + NEW }] });
  const t = JSON.stringify(r.facts);
  assert.ok(t.includes("site-footer.tsx") && t.includes("mailto:" + NEW), t);
});
