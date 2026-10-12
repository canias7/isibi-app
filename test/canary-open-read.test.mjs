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
import { sectionChecks, addedRuns, servedLines, runText, openedSections } from "../scripts/canary-requests.mjs";

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
  assert.equal(out.complete, true, JSON.stringify(out.failed));
  assert.deepEqual(out.items.find((x) => x.question === "How much is an evening?"), { question: "How much is an evening?", answer: "£25 a head, cheese included." }, JSON.stringify(out.items));
  assert.deepEqual(out.items.find((x) => x.question === "Where is it?"), { question: "Where is it?", answer: "At the counter, Bristol." }, "the closed <details> was not opened and read");
  assert.ok(!out.html.includes("£25 a head"), "the page as served should hold no answer: it is read before any press");
  assert.ok(out.opened >= 3, "not every closed disclosure was opened: " + out.opened);
  assert.ok(!sent.some((x) => x.includes("/elsewhere")), "the menu was pressed: " + JSON.stringify(sent));
  assert.ok(!sent.some((x) => x.includes("/api/join")), "the form was submitted: " + JSON.stringify(sent));
  assert.ok(!sent.some((x) => x.startsWith("POST")), "a write left the browser: " + JSON.stringify(sent));
  assert.deepEqual(out.aborted.map((x) => x.replace(ORIGIN, "")), ["POST /api/track"], "the stopped write was not recorded");
  assert.ok(!/data-canary-open/.test(out.html), "the reader's own marks were left in the markup");
});

test("OPEN 2 — what the opened read is judged on: the answer the visitor sees beside its question passes; a wrong answer behind the same question fails; the served HTML, closed, fails as K's run 135 did", { skip: SKIP }, async () => {
  const want = UI_SECTION_PROBE;
  const strip = (h) => h.replace(/<section class="faq">[\s\S]*?<\/section>/, "");
  const before = await readIt(strip(PAGE(""))).then((r) => r.out);
  const judge = (after) => {
    const o = openedSections(before, after);
    return o.ok ? sectionChecks("served", o.sections, want).filter((c) => !c.ok).map((c) => c.name) : ["incomplete: " + o.why];
  };
  assert.deepEqual(judge((await readIt(PAGE("£25 a head, cheese included."))).out), []);
  assert.ok(judge((await readIt(PAGE("£50 a head, cheese included."))).out).length > 0, "a wrong answer passed");
  const closed = sectionChecks("served", addedRuns(servedLines(before.html), servedLines(PAGE("£25 a head, cheese included."))).map(runText), want).filter((c) => !c.ok);
  assert.ok(closed.length > 0, "the closed page passed: it holds no answer");
});

// ── ONE ANSWER AT A TIME (the owner's review of 6dae03bc) ───────────────────
//
// A single-open accordion closes the last answer when the next opens, so the
// page's final markup holds only the last one. Two questions are asked for
// here; every answer must be judged beside its own question.
const TWO = { facts: [{ fact: "£25 a head", any: ["£25 a head"] }, { fact: "on Thursdays", any: ["thursday", "thursdays"] }], only: { money: ["25"] } };
const SINGLE = (a1, a2, { brokenFirst = false } = {}) => `<!doctype html><html><body><main>
  <h1>Tasting Evenings</h1>
  <section class="faq">
    <h3><button aria-expanded="false" aria-controls="p1" id="b1">How much is an evening?</button></h3><div id="p1" role="region" hidden></div>
    <h3><button aria-expanded="false" aria-controls="p2" id="b2">When are the evenings?</button></h3><div id="p2" role="region" hidden></div>
  </section>
</main>
<script>
  const ans = { b1: ${JSON.stringify(a1)}, b2: ${JSON.stringify(a2)} };
  for (const id of ["b1", "b2"]) document.getElementById(id).addEventListener("click", (e) => {
    if (${brokenFirst ? "true" : "false"} && id === "b1") return;
    for (const o of ["b1", "b2"]) { const b = document.getElementById(o), p = document.getElementById(b.getAttribute("aria-controls")); b.setAttribute("aria-expanded", "false"); p.hidden = true; p.innerHTML = ""; }
    const p = document.getElementById(e.currentTarget.getAttribute("aria-controls"));
    e.currentTarget.setAttribute("aria-expanded", "true"); p.hidden = false; p.innerHTML = ans[id] ? "<p>" + ans[id] + "</p>" : "";
  });
</script></body></html>`;

test("OPEN 3 — A SINGLE-OPEN ACCORDION, TWO QUESTIONS: each answer is read as its question opens and judged beside it (the final page holds only the last); a wrong or missing EARLIER answer fails although the last answer is right; a question that never opens is incomplete evidence, never a pass", { skip: SKIP }, async () => {
  const before = (await readIt("<!doctype html><html><body><main><h1>Tasting Evenings</h1></main></body></html>")).out;
  const judge = (after) => {
    const o = openedSections(before, after);
    return o.ok ? sectionChecks("served", o.sections, TWO).filter((c) => !c.ok).map((c) => c.name) : ["incomplete: " + o.why];
  };
  const right = (await readIt(SINGLE("£25 a head, cheese included.", "Thursdays, from 7."))).out;
  assert.equal(right.complete, true, JSON.stringify(right.failed));
  assert.deepEqual(right.items.map((x) => [x.question, x.answer]), [["How much is an evening?", "£25 a head, cheese included."], ["When are the evenings?", "Thursdays, from 7."]]);
  assert.deepEqual(judge(right), [], "both right answers did not pass");
  const wrongFirst = judge((await readIt(SINGLE("£50 a head, cheese included.", "Thursdays, from 7."))).out);
  assert.ok(wrongFirst.length > 0, "a wrong earlier answer passed beside a right last one");
  const missingFirst = judge((await readIt(SINGLE("", "Thursdays, from 7."))).out);
  assert.ok(missingFirst.length > 0, "a missing earlier answer passed beside a right last one");
  const broken = (await readIt(SINGLE("£25 a head, cheese included.", "Thursdays, from 7.", { brokenFirst: true }))).out;
  assert.equal(broken.complete, false, "a question that never opened was read as complete");
  assert.deepEqual(broken.failed.map((x) => x.question), ["How much is an evening?"]);
  assert.ok(judge(broken)[0].startsWith("incomplete:"), "incomplete evidence was judged as if complete");
});
