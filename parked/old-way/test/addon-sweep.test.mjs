// PARKED (2026-11-03, park-old-way): the old-way half of test/addon-sweep.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// Guards for scripts/addon-sweep.mjs — the harness that drives the ADD step on
// a live site. Kept to properties, not spellings, the way the other two
// harness guards are.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CASES, chooseCases, sitePathOf, watchJob, blindBackend, crashedRoutes, stopsRun, casesFor, askCase, shipped, askVerdict, ignoredNote, askLines, photoLines, customerLines, browserReply, httpOkOf, BROWSER_FNS, inventoryOf, inventoryDiff, inventoryLines, inventoryRefusals, IMAGE_READING, qrOpens, qrPublished, codeRefusals, expectedCode } from "../../../scripts/addon-sweep.mjs";
import { qrSvg } from "../../../builder/site-qr.mjs";
import { healthImage } from "../../../builder/build-lane.mjs";
import { ADD_KINDS, OWN_ADDS, DISPATCHED_ADDS, PLACING_ADDS, addLayer, MAX_MESSAGE, shownSchema } from "../../../builder/site-add.mjs";
import { routeOf } from "../../../builder/site-addon.mjs";
import { EDIT_LAYERS } from "../../../builder/route-shared.mjs";
// The served page's bands, one copy shared with test/copy-design.test.mjs.
import { SECOND_QUOTES, gridBand, page } from "../../../test/fixtures/testimonial-bands.mjs";

const SRC = readFileSync(new URL("../../../scripts/addon-sweep.mjs", import.meta.url), "utf8");
/**
 * Length-preserving, LINE COMMENTS FIRST — the recorded blanker-order trap, and
 * this file needed one the hour `shipped()` was written: its own comment names
 * `verdict.startsWith("ok")` while explaining why that spelling went, so the
 * absence check below read its own prose as a surviving call site. "Prose
 * contains the thing it forbids", inside the guard written for it.
 */
function blank(src) {
  let out = "", i = 0;
  while (i < src.length) {
    if (src[i] === "/" && src[i + 1] === "/") {
      let j = i; while (j < src.length && src[j] !== "\n") j++;
      out += " ".repeat(j - i); i = j; continue;
    }
    if (src[i] === "/" && src[i + 1] === "*") {
      let j = src.indexOf("*/", i + 2); j = j < 0 ? src.length : j + 2;
      out += src.slice(i, j).replace(/[^\n]/g, " "); i = j; continue;
    }
    out += src[i]; i++;
  }
  return out;
}
const CODE = blank(SRC);
// THE BLANKER'S OWN OBSERVER: the landmarks the absence checks are about to
// look for must have survived it, or a reader that ate the file satisfies every
// one of them perfectly.
assert.ok(CODE.includes("export function shipped(verdict)"), "the blanker ate the harness");
assert.ok(CODE.includes("if (shipped(verdict) && crashed.length)"), "the blanker ate the render downgrade");
const WF = readFileSync(new URL("../../../.github/workflows/lane-sweep.yml", import.meta.url), "utf8");
const W = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");

// The trace each refusal case reads off the page, and the reply a real
// addition of it carries — derived per case, so a case added without one
// fails the guard below by name rather than passing vacuously.
const REFUSAL_FIXTURES = {
  qr: { html: '<html><img src="/qr.svg" alt="Scan to ring and book"></html>', reply: { ok: true, added: [], changed: ["index.tsx"], moved: ["qr"] } },
  three: { html: "<html><canvas width=\"1096\" height=\"420\"></canvas></html>", reply: { ok: true, added: [], changed: ["index.tsx"], moved: ["three"] } },
  // `table` LEFT THIS LIST ON 2026-09-03: a table is never refused for want
  // of a database now (the first backend tier makes one), so the case has
  // one honest outcome and is judged with the other backend tiers below.
};

test("the refusal cases are driven to refusals the route really emits, and the hop names a real edit layer", () => {
  const b = W.slice(W.indexOf("\n          if (ad) {"), W.indexOf("\n          if (tx) {"));
  assert.ok(b.length > 1000, "the addon block is gone");
  for (const c of CASES.filter((x) => Array.isArray(x.mayRefuse))) {
    for (const token of c.mayRefuse) assert.ok(b.includes('error: "' + token + '"'), c.name + ": the route never answers error " + token);
  }
  for (const c of CASES.filter((x) => x.hop)) {
    assert.ok(EDIT_LAYERS.includes(c.hop), c.name + ": hops to a layer the edit route does not have");
    assert.equal(addLayer(c.name), c.hop, c.name + ": the harness expects a different layer from the step's own");
  }
  // ── RE-ANCHORED 2026-09-17: THE HOP CASES ARE THE KINDS THAT HOP ALONE ───
  //
  // Each harness case posts ONE ask, so what it exercises is a kind on its own
  // — and `PLACING_ADDS` joined `DISPATCHED_ADDS` in that answer: a photograph
  // by itself is still the picture rung's, and one beside a page or a component
  // is designed here because this step makes the slot. `addLayer` above is the
  // right reader for exactly that reason (it answers what the KIND is), and
  // `DISPATCHED_ADDS` alone is empty today, so pinning to it would have made
  // this a comparison of two empty lists.
  assert.deepEqual(CASES.filter((x) => x.hop).map((x) => x.name).sort(), [...DISPATCHED_ADDS, ...PLACING_ADDS].sort());
  assert.ok(CASES.some((x) => x.hop), "no case hops any more — this block asserts nothing");
  // And the refusal cases are kinds this step designs, which the sweep's site
  // cannot take.
  for (const c of CASES.filter((x) => Array.isArray(x.mayRefuse))) assert.ok(OWN_ADDS.includes(c.name) || PLACING_ADDS.includes(c.name));
});

// ─────────────────────────────────────────────────────────────────────────────
// WHICH CODE IS ANSWERING, ASKED BEFORE ANYTHING IS SPENT (2026-09-15)
// ─────────────────────────────────────────────────────────────────────────────
//
// Owner: *"Verify that both the Worker and the container executing the test use
// the merged changes. Elapsed rollout time alone is insufficient evidence."*
//
// The decision was SPLIT OUT of the fetching wrapper precisely so it could be
// driven — reachable only through two authenticated routes and a live cold
// container, it was this repository's recorded "a wall nobody can drive is a
// wall nobody is guarding", in the one branch whose wrong answer costs credits
// AND produces a complete, plausible, green-looking result about code that is
// not under test.

// RE-ANCHORED, NOT APPEASED (2026-09-18). Every case below was written when the
// only reasons not to spend were about WHICH CODE, so each called `codeRefusals`
// with no `queued` and expected `[]` on a match. Queued work is a separate,
// unconditional requirement now, and a case about the deploy sha that also fails
// for the async reason is a case about two things — so these hold `queued: true`
// and stay about their own subject. `refusals` is that isolation spelled once;
// the async property itself is driven directly in the case below them, which is
// the only place that may leave it out.
const refusals = (o = {}) => codeRefusals({ queued: true, ...o });

