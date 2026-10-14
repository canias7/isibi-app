// RUN 152, REPLAYED FROM ITS OWN SAVED EVIDENCE (2026-10-14).
//
// The owner, after Codex downloaded run 152's canary-evidence and compared its
// stored sources: *"Close the preservation uncertainty with a reproducible
// offline comparison of that saved evidence. Correct the generic footer-link
// checker to honor the requested destination and footer scope without
// assuming social-icon placement unless the user requested it; retain checks
// for existing links and unrelated content, with negative controls for wrong
// destinations, missing links and unrelated changes. Replay the corrected
// checks against run152's saved artifacts without another paid run, and
// preserve the original failed verdict alongside the corrected findings."*
//
// THE SAVED EVIDENCE is run 152's own (`test/fixtures/run152-evidence.json.gz`,
// built unchanged from canary-evidence.zip, artifact 11861418406, whose zip
// digest is pinned below): the before and after inventories, the stored
// sources, the served pages, the UI run's steps and the verdict the press
// printed. Each control changes that evidence in one place, the way a real
// defect would.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { gunzipSync } from "node:zlib";
import { UI_SCENARIOS } from "../scripts/canary-ui.mjs";
import { requestBatchVerdict } from "../scripts/canary-requests.mjs";
import { footerLinkVerdict, frameOf } from "../scripts/canary-additions.mjs";
import { applyChromeList, chromeListSlots } from "../builder/site-nav.mjs";

const FX = JSON.parse(gunzipSync(fs.readFileSync(new URL("./fixtures/run152-evidence.json.gz", import.meta.url))).toString("utf8"));
const SC = UI_SCENARIOS["acc-clarify-resume"];
const SHOP = "https://shop.harbourloaf.co.uk/bread";
const FOOTER = /^every page's footer gained /;
const BYTES = /^every stored page is byte for byte as it was/;
const failedNames = (v) => v.checks.filter((c) => !c.ok).map((c) => c.name);
const pagesOf = (side) => Object.fromEntries(side.source.pages.map((p) => [p.path, p.source]));

/** The evidence, deep-copied, with `change` applied to the after side's stored sources (by file) or served pages (by route). */
function evidence(change = {}) {
  const fx = JSON.parse(JSON.stringify(FX));
  for (const [path, edit] of Object.entries(change.sources || {})) {
    const page = fx.after.source.pages.find((p) => p.path === path);
    const was = page.source;
    page.source = edit(was);
    assert.notEqual(page.source, was, `the case did not change ${path}`);
  }
  for (const [route, edit] of Object.entries(change.served || {})) {
    const was = fx.after.served[route];
    fx.after.served[route] = edit(was);
    assert.notEqual(fx.after.served[route], was, `the case did not change ${route}`);
  }
  return fx;
}

/** Run 152's verdict, judged again by this tree's verifier with `spec`. */
function judge(spec = SC, fx = FX) {
  const side = (s) => ({ ...s.inventory, source: s.source, complete: s.inventory.readsComplete === true });
  return requestBatchVerdict({
    spec, steps: fx.ui.steps, before: side(fx.before), after: side(fx.after),
    served: fx.after.served, beforeServed: fx.before.served, logo: null, row: null,
    tables: fx.verdict.tables, slug: "fold-lane-bakery", frameLoads: fx.ui.frameLoads,
  });
}

// ── THE EVIDENCE, AND THE VERDICT IT WAS GIVEN ──────────────────────────────

