// A PUBLISH BUTTON ON THE WORKSPACE BAR (2026-09-12, owner: "NEXT TO SHARE ADD
// A PUBLISH BUTTON").
//
// There was one until 2026-09-08 and it was deleted, so the first question this
// file has to answer is why the new one is not the old one coming back.
//
// THE OLD ONE WAS DRAWN `isReact ? '' : …`. That gate meant it appeared ONLY on
// a project that had never built — the single state where it had nothing to
// open — and vanished the moment the site had an address worth showing. Both
// halves were unreachable code that read as live from the source. The gate is
// the defect, and the test below that forbids it is the point of this file.
//
// WHAT IT OPENS IS REAL, which is the other half. `sitePublishPanel` carries
// the live URL as a link, Copy link, and Take it offline / Put it back online
// over `POST /api/site/<slug>/offline` — a capability whose only door since
// 2026-09-08 has been More → Cloud → Visibility. The panel's own dead buttons
// (Publish and Republish, POSTing a route deleted 2026-07-27) went that day, so
// what this opens is a panel that stopped lying before it was given a door.
//
// `test/visibility-card.test.mjs` guards the OTHER door and the panel's own
// contents; this file guards the button and the fact that it dispatches. Two
// doors to one panel is deliberate and is the owner's call.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const CHAT = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const CSS = fs.readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

/**
 * Whole-line comments blanked, LENGTH PRESERVED so offsets still line up.
 *
 * This change's own comment block names `isReact`, `sitePublishPanel`,
 * `st-publish` and the words "Live" and "Offline" repeatedly while explaining
 * what was deleted and why — the recorded "prose contains the thing it
 * forbids". Every absence check below would match an explanation rather than
 * code without this.
 *
 * LINE COMMENTS FIRST and block openers only at the start of a line: chat.js
 * carries `// Every /api/* call carries the Supabase access token`, whose `/*`
 * opens a false block running 71,729 characters to the next real `* /` and
 * swallowing most of the file. Measured at 37.1% survival when done the other
 * way round.
 */
