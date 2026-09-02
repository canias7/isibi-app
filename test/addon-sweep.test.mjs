// Guards for scripts/addon-sweep.mjs — the harness that drives the ADD step on
// a live site. Kept to properties, not spellings, the way the other two
// harness guards are.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CASES, chooseCases, sitePathOf } from "../scripts/addon-sweep.mjs";
import { ADD_KINDS, OWN_ADDS, DISPATCHED_ADDS, addLayer } from "../builder/site-add.mjs";
import { routeOf } from "../builder/site-addon.mjs";
import { EDIT_LAYERS } from "../builder/site-ask.mjs";

const SRC = readFileSync(new URL("../scripts/addon-sweep.mjs", import.meta.url), "utf8");
const WF = readFileSync(new URL("../.github/workflows/lane-sweep.yml", import.meta.url), "utf8");
const W = readFileSync(new URL("../worker.js", import.meta.url), "utf8");

test("importing the harness runs nothing", () => {
  assert.ok(Array.isArray(CASES) && CASES.length > 0);
});

// ── THE TWO-LISTS RULE, POINTED AT THE HARNESS ─────────────────────────────
//
// A kind added to the step with no case is a kind the sweep silently skips and
// reports as "all passed"; a case for a kind the step does not have spends a
// credit asking for something the picker cannot name. Both directions, derived
// from the real `ADD_KINDS`.
test("every kind has a case and every case names kinds the step has", () => {
  const named = new Set(CASES.flatMap((c) => c.kinds));
  for (const k of ADD_KINDS) assert.ok(named.has(k), "`" + k + "` is a kind the sweep never exercises");
  for (const c of CASES) {
    assert.ok(Array.isArray(c.kinds) && c.kinds.length, c.name + ": names no kind");
    for (const k of c.kinds) assert.ok(ADD_KINDS.includes(k), c.name + ": names a kind the step does not have: " + k);
    assert.ok(ADD_KINDS.includes(c.name), c.name + ": a case's identity is a kind");
  }
  const ids = CASES.map((c) => c.name);
  assert.equal(new Set(ids).size, ids.length, "two cases share a name — which one is the verdict?");
  assert.ok(ADD_KINDS.length >= 6, "the observer is alive");
});

test("every case can be judged, and judges the site rather than the reply", () => {
  const same = { build: "b1", status: 200, html: "<html></html>", text: "Sheffield Beginner Guitar", hrefs: ["/"], routes: ["/"] };
  for (const c of CASES) {
    assert.equal(typeof c.ask, "string", c.name + ": no ask");
    assert.ok(c.ask.trim().length > 10, c.name + ": an ask too short to route");
    assert.equal(typeof c.check, "function", c.name + ": no check");
    // A refusal case passes on an unmoved build — that is its whole claim —
    // and the hop case passes on the hop; the rest must FAIL against a site
    // that did not change.
    if (Array.isArray(c.mayRefuse)) {
      assert.equal(c.check(same, { ...same }, {}, {}).ok, true, c.name + ": an unmoved build is not the honest-refusal pass");
      assert.equal(c.check(same, { ...same, build: "b2" }, {}, {}).ok, false, c.name + ": a moved build on a refusal passes");
      continue;
    }
    if (c.hop) {
      assert.equal(c.check(same, same, {}, { hopped: c.hop }).ok, true);
      assert.equal(c.check(same, same, {}, {}).ok, false, c.name + ": passes without the hop");
      continue;
    }
    const v = c.check(same, { ...same }, { ok: true, added: [], changed: [] }, {});
    assert.equal(v.ok, false, c.name + ": passes against a site that did not change");
    assert.equal(typeof v.note, "string", c.name + ": gives no note");
  }
});

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
  // The dispatched kinds are exactly the hop cases, both ways.
  assert.deepEqual(CASES.filter((x) => x.hop).map((x) => x.name).sort(), [...DISPATCHED_ADDS].sort());
  // And the refusal cases are own kinds the sweep's site cannot take.
  for (const c of CASES.filter((x) => Array.isArray(x.mayRefuse))) assert.ok(OWN_ADDS.includes(c.name));
});

test("the harness posts to the addon route, follows one hop to the edit route, and never touches the build route", () => {
  assert.match(SRC, /\/api\/site\/\$\{encodeURIComponent\(SLUG\)\}\/addon/, "the harness does not post to the addon route");
  assert.match(SRC, /\/api\/site\/\$\{encodeURIComponent\(SLUG\)\}\/edit/, "the hop does not land on the edit route");
  assert.ok(!/react-build|react-revise|\/api\/site\/build/.test(SRC), "the harness reaches for the build route");
  // The hop is gated on the case AND on the reply naming that layer.
  assert.match(SRC, /if \(c\.hop && body\.escalate === true && body\.layer === c\.hop\)/, "the hop is not gated on the reply naming the case's layer");
  // A claimed publish waits for the build id to move; a refusal is read at once.
  assert.match(SRC, /if \(body\.ok === true \|\| extra\.hopOk\) \{/, "a publish is not waited for");
  // Red on a lie, a lost answer, or a failure — never green by default.
  assert.match(SRC, /\/LIE\|NO ANSWER\|\^failed\$\/\.test\(r\.verdict\)/, "a failed case is a green run");
});

test("chooseCases refuses a stranger before anything is spent and forgives punctuation", () => {
  assert.deepEqual(chooseCases("all", CASES), CASES.map((c) => c.name));
  assert.deepEqual(chooseCases(" page, section. ", CASES), ["page", "section"]);
  assert.deepEqual(chooseCases("qr,qr", CASES), ["qr"]);
  assert.throws(() => chooseCases("page,nope", CASES), /not a case: "nope"/);
});

test("the reply's paths are read the way the module reads them", () => {
  for (const f of ["gallery.tsx", "src/routes/gallery.tsx", "index.tsx", "about.team.tsx", "_layout.tsx", "x.txt"]) {
    assert.equal(sitePathOf(f), routeOf(f), f);
  }
});

test("the workflow runs this harness behind the `addon` word and says what it costs", () => {
  const run = WF.split("\n").find((l) => /node scripts\/lane-sweep\.mjs/.test(l));
  assert.ok(run, "the sweep's run line is gone");
  assert.match(run, /"addon" \]; then node scripts\/addon-sweep\.mjs/, "the `addon` word does not run this harness");
  assert.match(WF, /harness:\n\s+description: '[^']*addon \(the ADD step[^']*section,page,table,qr,three,photo/, "the harness input does not name the addon sweep and its cases");
});
