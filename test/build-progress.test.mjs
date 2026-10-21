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


test("DRIVEN: four states, four characters, one column — and the class names stay", () => {
  const row = new Function("o",
    fn("function stStepRow(") + "\n" +
    "const esc = (s) => String(s).replace(/[&<>\"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));\n" +
    "return stStepRow(o);");

  // THE GLYPH IS TEXT NOW, in all four states. Two of them used to be drawn in
  // CSS (a dot and a ring, sized in pixels) and two as characters, so they never
  // shared a baseline; in the rail's monospace they line up by construction.
  const want = { run: "●", done: "✓", fail: "✕", wait: "○" };
  for (const [state, glyph] of Object.entries(want)) {
    const h = row({ label: "Writing the code", state });
    assert.ok(h.includes(">" + glyph + "<"), state + " draws no glyph — the column is empty for it");
  }
  // AND THE CLASS NAMES ARE UNCHANGED. The state is read by those names in the
  // stylesheet, in the guards above and in the finished-build rows; renaming one
  // is silent in all three at once.
  for (const [state, cls] of [["run", "st-step-run"], ["done", "st-step-tick"], ["fail", "st-step-fail"], ["wait", "st-step-wait"]]) {
    assert.match(row({ label: "x", state }), new RegExp('class="' + cls + '"'), state + " lost its class");
  }
  // A cross AND a tick — the outcome survives greyscale and anyone who cannot
  // tell the two hues apart.
  assert.notEqual(want.done, want.fail);
  // THE LABEL IS STILL ESCAPED: it carries a file name off the wire.
  assert.match(row({ label: '<img onerror=x>', state: "run" }), /&lt;img/, "a label reached the screen unescaped");

  // AND THE FINISHED ROW COUNTS IN ENGLISH. It said "1 files" for every
  // one-file build; the images row beside it has pluralised since it was
  // written, so this was one line of the same file disagreeing with itself.
  const done = new Function("b",
    fn("function stStepRow(") + "\n" + fn("function stFilesBody(") + "\n" +
    fn("function stImgsBody(") + "\n" + fn("function reactStepsHTML(") + "\n" +
    "const esc = (s) => String(s).replace(/[&<>\"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));\n" +
    "return reactStepsHTML(b);");
  assert.match(done({ files: ["a.tsx"], page: "app" }), />1 file</, "a one-file build still says “1 files”");
  assert.match(done({ files: ["a.tsx", "b.tsx"], page: "app" }), />2 files</);
  assert.ok(!/ files</.test(done({ files: [], page: "app" })), "a build with no files claimed a count");
});

test("DRIVEN: the setter carries the window's line, and never leaves a stale one beside a new window", () => {
  // DRIVEN, not read: both survivors of this change's sweep were here — the
  // setter dropping the line outright (E's gutter never appears at all) and the
  // setter keeping the PREVIOUS window's number when a new update carries none
  // (numbers that are merely wrong, which is the thing the whole line chain
  // exists to prevent). Neither fails anything a source read can see.
  const make = (state, open) => {
    let painted = 0;
    const api = new Function("siteOpenId", "paintReactLive", "state",
      "let siteBuild = state;\n" + fn("function setBuildCode(") +
      "\nreturn { set: setBuildCode, get: () => siteBuild };")(
        open, () => { painted++; }, state);
    return { ...api, painted: () => painted };
  };

  let a = make({ code: "", file: "" }, "site_1");
  assert.equal(a.set("site_1", { code: "const a = 1", file: "index.tsx", line: 47 }), true);
  assert.equal(a.get().codeLine, 47, "the setter dropped the line — the gutter has nothing to number from");
  assert.equal(a.get().code, "const a = 1");
  assert.equal(a.painted(), 1, "a code that changed must repaint exactly once");

  // A NEW WINDOW WITH NO NUMBER IS A WINDOW WITH NO NUMBER. Keeping the last
  // one would put line 47 beside text that starts somewhere else entirely.
  a = make({ code: "old", file: "index.tsx", codeLine: 47 }, "site_1");
  assert.equal(a.set("site_1", { code: "new text", file: "index.tsx" }), true);
  assert.equal(a.get().codeLine, 0, "a new window kept the previous window's line number");
  // Every shape that is not a line lands on 0, at the setter as well as the reader.
  for (const bad of ["47", 0, -1, null, undefined, NaN, [47], {}]) {
    a = make({ code: "old", codeLine: 47 }, "site_1");
    a.set("site_1", { code: "new", line: bad });
    assert.equal(a.get().codeLine, 0, "a non-line survived the setter: " + JSON.stringify(bad));
  }

  // AND THE SETTER'S OWN RULES STILL HOLD — a foreign workspace and an
  // unchanged update, asserted here so the line cases cannot be the only thing
  // this drives.
  a = make({ code: "x", file: "i.tsx" }, "site_1");
  assert.equal(a.set("site_2", { code: "y", line: 3 }), false, "a poll for another workspace wrote this one");
  assert.equal(a.painted(), 0);
  a = make({ code: "x", file: "i.tsx", codeLine: 3 }, "site_1");
  assert.equal(a.set("site_1", { code: "x", file: "i.tsx", line: 3 }), false, "an unchanged update repainted");
  assert.equal(a.painted(), 0);
});

