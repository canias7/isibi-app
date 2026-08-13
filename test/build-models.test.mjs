// The Builder picker, and the chain that makes it do anything.
//
// This control shipped, sat in the composer with a tooltip promising a choice,
// and was read ZERO times: `body.picker` appeared nowhere in worker.js and both
// build calls hardcoded `claude-sonnet-5`. That is the failure this repo keeps
// recording — a feature dead at one layer while every other layer is fine — and
// it has been dead at five layers at once before now.
//
// So the tests here run in two halves. The first is ordinary unit testing of the
// allow-list. The second is a REACHABILITY CHAIN, derived from the source at
// both ends, because any one broken link puts the control straight back to being
// decoration and nothing else in the suite would notice.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { BUILD_MODELS, DEFAULT_PICKER, modelsFor } from "../builder/build-models.mjs";
import { MODEL_RATES, buildFloor, MIN_CREDITS, SCHEMA_PROFILE, pageCredits } from "../builder/publish-pages.mjs";
import { pagesRequest } from "../builder/page-gen.mjs";

// What `use_credits` grants an account on first touch — the Postgres RPC's
// number, restated because this file cannot reach the database. If it moves
// there and not here, the guard below silently starts checking the wrong
// budget, which is why it is named rather than inlined.
const FREE_GRANT = 20;

const ROOT = new URL("../", import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, ROOT), "utf8");
// Comments are BLANKED, never removed, so offsets stay valid against the real
// text — the mistake this codebase made three separate times in one session.
const code = (src) => src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));

const worker = read("worker.js");
const workerCode = code(worker);
const chat = read("public/chat.js");

test("the pickers resolve to the models they promise, and Sonnet is the default", () => {
  assert.deepEqual(modelsFor("sonnet"), { picker: "sonnet", design: "claude-sonnet-5", pages: "claude-sonnet-5" });
  assert.deepEqual(modelsFor("opus"), { picker: "opus", design: "claude-opus-5", pages: "claude-opus-5" });
  // THE DEFAULT IS THE CHEAP ONE, and that is a decision rather than a habit:
  // a cold Opus schema call is 15 credits against a 20-credit grant, which left
  // a new account unable to finish its own first build. Asserted against the
  // real floor below rather than pinned as a name, so the two cannot disagree.
  assert.equal(DEFAULT_PICKER, "sonnet");
  assert.deepEqual(modelsFor(), modelsFor("sonnet"));
  // `auto` was removed the same day it was wired. A stored picker from those
  // hours must resolve to the default, not to an undefined pair.
  assert.ok(!Object.hasOwn(BUILD_MODELS, "auto"), "auto is back — check the grant covers a ~23-credit build");
  assert.deepEqual(modelsFor("auto"), modelsFor("sonnet"), "a stale stored picker must fall back");
});

test("the default picker's build fits inside the free grant", () => {
  // THE REGRESSION, PINNED. Wiring the picker made `auto` real, `auto` put the
  // schema call on Opus, and a cold Opus schema call is 15 credits against a
  // grant of 20 — leaving less than `MIN_CREDITS`, so the pages call was refused
  // and the customer paid 15 for a placeholder. Measured by `build smoke` going
  // red on the first run after the merge, with `stage: "credits"`.
  //
  // No unit test could have caught it: they all asserted the picker sends the
  // right model and prices it correctly, which it did. Nothing modelled a whole
  // build against a real starting balance. This is that test.
  assert.ok(buildFloor(modelsFor().design) <= FREE_GRANT,
    "a new account cannot finish its own first build on the default picker: needs " +
    buildFloor(modelsFor().design) + ", has " + FREE_GRANT);
  // And the expensive option genuinely does not fit, or this guard is passing
  // because the floor stopped meaning anything.
  assert.ok(buildFloor(BUILD_MODELS.opus.design) > FREE_GRANT,
    "Opus now fits in the grant — restoring `auto` may be worth revisiting");
});

