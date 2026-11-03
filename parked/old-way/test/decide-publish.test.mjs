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
import { siteDigest, DRAFT_FIRST_FACT } from "../builder/site-ask.mjs";
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

// ── #216: the router and the reply are told changes are drafts ─────────────

test("#216 under draft-first the router is told every change is a draft until Publish, and to point a typed publish at the button", () => {
  const on = siteDigest({ name: "Harbour Loaf", url: "https://h.gofarther.app", pages: ["/"], draftFirst: true });
  assert.ok(on.includes(DRAFT_FIRST_FACT), on);
  assert.match(DRAFT_FIRST_FACT, /goes live only when they press the Publish button/);
  assert.match(DRAFT_FIRST_FACT, /"publish my changes"[^.]*answer \\?"ask\\?" and tell them to press the Publish button/);
  const off = siteDigest({ name: "Harbour Loaf", url: "https://h.gofarther.app", pages: ["/"] });
  assert.ok(!off.includes("Publish button"), "told about drafts with draft-first off");
  // A TRUTHY NON-TRUE IS NOT THE SWITCH.
  assert.ok(!siteDigest({ name: "H", draftFirst: "on" }).includes("Publish button"));
  // AN EMPTY PROJECT IS STILL AN EMPTY PROJECT.
  assert.match(siteDigest({ draftFirst: true }), /brand new, empty project/);
});
