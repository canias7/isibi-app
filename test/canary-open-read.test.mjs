// THE PAGE WITH ITS DISCLOSURES OPENED (2026-10-12, K's run 135 and M's run
// 138). An accordion serves its answers closed: the served HTML held "Can I
// bring my dog?" and never "Dogs are welcome inside.", so the served section
// check failed a page that was right. Verified free in a browser the same day
// (both answers open to what was asked). `readOpenedPage` reads the page as a
// visitor who presses each question: reads only, nothing in a form, nothing
// in the header or a menu, every request that is not a read stopped.
//
// In a real Chromium, on a page served from memory; nothing leaves the machine.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readOpenedPage, UI_SCENARIOS } from "../scripts/canary-ui.mjs";
import { sectionChecks, addedRuns, servedLines, runText } from "../scripts/canary-requests.mjs";

// M's own expectation for the Tasting Evenings section.
const UI_SECTION_PROBE = UI_SCENARIOS["acc-addon-two-parts"].expect.sections.find((x) => x.route === "/tasting-evenings");

const EXE = "/opt/pw-browsers/chromium";
let chromium = null;
try { ({ chromium } = await import("playwright-core")); } catch { chromium = null; }
const HAVE = !!chromium && existsSync(EXE);
const SKIP = !HAVE && "no browser here (playwright-core and Chromium are not installed)";

const ORIGIN = "https://open-read.test";
// A RADIX-LIKE ACCORDION: the answer is not in the page until its question is
// pressed. Beside it: a menu button (in the header), a form with a submit
// button, a closed <details>, and a disclosure whose press tries to write.
const PAGE = (answer) => `<!doctype html><html><body>
<header><button aria-expanded="false" id="menu" onclick="location.href='/elsewhere'">Menu</button></header>
<main>
  <h1>Tasting Evenings</h1>
  <form onsubmit="fetch('/api/join',{method:'POST',body:'x'});return false"><input name="email"><button type="button" aria-expanded="false" onclick="fetch('/api/form-options',{method:'POST',body:'x'})">Options</button><button type="submit" aria-expanded="false">Join</button></form>
  <section class="faq">
    <h3><button aria-expanded="false" aria-controls="a1" id="q1">How much is an evening?</button></h3>
    <div id="a1" role="region" hidden></div>
  </section>
  <details><summary>Where is it?</summary><p>At the counter, Bristol.</p></details>
  <button aria-expanded="false" id="w" onclick="fetch('/api/track',{method:'POST',body:'opened'});this.setAttribute('aria-expanded','true')">More</button>
</main>
<script>
  document.getElementById('q1').addEventListener('click', (e) => {
    const b = e.currentTarget, p = document.getElementById('a1');
    b.setAttribute('aria-expanded', 'true'); p.hidden = false; p.innerHTML = '<p>${answer}</p>';
  });
</script>
</body></html>`;

async function readIt(html) {
  const browser = await chromium.launch({ executablePath: EXE });
  const sent = [];
  try {
    const out = await readOpenedPage(browser, {
      url: ORIGIN + "/tasting-evenings", ms: 10_000, settleMs: 50,
      route: async (ctx) => {
        await ctx.route("**/*", async (r) => {
          const req = r.request();
          sent.push(req.method() + " " + new URL(req.url()).pathname);
          if (req.method() === "GET" && new URL(req.url()).pathname === "/tasting-evenings") return r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
          return r.fulfill({ status: 404, body: "" });
        });
      },
    });
    return { out, sent };
  } finally { await browser.close(); }
}

test("OPEN 1 — in a real browser: each closed question is opened and its answer read; the header's menu, the form's button and the form itself are never pressed; a press that tries to write is stopped and recorded, never sent", { skip: SKIP }, async () => {
  const { out, sent } = await readIt(PAGE("£25 a head, cheese included."));
  assert.equal(out.ok, true, out.why);
  assert.ok(out.html.includes("£25 a head, cheese included."), "the answer was not read: " + out.html.slice(0, 600));
  assert.ok(out.html.includes('open=""') || /<details open/.test(out.html), "the closed <details> was not opened");
  assert.ok(out.opened >= 3, "not every closed disclosure was opened: " + out.opened);
  assert.ok(!sent.some((x) => x.includes("/elsewhere")), "the menu was pressed: " + JSON.stringify(sent));
  assert.ok(!sent.some((x) => x.includes("/api/join")), "the form was submitted: " + JSON.stringify(sent));
  assert.ok(!sent.some((x) => x.startsWith("POST")), "a write left the browser: " + JSON.stringify(sent));
  assert.deepEqual(out.aborted.map((x) => x.replace(ORIGIN, "")), ["POST /api/track"], "the stopped write was not recorded");
  assert.ok(!/data-canary-open/.test(out.html), "the reader's own marks were left in the markup");
});

test("OPEN 2 — what the opened read is judged on: the answer the visitor sees passes; a wrong answer behind the same question fails; the served HTML, closed, fails as K's run 135 did", { skip: SKIP }, async () => {
  const want = UI_SECTION_PROBE;
  const before = (await readIt(PAGE("")).then((r) => r.out.html)).replace(/<section class="faq">[\s\S]*?<\/section>/, "");
  const judge = (after) => sectionChecks("served", addedRuns(servedLines(before), servedLines(after)).map(runText), want).filter((c) => !c.ok).map((c) => c.name);
  const right = (await readIt(PAGE("£25 a head, cheese included."))).out.html;
  assert.deepEqual(judge(right), []);
  const wrong = (await readIt(PAGE("£50 a head, cheese included."))).out.html;
  assert.ok(judge(wrong).length > 0, "a wrong answer passed");
  assert.ok(judge(PAGE("£25 a head, cheese included.")).length > 0, "the closed page passed: it holds no answer");
});