test("every choice is genuinely a different one, not one wearing two labels", () => {
  // The whole point of wiring this was that every option produced byte-identical
  // requests. A change that collapses any two of them back together brings that
  // state back, and every other test here would still pass. Derived from the
  // table rather than counting to a number, so removing `auto` did not need this
  // test edited — and adding one back cannot slip past it.
  const seen = new Set(Object.keys(BUILD_MODELS).map((k) => {
    const m = modelsFor(k);
    return m.design + "|" + m.pages;
  }));
  assert.equal(seen.size, Object.keys(BUILD_MODELS).length, "two pickers now send the same pair of models");
});

test("picker is an ALLOW-LIST, and a prototype key is not a model", () => {
  // `picker` comes out of a request body. An unknown value is not a model id to
  // pass to the API, it is a field to ignore.
  for (const junk of ["", "haiku", "gpt-4", "OPUS", "auto ", 7, null, undefined, {}, ["opus"]]) {
    assert.equal(modelsFor(junk).picker, DEFAULT_PICKER, JSON.stringify(junk) + " was not refused");
  }
  // SHIPPED ONCE ALREADY, in the Stripe plan lookup: `PLANS[String(body.plan)]`
  // accepted "__proto__" and "constructor" because both are truthy, and Stripe
  // was sent `unit_amount: "undefined"`.
  for (const k of ["__proto__", "constructor", "toString", "hasOwnProperty"]) {
    const m = modelsFor(k);
    assert.equal(m.picker, DEFAULT_PICKER, k + " resolved through the prototype");
    assert.equal(typeof m.design, "string");
    assert.equal(typeof m.pages, "string");
  }
  // No argument at all is the default too — that is what `pagesRequest` and
  // `designSiteSchema` fall back to, and what a caller offering no choice gets.
  assert.deepEqual(modelsFor(), modelsFor(DEFAULT_PICKER));
  assert.ok(Object.hasOwn(BUILD_MODELS, DEFAULT_PICKER), "the default names no picker");
});

test("every model a picker can select has a price", () => {
  // The pair that decides whether wiring this shipped a silent undercharge.
  // Derived from both files rather than listed, because a model added to one and
  // not the other is invisible: `ratesFor` falls back rather than throwing.
  for (const [key, pair] of Object.entries(BUILD_MODELS)) {
    for (const half of ["design", "pages"]) {
      assert.ok(Object.hasOwn(MODEL_RATES, pair[half]),
        `picker "${key}" sends ${pair[half]} for ${half} and nothing prices it`);
    }
  }
});

// ── the chain ────────────────────────────────────────────────────────────────

test("the composer sends the picker on a build AND on a revise", () => {
  // THE REVISE DID NOT SEND IT AT ALL. So the one path where somebody has
  // already seen a result and is reaching for a better model was the path that
  // could not ask for one — a gap that looks exactly like the feature working.
  const i = chat.indexOf("const body = mode === 'build'");
  assert.ok(i > 0, "the send body moved; this guard is now watching nothing");
  const block = chat.slice(i, i + 500);
  const halves = block.split("slug: site.slug");
  assert.equal(halves.length, 2, "the build/revise split is no longer recognisable here");
  assert.match(halves[0], /picker: buildPicker/, "a build sends no picker");
  assert.match(halves[1], /picker: buildPicker/, "a revise sends no picker");
});

