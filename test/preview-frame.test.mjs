// THE PREVIEW PANEL RUNS THE SITE'S OWN JAVASCRIPT (2026-09-07, owner: "SO ITS
// PREVIEW THING, BECAUSE ON THE URL SHOWS FINE, SO FIX").
//
// The workspace preview framed a published site with no `allow-same-origin`, so
// the document's origin was opaque and every script it needed was refused —
// once by CORS (module scripts are fetched in CORS mode; the site sends no
// access-control-allow-origin for origin `null`) and again by the site's own
// `script-src 'self'`, which matches nothing under an opaque origin. The panel
// painted the server-rendered HTML and nothing ever ran: no 3D scene, no
// language switcher, no form. The owner found it as an empty 3D box.
//
// The fix is one attribute, and the whole risk in it is WHEN it may be added:
// `allow-scripts allow-same-origin` on a frame that is already same-origin with
// the app lets that frame take its own sandbox off — and the draft preview IS
// same-origin (gofarther.dev/preview/<uid>/<nonce>). So the decision is made per
// URL and fails closed, and these guards drive both directions plus every call
// site, because a function that decides correctly and is never called is this
// repo's most repeated defect.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const chat = read("../public/chat.js");

// Whole-line comments blanked, length preserved: this file's own prose names
// every spelling it forbids, and so does chat.js's.
const bare = (s) => s.split("\n").map((l) => (/^\s*\/\//.test(l) ? " ".repeat(l.length) : l)).join("\n");

// The real function, evaluated out of chat.js with a `location` handed in —
// site-list's own technique. Reading the source would certify the layer below
// the break; the property here is what it ANSWERS.
function loadFrameSandbox(origin) {
  const cut = (head) => {
    const at = chat.indexOf(head);
    assert.ok(at > 0, head + " is gone from chat.js");
    const end = chat.indexOf("\n}", at);
    assert.ok(end > at, head + " has no end");
    return chat.slice(at, end + 2);
  };
  const cAt = chat.indexOf("const FRAME_SANDBOX = ");
  assert.ok(cAt > 0, "the base flags are gone from chat.js");
  const cEnd = chat.indexOf("\n", cAt);
  return new Function("location",
    chat.slice(cAt, cEnd) + "\n" + cut("function frameSandbox(") + "\nreturn frameSandbox;")({ origin, href: origin + "/" });
}

const APP = "https://gofarther.dev";
const BASE = "allow-scripts allow-forms allow-popups";

test("DRIVEN: a published site on its own address keeps its own origin, so its scripts run", () => {
  const fs = loadFrameSandbox(APP);
  const got = fs("https://fretwork-1.gofarther.app/?v=3");
  assert.match(got, /allow-same-origin/,
    "a cross-origin site must be allowed its own origin or nothing on the page runs");
  // The three it already had are still there — the widening only ever adds.
  for (const flag of BASE.split(" ")) assert.match(got, new RegExp(flag + "(\\s|$)"), flag + " was dropped");
  // A custom domain is the same case.
  assert.match(fs("https://crookesguitar.co.uk/"), /allow-same-origin/);
});

test("DRIVEN: the app's OWN origin never gets it — that frame could take its sandbox off", () => {
  const fs = loadFrameSandbox(APP);
  // The draft preview, served from our own Worker. This is the case that makes
  // the decision per-URL rather than a one-line change.
  assert.equal(fs(APP + "/preview/u123/nonce"), BASE, "the draft preview must stay opaque");
  assert.equal(fs("/preview/u123/nonce"), BASE, "a relative URL resolves against the app and stays opaque");
  assert.equal(fs(APP + "/s/fretwork-1/"), BASE, "our own /s/ path stays opaque");
});

test("DRIVEN: anything it cannot prove cross-origin keeps yesterday's flags", () => {
  const fs = loadFrameSandbox(APP);
  // Cannot-tell must never read as somewhere-else. Each of these would be a
  // silently widened sandbox if the answer defaulted the other way.
  assert.equal(fs(""), BASE, "an empty url");
  assert.equal(fs(null), BASE, "no url at all");
  assert.equal(fs(undefined), BASE, "an absent url");
  // `::::not a url` does NOT throw — with a base it resolves as a path on the
  // app, which is its own reason to stay tight. The sweep caught the mislabel:
  // it was the only case named "unparseable", so the catch branch below had no
  // driver at all and a mutant that widened it survived.
  assert.equal(fs("::::not a url"), BASE, "junk resolves against the app and stays tight");
  // GENUINELY UNPARSEABLE — these throw inside the constructor, which is the
  // branch that failing closed depends on.
  assert.equal(fs("http://["), BASE, "a malformed host throws and must not widen");
  assert.equal(fs("https://[bad]/"), BASE, "a malformed host throws and must not widen");
  assert.equal(fs("https://exa mple.com/"), BASE, "a space in the host throws and must not widen");
  assert.equal(fs("data:text/html,<b>hi</b>"), BASE, "a data: url parses to origin null");
  // NEVER COERCE: String(["https://x.gofarther.app/"]) is the bare URL, and a
  // one-element array has passed as a string three times in this repo.
  assert.equal(fs(["https://x.gofarther.app/"]), BASE, "an array is not a string");
  assert.equal(fs({ toString: () => "https://x.gofarther.app/" }), BASE, "an object is not a string");
});

test("DRIVEN: a blob preview stays opaque (it inherits the app's origin)", () => {
  const fs = loadFrameSandbox(APP);
  // The offline fallback in loadSitePreview. Chrome parses a blob URL's origin
  // as the inner origin, so this is the app — and the tight flags are right.
  const got = fs("blob:" + APP + "/6f2b-…");
  assert.equal(got, BASE, "a blob of our own origin must not be widened");
});

test("THE WIRING: every place the preview frame is pointed goes through loadSiteFrame", () => {
  const src = bare(chat);
  // The setter writes the flags BEFORE the navigation, because a sandbox
  // attribute applies at navigation and changing it afterwards does nothing.
  const at = src.indexOf("function loadSiteFrame(");
  assert.ok(at > 0, "loadSiteFrame is gone");
  const body = src.slice(at, src.indexOf("\n}", at));
  const setAt = body.indexOf("setAttribute('sandbox'");
  const srcAt = body.indexOf(".src =");
  assert.ok(setAt > 0, "loadSiteFrame no longer writes the sandbox attribute");
  assert.ok(srcAt > setAt, "the flags must be written BEFORE the src, or the navigation uses the old ones");
  assert.match(body, /frameSandbox\(/, "loadSiteFrame no longer asks frameSandbox — the flags would be fixed");

  // THE CALL SITES. Cutting the call out of any one of them leaves the function
  // perfect and that surface dead — the wiring trap, which survived twelve
  // features here and was caught on the card icons by exactly this check.
  const calls = (src.match(/loadSiteFrame\(/g) || []).length;
  assert.equal(calls, 5, "one definition plus four call sites; a changed count means one moved or went");

  // Named individually, so the count above cannot be satisfied by four copies
  // in one place.
  assert.match(src, /loadSiteFrame\(fr, site\.url \+/, "the workspace render must point the frame through it");
  assert.match(src, /loadSiteFrame\(f, s\.url \+/, "the page picker must point the frame through it");
  assert.match(src, /loadSiteFrame\(fr, d\.url\)/, "the draft preview must point the frame through it");
  assert.match(src, /loadSiteFrame\(fr, sitePrevUrl\)/, "the blob fallback must point the frame through it");

  // AND NO ROUTE AROUND IT, asked per function rather than across the file:
  // the card thumbnail assigns `fr.src` directly and is meant to, so a file-wide
  // scan would either flag correct code or have to carry a list of exceptions
  // that drifts. The property is about the PREVIEW frame: every function that
  // looks #stFrame up must navigate it through the setter.
  let from = 0, seen = 0;
  for (;;) {
    const hit = src.indexOf("getElementById('stFrame')", from);
    if (hit < 0) break;
    from = hit + 1;
    const head = Math.max(src.lastIndexOf("\nfunction ", hit), src.lastIndexOf("\nasync function ", hit));
    const tail = src.indexOf("\n}", hit);
    assert.ok(head > 0 && tail > hit, "could not bound the function that looks up the preview frame");
    const fn = src.slice(head, tail);
    const name = /^\s*(?:const|let|var)?\s*(\w+)\s*=\s*document\.getElementById\('stFrame'\)/m.exec(
      fn.slice(fn.indexOf("getElementById('stFrame')") - 40)
    );
    if (name) {
      assert.ok(!new RegExp("\\b" + name[1] + "\\.src\\s*=").test(fn),
        "a function holding the preview frame assigns its src directly, skipping the flags");
    }
    seen++;
  }
  assert.ok(seen >= 3, "the preview frame is looked up in fewer places than it was — did the panel move?");
});

test("THE MARKUP: the frame is born on the tight flags, spelled once", () => {
  const src = bare(chat);
  // Fail-closed at creation: whatever happens before a navigation, the frame
  // cannot be wider than the day before this change.
  assert.match(src, /id="stFrame" sandbox="' \+ FRAME_SANDBOX \+ '"/,
    "the preview frame's markup must take the base flags from the constant, not a second literal");
  // One spelling of the three flags in the whole file — the recorded "two lists
  // of the same thing", which is how a widening would go unnoticed on one of them.
  assert.equal((src.match(/allow-scripts allow-forms allow-popups/g) || []).length, 1,
    "the base flags are written more than once");
});

test("THE THUMBNAILS ARE LEFT TIGHT ON PURPOSE, and the observer proves it is awake", () => {
  const src = bare(chat);
  // A negative assertion beside a positive one: if the card grid stopped being
  // drawn at all this check would still have to fail.
  assert.match(src, /class="st-card-prev"><iframe sandbox="/, "the card thumbnail frame is gone");
  const card = src.slice(src.indexOf('class="st-card-prev"'), src.indexOf('class="st-card-meta"'));
  assert.ok(card.length > 40, "the thumbnail markup window is empty");
  assert.ok(!/allow-same-origin/.test(card),
    "the thumbnails must stay cheap: one frame per site, 51 on the owner's account, and each would start a whole app");
  assert.match(card, /'allow-scripts' : ''/, "the thumbnail's own flags moved");
});
