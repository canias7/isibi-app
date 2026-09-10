// THE STAGE PANEL IS CREATED, NOT ONLY UPDATED.
//
// Owner, 2026-09-10, watching a first build run: "WHEN IT STARTS NOTHING
// APPEARS IN THE BIG SCREEN, IT WOULD ONLY APPEAR IF I CLICK A BUTTON AND THEN
// PRESS PREVIEW AGAIN".
//
// THE SEQUENCE, which is the whole of it and is why this file drives rather
// than reads. `reactSend` renders the workspace, THEN sets the phase:
//
//   1. renderSiteWorkspace runs while `rphase` is still `thinking` — a word
//      deliberately absent from ST_PHASE_ORDER, so `stBuildRunning()` is false
//      — and the stage draws "Describe your site on the left".
//   2. reactSend sets `rphase = ST_PHASE_ORDER[0]` and calls `paintReactLive`.
//   3. paintReactLive looked for `.st-b1`, found none, and skipped.
//
// Nothing renders the workspace again until the build ENDS, so the invitation
// sat there for eight minutes. The painter could UPDATE a stage panel and could
// never CREATE one, and only a re-render somebody triggered by hand converted
// it — which is what "click a button and then press Preview again" is.
//
// This is the third turn of one lesson, and the two before it are in chat.js's
// own comments: the DRAWING was unified into `buildStageHTML` (a panel saying
// "Thinking…" for seventeen minutes), then the QUESTION the rail asks became
// `stBuildRunning()` (a greeting taking the preview over). The DECISION the
// STAGE asks was still spelled out on the render's own line, so the painter had
// no way to ask it. `stStageBuilding` and `stBuildFrameHTML` are that pair.
//
// WHY DRIVEN AND NOT READ. A source read cannot tell `if (st)` from `if (st)
// … else if (stage)`, which is exactly the shape of the defect; and this
// repository's own record says a position is not a behaviour — `if (false)`
// leaves every landmark where a guard looks for it. Both call sites are also
// COUNTED here, because cutting either leaves both new functions perfect and
// one path dead, which is the wiring trap and is how the original shipped.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const CHAT = fs.readFileSync(path.join(here, "../public/chat.js"), "utf8");

/** Comments blanked, length preserved — this file's subject is named in prose. */
const BARE = CHAT.split("\n")
  .map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? " ".repeat(l.length) : l)).join("\n");

function cut(name) {
  const at = CHAT.indexOf("function " + name + "(");
  assert.ok(at > 0, name + " is gone from chat.js");
  const end = CHAT.indexOf("\n}", at);
  assert.ok(end > at, name + " has no end — re-anchor this");
  return CHAT.slice(at, end + 2);
}
function line(decl) {
  const at = CHAT.indexOf(decl);
  assert.ok(at > 0, decl + " is gone from chat.js");
  return CHAT.slice(at, CHAT.indexOf("\n", at));
}
function block(open, close) {
  const at = CHAT.indexOf(open);
  assert.ok(at > 0, open + " is gone from chat.js");
  const end = CHAT.indexOf(close, at);
  assert.ok(end > at, open + " has no closing `" + close + "` — re-anchor this");
  return CHAT.slice(at, end + close.length);
}

/**
 * A DOM small enough to see through and honest about what it answers.
 *
 * `#stThread .st-steps-live` answers null on purpose: the thread half is not
 * this file's subject, it is driven in build-progress, and `paintReactLive`
 * already guards it with `if (host)`. A thread that has not been drawn is a
 * real state, so null is the honest answer rather than a convenience.
 *
 * `outerHTML =` on the panel is what the UPDATE path does, so the fake element
 * writes back through its parent the way a browser does — without that, the
 * update leg would silently do nothing here and every case would pass on the
 * create leg alone.
 */
function makeStage(html) {
  const stage = {
    id: "stStage",
    innerHTML: html,
    querySelector(sel) {
      if (sel !== ".st-b1") return null;
      const at = stage.innerHTML.indexOf('<div class="st-b1">');
      if (at < 0) return null;
      // The panel ends at the close of the frame it sits in; `buildStageHTML`
      // emits one top-level div, so the last `</div>` before `</div></div>` is
      // its own. Measured against the real string rather than counted by hand.
      const end = stage.innerHTML.lastIndexOf("</div></div></div>");
      const stop = end > at ? end + "</div>".length : stage.innerHTML.length;
      const old = stage.innerHTML.slice(at, stop);
      return {
        get outerHTML() { return old; },
        set outerHTML(next) { stage.innerHTML = stage.innerHTML.replace(old, next); },
      };
    },
  };
  return stage;
}