test("the build route resolves the picker ONCE and gives it to both calls", () => {
  assert.match(workerCode, /const models = modelsFor\(body\.picker\)/,
    "the route does not read body.picker through the allow-list");
  // Both calls, by name. Reading the field and then not using it is precisely
  // the state this whole change was fixing.
  // NOT ANCHORED ON THE CLOSING PAREN. This was `models\.design\)` and went red
  // the day the designer gained a fourth argument (the site's current state on
  // an edit) — a correct change failing a test about arity, which is this repo's
  // recurring source-guard bug.
  assert.match(workerCode, /designSiteSchema\(env, briefWithLinks, models\.design\b/,
    "the designer is not given the chosen model");
  assert.match(workerCode, /model: models\.pages/,
    "page generation is not given the chosen model");
  // ONCE. Two resolutions of one field is how the designer and the pages end up
  // on models chosen by two different readings of it.
  assert.equal((workerCode.match(/modelsFor\(body\.picker\)/g) || []).length, 1);
});

test("the model reaches the API, and the same one reaches the meter", () => {
  // Both calls build a request object and then stamp the usage from `req.model`,
  // so the model we bill for is the model we sent. A literal in either place is
  // a fourth copy of a model id and a place for the two to diverge.
  // THE SLICE ENDS AT THE NEXT FUNCTION, NOT AT A DISTANT LANDMARK. The first
  // draft ran both windows to the same far-off anchor, so the designer's window
  // swallowed the pages call — and a mutation deleting the designer's own stamp
  // SURVIVED, satisfied by the other function's copy a hundred lines below.
  const nextFn = (from) => {
    const m = /\n(?:async )?function [A-Za-z]/.exec(workerCode.slice(from + 1));
    return m ? from + 1 + m.index : workerCode.length;
  };
  for (const fn of ["async function designSiteSchema", "async function generateSitePages"]) {
    const i = workerCode.indexOf(fn);
    assert.ok(i > 0, fn + " is gone; this guard watches nothing");
    const body = workerCode.slice(i, nextFn(i));
    assert.ok(body.length > 500 && body.length < 20000, fn + ": the window is not one function");
    assert.ok(!/model:\s*"claude-/.test(body), fn + " hardcodes a model again");
    assert.match(body, /model:\s*req\.model/, fn + " does not price what it sent");
  }
});

test("research does NOT follow the picker, and is priced at what it sent", () => {
  // A STATED DECISION, pinned. Research is a factual lookup — run these
  // searches, report what came back — which is the step in a build where the
  // model matters least, and the server-side search tool is versioned per model,
  // so moving it is a way to break searching entirely in exchange for nothing
  // anybody would see. Left unpinned, that is a price change and a tool-version
  // risk that no test would mention.
  const i = workerCode.indexOf("async function siteWebResearch");
  assert.ok(i > 0, "the research call is gone; this guard watches nothing");
  const body = workerCode.slice(i, workerCode.indexOf("async function generateSitePages", i));
  assert.match(body, /const RESEARCH_MODEL = "claude-sonnet-5"/,
    "research changed model — the web_search tool is versioned per model, so this needs proving, not assuming");
  assert.ok(!/models\.(design|pages)/.test(body), "research started following the Builder picker");
  // ONE CONSTANT, SENT AND BILLED, and the two assertions have to name
  // DIFFERENT lines or one satisfies the other. A bare /model: RESEARCH_MODEL/
  // for the request was answered by the usage line below it, so a mutation
  // putting a literal back in the request survived — the overlapping-window
  // mistake, a third time, in one change.
  assert.match(body, /model: RESEARCH_MODEL,\s*\n\s*max_tokens:/, "the request does not use the constant");
  assert.match(body, /searches: 0, model: RESEARCH_MODEL/, "the usage does not name what was sent");
  assert.ok(Object.hasOwn(MODEL_RATES, "claude-sonnet-5"));
});

test("pagesRequest honours an explicit model and defaults to the picker's", () => {
  const args = { brief: "a cafe", spec: { tables: [] }, brand: "Cafe" };
  assert.equal(pagesRequest(args).model, modelsFor().pages, "the default is not the default picker's");
  assert.equal(pagesRequest({ ...args, model: "claude-opus-5" }).model, "claude-opus-5");
  // Everything else about the request is unchanged by the choice — the cached
  // system block especially, since a different prompt would mean a different
  // cache entry and the picker would quietly cost a cache write.
  const a = pagesRequest(args);
  const b = pagesRequest({ ...args, model: "claude-opus-5" });
  assert.deepEqual(a.system, b.system, "changing the model changed the cached prefix");
  assert.deepEqual(a.messages, b.messages);
  assert.equal(a.max_tokens, b.max_tokens);
});

test("the response says which models actually ran", () => {
  // The RESOLVED picker, never `body.picker`. Echoing back what was sent reports
  // a typo as if it had been honoured — which is the exact state this control
  // spent its whole life in, and the reason nobody noticed.
  assert.match(workerCode, /models: \{ picker: models\.picker/, "the build response hides which models ran");
  assert.ok(!/picker: body\.picker/.test(workerCode), "the response echoes the request instead of the resolution");
});

test("Effort is visible and inert, and that is a DECISION", () => {
  // Owner's call 2026-08-08: "leave the effort thing off, leave it there but
  // doesn't work, i want it like that". Pinned because "we forgot" and "we
  // decided" look identical in a list of controls a year later — the same reason
  // `toast` has a test saying it was refused rather than overlooked.
  // RENDERED, not merely defined. The first draft matched `buildEffortHTML()`
  // anywhere in the file, which its own definition satisfies — so a mutation
  // dropping the call out of the composer markup SURVIVED with the control gone
  // from the screen. Same shape as the Bookmarks guard that matched its own
  // explanatory comment.
  const render = chat.indexOf("buildPickerHTML() +");
  assert.ok(render > 0, "the composer no longer renders the Builder control");
  assert.match(chat.slice(render, render + 200), /buildEffortHTML\(\) \+/,
    "the Effort control was removed; it is meant to stay visible");
  assert.match(chat, /effort: buildEffort/, "the composer stopped sending effort");
  // And the build route must still not read it. `/api/direct` does — that is a
  // different feature — so this is scoped to the builder's own handler.
  const i = workerCode.indexOf("const models = modelsFor(body.picker)");
  assert.ok(i > 0);
  const route = workerCode.slice(i, workerCode.indexOf("models: { picker: models.picker", i));
  assert.ok(route.length > 1000, "the build route block could not be located");
  assert.ok(!/body\.effort/.test(route), "the build route now reads body.effort — was that deliberate?");
});

test("the whole build is affordable before anything is spent", () => {
  // THE FIX FOR THE REGRESSION ABOVE. The route used to charge the deposit,
  // run the schema call, settle it — and only then did `publishPages` read the
  // ledger, find less than MIN_CREDITS and refuse to generate. The pages model
  // was never called at all: we spent their budget on step one and then declined
  // to do step two, which is ours and not theirs.
  const w = workerCode;
  const i = w.indexOf("const floor = buildFloor(models.design);");
  assert.ok(i > 0, "the build no longer checks it can afford itself");
  // BEFORE the schema call, or it is the same bug with an extra number in it.
  const design = w.indexOf("designSiteSchema(env, briefWithLinks");
  assert.ok(design > 0 && i < design, "the affordability check runs after the model call it is meant to gate");
  const block = w.slice(i, i + 900);
  // Off the ledger value the deposit returned, not a second read that could race.
  assert.match(block, /balanceAfter \+ SITE_BUILD_FEE < floor/, "the floor is compared against something else");
  // The deposit comes BACK — nothing was spent, so this is a refusal and not a
  // failure. Without it the gate itself takes 2 credits for doing nothing.
  assert.match(block, /creditBack\(env, bu\.id, SITE_BUILD_FEE\)/, "the refusal keeps the deposit");
  assert.match(block, /status: 402/);
  // And it names the way out that is not "give us money" — the customer picking
  // Opus with 20 credits can simply pick Sonnet.
  assert.match(block, /Sonnet 5/, "an Opus refusal does not mention the option that would work");
});

test("the floor is derived from the price table, not a number somebody typed", () => {
  // Two models, two floors, and the dear one must really be dearer — a floor
  // computed from a constant would satisfy every other assertion here while
  // being wrong for one of the two pickers.
  const s = buildFloor("claude-sonnet-5");
  const o = buildFloor("claude-opus-5");
  assert.ok(o > s, "an Opus build's floor is not higher than a Sonnet one's");
  assert.ok(s > MIN_CREDITS, "the floor forgot the schema call entirely");
  // Exactly the schema call plus what the pages call needs, so the two halves
  // stay visible rather than being folded into one tuned number.
  assert.equal(s, pageCredits({ ...SCHEMA_PROFILE, model: "claude-sonnet-5" }) + MIN_CREDITS);
  // The profile is a MEASUREMENT and is cold on purpose: a gate that
  // under-estimates takes the money and then refuses to finish.
  assert.ok(SCHEMA_PROFILE.cacheWrite > 0 && SCHEMA_PROFILE.cacheRead === 0,
    "the profile went warm — the gate will now under-estimate the case it exists for");
});

test("the composer offers exactly the pickers that exist, and no more", () => {
  // DERIVED AT BOTH ENDS. A mutation adding `auto` back to the rendered list
  // survived everything: the composer would offer an option the server resolves
  // to the default, so the customer picks Opus-plans-Sonnet-builds and silently
  // gets Sonnet — a control lying about what it does, which is the exact state
  // this whole feature was fixing.
  const declared = Object.keys(BUILD_MODELS).sort();
  const listed = (chat.match(/\[((?:'\w+',?\s*)+)\]\.map\(\(k\) => \{ const m = BUILD_PICKERS/) || [])[1];
  assert.ok(listed, "the picker menu no longer renders from a list; this guard checks nothing");
  const offered = listed.split(",").map((s) => s.trim().replace(/'/g, "")).filter(Boolean).sort();
  assert.deepEqual(offered, declared,
    "the composer offers " + offered.join("/") + " and the server knows " + declared.join("/"));

  // And the LABELS exist for each, or the menu renders "undefined".
  for (const k of declared) {
    assert.ok(new RegExp("\\b" + k + ":\\s*\\{\\s*label:").test(chat), k + " has no label in the composer");
  }
});

test("a picker stored from the hours `auto` existed falls back", () => {
  // It is in real browsers' localStorage. Without the fallback the button
  // renders `undefined` and every build sends a picker the server ignores —
  // visible to the customer as the control having broken.
  assert.match(chat, /if \(!BUILD_PICKERS\[buildPicker\]\) buildPicker = 'sonnet';/,
    "a stale stored picker is no longer repaired");
  assert.match(chat, /localStorage\.getItem\(BUILD_PICKER_KEY\) \|\| 'sonnet'/,
    "the composer default disagrees with the server default");
  // The two defaults must BE the same, not merely both look right.
  assert.ok(chat.includes("'" + DEFAULT_PICKER + "'"), "the composer never names the server's default");
});

// ─────────────────────────────────────────────────────────────────────────────
// THE JOURNEY, NOT THE STEP. `buildFloor <= FREE_GRANT` models the build in
// isolation, and a real first build is not in isolation: the customer types a
// brief, that goes through `/api/site/route` first, and a routing call rounds up
// to the 1-credit floor however cheap the model is. So the balance the build
// actually meets is the grant MINUS that.
//
// It is the difference between passing and failing right now. Measured
// 2026-08-13 with the re-taken SCHEMA_PROFILE: the floor is exactly 20 against a
// grant of exactly 20 — green with zero headroom — while a real new customer
// arrives at the gate with 19 and is refused.
const ROUTING_CREDITS = 1;

test("a cold first build does NOT fit once the routing call is counted — pinned, not fixed", () => {
  // RECORDED AS A FACT, deliberately, rather than asserted as a requirement.
  //
  // The requirement would be red today, and a permanently red suite is one
  // people stop reading — which is how the schema eval sat dead for a day. The
  // limitation is real and its fix is a decision about MONEY (raise the grant),
  // not a number to correct in this file. So it is pinned in the direction it
  // actually points, and the day somebody raises the grant this goes red and
  // says so.
  const need = buildFloor(modelsFor().design) + ROUTING_CREDITS;
  assert.ok(need > FREE_GRANT,
    "a cold first build now FITS (" + need + " <= " + FREE_GRANT + ") — the grant was raised or the "
    + "schema call got cheaper. Delete this pin and tighten the guard above to include ROUTING_CREDITS.");
  // What the shortfall IS, so the decision has a number attached rather than a
  // direction. Bounded on both sides: a much larger gap means something else
  // moved and the profile wants re-measuring, not the grant raising.
  const short = need - FREE_GRANT;
  assert.ok(short >= 1 && short <= 6,
    "the cold-build shortfall is " + short + " credits, outside the range this pin was written against — "
    + "re-measure SCHEMA_PROFILE before treating it as a grant question");
});
