// THE BUILD'S LIVE LINES ARE DRAWN ONCE (2026-10-19). Deploy 2218's recorded
// build showed one progress line nine times: `paintReactLive` swaps the
// `.st-steps-live` box alone, and the lines were drawn BESIDE that box, so each
// repaint left the old list behind and added a new one. Every markup the live
// steps return must keep its lines inside the box the repaint replaces.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const CHAT = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");

function body(name) {
  const start = CHAT.indexOf("function " + name + "(");
  assert.ok(start >= 0, name + " is gone");
  const end = CHAT.indexOf("\n}\n", start);
  assert.ok(end > start, name + " has no end");
  return CHAT.slice(start, end);
}

test("the repaint swaps the live box, and every live markup ends with that box", () => {
  assert.match(body("paintReactLive"), /querySelector\('#stThread \.st-steps-live'\)[\s\S]*host\.outerHTML = reactLiveStepsHTML\(\)/,
    "the repaint no longer swaps the live box by its outer markup");
  const live = body("reactLiveStepsHTML");
  const returns = live.split("\n").filter((l) => /^\s*(?:if \(.*\) )?return '<div class="st-steps st-steps-live/.test(l));
  assert.ok(returns.length >= 2, "the live markup's returns could not be found");
  for (const r of returns) {
    assert.match(r.trim(), /<\/div>';$/, "something is drawn after the live box, and a repaint would leave it behind: " + r.trim());
  }
  assert.ok(returns.some((r) => r.includes("progressListHTML(lines, true)")), "the build's own lines are no longer in the live box");
});

// THE HEADER DURING A BUILD (2026-10-19): it read "Build a website for", the
// brief's first four words, until the build named the site.
test("a new project is named neutrally, never from the brief's first words", () => {
  const create = body("siteCreate");
  assert.match(create, /const name = 'New website';/, "a new project is no longer named neutrally");
  assert.ok(!/prompt\.split\(/.test(create), "a new project is named from the brief again");
  assert.ok(!/name: words\.split\(/.test(CHAT), "a build picked up on another page is named from the brief again");
  assert.match(CHAT, /if \(d\.brand && typeof d\.brand === 'string' && d\.brand\.trim\(\)\) s\.name = d\.brand\.trim\(\)/, "the build no longer names the site when it finishes");
});

// THE FINISHED BUILD'S STEP SUMMARY IS GONE (2026-10-19, owner: "delete this
// completely" — the "wrote the code · compiled react · published" rows under
// the reply). The reply and the progress talk are what a finished build shows.
test("a finished reply no longer draws the build's step summary", () => {
  // (2026-10-23, background work: a card message that shows nothing is drawn `hidden`.)
  const at = CHAT.indexOf("('<div class=\"st-msg a\"' + (m.request && !m.t && !m.jobCard && !siteReqCardShows(m, site) ? ' hidden' : '') + '>') + (m.note");
  assert.ok(at > 0, "the assistant message markup could not be found");
  const line = CHAT.slice(at, CHAT.indexOf("\n", at));
  assert.ok(line.includes("siteMsgText(m, linkify)"), "the landmark is not the message markup");
  assert.ok(!/reactStepsHTML\(m\.build\)/.test(line), "the finished build's step summary is drawn again");
});