const BARE = CHAT.split("\n")
  .map((l) => (/^\s*\/\//.test(l) ? " ".repeat(l.length) : l))
  .join("\n");

// THE OBSERVER IS ALIVE. A blanker that ate the file would make every check
// below vacuous, and a survival RATIO is the wrong test — chat.js is measured at
// 50.1% comments. Assert the landmarks this file is about to look for.
test("the blanker left the landmarks this file reads", () => {
  for (const landmark of ['id="stPublish"', 'id="stShare"', '<div class="st-tb-right">', "function sitePublishPanel(site)"]) {
    assert.ok(BARE.includes(landmark), landmark + " did not survive comment blanking — this file proves nothing");
  }
});

/** The button's own markup, landmark to landmark — never a byte window. */
function buttonMarkup() {
  const at = BARE.indexOf('id="stPublish"');
  assert.ok(at > 0, "the Publish button is gone from the top bar");
  const end = BARE.indexOf(">Publish</button>", at);
  assert.ok(end > at, "the button has no closing landmark — re-derive this window");
  return BARE.slice(at, end + ">Publish</button>".length);
}

// ── THE BUTTON ──────────────────────────────────────────────────────────────

test("Publish is drawn, next to Share, in the right-hand group", () => {
  const right = BARE.indexOf('<div class="st-tb-right">');
  const share = BARE.indexOf('id="stShare"', right);
  const pub = BARE.indexOf('id="stPublish"', right);
  assert.ok(right > 0 && share > right, "the top bar was restructured — rescope this guard");
  assert.ok(pub > share, "Publish is no longer beside Share in the right-hand group");

  // AND NOT IN THE CENTRED GROUP, which `topbar-layout.test.mjs` holds to the
  // tabs alone: anything else in there moves the tabs at every width.
  const mid = BARE.indexOf('<div class="st-tb-mid">');
  assert.ok(mid > 0 && mid < right, "the middle group moved");
  assert.ok(!BARE.slice(mid, right).includes("stPublish"), "Publish is inside the centred group and will move the tabs");
});

test("it is NOT gated on isReact — the defect that killed the last one", () => {
  // THE ONE ASSERTION THIS FILE EXISTS FOR. `isReact ? '' : …` around this
  // button draws it only on a project that has never built, which is the single
  // state in which it has nothing to open.
  //
  // The window runs from Share to the end of Publish, so a conditional WRAPPING
  // the button is caught as well as one inside it — the old gate was the
  // wrapping kind.
  const from = BARE.indexOf('id="stShare"');
  const to = BARE.indexOf(">Publish</button>", from);
  assert.ok(from > 0 && to > from, "one of the two buttons moved — re-derive this window");
  const span = BARE.slice(from, to);
  assert.ok(!span.includes("isReact"), "the isReact gate is back: the button will vanish from every site that has built");
});

test("it is gated on the slug, and DIMMED rather than hidden without one", () => {
  const markup = buttonMarkup();
  // `siteSetLive` returns at once without a slug and the panel's link needs
  // one, so this is the same gate the Visibility card asks — asserted there too.
  assert.match(markup, /site\.slug/, "the button no longer asks whether there is a site to publish");
  assert.match(markup, /\bdisabled\b/, "it is hidden rather than dimmed before the first build");

  // BOTH BRANCHES SAY SOMETHING. A disabled control with no tooltip is a
  // customer wondering what they did wrong; the enabled one has to resolve the
  // contradiction between a button reading Publish and a panel reading "there is
  // nothing to publish", which it can only do before the click.
  assert.equal((markup.match(/title="/g) || []).length, 2, "one of the two states has no tooltip");
});

test("the label is a constant, and the button claims no action it cannot do", () => {
  // The DELETED button set its own label to "Live" or "Offline" — a second copy
  // of state the panel already reads, and the panel's copy is the better one
  // (`SiteList.offlineFor` prefers the server's answer over this browser's).
  // A bar that carries the state has to be repainted when the site goes offline,
  // and this render is not the thing that would notice.
  const markup = buttonMarkup();
  assert.match(markup, />Publish<\/button>/, "the label is no longer a literal in the markup");
  assert.ok(!/offlineFor|site\.offline/.test(markup), "the button reads the offline state again — the panel is the one place that says which face a site wears");

  // AND NOTHING REWRITES IT AFTER THE FACT. Read over the HANDLER's own region,
  // not over the string `stPublish`: the realistic defect is `pub.textContent =
  // …` on a line that never names the id, so a needle keyed on the id would
  // have watched the one line the mutation does not touch. Landmark to
  // landmark, both ends asserted.
  const at = BARE.indexOf("const pub = document.getElementById('stPublish');");
  assert.ok(at > 0, "the handler's opening landmark moved");
  const end = BARE.indexOf("\n  const ", at + 10);
  assert.ok(end > at, "the handler has no closing landmark — re-derive this window");
  const handler = BARE.slice(at, end);
  assert.ok(!/textContent|innerHTML/.test(handler), "something swaps the button's label at runtime");
  assert.ok(!/offline/i.test(handler), "the handler reads the offline state — that is the panel's job, and this render would not be repainted when it changes");
});

// ── THE DOOR ────────────────────────────────────────────────────────────────

test("pressing it opens the panel, and the call is not in a dead branch", () => {
  // A POSITION IS NOT A BEHAVIOUR: `if (false) pub.onclick = …` leaves the
  // handler exactly where a position check finds it, which is why the call's own
  // condition is read rather than its offset.
  assert.match(BARE, /const pub = document\.getElementById\('stPublish'\);\s*\n\s*if \(pub\) pub\.onclick = \(\) => sitePublishPanel\(site\);/,
    "the Publish handler is gone, renamed, or behind a condition that is not the element check");
});

test("the panel it opens still exists, and both doors reach the same one", () => {
  // A button with no panel and a panel with no button are equally dead, and
  // this repo has shipped both.
  assert.match(BARE, /function sitePublishPanel\(site\)/, "the panel itself is gone");
  // TWO DOORS NOW, deliberately — the Cloud card and this button. Counted so
  // that a later edit which re-points one of them at something else shows.
  const calls = (BARE.match(/sitePublishPanel\(site\)/g) || []).length;
  assert.ok(calls >= 3, "expected the declaration plus both doors, found " + calls + " mentions");
  assert.match(BARE, /b\.dataset\.cloud === 'visibility'\) sitePublishPanel\(site\)/, "the Cloud card's door was lost");
});

// ── THE SHEET ───────────────────────────────────────────────────────────────

test("the disabled state is painted, not just written", () => {
  // The button is DRAWN disabled before the first build. A sheet with no
  // disabled rule paints a full-strength primary button that does nothing when
  // pressed — the markup would be correct and the screen would be lying.
  // Read by VALUE, because a rule that exists and says nothing satisfies a
  // presence check: the recorded "a CSS rule can be correct and still lose".
  const m = CSS.match(/\.st-publish\[disabled\]\s*\{[^}]*\}/);
  assert.ok(m, "the disabled rule is gone — a dimmed button draws at full strength");
  assert.match(m[0], /opacity:\s*\.?\d/, "it is not dimmed");
  assert.match(m[0], /cursor:\s*default/, "it still offers a pointer on a button that does nothing");

  // And the button has a look at all: this is the primary action's style and it
  // is shared with every modal's own primary button.
  const base = CSS.match(/^\.st-publish \{[\s\S]*?\n\}/m);
  assert.ok(base, "the .st-publish rule is gone — the button draws as unstyled chrome");
  assert.match(base[0], /background:\s*var\(--split\)/, "it no longer reads as the primary action");
});
