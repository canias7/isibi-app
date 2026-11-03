// WORD BY WORD (2026-10-21, owner: "instead of just putting the sentence there,
// lets have it word by word"). The reveal is driven by time, so a redraw never
// restarts it; what was on screen when a site opened is never typed; reduced
// motion types nothing.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

// THE SAME BROWSER CHECK AS EVERY OTHER BROWSER CASE: CI has no playwright-core.
let chromium = null;
try { ({ chromium } = await import("playwright-core")); } catch { chromium = null; }
const SKIP = !(chromium && existsSync("/opt/pw-browsers/chromium")) && "no browser here";

const src = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const a = src.indexOf("const TypeIn = (() => {");
const b = src.indexOf("\n})();", a);
const block = src.slice(a, b);

test("the reveal keeps each text's first moment, so a redraw resumes it rather than restarting", () => {
  assert.ok(a > 0 && b > a, "TypeIn is gone from chat.js");
  assert.match(block, /const started = new Map\(\);/);
  assert.match(block, /if \(!started\.has\(key\)\) started\.set\(key, first \|\| reduce\(\) \? 0 : now\);/, "a text already on screen, or reduced motion, is typed");
  assert.match(block, /Math\.floor\(\(\(now - t0\) \/ 1000\) \* rate\) \+ 1/, "the words shown are not read from the time elapsed");
  assert.match(block, /const rate = Math\.max\(WPS, words \/ \(MAX_MS \/ 1000\)\);/, "a long reply never finishes in a bounded time");
});

test("it types the progress lines and the replies, never buttons, options, the working line or folded detail", () => {
  assert.match(block, /ul\.st-req-prog > li/);
  assert.match(block, /\.st-msg\.a/);
  for (const skip of ["ul.st-req-prog", ".st-opts", ".st-think", "details", "button"]) assert.ok(block.includes(skip), "typed inside " + skip);
  assert.match(block, /new MutationObserver\(schedule\)\.observe\(document\.body, \{ childList: true, subtree: true \}\)/, "nothing starts it");
});

// THE KEY BOX'S BLANK NAMES (live, 2026-11-01, northline-climbing): the key
// box sits in a reply; a redraw mid-reveal left its names blank for good,
// because a text node blanked by the reveal was no longer a target.
test("the key box is never typed word by word", () => {
  assert.ok(block.includes("[data-keycard]"), "the key box is typed word by word");
});

test("a text node blanked mid-reveal is still finished", { skip: SKIP }, async () => {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
  try {
    const p = await browser.newPage();
    await p.setContent('<div id="stThread"></div>');
    const out = await p.evaluate(async (code) => {
      window.siteOpenId = "s"; eval(code + "\n})();\nwindow.TI = TypeIn;");
      const th = document.getElementById("stThread");
      TI.sweep(); // primes the site: what is on screen now is never typed
      const m = document.createElement("div"); m.className = "st-msg a";
      m.innerHTML = "<p>one two three four five six seven eight nine ten</p><b>NAME_ONE</b>";
      th.appendChild(m);
      const kc = document.createElement("div"); kc.className = "st-msg a";
      kc.innerHTML = '<div data-keycard=""><span class="kc-name">RESEND_API_KEY</span></div>';
      th.appendChild(kc);
      TI.sweep();
      const mid = m.querySelector("b").textContent;
      const kcMid = kc.querySelector(".kc-name").textContent;
      await new Promise((r) => setTimeout(r, 3600));
      TI.sweep();
      return { mid, kcMid, end: m.querySelector("b").textContent, kcEnd: kc.querySelector(".kc-name").textContent };
    }, block);
    assert.equal(out.mid, "", "the reveal had not reached the name yet (the observer is alive)");
    assert.equal(out.end, "NAME_ONE", "a node blanked mid-reveal stays blank");
    assert.equal(out.kcMid, "RESEND_API_KEY");
    assert.equal(out.kcEnd, "RESEND_API_KEY");
  } finally { await browser.close(); }
});
