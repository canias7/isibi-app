// THE BUILDER PICKER REACHES THE ROUTING CALL, AND SITS ON THE START SCREEN
// (2026-09-07, owner: "PUT THE PICKER TOO IN THE SITESPAGE PAGE, THE ONE BEFORE,
// AND THEN WHATEVR THE USER CHOOSES THERE IT GOES NEXT").
//
// Two halves of one thing, and the first is a defect the composer's own label
// hid. `/api/site/route` reads `modelsFor(rb.picker).quick`, and `siteRoute` did
// not send `picker` — so every routing call on the platform ran on
// DEFAULT_PICKER whatever the chip above the send button said. The build, the
// revise and the edit all sent it; this one hop did not.
//
// It is the wiring layer for the thirteenth recorded time, and the pointed part
// is that `test/picked-model.test.mjs` was written for THIS BUG one hop down —
// `routeMessage` took a model and never handed it to `askRequest`. That guard
// drives the module with a model passed in, which proves the module forwards it
// and says nothing about whether anybody supplies one. So these read the hop:
// what the browser puts on the wire, and what the route does with it.
//
// The second half is a screen. The picker existed only in the workspace
// composer, which you reach AFTER the first build is already running — so the
// one build where the choice matters most was the one nobody could make it for.
// "Whatever they choose there goes next" needs no carrying: one module variable
// behind one storage key, read by the build POST and by both chips.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_PICKER, modelsFor } from "../builder/build-models.mjs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const chat = read("../public/chat.js");
const css = read("../public/styles.css");
const worker = read("../worker.js");