test("R152 1 — the saved evidence is run 152's, and its printed verdict is kept as it was: the clarify check ok, and exactly two content checks failed, both about where the footer link was looked for", () => {
  assert.equal(FX.provenance.run, 38489594737);
  assert.equal(FX.provenance.artifact, 11861418406);
  assert.equal(FX.provenance.zipSha256, "f2c3f669156386a6b7f7afdaf6076f7084db1fbe688484f45fa710d4eb240ff9");
  const saved = FX.verdict;
  assert.equal(saved.ok, false);
  assert.deepEqual(saved.checks.filter((c) => !c.ok).map((c) => c.name), [
    "every page's footer gained the website link to shop.harbourloaf.co.uk/bread and kept every link it had",
    "every stored page is byte for byte as it was, apart from the named changes",
  ]);
  assert.match(saved.checks.find((c) => FOOTER.test(c.name)).why, /index\.tsx's footer gained \[\]/);
  assert.ok(saved.checks.some((c) => c.ok && /^every served footer links to shop\.harbourloaf\.co\.uk\/bread$/.test(c.name)));
  assert.ok(saved.checks.some((c) => c.ok && /^clarify:/.test(c.name)));
  assert.equal(saved.clarify.state, "pass");
  assert.deepEqual(saved.clarify.waitFrom, { ms: 135691, after: 102221 });
  assert.deepEqual(saved.clarify.during, [{ part: 1, how: "running", ms: 135691 }]);
  assert.equal(saved.clarify.release, "observed");
  // THE MONEY: the press's own charges, 25, exactly the balance's move.
  assert.deepEqual({ spent: saved.money.spent, routing: saved.money.routing, edits: saved.money.edits, ok: saved.money.ok }, { spent: 25, routing: 4, edits: 21, ok: true });
});

// ── PRESERVATION, BY A COMPARISON ANYONE CAN RERUN ──────────────────────────

test("R152 2 — PRESERVATION, REPRODUCED: take out exactly the one new 'Online shop' small-print entry from the 11 framed pages, put the Classes heading back and remove the one Order paragraph, and every stored page is byte for byte what it was; the starter page never changed, and the component list is the same (none)", () => {
  const b = pagesOf(FX.before), a = pagesOf(FX.after);
  assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort(), "a page was added or removed");
  const legal = (src, path) => chromeListSlots([{ path, source: src }], "legal").map((s) => s.items);
  let stripped = 0;
  for (const path of Object.keys(a)) {
    let src = a[path];
    const before = legal(b[path], path), after = legal(src, path);
    if (path === "starter.tsx") { assert.equal(src, b[path], "the frameless starter page changed"); continue; }
    // EXACTLY ONE NEW ENTRY, the shop, where the page had none.
    assert.deepEqual(before, [null], `${path} already had small print`);
    assert.deepEqual(after, [[{ label: "Online shop", href: SHOP }]], `${path}'s small print is not exactly the shop link`);
    src = applyChromeList([{ path, source: src }], "legal", []).pages[0].source;
    stripped++;
    if (path === "classes.tsx") {
      assert.equal(src.split('title="How a Saturday class works"').length, 2);
      src = src.replace('title="How a Saturday class works"', 'title="How a Saturday class runs"');
    }
    if (path === "order.tsx") {
      const line = '\n        </p>\n\n        <p className="mt-4 text-sm text-muted-foreground">\n          You can also order online from our shop, using the link at the bottom of every page.';
      assert.equal(src.split(line).length, 2, "the Order paragraph is not exactly the one expected");
      src = src.replace(line, "");
    }
    assert.equal(src, b[path], `${path} differs beyond the three named changes`);
  }
  assert.equal(stripped, 11);
  assert.deepEqual(FX.after.source.parts, FX.before.source.parts);
  assert.deepEqual(FX.after.source.parts, []);
});

// ── THE CORRECTED FOOTER CHECK ON RUN 152 ───────────────────────────────────

test("R152 3 — REPLAYED UNDER THE CORRECTED CHECK: the footer link to the shop counts in the small print (no placement was asked for), every footer kept its links, the byte-for-byte check passes, and nothing else moves", () => {
  const v = judge();
  const old = FX.verdict.checks;
  assert.deepEqual(failedNames(v), [], JSON.stringify(v.checks.filter((c) => !c.ok)));
  const f = v.checks.find((c) => FOOTER.test(c.name));
  assert.equal(f.name, "every page's footer gained a link to shop.harbourloaf.co.uk/bread (in either footer list: no placement was asked for) and kept every link it had");
  assert.ok(f.ok);
  assert.ok(v.checks.find((c) => BYTES.test(c.name)).ok);
  // EVERY OTHER CHECK reads exactly as the press printed it.
  const others = (list) => list.filter((c) => !FOOTER.test(c.name) && !BYTES.test(c.name)).map((c) => `${c.ok ? "ok" : "FAIL"} ${c.name}`);
  assert.deepEqual(others(v.checks), others(old));
  assert.equal(v.clarify.state, "pass");
  assert.equal(v.ok, true);
  // WHERE IT LANDED, read directly: one small-print entry on each of the 11 framed pages, no social icon gained.
  const framed = [...frameOf(FX.before.source.pages).keys()];
  const r = footerLinkVerdict({ framed, fb: frameOf(FX.before.source.pages), fa: frameOf(FX.after.source.pages), want: SC.expect.social });
  assert.deepEqual({ ok: r.ok, gained: r.gained, placed: r.placed }, { ok: true, gained: 11, placed: { social: 0, legal: 11 } });
});

