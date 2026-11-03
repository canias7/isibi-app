// PARKED (2026-11-03, park-old-way): the old-way half of test/site-security.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// THE QUICK SECURITY CHECK (2026-10-21, phase A of the security scan).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { quickChecks, accessPair } from "../../../site-security.mjs";

const ids = (r) => r.findings.map((f) => f.id);

test("FIX IT and THE CHAT: a finding's button sends it to the builder as a message; the router's security answer offers the deep scan with its price", async () => {
  const c = readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8");
  assert.match(c, /data-secfix="/, "no Fix it button");
  assert.match(c, /siteSend\('Fix this security problem on my site: ' \+ b\.getAttribute\('data-secfix'\), true\);/, "Fix it does not go to the builder as the platform's words");
  assert.match(c, /if \(d\.intent === 'security'\) return !!slug;/, "the page refuses the router's security answer");
  assert.match(c, /if \(d\.intent === 'security' && site\.slug\) return siteSecurityOffer\(site, t, origin, finish\);/, "a security answer does not go to the offer (2026-10-23: never straight to the paid scan)");
  assert.match(c, /body: JSON\.stringify\(\{ deep: true, picker: buildPicker, \.\.\.\(typeof sendEffort === 'function' \? sendEffort\(\) : null\), thorough: /, "the scan is not sent the picker");
  const ask = await import("../builder/site-ask.mjs");
  assert.ok(ask.LIVE_ASK_TOOL.input_schema.properties.intent.enum.includes("security"), "the router is not offered security");
  assert.ok(!ask.ASK_TOOL.input_schema.properties.intent.enum.includes("security"), "a first build is offered a scan of a site that does not exist");
  const said = (input, o) => ask.readRouting({ content: [{ type: "tool_use", input }] }, o);
  assert.deepEqual(said({ intent: "security" }, { hasSite: true, live: true }), { intent: "security", answer: "" });
  assert.notEqual(said({ intent: "security" }, { hasSite: false }).intent, "security", "a scan with no site");
});
