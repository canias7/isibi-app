// THE BUILD PANEL BELONGS TO THE BUILD (2026-09-08, owner: "it shows that
// screen to the right everytime, even if its just talking back, that should
// only be on the build step because all the other steps are different tho").
//
// `siteBuildStart` runs the instant a message is sent, before the router has
// said whether the message is a build at all — so `siteBusy && siteBuild.react`
// is true for a greeting. The stage panel gated on exactly that and replaced the
// whole right-hand side with a four-stage Design·Code·Compile·Publish rail for
// "hey", while the step rail one pane over correctly said "Thinking".
//
// THE SIGNAL ALREADY EXISTED AND THIS WAS THE ONE CONSUMER THAT DID NOT READ IT.
// `reactSend` moves the phase off `thinking` under a comment that says "WE KNOW
// IT IS A BUILD NOW"; the rail has always asked. So this is the wiring trap's
// quieter face — not a value that never arrives, but a value one of two readers
// never consulted — and it is the same "two halves that can be painted apart
// will eventually disagree" the panel's own comment records about the layer
// below. The fix is one predicate that both ask, and what these guards hold is
// that it stays one.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const chat = read("../public/chat.js");
const css = read("../public/styles.css");

// Whole-line comments blanked, LENGTH PRESERVED so offsets still line up. This
// file's prose names `siteBusy` and `thinking` repeatedly, and so does chat.js's
// — the recorded "prose contains the thing it forbids", which here would let a
// scan find the old gate inside the explanation of why it is gone.
const bare = (s) => s.split("\n").map((l) => (/^\s*\/\//.test(l) ? " ".repeat(l.length) : l)).join("\n");
const BARE = bare(chat);

/** A named function's source, out of the file. */
function fn(head, src = BARE) {
  const at = src.indexOf(head);
  assert.ok(at > 0, head + " is gone");
  const end = src.indexOf("\n}", at);
  assert.ok(end > at, head + " has no end");
  return src.slice(at, end + 2);
}

// ── THE PREDICATE ───────────────────────────────────────────────────────────

/** The phase list, read out of chat.js rather than retyped here. */
function phaseOrder() {
  const m = /const ST_PHASE_ORDER = \[([^\]]+)\]/.exec(BARE);
  assert.ok(m, "ST_PHASE_ORDER is gone");
  const list = m[1].split(",").map((x) => x.trim().replace(/^'|'$/g, "")).filter(Boolean);
  assert.ok(list.length >= 4, "only " + list.length + " phases found — the scan is not reading the file");
  return list;
}

/**
 * The real `stBuildRunning`, evaluated out of chat.js.
 *
 * BOTH ITS INPUTS ARE HANDED IN, and the second one is why this is driven at
 * all: the predicate closes over `ST_PHASE_ORDER`, a module-level constant, so
 * evaluating its body alone threw `ReferenceError` — the recorded free-identifier
 * trap, met inside the guard written for this change. A read would have called
 * the function correct. The order is derived from the file, never retyped, so
 * the two cannot drift.
 */
function predicate() {
  const src = fn("function stBuildRunning()");
  const body = /return ([^;]+);/.exec(src);
  assert.ok(body, "stBuildRunning no longer returns an expression — re-derive this");
  const fnv = new Function("siteBuild", "ST_PHASE_ORDER", "return (" + body[1] + ");");
  const order = phaseOrder();
  return (sb) => fnv(sb, order);
}

test("DRIVEN: a build is running only once something says which phase it is in", () => {
  const running = predicate();

  // THE STATE EVERY MESSAGE STARTS IN. `siteBuildStart` sets it before the
  // router has been asked, so this is the answer for a greeting, a question, and
  // the first seconds of a real build alike.
  assert.equal(running({ rphase: "thinking", react: true }), false,
    "a message whose shape nobody knows yet counts as a running build");

  // AND EVERY PHASE A REAL BUILD REACHES. Derived from the module's own order
  // rather than typed here, so a phase added to that list cannot be one this
  // predicate silently answers `false` for.
  for (const ph of phaseOrder()) {
    assert.equal(running({ rphase: ph, react: true }), true, "a build in `" + ph + "` is not running");
  }

  // NO BUILD IS NOT A RUNNING BUILD. Cannot-tell reads as the earliest state,
  // the rule `EditPoll.buildPhase` keeps one hop over; the alternative is a
  // four-stage rail drawn over a workspace with nothing in flight.
  assert.equal(running(null), false);
  assert.equal(running(undefined), false);
  assert.equal(running({}), false, "a build with no phase at all counts as running");
});

// ── BOTH DISPLAYS ASK IT, AND NEITHER SPELLS THE STATE ITSELF ───────────────

test("the rail and the stage panel ask the ONE predicate", () => {
  // COUNTED AND NAMED. A count alone is satisfied by two calls in one function,
  // and the whole defect was a second display that answered this question its
  // own way — so each consumer is found by name.
  const calls = [...BARE.matchAll(/stBuildRunning\(\)/g)];
  assert.equal(calls.length, 4,
    "expected the definition plus three asks (the rail, the stage gate, the empty-state sentence); found " + calls.length);

  const rail = fn("function reactLiveStepsHTML()");
  assert.match(rail, /if \(!stBuildRunning\(\)\)/,
    "the step rail no longer asks the predicate — it and the panel can disagree again");

  // THE PANEL'S GATE, read between landmarks rather than by byte offset: this
  // file's comments outrun any window sized in bytes, which is a recorded trap
  // and one this very block carries eleven lines of prose into.
  const at = BARE.indexOf('<div class="st-stage" id="stStage"');
  assert.ok(at > 0, "the stage container is gone");
  const end = BARE.indexOf('<div class="st-fixbar"', at);
  assert.ok(end > at, "the stage block has no end landmark — re-derive this window");
  const stage = BARE.slice(at, end);
  // RE-ANCHORED 2026-09-10, and this is the property that was always meant.
  // The whole condition used to be spelled out on the render's own line, and
  // this case pinned that spelling. It is `stStageBuilding` now — because the
  // live painter has to ask the same question to CREATE the panel, and it could
  // not ask a condition written inline in a render — so the chain is asserted
  // instead: the stage goes through the shared decision, and that decision goes
  // through the shared predicate. Being written here was never the property;
  // not deciding this its own way is.
  assert.match(stage, /\(stStageBuilding\(site\)/,
    "the stage panel decides for itself again instead of asking the shared question");
  const decide = fn("function stStageBuilding(");
  assert.match(decide, /stBuildRunning\(\)/,
    "the stage panel is drawn without asking whether a build is running — a greeting takes the preview over again");
  assert.match(decide, /siteBusy && siteBuild && siteBuild\.react/,
    "the stage's decision stopped asking whether a react build is in flight at all");
  assert.match(decide, /!\(site && site\.react && site\.url\)/,
    "the decision no longer exempts a built site — a revise gets its live preview painted over");
});

test("no display decides this by comparing the state word itself", () => {
  // The predicate asks the phase ORDER, so the word `thinking` decides nothing
  // anywhere — and a second comparison, wherever it appeared, would be a second
  // thing that can disagree with the rail. That is what this change removes.
  const tests = [...BARE.matchAll(/rphase\s*[!=]==?\s*'thinking'/g)];
  assert.equal(tests.length, 0,
    "the `thinking` state is compared directly in " + tests.length + " place(s); the predicate is the one reader");
  assert.match(fn("function stBuildRunning()"), /ST_PHASE_ORDER\.indexOf\(siteBuild\.rphase\) >= 0/,
    "the predicate no longer derives from the phase order — a phase added to that list can now read as not-running");
  // AND THE ORDER REALLY LACKS IT, which is the fact the predicate rests on.
  // If `thinking` were ever added to that array every message would count as a
  // build again, silently and everywhere at once.
  const order = /const ST_PHASE_ORDER = \[([^\]]+)\]/.exec(BARE)[1];
  assert.ok(!/thinking/.test(order),
    "`thinking` is in ST_PHASE_ORDER, so every message counts as a running build again");
});

// ── WHAT THE PANEL SHOWS WHILE THE SHAPE IS UNKNOWN ─────────────────────────

test("a react message of unknown shape leaves the panel exactly as it was", () => {
  const at = BARE.indexOf('<div class="st-stage" id="stStage"');
  const end = BARE.indexOf('<div class="st-fixbar"', at);
  const stage = BARE.slice(at, end);

  // THE CLASSIC LOG BOX IS THE CLASSIC BUILD'S. `paintBuildLog` returns early
  // for a react build, so that div is one nothing ever fills — and the moment
  // the gate above narrowed, a react build in `thinking` fell into it and got a
  // blank right-hand side where the invitation had been.
  assert.match(stage, /siteBusy && siteBuild && !siteBuild\.react\s*\n?\s*\? '<div class="st-empty"><div class="st-livelog st-livelog-stage">/,
    "the empty-state branch hands a react build the classic log box, which nothing paints");
  // THE SKIP IS AT THE CALL SITE, not inside the painter — asserted where it
  // lives rather than where I first guessed it did. Nothing paints that box for
  // a react build, which is what makes handing one the box a blank panel.
  const calls = [...BARE.matchAll(/paintBuildLog\(\)/g)];
  assert.ok(calls.length >= 1, "paintBuildLog is never called — the classic box is dead for every build");
  assert.match(BARE, /if \(siteBusy && siteBuild && !siteBuild\.react\) paintBuildLog\(\);/,
    "the classic log painter is no longer skipped for react builds — re-derive why the box is gated");
  assert.match(fn("function siteBuildStart("), /if \(siteBuild\.react\) \{ paintReactLive\(\); return; \}/,
    "the ticker no longer skips the classic painter for a react build");

  // AND THE SENTENCE DOES NOT CLAIM A BUILD EITHER. "Building your site" over a
  // question is the same false statement one font size down.
  assert.match(stage, /siteBusy && stBuildRunning\(\) \? 'Building your site/,
    "the empty state says a site is being built for a message nobody has classified yet");
  assert.match(stage, /Describe your site on the left to build the first draft\./,
    "the observer is alive: the invitation is still the other half of that sentence");
});

// ── THE DECORATION UNDER THE RAIL ───────────────────────────────────────────

test("the busy bubble's ellipsis is suppressed under BOTH live displays", () => {
  // A muted, animated "…" sat under the dense log for the whole of every build,
  // reading at the left edge below the last row as an empty code line. It was
  // suppressed for the classic activity log the day that log got its own box and
  // never for the rail — one list of the things this decoration is redundant
  // beside, with one of them missing.
  const rule = /\.st-msg\.st-busy:has\(\.st-livelog\)::after,\s*\n\s*\.st-msg\.st-busy:has\(\.st-steps\)::after \{ content: none; \}/;
  assert.match(css, rule, "the step rail no longer suppresses the busy bubble's ellipsis");

  // THE OBSERVER IS ALIVE: the decoration itself still exists, so this is a
  // suppression of something rather than an assertion about nothing.
  assert.match(css, /\.st-msg\.st-busy::after \{ content: '…'/,
    "the busy ellipsis is gone entirely — this suppression now proves nothing");

  // AND IT REALLY REACHES THE RAIL: the class the suppression keys on is the one
  // the rail draws. Derived from chat.js, never assumed.
  assert.match(fn("function reactLiveStepsHTML()"), /class="st-steps st-steps-live"/,
    "the rail's wrapper class moved, so the CSS suppression keys on nothing");
  const busy = BARE.indexOf('st-msg a st-busy st-busy-react');
  assert.ok(busy > 0, "the react busy bubble's classes moved — the suppression may no longer apply to it");
});
