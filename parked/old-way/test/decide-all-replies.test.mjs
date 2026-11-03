// PARKED (2026-11-03, park-old-way): the old-way half of test/decide-all-replies.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// DECIDE-ALL (2026-10-23), the owner's rule: no hardcoded customer-facing
// message. Each sentence the decided branches added is carried as structured
// facts and told by the reply writer; the step's own `msg` is only the
// fallback shown when no reply could be written. These cases hold both halves:
// the facts reach the writer (and the `msg` does not stand in for them), and
// the server carries the structure the facts are read from.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { editReplyFacts, addonReplyFacts, routeReplyFacts, buildReplyFacts, refusalFacts, langFacts, languageNamed, DECIDED_REFUSALS } from "../../../builder/site-reply.mjs";
import { buildFacts } from "../../../builder/build-answer.mjs";
import { filingFloorRefusal } from "../../../builder/publish-pages.mjs";

const SENTINEL = "SENTINEL-CODE-SENTENCE";
const texts = (r) => r.facts.map((f) => f.text).join("\n");
const W = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
const NAV = readFileSync(new URL("../../../builder/site-nav.mjs", import.meta.url), "utf8");
const CHAT = readFileSync(new URL("../../../public/chat.js", import.meta.url), "utf8");

test("THE WIRING: the server carries each structure to the writer", () => {
  // The menu step's two scoped refusals carry codes, and the route passes them on.
  assert.match(NAV, /refusal: \{ code: "menu-page-unknown", pages: scope\.unknown\.slice\(\) \}/);
  assert.match(NAV, /refusal: \{ code: "menu-no-menu", pages: scope\.pages\.slice\(\) \}/);
  assert.match(W, /refusal: nOut\.refusal \|\| undefined/);
  assert.match(W, /refusal: \{ code: "qr-forget-blocked", host: fHost \|\| drop, codes: fCodes\.map\(\(c\) => c\.name\) \}/);
  assert.equal((W.match(/refusal: \{ code: "site-offline" \}, error: OFFLINE_PUBLISH_REFUSAL/g) || []).length, 3, "a Publish refusal for an offline site carries no code");
  // The floor's refusals on the edit and add-on routes go through the writer.
  assert.match(W, /if \(eFloor\) return withModelReply\(env, Response\.json\(eFloor, \{ status: 402 \}\), "edit", eReplyOut\)/);
  assert.match(W, /if \(aFloor\) return withModelReply\(env, Response\.json\(aFloor, \{ status: 402 \}\), "addon", aReplyOut\)/);
  // The build's Stop and name refusal are narrated; the logo is among the build's facts.
  const stop = W.indexOf("const stoppedAnswer = async (stage) => {");
  assert.ok(stop > 0);
  assert.match(W.slice(stop, stop + 1600), /narrateBuild\(env, \{[\s\S]*buildFacts: buildFacts\(\{ failure: \{ kind: "stopped"/);
  assert.match(W, /buildFacts: buildFacts\(\{ refusal: tooLong \}\)/);
  assert.match(W, /checks: buildChecks\(pages\),\n\s*\/\/[^\n]*\n\s*ownLogo,/);
  assert.match(W, /langStale: Object\.keys\(langStale\)\.length \? langStale : undefined/);
  // The page shows the written reply first on the routing route's credits refusal.
  assert.match(CHAT, /d\.need === 'credits' && \(routeSaid \|\|[\s\S]{0,300}finish\(routeSaid \|\| d\.msg\)/);
});