// ── NEGATIVE CONTROLS, EACH ON RUN 152'S OWN EVIDENCE ───────────────────────

const legalOn = (src, items) => applyChromeList([{ path: "x.tsx", source: src }], "legal", items).pages[0].source;
const socialOf = (src) => chromeListSlots([{ path: "x.tsx", source: src }], "social")[0].items;

test("R152 4 — NEGATIVE: a WRONG DESTINATION (the small-print link goes to another address) fails the footer check, stored and served", () => {
  const fx = evidence({
    sources: { "index.tsx": (s) => legalOn(s, [{ label: "Online shop", href: "https://shop.harbourloaf.co.uk/cakes" }]) },
    served: { "/": (h) => h.split(SHOP).join("https://shop.harbourloaf.co.uk/cakes") },
  });
  const v = judge(SC, fx);
  const f = v.checks.find((c) => FOOTER.test(c.name));
  assert.equal(f.ok, false);
  assert.match(f.why, /index\.tsx's footer gained \[\{"list":"legal","label":"Online shop","href":"https:\/\/shop\.harbourloaf\.co\.uk\/cakes"\}\]/);
  assert.equal(v.checks.find((c) => /^every served footer links to/.test(c.name)).ok, false);
});

test("R152 5 — NEGATIVE: a MISSING LINK (one page never gained it) fails; so does a SECOND link gained beside it", () => {
  const missing = judge(SC, evidence({ sources: { "visit.tsx": (s) => legalOn(s, []) } }));
  const f = missing.checks.find((c) => FOOTER.test(c.name));
  assert.equal(f.ok, false);
  assert.match(f.why, /visit\.tsx's footer gained \[\]/);
  const twice = judge(SC, evidence({ sources: { "faq.tsx": (s) => legalOn(s, [{ label: "Online shop", href: SHOP }, { label: "Press", href: "https://example.com/press" }]) } }));
  assert.equal(twice.checks.find((c) => FOOTER.test(c.name)).ok, false);
});

test("R152 6 — NEGATIVE: an EXISTING LINK LOST (a social icon dropped while the shop link was added) fails the footer check; the byte-for-byte check alone could not see it, since the footer lists are the footer check's", () => {
  const fx = evidence({ sources: { "bakers.tsx": (s) => applyChromeList([{ path: "x.tsx", source: s }], "social", socialOf(s).filter((x) => x.network !== "tiktok")).pages[0].source } });
  const f = judge(SC, fx).checks.find((c) => FOOTER.test(c.name));
  assert.equal(f.ok, false);
  assert.match(f.why, /bakers\.tsx's footer social links did not keep what they had in order/);
});

test("R152 7 — NEGATIVE: an UNRELATED CHANGE (the footer's tagline, or a word on a page) fails the byte-for-byte check while the footer check still passes", () => {
  for (const [path, edit] of [
    ["gallery.tsx", (s) => s.replace('tagline: "A neighbourhood sourdough bakery in Bristol."', 'tagline: "A sourdough bakery in Bristol."')],
    ["wholesale.tsx", (s) => s.replace("Bread for the counter", "Bread for your counter")],
  ]) {
    const v = judge(SC, evidence({ sources: { [path]: edit } }));
    const bytes = v.checks.find((c) => BYTES.test(c.name));
    assert.equal(bytes.ok, false, path);
    assert.match(bytes.why, new RegExp(path.replace(".", "\\.") + " changed"));
    assert.ok(v.checks.find((c) => FOOTER.test(c.name)).ok, path);
  }
});

test("R152 8 — PLACEMENT ASKED FOR: had the request named the social icons (`list: \"social\"`), run 152's small-print link would fail — the rule assumes no placement only when none was asked for", () => {
  const asked = { ...SC, expect: { ...SC.expect, social: { ...SC.expect.social, list: "social" } } };
  const f = judge(asked).checks.find((c) => FOOTER.test(c.name));
  assert.equal(f.name, "every page's footer gained a link to shop.harbourloaf.co.uk/bread in its social links (as asked) and kept every link it had");
  assert.equal(f.ok, false);
  assert.match(f.why, /\(asked for in its social links\)/);
  const small = { ...SC, expect: { ...SC.expect, social: { ...SC.expect.social, list: "legal" } } };
  assert.ok(judge(small).checks.find((c) => FOOTER.test(c.name)).ok);
});

test("R152 9 — footerLinkVerdict directly: a social icon for the asked network passes; one for another network fails; a page that already linked the destination may gain nothing", () => {
  const page = (social, legal) => new Map([["p.tsx", { social, legal }]]);
  const want = { network: "instagram", host: "instagram.com", path: "/harbourloaf" };
  const before = page([{ network: "facebook", href: "https://facebook.com/x" }], []);
  const ok = footerLinkVerdict({ framed: ["p.tsx"], fb: before, fa: page([{ network: "facebook", href: "https://facebook.com/x" }, { network: "instagram", href: "https://instagram.com/harbourloaf" }], []), want });
  assert.deepEqual({ ok: ok.ok, placed: ok.placed }, { ok: true, placed: { social: 1, legal: 0 } });
  const wrongNet = footerLinkVerdict({ framed: ["p.tsx"], fb: before, fa: page([{ network: "facebook", href: "https://facebook.com/x" }, { network: "tiktok", href: "https://instagram.com/harbourloaf" }], []), want });
  assert.equal(wrongNet.ok, false);
  const had = page([{ network: "instagram", href: "https://instagram.com/harbourloaf" }], []);
  assert.equal(footerLinkVerdict({ framed: ["p.tsx"], fb: had, fa: had, want }).ok, true);
  assert.equal(footerLinkVerdict({ framed: ["p.tsx"], fb: had, fa: page([{ network: "instagram", href: "https://instagram.com/harbourloaf" }], [{ label: "Instagram", href: "https://instagram.com/harbourloaf" }]), want }).ok, false);
  const unlabelled = footerLinkVerdict({ framed: ["p.tsx"], fb: page([], []), fa: page([], [{ label: " ", href: "https://instagram.com/harbourloaf" }]), want });
  assert.equal(unlabelled.ok, false);
});

// ── THE ESTIMATE AND THE SPECS ───────────────────────────────────────────────

test("R152 10 — THE ESTIMATE COVERS EVERY VALID ROUTE: run 152's 25 credits (the Order line through the Add-on step, 12) fall inside acc-clarify-resume's revised estimate; the scenario does not wall the Add-on off to make it cheaper", () => {
  assert.equal(SC.budget, 34);
  assert.ok(FX.verdict.money.spent <= SC.budget, `run 152's ${FX.verdict.money.spent} is above the revised estimate`);
  assert.equal(SC.addon, true, "the Add-on route was walled off to fit the estimate");
  // THE ORIGINAL OVERRUN STAYS ON RECORD: 25 against the first estimate of 20.
  assert.equal(FX.verdict.money.spent, 25);
});

test("R152 11 — NO SPEC ASKS FOR A FOOTER LIST ITS MESSAGE DOES NOT ASK FOR: a scenario that names `list` quotes the placement words its message says (`asked`)", () => {
  let seen = 0;
  for (const [name, sc] of Object.entries(UI_SCENARIOS)) {
    const s = (sc.expect && sc.expect.social) || (sc.additions && sc.additions.social);
    if (!s) continue;
    seen++;
    if (!s.list) continue;
    assert.ok(typeof s.asked === "string" && s.asked.trim(), `${name} names the ${s.list} list without quoting where it was asked`);
    assert.ok((sc.steps || []).some((st) => (st.say || "").includes(s.asked)), `${name}'s message never says "${s.asked}"`);
  }
  assert.ok(seen >= 6, "the footer-link scenarios were not found");
});