/**
 * The real painter and the real decision, evaluated out of chat.js.
 *
 * EVERY NAME THE CREATE PATH TOUCHES IS CARRIED OUT OF THE FILE, never stubbed
 * — the recorded free-identifier trap, which has fired four times in this
 * repository and once inside a guard written for it. `siteById` in particular:
 * a stub answering the site under test would prove the branch runs and say
 * nothing about whether the painter looks up the site the RENDER draws, which
 * is the one thing tying the two answers together.
 */
function loadPainter({ stage, site, busy = true, phase = "thinking", startedAt = 0, noBuild = false }) {
  const doc = {
    getElementById: (id) => (id === "stStage" ? stage : null),
    querySelector: (sel) => (sel === "#stStage" ? stage : null),
  };
  const store = { [line("const SITES_KEY = ").split("'")[1]]: JSON.stringify(site ? [site] : []) };
  const src =
    line("const SITES_KEY = ") + "\n" +
    line("const SITE_ZONE = ") + "\n" + line("const SITE_ZONE_LIVE = ") + "\n" +
    line("const ST_PHASE_ORDER = ") + "\n" +
    block("const ST_STAGE_STEPS = [", "\n];") + "\n" +
    line("const ST_STAGE_TYPICAL_MS = ") + "\n" +
    "let sitesCache = null;\n" +
    cut("esc") + "\n" + cut("sitesLoad") + "\n" + cut("siteById") + "\n" +
    cut("sitePages") + "\n" + cut("siteActivePage") + "\n" + cut("siteChipUrl") + "\n" +
    cut("stAgo") + "\n" + cut("stStageFill") + "\n" +
    cut("reactStageLabel") + "\n" + cut("reactStageDetail") + "\n" +
    cut("stBuildRunning") + "\n" + cut("buildStageHTML") + "\n" +
    cut("stStageBuilding") + "\n" + cut("stBuildFrameHTML") + "\n" + cut("paintReactLive") + "\n" +
    "return { paint: paintReactLive, building: stStageBuilding, frame: stBuildFrameHTML,"
    + " setPhase: (p) => { siteBuild.rphase = p; }, order: ST_PHASE_ORDER };";
  return new Function("document", "localStorage", "siteBusy", "siteBuild", "siteOpenId", src)(
    doc,
    { getItem: (k) => (Object.hasOwn(store, k) ? store[k] : null) },
    busy,
    noBuild ? null : { react: true, rphase: phase, startedAt, pages: [], done: [], code: "", file: "", images: [], agents: {} },
    site ? site.id : "s-none",
  );
}

/** What the FULL render draws for a react message whose shape is not yet known. */
const INVITATION = '<div class="st-empty">Describe your site on the left to build the first draft.</div>';
const DRAFT = { id: "p1", slug: "marlow-and-tide", msgs: [], pages: [] };
const BUILT = { id: "p1", slug: "marlow-and-tide", msgs: [], pages: [], react: true, url: "https://marlow-and-tide.gofarther.app" };

// ── THE SEQUENCE ────────────────────────────────────────────────────────────

test("DRIVEN: the phase moving off `thinking` converts the invitation into the panel", () => {
  const stage = makeStage(INVITATION);
  const l = loadPainter({ stage, site: DRAFT, phase: "thinking", startedAt: Date.now() - 3000 });

  // STEP 1 — the render's own answer while the shape is unknown, and the
  // painter must AGREE with it. A painter that drew a build rail here would be
  // the "hey" defect the gate above this one was written to stop.
  l.paint();
  assert.equal(stage.innerHTML, INVITATION,
    "a message nobody has classified yet was painted as a running build");

  // STEP 2 — `reactSend` says it is a build. This is the exact line that runs
  // after the render, and it is the moment the old code went silent.
  l.setPhase(l.order[0]);
  l.paint();

  assert.match(stage.innerHTML, /class="st-b1"/,
    "the stage never grew a build panel — the defect: the painter can update one and not create one");
  assert.match(stage.innerHTML, /class="st-building"/, "the panel is not inside the building frame");
  assert.match(stage.innerHTML, /class="st-frame-bar"/, "the frame lost its url bar");
  assert.match(stage.innerHTML, /marlow-and-tide\.gofarther\.app/,
    "the frame bar names no address — the composition is not the render's");
  assert.ok(!/Describe your site on the left/.test(stage.innerHTML),
    "the invitation is still on screen underneath the panel");
});

