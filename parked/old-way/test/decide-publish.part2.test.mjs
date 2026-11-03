// PARKED (2026-11-03, park-old-way): the old-way half of test/decide-publish.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// THE OWNER'S PUBLISH DECISIONS (2026-10-23): the options chosen on builder
// audit findings #195, #118/#119, #219, #144, #247 and #216
// (docs/history/2026-10-23-decide-publish.md). The driven cases are in
// test/draft-first.test.mjs (DPO*, DPP*, DPR*) and test/edit-path.test.mjs
// ("audit #195"); this file holds the pure rules and the wiring each reads.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { MAX_NEW_SLUG, capNewSlug, previewLabel, rebuildGoesLive, PUBLISH_KEEP_BUILDS, publishKeeps } from "../../../site-draft.mjs";
import { verdictFor, drainRebuild } from "../../../site-rebuild.mjs";

import { siteContextBlock } from "../../../builder/site-converse.mjs";
import { translationBatches, batchKey, stuckFor, stuckAfter, nextCache, langNote, STUCK_KEY, BATCH_MAX_STRINGS, BATCH_MAX_CHARS } from "../../../builder/site-translate.mjs";
import { readableJobKey, allowedJobKey } from "../../../builder/job-gateway.mjs";
import { siteOffline } from "../../../builder/site-offline.mjs";
import { driveBuild, GOOD_DESIGN, BRIEF } from "../../../test/fixtures/build-route.mjs";
import { loadWorker } from "../../../test/fixtures/worker-harness.mjs";
import { withWire as askWire, routeCall, envFor, bucket as askBucket, freshSlug } from "../../../test/fixtures/live-ask.mjs";

const WORKER = fs.readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
const blank = (s) => s.replace(/^([ \t]*)\/\/.*$/gm, (m) => " ".repeat(m.length));
const W = blank(WORKER);
const fnOf = (name) => {
  let at = W.indexOf("async function " + name + "(");
  if (at < 0) at = W.indexOf("function " + name + "(");
  assert.ok(at >= 0, name + " is gone — rescope this guard");
  const end = W.indexOf("\n}\n", at);
  assert.ok(end > at, name + " never closes");
  return W.slice(at, end);
};
const TOKEN = "0123456789ab";

test("#216 the route tells the router from the Worker's own switch, never the body's word", async () => {
  const worker = await loadWorker();
  for (const [on, want] of [["on", true], ["", false]]) {
    const slug = freshSlug("dp216" + (on ? "on" : "off"));
    const store = askBucket(slug);
    await askWire({ route: { intent: "ask", answer: "Press Publish." }, converse: "Press the Publish button." }, async (seen) => {
      const env = { ...envFor(store), DRAFT_FIRST: on };
      const r = await routeCall(worker, env, { slug, message: "publish my changes", extra: { site: { name: "Harbour Loaf", url: "https://" + slug + ".gofarther.app", pages: ["/"], tables: [], draftFirst: !want } } });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const asked = seen.routerAsked[0];
      assert.ok(asked, "the router was never asked");
      const told = String(asked.messages[0].content);
      assert.equal(told.includes("Publish button above their site"), want, (want ? "not told" : "told") + " about drafts: " + told.slice(0, 400));
    });
  }
});
