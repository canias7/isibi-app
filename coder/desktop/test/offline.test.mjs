// The desktop app's "Can't reach Go Farther" page (test, 2026-11-08: on a computer with no internet,
// "Try again" left the window blank: the failed load was swapped for this page again, which was then
// never drawn). Now Try again first asks Go Farther whether it answers, and only then opens it.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const html = readFileSync(new URL("../offline.html", import.meta.url), "utf8");
const script = html.split("<script>")[1].split("</script>")[0];

/** The page's own script, run against a stand-in page; fetch answers as told. */
async function run(answers) {
  const els = { again: { textContent: "Try again", on: {}, addEventListener(t, f) { this.on[t] = f; } }, still: { hidden: true } };
  const win = { on: {}, addEventListener(t, f) { this.on[t] = f; } };
  const location = { href: "file:///app/offline.html" };
  const asked = [];
  const fetch = async (url, opts) => { asked.push([url, opts]); if (!answers) throw new TypeError("Failed to fetch"); return { type: "opaque" }; };
  new Function("document", "window", "location", "fetch", script)({ getElementById: (id) => els[id] }, win, location, fetch);
  return { els, win, location, asked };
}

test("D3 the offline page's Try again opens Go Farther only when it answers; still offline, the page stays and says so; back online, it opens by itself", async () => {
  // Still offline: nothing is loaded (so nothing can go blank); the page says it is still unreachable.
  let p = await run(false);
  let stopped = false;
  await p.els.again.on.click({ preventDefault: () => { stopped = true; } });
  assert.equal(stopped, true, "the link itself is not followed");
  assert.deepEqual(p.asked, [["https://gofarther.dev/", { mode: "no-cors", cache: "no-store" }]]);
  assert.equal(p.location.href, "file:///app/offline.html", "the page stays");
  assert.equal(p.els.still.hidden, false, "\"Still can't reach it\" is shown");
  assert.equal(p.els.again.textContent, "Try again", "and Try again can be pressed again");
  // Go Farther answers: it opens.
  p = await run(true);
  await p.els.again.on.click({ preventDefault() {} });
  assert.equal(p.location.href, "https://gofarther.dev/");
  // The computer comes back online: it tries by itself.
  p = await run(true);
  await p.win.on.online();
  assert.equal(p.location.href, "https://gofarther.dev/");
  assert.match(html, /<a href="https:\/\/gofarther\.dev\/" id="again">Try again<\/a>/, "without its script, the link still works");
  assert.match(html, /<p class="still" id="still" hidden>Still can't reach it\. Go Farther opens by itself when your internet is back\.<\/p>/);
});

test("D4 the offline page allows exactly its own script (by its hash) and only asking gofarther.dev, nothing else", () => {
  const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)[1];
  const hash = createHash("sha256").update(script).digest("base64");
  assert.equal(csp, "default-src 'none'; style-src 'unsafe-inline'; script-src 'sha256-" + hash + "'; connect-src https://gofarther.dev", "a changed script must get its new hash, or it is blocked");
  assert.equal(html.split("<script").length, 2, "one script, inline");
});