test("DRIVEN: once the panel exists it is updated in place, not rebuilt", () => {
  const stage = makeStage(INVITATION);
  const l = loadPainter({ stage, site: DRAFT, phase: "thinking", startedAt: Date.now() - 3000 });
  l.setPhase("planning"); l.paint();
  assert.match(stage.innerHTML, /Planning your site/, "the first paint drew the wrong stage label");

  // The panel now exists, so this must take the UPDATE leg. The tell is that the
  // label moves while the frame around it is untouched — a create would rebuild
  // the frame too, which is invisible from the outside except here.
  const bars = (stage.innerHTML.match(/st-frame-bar/g) || []).length;
  l.setPhase("generating"); l.paint();
  assert.match(stage.innerHTML, /Writing the code/, "the running panel stopped following the phase");
  assert.ok(!/Planning your site/.test(stage.innerHTML), "the old label is still on screen");
  assert.equal((stage.innerHTML.match(/st-frame-bar/g) || []).length, bars,
    "the frame was drawn a second time — the create branch is firing on every tick");
  assert.equal((stage.innerHTML.match(/class="st-b1"/g) || []).length, 1,
    "the stage holds two build panels");
});

test("DRIVEN: a built site's preview is never painted over", () => {
  // THE `!isReact` HALF, and it is the reason the decision takes the site. On a
  // site that has already built, the stage holds the live preview iframe and a
  // revise keeps it — painting a build panel there would tear the iframe down
  // and reload the customer's preview mid-edit.
  const preview = '<div class="st-frame"><div class="st-frame-bar"><span class="st-frame-url">x</span></div><iframe id="stFrame"></iframe></div>';
  const stage = makeStage(preview);
  const l = loadPainter({ stage, site: BUILT, phase: "generating", startedAt: Date.now() - 3000 });
  l.paint();
  assert.equal(stage.innerHTML, preview, "a revise replaced the live preview with a build panel");
});

test("DRIVEN: nothing is painted when there is no stage at all", () => {
  // The painter runs off a 1.5s ticker and off every stream event, so it fires
  // on screens that have no workspace drawn. A `getElementById` answering null
  // is that screen, and it must be a no-op rather than a throw.
  const l = loadPainter({ stage: null, site: DRAFT, phase: "generating" });
  assert.doesNotThrow(() => l.paint());
});

// ── THE DECISION ITSELF ─────────────────────────────────────────────────────

test("DRIVEN: stStageBuilding over every shape, and cannot-tell is not a build", () => {
  const ask = (o) => loadPainter({ stage: makeStage(""), site: DRAFT, ...o }).building(o.arg);

  assert.equal(ask({ arg: DRAFT, phase: "planning" }), true, "a first build in a real phase is not a build");
  assert.equal(ask({ arg: DRAFT, phase: "thinking" }), false,
    "a message of unknown shape counts as a build — the greeting defect, one gate up");
  assert.equal(ask({ arg: BUILT, phase: "planning" }), false,
    "a revise on a built site would have its preview painted over");
  assert.equal(ask({ arg: DRAFT, phase: "planning", busy: false }), false,
    "a finished build still shows the rail");
  // A SITE THAT IS NOT THERE. Absent must read as "no preview to protect", which
  // is the same answer the render gives for a draft — never a throw.
  assert.equal(ask({ arg: null, phase: "planning" }), true);
  assert.equal(ask({ arg: undefined, phase: "planning" }), true);
  // HALF-BUILT IS NOT BUILT: a site carrying a slug and no url has no iframe to
  // protect, and this is exactly the state a first build is in mid-flight.
  assert.equal(ask({ arg: { react: true }, phase: "planning" }), true,
    "a site with react and no url was read as having a live preview");
  assert.equal(ask({ arg: { url: "https://x" }, phase: "planning" }), true,
    "a site with a url and no react build was read as having a live preview");
  // NOTHING IN FLIGHT AT ALL, which is the shape that makes the `!!` real. A
  // sweep found this: with no build the chain answers on `siteBuild` itself, so
  // dropping the coercion answers `null` rather than `false`. Both consumers ask
  // truthiness today, so the product would be right and the type would be wrong
  // — and one `=== false` written downstream later reads "no build running" as a
  // build. That is `readWaveAnswer`'s recorded defect one screen over, and the
  // reason the coercion is there rather than tidied away.
  assert.equal(ask({ arg: DRAFT, noBuild: true }), false, "no build in flight was read as a running build");
  assert.equal(typeof ask({ arg: DRAFT, noBuild: true }), "boolean",
    "the decision answers something falsy that is not `false`");
  assert.equal(typeof ask({ arg: DRAFT, phase: "thinking" }), "boolean");
});

