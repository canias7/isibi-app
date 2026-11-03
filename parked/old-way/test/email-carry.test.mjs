// PARKED (2026-11-03, park-old-way): the old-way half of test/email-carry.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// Run 6 (job e440655f): an email change on the text step left `mailto:<old>`
// and other copies of the old address in the site's parts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as text from "../../../builder/site-text.mjs";
import { editReplyFacts } from "../../../builder/site-reply.mjs";

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

test("the text route runs it before the split and answers the links", () => {
  const w = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  const a = w.indexOf("const eMail = carryEmailChange(out.pages, out.edits, { keepLinks: out.keepLinks === true });");
  const b = w.indexOf("const eSplit = splitEditable(eMail.pages);");
  assert.ok(a > 0 && b > a && b - a < 400);
  assert.ok(w.indexOf("links: eMail.links.length", b) > b);
});

test("keepLinks is a schema field, read only as exactly true from the step's answer", async () => {
  const ap = await import("../../../builder/site-apply.mjs");
  const k = ap.TEXT_TOOL.input_schema.properties.keepLinks;
  assert.equal(k && k.type, "boolean");
  assert.ok(!ap.TEXT_TOOL.input_schema.required.includes("keepLinks"));
  const reply = (input) => ({ content: [{ type: "tool_use", input }] });
  assert.equal(ap.readTextKeepLinks(reply({ edits: [], keepLinks: true })), true);
  assert.equal(ap.readTextKeepLinks(reply({ edits: [], keepLinks: "true" })), false);
  assert.equal(ap.readTextKeepLinks(reply({ edits: [] })), false);
  const w = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  assert.match(w, /keptLinks: eMail\.kept\.length/);
  assert.match(w, /readTextKeepLinks|keepLinks: out\.keepLinks === true/);
  const src = readFileSync(new URL("../../../builder/site-apply.mjs", import.meta.url), "utf8");
  assert.match(src, /\.\.\.\(readTextKeepLinks\(reply\) \? \{ keepLinks: true \} : \{\}\)/);
});