// Whole-line comments blanked, length preserved: this file's own prose names the
// field it is about, and so does chat.js's — several times, in the comment that
// explains the fix.
const bare = (s) => s.split("\n").map((l) => (/^\s*\/\//.test(l) ? " ".repeat(l.length) : l)).join("\n");

// A named function's source, out of the file.
function fn(head, src = bare(chat)) {
  const at = src.indexOf(head);
  assert.ok(at > 0, head + " is gone");
  const end = src.indexOf("\n}", at);
  assert.ok(end > at, head + " has no end");
  return src.slice(at, end + 2);
}

// ── THE HOP THAT WAS CUT ────────────────────────────────────────────────────

test("DRIVEN: the routing call carries the picker, and it is the one the build sends", () => {
  const body = fn("function siteRoute(");
  const post = body.slice(body.indexOf("apiFetch('/api/site/route'"));
  assert.ok(post.length > 0, "the routing call moved out of siteRoute");
  const json = /body: JSON\.stringify\(\{[^\n]*\)/.exec(post);
  assert.ok(json, "the routing call no longer serialises a body");
  assert.match(json[0], /\bpicker: buildPicker\b/,
    "the routing call does not send the picked model — it will run on the platform default, whatever the chip says");
  // THE SAME VARIABLE the build posts, not a copy assembled here. Two readings of
  // one choice is how a label and a request quietly stop agreeing, which is the
  // whole shape of the bug this fixes.
  const send = fn("function reactSend(");
  assert.match(send, /picker: buildPicker/, "the build no longer sends the same variable");
});

test("DRIVEN: the route resolves that field, and an absent one still falls to the default", () => {
  // The receiving half, so the two ends are asserted together rather than each
  // being certified against an assumption about the other.
  const at = worker.indexOf('url.pathname === "/api/site/route"');
  assert.ok(at > 0, "the routing route moved");
  // BOTH LANDMARKS ASSERTED. The first draft closed on `return Response.json({`,
  // which the route's own 401 satisfies four lines in — a window that ended
  // before the thing it was looking for and reported the field as gone. The
  // recorded byte/landmark-window trap, met on the first run of this guard.
  const end = worker.indexOf("intent: routed.intent", at);
  assert.ok(end > at, "the routing route no longer answers an intent — re-derive this window");
  const route = worker.slice(at, end);
  assert.match(route, /modelsFor\(rb && rb\.picker\)\.quick/,
    "the route no longer resolves the caller's picker");
  // And the fallback is real, driven rather than read: an old client that sends
  // nothing must still get a model, not undefined.
  assert.equal(modelsFor(undefined).picker, DEFAULT_PICKER);
  assert.ok(modelsFor(undefined).quick, "the default picker resolves to no quick model");
  // NEVER COERCED. `String(["opus"])` is "opus", and a one-element array has
  // passed as a string three times in this repo.
  assert.equal(modelsFor(["opus"]).picker, DEFAULT_PICKER, "an array was read as a picker name");
  assert.equal(modelsFor("nonesuch").picker, DEFAULT_PICKER, "an unknown name was read as a picker");
});

// ── ONE PICKER, TWO SCREENS ─────────────────────────────────────────────────

test("THE WIRING: both screens draw the chip, from one function, and both wire it", () => {
  const src = bare(chat);
  // ONE DEFINITION AND TWO CALL SITES. A second copy of this markup is the
  // recorded "two lists of the same thing" and would disagree the first time a
  // model joined BUILD_PICKERS; cutting the call out of either screen leaves the
  // function perfect and that screen without a chip, which is the wiring trap the
  // card icons met a fortnight ago and which nothing but a call-site count sees.
  assert.equal((src.match(/buildPickerHTML\(/g) || []).length, 3,
    "one definition plus two call sites; a changed count means a screen lost its chip or grew a copy");
  assert.match(src, /buildPickerHTML\(\) \+/, "the workspace composer no longer draws the chip");
  assert.match(src, /buildPickerHTML\('down'\) \+/, "the start screen no longer draws the chip");

  // AND A CHIP NOBODY WIRES IS A CHIP THAT DOES NOTHING. `wireBuildPicker` finds
  // its elements by id, so it must be called on each screen after that screen's
  // markup lands.
  assert.match(fn("function renderSites("), /wireBuildPicker\(\)/,
    "the start screen draws the chip and never wires it — it would open no menu");
  assert.match(fn("function renderSiteWorkspace("), /wireBuildPicker\(\)/,
    "the workspace no longer wires its chip");
});

test("DRIVEN: the same function opens the menu upward or downward, and defaults to upward", () => {
  // Evaluated out of chat.js rather than read — site-list's technique. The
  // property is what it ANSWERS, and the direction is the one thing that differs
  // between the two screens.
  const cAt = chat.indexOf("const BUILD_PICKERS = {");
  const cEnd = chat.indexOf("\n};", cAt) + 3;
  const make = (picked) => new Function(
    chat.slice(cAt, cEnd) + "\nlet buildPicker = " + JSON.stringify(picked) + ";\n" +
    fn("function buildPickerHTML(", chat) + "\nreturn buildPickerHTML;")();

  const f = make("sonnet");
  assert.match(f(), /class="model-menu drop-up build-menu"/,
    "the composer's chip must keep dropping UP over the thread");
  assert.ok(!/drop-up/.test(f("down")), "the start screen's chip must not drop up into the hero");
  assert.match(f("down"), /class="model-menu build-menu"/, "the downward menu lost its own class");
  // FAIL TOWARD WHAT WAS THERE BEFORE: only the exact word turns it round, so
  // anything unexpected keeps the behaviour that has always shipped.
  for (const junk of ["", null, undefined, "DOWN", "up", ["down"], {}]) {
    assert.match(f(junk), /drop-up/, "a value that is not exactly 'down' opened the menu downward");
  }
  // The label really is the current pick, on both screens.
  assert.match(make("grok")("down"), /Builder: <b id="stBuildLabel">Grok 4\.6<\/b>/);
  assert.match(make("opus")(), /Builder: <b id="stBuildLabel">Opus 5<\/b>/);
});

test("the two chips never exist at once, so their shared ids are unambiguous", () => {
  // `buildPickerHTML` hardcodes stBuildSel / stBuildLabel / stBuildMenu, and
  // `setBuildPicker` updates the label through getElementById — which answers the
  // FIRST match. Two chips on one page would leave the second showing a stale
  // model, so the guarantee is that the start screen returns before it draws
  // anything whenever a site is open.
  const body = fn("function renderSites(");
  const hand = body.indexOf("renderSiteWorkspace(view, open); return;");
  const draw = body.indexOf("view.innerHTML =");
  assert.ok(hand > 0, "the start screen no longer hands off to the workspace");
  assert.ok(draw > hand,
    "the start screen draws before it hands off — both chips could be on the page and the label would go stale");
});

test("the pick carries because there is nothing to carry: one variable, one key, one writer", () => {
  const src = bare(chat);
  // "Whatever they choose there goes next" is a property of there being ONE
  // answer, not of anything passing it along. A second store — the choice
  // remembered beside the prompt, say — is a value that can disagree with the
  // chip, and this file already records what two copies of one value cost.
  assert.equal((src.match(/localStorage\.setItem\(BUILD_PICKER_KEY/g) || []).length, 1,
    "more than one writer of the stored pick");
  assert.match(fn("function setBuildPicker("), /localStorage\.setItem\(BUILD_PICKER_KEY, p\)/,
    "the picker's one writer no longer stores the choice");
  assert.match(fn("function setBuildPicker("), /if \(!BUILD_PICKERS\[p\]\) return;/,
    "the writer no longer refuses a name that is not a picker");
  // And the reader agrees with the server's default, which `build-models` already
  // asserts; repeated here only as the premise this file's fallback case rests on.
  assert.match(src, new RegExp("localStorage\\.getItem\\(BUILD_PICKER_KEY\\) \\|\\| '" + DEFAULT_PICKER + "'"),
    "the composer's default no longer matches the server's");
});

// A request body, read by BRACE DEPTH from `body: JSON.stringify({` to its own
// closing brace — never by a byte count. The first draft of the scan below took
// 700 characters after `body:` and reported the EDIT call as picker-less: that
// object carries 986 bytes of comment between the opening brace and the line
// naming the model, so the window ended inside the explanation. This repo's
// recorded "never size a source-read window in bytes" trap, met inside the guard
// written to catch a wiring bug — and it would have reported a correct call site
// as broken, which is the one failure mode worse than missing one.
function bodyOf(win) {
  const at = win.indexOf("body: JSON.stringify(");
  if (at < 0) return "";
  let depth = 0;
  for (let i = win.indexOf("(", at); i < win.length; i++) {
    if (win[i] === "(" || win[i] === "{") depth++;
    else if (win[i] === ")" || win[i] === "}") { depth--; if (depth === 0) return win.slice(at, i + 1); }
  }
  return win.slice(at);
}

// ── WHAT THEY PICK IS WHAT CARRIES, ACROSS RELOADS ──────────────────────────

test("DRIVEN: a pick survives a reload and no default reasserts itself", () => {
  // Owner, 2026-09-07: "MAKE SURE WHATVER USER SLECETS IT WHAT CARRIES INTO THE
  // NEXT, NO DEFAULT, THE DEFAULT IS WHAT USER SELECTS — BUT FOR OUR TESTING
  // YEA, GROK DEFAULT."
  //
  // Read, this is three lines and obviously fine. Driven, it is the only way to
  // show that the DEFAULT never overwrites a choice: the two live in the same
  // statement (`getItem(...) || 'grok'`), and the fallback below it can reach a
  // stored value too. So the module's own init and its writer are evaluated
  // against a real store, and the store is carried across a fresh evaluation —
  // which is what a page reload is.
  const cAt = chat.indexOf("const BUILD_PICKERS = {");
  const cEnd = chat.indexOf("\n};", cAt) + 3;
  // FROM THE KEY, not from the init line: `BUILD_PICKER_KEY` is declared above
  // it and the init reads it, so a slice starting at `let buildPicker` loads a
  // module with a free identifier — which is a ReferenceError at call time, not
  // at parse time, and is the same class of miss this repo has hit four times.
  const initAt = chat.indexOf("const BUILD_PICKER_KEY = ");
  assert.ok(initAt > cEnd, "the picker's storage key moved");
  assert.ok(chat.indexOf("let buildPicker = localStorage.getItem(", initAt) > initAt,
    "the picker's init line no longer follows its key");
  const initEnd = chat.indexOf("\nfunction buildPickerHTML(", initAt);
  assert.ok(initEnd > initAt, "could not bound the init lines");

  // ONE store, shared across every "reload" below, exactly as a browser's is.
  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };
  const load = () => new Function("localStorage", "document",
    chat.slice(cAt, cEnd) + "\n" + chat.slice(initAt, initEnd) + "\n" +
    fn("function buildPickerHTML(", chat) + "\n" + fn("function setBuildPicker(", chat) + "\n" +
    "return { get: () => buildPicker, set: setBuildPicker, chip: buildPickerHTML };")(
      localStorage, { getElementById: () => null });

  // A COLD BROWSER TAKES THE TESTING DEFAULT, and it is Grok.
  let app = load();
  assert.equal(app.get(), DEFAULT_PICKER, "a browser with nothing stored must take the platform default");
  assert.equal(DEFAULT_PICKER, "grok", "the testing default is no longer Grok — the owner's call, so re-read this");
  assert.equal(store.size, 0, "merely reading the default wrote it to storage");

  // THEY PICK. Every model in the table, each proved to survive its own reload.
  for (const want of Object.keys(BUILD_PICKERS_KEYS())) {
    app.set(want);
    assert.equal(app.get(), want, "the pick did not take effect in this session");
    // A RELOAD: a fresh evaluation of the same module against the same store.
    app = load();
    assert.equal(app.get(), want,
      "after a reload the picker fell back to the default instead of keeping the choice — a pick must outlive the tab");
    assert.match(app.chip(), new RegExp(">" + BUILD_PICKERS_KEYS()[want].replace(/[.]/g, "\\.") + "<"),
      "the chip does not show the stored choice after a reload");
    assert.match(app.chip("down"), new RegExp(">" + BUILD_PICKERS_KEYS()[want].replace(/[.]/g, "\\.") + "<"),
      "the START SCREEN's chip does not show the stored choice — the two screens disagree");
  }

  // AND A JUNK STORED VALUE FALLS BACK RATHER THAN RENDERING AN UNDEFINED LABEL.
  // `auto` really was an option for a few hours and is still in some browsers.
  store.set("zephyr_build_picker_v1", "auto");
  assert.equal(load().get(), DEFAULT_PICKER, "a stored value that is no longer a model must fall back");
  // The writer refuses to store one in the first place.
  const a = load();
  a.set("auto");
  assert.equal(a.get(), DEFAULT_PICKER, "the writer accepted a name that is not a model");
});

// The label table, read out of chat.js once so the case above compares against
// the real names rather than a second copy of them.
function BUILD_PICKERS_KEYS() {
  const cAt = chat.indexOf("const BUILD_PICKERS = {");
  const cEnd = chat.indexOf("\n};", cAt) + 3;
  const t = new Function(chat.slice(cAt, cEnd) + "\nreturn BUILD_PICKERS;")();
  return Object.fromEntries(Object.keys(t).map((k) => [k, t[k].label]));
}

test("every model call the browser makes carries the pick — none of them takes the default", () => {
  const src = bare(chat);
  // DERIVED FROM THE FILE, not a list kept here: every POST to a site route is
  // found, and the ones that spend a model call must carry `picker`. A list
  // written by hand is the recorded "two lists of the same thing", and the whole
  // defect this file is about was one call site missing from an unwritten list.
  const lines = src.split("\n");
  const posts = [];
  lines.forEach((l, i) => {
    if (!/apiFetch\(/.test(l)) return;
    const win = lines.slice(i, i + 90).join("\n");
    if (!/method: ?'POST'/.test(win.slice(0, 400))) return;
    const url = (l.match(/apiFetch\((.{0,90})/) || ["", "?"])[1].replace(/,\s*\{.*$/, "").trim();
    posts.push({ url, picker: /\bpicker\b/.test(bodyOf(win)) });
  });
  // THE FOUR THAT SPEND A MODEL CALL. Named, because "carries a picker" is only
  // half the property — the other half is that these are the ones that must.
  const spends = [/\/route/, /\/edit/, /\/addon/];
  for (const re of spends) {
    const hit = posts.find((p) => re.test(p.url));
    assert.ok(hit, "a model-spending POST matching " + re + " is gone from chat.js");
    assert.ok(hit.picker, "the POST to " + hit.url + " does not carry the picked model");
  }
  // The build and the revise share one call whose URL is a variable, so they are
  // read where the body is built rather than at the fetch.
  const send = fn("function reactSend(");
  const bodies = send.match(/^.*picker: buildPicker.*$/gm) || [];
  assert.equal(bodies.length, 2, "the build and the revise no longer both carry the pick");
  assert.match(bodies[0], /brief:/, "the first branch is no longer the build");
  assert.match(bodies[1], /instruction:/, "the second branch is no longer the revise");
  // ALIVE: the scan really did find the free routes too, so "they all carry it"
  // is not the vacuous answer of a scan that found four things.
  assert.ok(posts.length >= 10, "the POST scan stopped seeing this file — it now proves nothing");
  assert.ok(posts.some((p) => !p.picker), "every POST carries a picker, which means the scan is not reading bodies");
});

// ── THE ROW, MEASURED ───────────────────────────────────────────────────────

test("the start screen's row has exactly one auto margin, and it is the send button's", () => {
  // MEASURED, not reasoned: with two live, Chrome split the free space 105.72px
  // each and the chip floated in the middle of the row; with three it was 70.48px
  // each. `.st-attbtn` and `.st-buildsel-wrap` each carry `margin-right: auto`
  // for the row they were designed in, and `.st-gen` carries `margin-left: auto`
  // for this one — so the two before it give theirs up here.
  const rule = /\.st-new-foot \.st-attbtn, \.st-new-foot \.st-buildsel-wrap \{[^}]*margin-right:\s*0[^}]*\}/;
  assert.match(css, rule, "the start-screen row's auto margins are back to fighting each other");
  // The observer is alive: the two rules it neutralises must still be there, or
  // the rule above is protecting against nothing.
  assert.match(css, /\.st-attbtn \{[^}]*margin-right:\s*auto/, "the attach button's own margin moved");
  assert.match(css, /\.st-buildsel-wrap \{[^}]*margin-right:\s*auto/, "the picker wrap's own margin moved");
  assert.match(css, /\.st-gen \{[^}]*margin-left:\s*auto/, "the send button no longer holds the right edge");
});

test("the menu is wide and solid in BOTH directions, not only when it drops up", () => {
  // `topbar-layout` asserts the builder menu is wide enough and opaque, and it
  // takes either spelling of the selector — so re-gating the width on `.drop-up`
  // passes every assertion there while leaving the START SCREEN's copy at
  // `.model-menu`'s inherited 250px translucent panel. A cascade cannot be
  // resolved by reading, so the property is expressed at the level the
  // stylesheet makes available: the rule that carries the width must not require
  // a class only one of the two chips wears.
  const gated = /\.model-menu\.drop-up\.build-menu\s*\{[^}]*(?:min-width|background)/.exec(css);
  assert.ok(!gated,
    "the builder menu's width or panel is gated on .drop-up again — the start screen's menu goes back to 130px and see-through");
  // Alive: the ungated rule is really the one setting them.
  const ungated = /\.model-menu\.build-menu \{[^}]*\}/.exec(css);
  assert.ok(ungated, "the ungated builder-menu rule is gone");
  assert.match(ungated[0], /min-width:\s*270px/);
  assert.match(ungated[0], /background:\s*#ffffff/);
  // AND IT MUST OUTWEIGH `.model-menu.drop-up`, not merely follow it: dropping a
  // class here (`.build-menu` alone) makes it lighter than the 130px rule and the
  // composer's menu narrows again, with source order no longer able to save it.
  assert.ok(!/(^|[^.\w-])\.build-menu\s*\{/m.test(css),
    "a single-class .build-menu rule is lighter than .model-menu.drop-up and loses to it");
});

test("the downward menu hangs under its chip rather than off the left of the box", () => {
  // `.model-menu` pins itself `right: 0`, which for a 270px panel under a chip on
  // the LEFT of the row would push it out past the edge of the box it belongs to.
  const m = /\.model-menu\.build-menu:not\(\.drop-up\) \{[^}]*\}/.exec(css);
  assert.ok(m, "the downward menu no longer positions itself — it will open leftwards off the box");
  assert.match(m[0], /left:\s*0/);
  assert.match(m[0], /right:\s*auto/, "right must be released or left:0 does nothing");
  // It can never collide with the end-anchored rule, which requires .drop-up —
  // stated because the two set opposite values for the same two properties.
  assert.match(css, /\.model-menu\.drop-up\.build-menu-end \{/,
    "the end-anchored rule lost its .drop-up, so it now fights the rule above");
});