test("the rail is one monospace column, and only the LABEL is lower-cased", () => {
  const at = css.indexOf(".st-steps {");
  assert.ok(at > 0, ".st-steps is gone from the stylesheet");
  const end = css.indexOf(".st-think {", at);
  assert.ok(end > at, "the rail block has no end landmark");
  const rail = css.slice(at, end);

  assert.match(rail, /\.st-steps \{[^}]*font-family:\s*ui-monospace/, "the rail is no longer monospace — treatment E is all monospace");
  // THE BOXES ARE GONE. Three equal bordered cards said nothing about which step
  // mattered; E is flush left with no surface at all.
  assert.match(rail, /\.st-step \{[^}]*border:\s*0/, "the step boxes are back");
  assert.match(rail, /\.st-step-b \{[^}]*border:\s*0[^}]*background:\s*none/, "the pane is a box inside a box again");

  // LOWER CASE ON THE LABEL AND NOWHERE ELSE. The bodies carry the model's own
  // words — an image prompt, a file name — and lower-casing those is a lie about
  // what it said.
  assert.match(rail, /\.st-step-lbl \{[^}]*text-transform:\s*lowercase/, "the labels are no longer lower-cased");
  assert.ok(!/\.st-steps \{[^}]*text-transform/.test(rail), "the whole rail is lower-cased — the model's own words with it");
  assert.ok(!/\.st-step-b \{[^}]*text-transform/.test(rail), "the bodies are lower-cased — that is the model's text");

  // THE GUTTER IS NOT SELECTABLE: copying the pane copies code, not a column of
  // numbers down its left edge.
  assert.match(rail, /\.st-lc-n \{[^}]*user-select:\s*none/, "the line numbers copy along with the code");
  assert.match(rail, /\.st-lc-n \{[^}]*text-align:\s*right/, "the gutter no longer right-aligns — the numbers stop lining up past 9");
  // The four marks share one box, so labels start at the same x whatever the state.
  assert.match(rail, /\.st-step-run, \.st-step-tick, \.st-step-wait, \.st-step-fail \{[^}]*width:\s*10px/,
    "the glyphs no longer share one column — the labels will not line up");
});

// ── THE ROWS ────────────────────────────────────────────────────────────────

