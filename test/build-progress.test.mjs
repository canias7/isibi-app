// SHOW THE BUILDER WORKING (2026-09-07, owner: "WHEN THE BUILDER IS DOING STUIFF,
// IT KINDA NEEDS TO SHOW IT" → design B1 → "do b1").
//
// The progress UI was fully built and never connected. `readReactStream` and its
// whole renderer are reachable only from an NDJSON response `/api/site/react-build`
// has never sent — only the GAME routes do — so `siteBuild.code` was permanently
// `''` and `stCodeBody('', true)` rendered exactly an empty bordered box with one
// blinking caret, for the whole build. Meanwhile `paintReactLive` rewrote only the
// thread, so the stage panel kept the label baked while the phase was still
// `thinking`, and `followBuildJob` polled every six seconds for twenty minutes
// reading nothing but the status code.
//
// These drive the replacement rather than reading it, and they COUNT CALL SITES:
// every defect above is a correct function that nothing called, which is the one
// shape a passing assertion cannot see.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import EditPoll from "../public/edit-poll.js";

const chat = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

// Whole-line comments blanked, length preserved: this file's own prose and
// chat.js's both name the spellings under test — the comment left where the code
// pane used to be says `stCodeBody` in order to explain why it went.
const bare = (s) => s.split("\n").map((l) => (/^\s*\/\//.test(l) ? " ".repeat(l.length) : l)).join("\n");

function fn(head, src = chat) {
  const at = src.indexOf(head);
  assert.ok(at > 0, head + " is gone from chat.js");
  const end = src.indexOf("\n}", at);
  assert.ok(end > at, head + " has no end");
  return src.slice(at, end + 2);
}
// A const declaration up to its own line end, or to a closing `];` for an array.
function decl(head, close = "\n") {
  const at = chat.indexOf(head);
  assert.ok(at > 0, head + " is gone from chat.js");
  const end = chat.indexOf(close, at);
  assert.ok(end > at, head + " has no end");
  return chat.slice(at, end + close.length);
}

// ── THE DECISION, DRIVEN ────────────────────────────────────────────────────

test("DRIVEN: buildPhase turns a 202 body into a word the browser knows, or says nothing", () => {
  const p = EditPoll.buildPhase;
  // The server's four stages.
  assert.equal(p({ phase: "design" }), "planning");
  assert.equal(p({ phase: "provision" }), "planning");
  assert.equal(p({ phase: "generate" }), "generating");
  // THE ONE MAPPING THAT IS NOT OBVIOUS. `budgetStage` calls a build "publish"
  // from the `img` mark onward, and `img` is BEFORE the compile — so answering
  // `publishing` here would tick "Compiled React ✓" over a compile that has not
  // started. That is exactly the defect the images row was removed for: a step
  // reporting what was planned rather than what happened.
  assert.equal(p({ phase: "publish" }), "compiling");

  // The state, for the window before the row learns a stage.
  assert.equal(p({ state: "queued" }), "planning");
  assert.equal(p({ state: "claimed" }), "planning");
  assert.equal(p({ state: "generating" }), "generating");
  // Phase beats state when both are readable.
  assert.equal(p({ phase: "generate", state: "queued" }), "generating");
  // An unknown phase falls through TO the state rather than answering nothing:
  // a stage this browser has not learned yet must not blank a signal it has.
  assert.equal(p({ phase: "nope", state: "claimed" }), "planning");

  // EVERY REFUSAL, beside the answers above so the observer is provably alive.
  for (const junk of [null, undefined, {}, [], ["design"], { phase: ["design"] },
                      { phase: 1 }, { state: "PUBLISH" }, { state: {} }, "generate", 7]) {
    assert.equal(p(junk), "", "a body that says nothing knowable must answer nothing: " + JSON.stringify(junk));
  }

  // AN INHERITED KEY IS NOT AN ANSWER. `BUILD_PHASE_OF["constructor"]` is the
  // Object constructor — truthy — so a lookup written as `if (MAP[x])` hands a
  // FUNCTION back as the phase. This repository shipped that exact shape once in
  // the Stripe plan lookup and came near it three times since, which is why the
  // reader uses `hasOwnProperty` and why that has to be DRIVEN: with truthiness
  // the module's own refusal list above still passes, every entry of it.
  for (const key of ["constructor", "toString", "valueOf", "hasOwnProperty", "__proto__"]) {
    assert.equal(p({ phase: key }), "", "an inherited key answered as a phase: " + key);
    assert.equal(p({ state: key }), "", "an inherited key answered as a state: " + key);
  }
});

test("DRIVEN: the phase only ever moves forward, and only for this workspace", () => {
  // Evaluated out of chat.js with its collaborators handed in — site-list's
  // technique. The property is what it DOES, and the repaint is counted, so a
  // setter that assigns without painting fails.
  const build = (rphase, open) => {
    let painted = 0;
    const api = new Function("siteOpenId", "paintReactLive", "state",
      decl("const ST_PHASE_ORDER = ") + "\n" +
      "let siteBuild = state;\n" + fn("function setBuildPhase(") +
      "\nreturn { set: setBuildPhase, get: () => siteBuild && siteBuild.rphase };")(
        open, () => { painted++; }, rphase === null ? null : { rphase });
    return { ...api, painted: () => painted };
  };

  let a = build("planning", "site_1");
  assert.equal(a.set("site_1", "generating"), true, "a forward move must take");
  assert.equal(a.get(), "generating");
  assert.equal(a.painted(), 1, "a phase that changed must repaint exactly once");

  // BACKWARDS IS REFUSED, and this is the case that is not obvious: the build is
  // polled every six seconds and two answers can land out of order, so a stale
  // one must never un-say what the customer has already been told.
  a = build("compiling", "site_1");
  assert.equal(a.set("site_1", "generating"), false, "a stale poll moved the phase backwards");
  assert.equal(a.get(), "compiling");
  assert.equal(a.painted(), 0, "a refused move must not repaint");
  assert.equal(a.set("site_1", "compiling"), false, "the same phase again is not a change");

  // A FOREIGN WORKSPACE. The customer may have opened another site while this
  // build runs; a poll landing then must not repaint somebody else's screen.
  a = build("planning", "site_1");
  assert.equal(a.set("site_2", "generating"), false);
  assert.equal(a.painted(), 0);

  // NO BUILD AT ALL, and words it does not know — including ones that would snap
  // the display back to the first step through `Math.max(0, -1)` downstream.
  assert.equal(build(null, "site_1").set("site_1", "generating"), false);
  for (const junk of ["", "GENERATING", "nope", ["generating"], null, undefined, 3, {}]) {
    const b = build("planning", "site_1");
    assert.equal(b.set("site_1", junk), false, "an unknown phase moved the display: " + JSON.stringify(junk));
    assert.equal(b.painted(), 0);
  }
});

// ── THE PANEL, DRIVEN ───────────────────────────────────────────────────────

function stageApi() {
  return new Function(
    decl("const ST_PHASE_ORDER = ") +
    decl("const ST_STAGE_STEPS = [", "\n];") +
    decl("const ST_STAGE_TYPICAL_MS = ") +
    fn("function stStageFill(") + "\n" + fn("function stAgo(") + "\n" +
    fn("function buildStageHTML(") + "\n" + fn("function reactStageDetail(") + "\n" +
    fn("function reactStageLabel(") + "\n" +
    "let siteBuild = null;\n" +
    "const esc = (s) => String(s).replace(/[&<>\"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));\n" +
    "return { html: (rp, ago) => { siteBuild = rp === null ? null : { rphase: rp, startedAt: ago === null ? 0 : Date.now() - ago }; return buildStageHTML(); }," +
    "  fill: stStageFill, ago: stAgo, steps: ST_STAGE_STEPS, order: ST_PHASE_ORDER };")();
}

test("DRIVEN: the running segment approaches full and can never reach it", () => {
  const { fill } = stageApi();
  // WITHIN A STAGE WE DO NOT KNOW HOW FAR ALONG WE ARE — the generation's text
  // never leaves its container until it is finished. So this is elapsed time
  // against a rough sense of the stage's length, and a segment that reached the
  // end would be claiming the stage had finished, which is a claim only the build
  // gets to make. A progress display that invents progress is a lying instrument.
  assert.equal(fill(0), 0);
  assert.ok(fill(60_000) > 0 && fill(60_000) < 1);
  assert.ok(fill(4 * 60_000) < 1);
  for (const ms of [10 * 60_000, 60 * 60_000, 24 * 3600_000, Number.MAX_SAFE_INTEGER]) {
    assert.ok(fill(ms) < 1, "the running segment reached full at " + ms + "ms — it claimed a stage had finished");
    assert.ok(fill(ms) <= 0.92, "the ceiling moved; the property is that it never completes");
  }
  // Monotonic, and junk reads as no time at all rather than as a full bar.
  assert.ok(fill(30_000) < fill(90_000));
  for (const junk of [null, undefined, NaN, -5, "soon", [], {}]) assert.equal(fill(junk), 0);
});

test("DRIVEN: the chips are derived from what is actually past, never a fixed pair", () => {
  const { html } = stageApi();
  const chips = (s) => (s.match(/class="st-bchip"/g) || []).length;
  // A build that has only just started has finished nothing.
  assert.equal(chips(html("planning", 4000)), 0, "a just-started build claimed a finished stage");
  assert.equal(chips(html("generating", 60_000)), 1);
  assert.equal(chips(html("compiling", 60_000)), 2);
  assert.equal(chips(html("publishing", 60_000)), 3);
  // And each one names its own stage rather than a generic tick.
  assert.match(html("publishing", 60_000), /✓ Designed/);
  assert.match(html("publishing", 60_000), /✓ Wrote the code/);
  assert.match(html("publishing", 60_000), /✓ Compiled/);
});

test("DRIVEN: the panel says the stage, the detail and the clock, and escapes what it prints", () => {
  const { html, ago } = stageApi();
  const s = html("generating", 252_000);
  assert.match(s, /Writing the code…/, "the hero no longer names the stage");
  assert.match(s, /Writing your pages/, "the detail line is gone");
  assert.match(s, /4m 12s/, "the clock is gone");
  assert.match(s, /class="st-brail"/);
  assert.equal((s.match(/<i style="--w:/g) || []).length, 4, "the rail is not four segments");
  assert.match(s, /Design<\/span>/); assert.match(s, /Publish<\/span>/);

  // THE RAIL, SEGMENT BY SEGMENT — a finished stage full, the running one part
  // way, the ones ahead empty. A sweep left a done segment at the running one's
  // fill and every assertion above passed: four segments were drawn, the clock
  // and the words were right, and the rail simply never filled in behind the run.
  const rail = (p, ms) => [...html(p, ms).matchAll(/<i style="--w:(\d+)%"><\/i>/g)].map((m) => +m[1]);
  const gen = rail("generating", 60_000);
  assert.equal(gen[0], 100, "a finished stage's segment is not full");
  assert.ok(gen[1] > 0 && gen[1] < 100, "the running segment is not part way: " + gen[1]);
  assert.deepEqual(gen.slice(2), [0, 0], "a stage not yet reached has a filled segment");
  assert.deepEqual(rail("publishing", 1000).slice(0, 3), [100, 100, 100],
    "three finished stages are not all full");

  // AN UNKNOWN PHASE READS AS THE EARLIEST, NEVER AS NOTHING. `thinking` is
  // deliberately not one of the four stages and is where every build starts, so
  // an `indexOf` taken raw gives -1 and the whole rail goes blank — the panel
  // showing less than it did before this existed, in the one state it is always
  // in first.
  for (const p of ["thinking", "nonsense", undefined]) {
    const r = rail(p, 30_000);
    assert.equal(r.length, 4, "the rail lost its segments at phase " + p);
    assert.ok(r[0] > 0, "an unknown phase drew an empty rail at " + p + ": " + r.join(","));
    assert.deepEqual(r.slice(1), [0, 0, 0], "an unknown phase filled a later stage at " + p);
  }
  // AND NO BUILD AT ALL IS A DIFFERENT CASE, not the one above: the panel is
  // drawn on the workspace's ordinary render path before any build exists, and
  // there the rail is four empty tracks and no clock. Asserted apart so neither
  // case can be read as evidence for the other.
  assert.deepEqual(rail(null, null), [0, 0, 0, 0], "a rail filled in with no build running");

  // NO CLOCK BEFORE THERE IS A START. A time on a build that has not begun is the
  // images-row lie in a smaller font.
  assert.match(html("planning", null), /class="st-bclock"><\/div>/, "a clock was drawn with no start time");

  assert.equal(ago(0), "0s");
  assert.equal(ago(59_000), "59s");
  assert.equal(ago(60_000), "1m 0s");
  assert.equal(ago(252_000), "4m 12s");
  for (const junk of [null, undefined, NaN, "later", [], -1]) assert.equal(ago(junk), "0s");

  // A build with no state at all still renders rather than throwing — the panel
  // is drawn on the workspace's ordinary render path, before any poll lands.
  assert.match(html(null, null), /class="st-b1"/);
});

test("the live sentences are the PROGRESS ones, never the deadline's", () => {
  // `budgetNote` in builder/build-budget.mjs has a sentence per stage and the
  // stage names match exactly — which is what makes reusing it tempting and what
  // makes it the worst available lie: it says "This build ran out of time before
  // your data model was ready", and rendering that over a healthy running build
  // tells a customer their build has already failed.
  const budget = readFileSync(new URL("../builder/build-budget.mjs", import.meta.url), "utf8");
  const detail = fn("function reactStageDetail(");
  for (const phrase of ["ran out of time", "were not written", "could be published"]) {
    assert.ok(budget.includes(phrase), "the deadline sentence changed — re-derive this guard from budgetNote");
    assert.ok(!detail.includes(phrase),
      "a deadline sentence is being shown over a running build: " + JSON.stringify(phrase));
  }
  // Alive: the detail function really does have sentences of its own.
  assert.match(detail, /Writing your pages/);
  assert.match(detail, /Designing the site/);
});

// ── THE ROWS ────────────────────────────────────────────────────────────────

test("DRIVEN: the rows carry a planning step, a clock on the running one, and no empty pane", () => {
  const rows = new Function("sb",
    decl("const ST_PHASE_ORDER = ") +
    fn("function stStepRow(") + "\n" + fn("function stAgo(") + "\n" +
    fn("function reactLiveStepsHTML(") + "\n" +
    "const esc = (s) => String(s).replace(/[&<>\"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));\n" +
    "const siteBuild = sb;\nreturn reactLiveStepsHTML();");

  const planning = rows({ rphase: "planning", startedAt: Date.now() - 22_000 });
  assert.match(planning, /Planning your site/, "the planning row is gone — the first minutes have no honest label");
  assert.match(planning, /st-step-run/, "nothing is marked as running");

  // THE EMPTY PANE, WHICH IS WHAT THE OWNER SAW. `stCodeBody('', true)` renders a
  // bordered box with one blinking caret, fed from a field only a stream that
  // never arrives can write.
  for (const p of ["planning", "generating", "compiling", "publishing"]) {
    const h = rows({ rphase: p, startedAt: Date.now() - 60_000 });
    assert.ok(!/st-lc-cur/.test(h), "the empty caret pane is back on the " + p + " row");
    assert.ok(!/class="st-lc"/.test(h), "a code pane is being drawn from a source that cannot fill it");
  }

  // THE CLOCK IS ON THE RUNNING ROW AND NOWHERE ELSE.
  const gen = rows({ rphase: "generating", startedAt: Date.now() - 252_000 });
  const running = /<div class="st-step[^"]*">.*?st-step-run.*?<\/div>/s.exec(gen);
  assert.ok(running, "no row is marked running");
  assert.match(gen, /4m 12s/, "the running row carries no clock");
  assert.equal((gen.match(/4m 12s/g) || []).length, 1, "the clock is drawn on more than the running row");
  // A build with no start time draws no clock at all.
  assert.ok(!/\ds<\/span>/.test(rows({ rphase: "generating" })), "a clock was drawn with no start time");
});

// ── THE WIRING, COUNTED ─────────────────────────────────────────────────────

test("THE WIRING: both halves are painted, from one composition, by one function", () => {
  const src = bare(chat);
  // THE DEFECT ITSELF. `paintReactLive` rewrote the thread and nothing else, so
  // the stage panel kept a label baked while the phase was still `thinking` —
  // "Thinking…" on the right for seventeen minutes while the left rail moved.
  const paint = fn("function paintReactLive(", src);
  assert.match(paint, /#stStage \.st-b1/, "paintReactLive no longer repaints the stage panel");
  assert.match(paint, /buildStageHTML\(\)/, "the stage is repainted from something other than the one composition");
  assert.match(paint, /st-steps-live/, "paintReactLive stopped repainting the thread");

  // ONE COMPOSITION, TWO CALL SITES — the workspace's own render and the repaint.
  // Cutting either leaves both functions perfect and one half of the screen
  // frozen, which is precisely how this shipped.
  assert.equal((src.match(/buildStageHTML\(\)/g) || []).length, 3,
    "one definition plus two call sites; a changed count means a half went unpainted or grew a copy");
  const render = src.indexOf("st-frame-bar");
  assert.ok(render > 0 && /buildStageHTML\(\)/.test(src.slice(render, src.indexOf("</div>'", render) + 400)),
    "the workspace's own render no longer draws the stage composition");
});

test("THE WIRING: the poll opens the envelope and hands it to the one setter", () => {
  const src = bare(chat);
  const follow = fn("async function followBuildJob(", src);
  // It read the status code and nothing else, for up to twenty minutes.
  assert.match(follow, /r\.json\(\)/, "the poll no longer parses the 202 body");
  assert.match(follow, /setBuildPhase\(origin, EditPoll\.buildPhase\(/,
    "the poll parses the body and does nothing with it — the purest form of the trap this file is about");
  // A BODY THAT WILL NOT PARSE MUST NOT END THE FOLLOW: the 202 is the answer and
  // the progress is a courtesy, the same rule the server keeps for `flight`.
  //
  // READ INSIDE THE 202 BRANCH, NEVER ACROSS THE FUNCTION. A sweep took the catch
  // off this parse and the check passed, because the TERMINAL parse forty lines
  // below carries one too and satisfied a whole-function match: an assertion
  // answered by a line nobody was asking about. Windowed to the branch, both ends
  // asserted.
  const twoStart = follow.indexOf("if (r.status === 202)");
  const twoEnd = follow.indexOf("if (r.status === 503)");
  assert.ok(twoStart > 0 && twoEnd > twoStart, "the 202 branch is gone — rescope this guard");
  const branch = follow.slice(twoStart, twoEnd);
  assert.match(branch, /r\.json\(\)\.catch\(\(\) => null\)/, "an unparseable body now ends the build watch");
  // RE-ANCHORED 2026-09-07: the branch hands the body to TWO setters now (the
  // phase and the code), so it opened a block and this one-line pin stopped
  // matching. The property is unchanged and is what is asserted — an
  // unparseable body reaches neither setter.
  assert.match(branch, /if \(p\) \{/, "a null body is handed to the setters");
  assert.ok(branch.indexOf("if (p) {") < branch.indexOf("setBuildPhase("),
    "the phase setter is called outside the null check");
  assert.match(follow, /bad = 0;/, "a 202 no longer resets the bad-answer counter");

  // The origin really reaches it, or every repaint is refused as foreign.
  assert.match(src, /async function followBuildJob\(job, signal, origin\)/, "followBuildJob lost its origin");
  assert.match(src, /followBuildJob\(d\.job, siteAbort \? siteAbort\.signal : undefined, origin\)/,
    "the caller no longer hands the origin down");

  // ONE WRITER OF THE PHASE. Anything else assigning `rphase` outside the setter
  // and the two initialisers is a second door past the monotonic clamp.
  const writes = (src.match(/siteBuild\.rphase = /g) || []).length;
  assert.equal(writes, 3, "rphase is assigned somewhere new — the forward-only clamp has a way around it");
});

test("THE WIRING: the clock has an origin, a tick, and a stop", () => {
  const src = bare(chat);
  assert.match(fn("function siteBuildStart(", src), /startedAt: Date\.now\(\)/,
    "the build records no start time, so every clock reads zero");
  // The 6-second poll cannot drive a seconds display; the ticker does, and it
  // returned early for react builds because they were meant to repaint on a
  // stream that never arrives.
  const startFn = fn("function siteBuildStart(", src);
  assert.match(startFn, /if \(siteBuild\.react\) \{ paintReactLive\(\); return; \}/,
    "the ticker no longer repaints a react build — the clock stops between polls");
  // AND IT IS CLEARED. A timer outliving its build is this repo's recorded shape.
  assert.match(fn("function siteBuildStop(", src), /clearInterval\(siteTicker\)/,
    "the ticker is not cleared when the build ends");

  // The promotion out of `thinking` is the FIRST phase, derived from the order —
  // it said 'generating', which is the line that put "Writing the code" on the
  // screen over a design call.
  assert.match(src, /siteBuild\.rphase = ST_PHASE_ORDER\[0\]/,
    "the build promotes to a hardcoded phase again");
  assert.ok(!/siteBuild\.rphase = 'generating'/.test(src),
    "the old promotion to 'generating' is back");
});

test("the panel's own type and its never-full segment are in the stylesheet", () => {
  // The hero's face is NAMED, not inherited: the app's `body` rule is nested
  // inside `:root` and did not apply in a headless render, so what was drawn for
  // the owner and what shipped would have been two different typefaces.
  const hero = /\.st-b1 \.st-building-t \{[^}]*\}/.exec(css);
  assert.ok(hero, "the stage hero has no rule of its own");
  assert.match(hero[0], /font-family:\s*'Patrick Hand'/, "the hero's display face is inherited again");
  // Tabular figures, because this redraws every 1.5s and proportional digits make
  // a running clock twitch sideways on every tick.
  const clock = /\.st-bclock \{[^}]*\}/.exec(css);
  assert.ok(clock, "the clock has no rule");
  assert.match(clock[0], /font-variant-numeric:\s*tabular-nums/, "the clock will jitter on every tick");
  // The fill is a child of the track, so an empty segment is still a visible rail.
  assert.match(css, /\.st-brail i::after \{[^}]*width: var\(--w, 0\)/, "the segment fill moved");
  assert.match(css, /\.st-brail i \{[^}]*background: var\(--panel-2\)/, "an empty segment has no track");
  // REDUCED MOTION, read out of the media block that actually names the rail —
  // never as one regex spanning from `prefers-reduced-motion` to the rule, which
  // is a byte window over a stylesheet by another name and matched nothing here
  // because the block is written on one line. Landmark to landmark, both ends
  // asserted, and the observer proved alive by finding the block at all.
  const rm = css.indexOf("@media (prefers-reduced-motion: reduce) { .st-brail");
  assert.ok(rm > 0, "the rail has no reduced-motion rule at all");
  const rmEnd = css.indexOf("}", css.indexOf("transition", rm));
  assert.ok(rmEnd > rm, "the reduced-motion block never closes");
  assert.match(css.slice(rm, rmEnd), /\.st-brail i::after \{[^}]*transition:\s*none/,
    "the rail still animates under reduced motion");
});