test("DRIVEN: the frame carries the address and the panel, and nothing else composes it", () => {
  const l = loadPainter({ stage: makeStage(""), site: DRAFT, phase: "planning" });
  const html = l.frame(DRAFT);
  assert.match(html, /class="st-frame"/);
  // The address is asserted as `siteChipUrl` really answers it, trailing slash
  // and all — a hand-typed expectation here would be a second copy of what that
  // function returns, which is the recorded fixture-in-a-different-shape trap
  // and is what shipped `//menu` as a canonical for a day.
  assert.match(html, /class="st-frame-url">marlow-and-tide\.gofarther\.app\/</,
    "the frame bar does not carry the site's own chip address");
  assert.match(html, /class="st-b1"/, "the frame does not hold the one stage composition");
  // A DRAFT WITH NO SLUG STILL DRAWS A FRAME. `siteChipUrl` answers a sentence
  // rather than an address there, and a frame that threw would leave the stage
  // on the invitation for exactly the builds this exists to fix.
  assert.match(l.frame({ id: "p2" }), /Draft preview/);

  // THE FRAME NAMES THE PAGE BEING LOOKED AT, not merely the site — the render
  // has always composed the chip from `siteActivePage(site)` and this carries
  // that unchanged. A sweep found it: with a page-less fixture, dropping the
  // lookup changes nothing, because the site under test had no active page to
  // find. A CLASSIC draft with pages reaches this frame (the build gate sits
  // above `hasSite`), so the lookup is load-bearing and needs a site that has
  // one — the recorded "a guard proves the branch it drives".
  const withPages = { id: "p3", slug: "marlow-and-tide", active: "/menu",
    pages: [{ path: "/", name: "Home", html: "" }, { path: "/menu", name: "Menu", html: "" }] };
  assert.match(l.frame(withPages), /class="st-frame-url">marlow-and-tide\.gofarther\.app\/menu</,
    "the frame bar ignores which page is open — it no longer composes the address the render composes");
});

// ── THE WIRING, COUNTED AND NAMED ───────────────────────────────────────────

test("THE WIRING: one decision and one composition, each asked in BOTH places", () => {
  // Cutting either call leaves both new functions perfect and one path dead —
  // the recorded wiring trap, and precisely how the original shipped: the
  // drawing was shared and the decision was not.
  assert.equal((BARE.match(/stStageBuilding\(/g) || []).length, 3,
    "expected the definition plus two asks (the render, the painter)");
  assert.equal((BARE.match(/stBuildFrameHTML\(/g) || []).length, 3,
    "expected the definition plus two draws (the render, the painter)");

  // THE RENDER, read between landmarks rather than by byte offset — this file's
  // subject carries a dozen lines of prose into that block and a byte window is
  // this repository's most-repeated own-goal.
  const at = BARE.indexOf('<div class="st-stage" id="stStage"');
  assert.ok(at > 0, "the stage container is gone");
  const end = BARE.indexOf('<div class="st-fixbar"', at);
  assert.ok(end > at, "the stage block has no end landmark — re-derive this window");
  const stage = BARE.slice(at, end);
  assert.match(stage, /\(stStageBuilding\(site\)/,
    "the render spells the build test itself again — the painter cannot ask what the render decides inline");
  assert.match(stage, /\? stBuildFrameHTML\(site\)/,
    "the render draws its own copy of the build frame");

  // THE PAINTER, and the branch that is the fix. Read as well as driven because
  // the drive stubs nothing here and this says WHICH element is created.
  const paint = cut("paintReactLive");
  assert.match(paint, /const stage = document\.getElementById\('stStage'\)/,
    "the painter no longer reaches the stage container, so it can only ever find an existing panel");
  assert.match(paint, /else if \(stage\)[\s\S]*stStageBuilding\(/,
    "the painter has no create branch, or creates without asking whether a build is running");
});

test("THE WIRING: the painter looks up the site the render draws", () => {
  // The two answers must be about the same site or they can disagree on any
  // tick. The render is opened with `siteById(siteOpenId)` and the painter asks
  // for the same thing — asserted as an identity between the two call sites,
  // because every caller of the painter is an event and cannot be handed one.
  const render = cut("renderSites");
  assert.match(render, /const open = siteOpenId && siteById\(siteOpenId\)/,
    "the render no longer opens siteById(siteOpenId) — the painter's lookup is now about a different site");
  assert.match(render, /renderSiteWorkspace\(view, open\)/,
    "the workspace is drawn for something other than the opened site");
  assert.match(cut("paintReactLive"), /siteById\(siteOpenId\)/,
    "the painter decides against a site the render never drew");
});