test("DRIVEN: a running build draws only its progress talk — no stage rows, \"Thinking\" until the first line", () => {
  const rows = new Function("sb",
    decl("const ST_PHASE_ORDER = ") +
    fn("function stStepRow(") + "\n" +
    // RE-ANCHORED 2026-09-08. The rail asks `stBuildRunning()` now instead of
    // testing `sb.rphase === 'thinking'` itself, so this scope has to carry it or
    // the whole function throws a ReferenceError. Taken OUT OF THE FILE rather
    // than stubbed: a stub that answered `true` would make every case below blind
    // to the one gate that decides whether the rail draws at all.
    fn("function stBuildRunning(") + "\n" +
    fn("function reactLiveStepsHTML(") + "\n" +
    // AND THE BUILD'S LIVE LINES' RENDERER (2026-10-09, round 5), taken out of
    // the file for the same reason: the rail now ends with them.
    fn("function progressListHTML(") + "\n" +
    "const esc = (s) => String(s).replace(/[&<>\"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));\n" +
    "const siteBuild = sb;\nreturn reactLiveStepsHTML();");

  // RE-ANCHORED 2026-10-19 (owner: "delete the planning your site, writing code
  // and compiling react, just lets have the progress talks").
  for (const p of ["planning", "generating", "compiling", "fixing", "publishing", "database"]) {
    const bare = rows({ rphase: p, startedAt: Date.now() - 60_000 });
    assert.ok(!/st-step\b|st-step-run|Planning your site|Writing the code|Compiling React/i.test(bare), "a stage row is drawn on " + p);
    assert.match(bare, /st-think[\s\S]*Thinking/, "nothing is drawn on " + p + " before the first line");
    const talk = rows({ rphase: p, startedAt: Date.now() - 60_000, code: "const a = 1;", prog: [{ n: 1, text: "I'm writing the pages now." }] });
    assert.equal((talk.match(/I'm writing the pages now\./g) || []).length, 1, "the line is not drawn exactly once on " + p);
    assert.ok(!/st-step\b|Thinking|class="st-lc"/.test(talk), "something besides the talk is drawn on " + p);
  }
});

// ── THE WIRING, COUNTED ─────────────────────────────────────────────────────

test("THE WIRING: both halves are painted, from one composition, by one function", () => {
  const src = bare(chat);
  // THE DEFECT ITSELF. `paintReactLive` rewrote the thread and nothing else, so
  // the stage panel kept a label baked while the phase was still `thinking` —
  // "Thinking…" on the right for seventeen minutes while the left rail moved.
  const paint = fn("function paintReactLive(", src);
  // RE-ANCHORED 2026-09-10: the painter reaches the stage CONTAINER first now
  // (it has to, to create a panel where there is none), so the one-string
  // selector `#stStage .st-b1` is two reads. Both are asserted, because holding
  // the container and never looking for the panel is a painter that rebuilds
  // the frame on every 1.5s tick.
  assert.match(paint, /getElementById\('stStage'\)/, "paintReactLive no longer reaches the stage");
  assert.match(paint, /querySelector\('\.st-b1'\)/, "paintReactLive no longer repaints the stage panel");
  assert.match(paint, /buildStageHTML\(\)/, "the stage is repainted from something other than the one composition");
  assert.match(paint, /st-steps-live/, "paintReactLive stopped repainting the thread");

  // ONE COMPOSITION, TWO CALL SITES — the workspace's own render and the repaint.
  // Cutting either leaves both functions perfect and one half of the screen
  // frozen, which is precisely how this shipped.
  assert.equal((src.match(/buildStageHTML\(\)/g) || []).length, 3,
    "one definition plus two call sites; a changed count means a half went unpainted or grew a copy");
  // RE-ANCHORED 2026-09-10. Both call sites are now one hop further out: the
  // whole framed panel is `stBuildFrameHTML`, so the render and the painter draw
  // that and it draws this. The old check found the FIRST `st-frame-bar` in the
  // file and looked for `buildStageHTML()` near it — and once the render's own
  // copy of the frame moved into a function, the first one in the file became
  // the PREVIEW iframe's, which has nothing to do with a build. The recorded
  // ambiguous-landmark trap: a landmark is only unique until the code that made
  // it unique moves. Named rather than positional, both hops.
  assert.match(fn("function stBuildFrameHTML(", src), /buildStageHTML\(\)/,
    "the build frame no longer holds the one stage composition");
  const at = src.indexOf('<div class="st-stage" id="stStage"');
  assert.ok(at > 0, "the stage container is gone");
  const end = src.indexOf('<div class="st-fixbar"', at);
  assert.ok(end > at, "the stage block has no end landmark — re-derive this window");
  assert.match(src.slice(at, end), /\? stBuildFrameHTML\(site\)/,
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
  //
  // RE-ANCHORED 2026-09-13, and the spelling that moved is named: this read
  // `if (siteBuild.react) { paintReactLive(); return; }` — the react ARM of a
  // two-way tick whose other arm drove the pre-React rotating activity log. The
  // dead-code census proved that other arm unreachable (`siteBuildStart` is
  // called with `true` from every call site, which the case below derives), so
  // the log and the branch went and the tick is one call. The property is
  // unchanged and is now held by construction: every tick repaints the rail.
  //
  // AND IT IS DRIVEN, NOT READ, because a text read cannot see a dead branch.
  // The first version of this re-anchor matched `paintReactLive\(\);` in the
  // tick's source, and a sweep mutant that put `if (siteBuild) return;` ABOVE
  // that call SURVIVED: every landmark stayed exactly where a text read finds
  // it while the clock stopped between polls. That is the recorded "a positional
  // guard cannot see a dead branch", landing in a guard written the same day for
  // the deletion that made the tick one call. So the ticker is cut out and RUN,
  // with `setInterval` handed in to capture the callback.
  const startFn = fn("function siteBuildStart(", src);
  assert.ok(startFn.includes("setInterval("), "the ticker is gone — re-derive this landmark");
  const run = new Function("paintReactLive", "setInterval", "clearInterval", "Date",
    "let siteBuild = null, siteTicker = null;\n" + startFn + "\n"
    + "return { start: siteBuildStart, end: () => { siteBuild = null; }, ticker: () => siteTicker };");
  let painted = 0, cb = null;
  const api = run(() => { painted++; }, (f) => { cb = f; return 7; }, () => {}, Date);
  api.start(true);
  assert.equal(typeof cb, "function", "the ticker registered no callback");
  assert.equal(api.ticker(), 7, "the interval handle is not kept, so nothing can clear it");
  cb();
  assert.equal(painted, 1, "the tick did not repaint — the clock stops between polls");
  cb();
  assert.equal(painted, 2, "the tick repaints once and then stops");
  // AND IT STOPS WITH ITS BUILD. A clock outliving its build is this repo's
  // recorded shape, and the same drive answers it.
  api.end();
  cb();
  assert.equal(painted, 2, "the tick repainted after the build ended");
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

