// CLAUDE CODE FIXES, BATCH 17 (2026-11-19): page items, each kept fixed here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const ui = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../public/coder.css", import.meta.url), "utf8");
// One of the page's functions, cut out and run on its own with the stand-ins given.
function fn(head, names, pre = "") {
  const start = ui.indexOf(head);
  assert.ok(start >= 0, head);
  const end = ui.indexOf("\n  }\n", start) + 4;
  return new Function(pre + ui.slice(start, end) + "\nreturn { " + names + " };")();
}
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

test("L-page-03 a draft stays with its own chat after a failed or quick switch", () => {
  const { keepDraft } = fn("  function keepDraft(", "keepDraft");
  const S = { drafts: {}, draft: "", pics: [], comments: [], mention: null };
  keepDraft(S, "a");
  S.draft = "For a"; S.pics = [{ n: 1 }]; S.comments = [{ line: 2 }];
  // b opened before a has loaded (or a's open failed): the open chat is empty, but the draft is still a's.
  keepDraft(S, "b");
  assert.equal(S.draft, "", "b's box is empty");
  keepDraft(S, "c");
  assert.equal(S.draft, "");
  keepDraft(S, "a");
  assert.deepEqual([S.draft, S.pics, S.comments], ["For a", [{ n: 1 }], [{ line: 2 }]]);
  assert.match(ui, /keepDraft\(S, id\);/);
});

test("L-page-20 a message the server started as a new job (the job had just ended) counts as sent", () => {
  assert.match(ui, /if \(q\.status === 200 && q\.data && q\.data\.ok && q\.data\.project && !q\.data\.error\) \{ boxEmpty\(\); S\.error = ''; stopPoll\(\); S\.project = q\.data\.project; syncEntry\(\); return reloadChat\(id\); \}\n      S\.error = sendFailText\(q, false\);/);
});

test("L-page-23 the landing page's ask is put in the box when Coder first shows after sign-in", () => {
  const start = ui.indexOf("      // THE LANDING PAGE'S ASK, waiting in the box");
  assert.ok(start > 0);
  const line = ui.slice(ui.indexOf("\n", start) + 1, ui.indexOf("\n", ui.indexOf("\n", start) + 1));
  const store = { gf_ask: "Fix the cart" };
  const sessionStorage = { getItem: (k) => store[k] ?? null, removeItem: (k) => { delete store[k]; } };
  const S = { draft: "" };
  new Function("first", "GLOOPY", "S", "sessionStorage", line)(true, false, S, sessionStorage);
  assert.equal(S.draft, "Fix the cart");
  assert.equal(store.gf_ask, undefined, "used once, then gone");
});

test("M-d-31 a message that cannot go out says Connection lost or Server error, and that it is back in the box", () => {
  const { sendFailText } = fn("  function sendFailText(", "sendFailText");
  assert.match(sendFailText({ status: 0, data: { error: "Coder could not be reached." } }, true), /^Connection lost: check your internet connection and any VPN or proxy you use, then send your message again\. Your message is back in the box\.$/);
  assert.match(sendFailText({ status: 502, data: {} }, true), /^Server error: wait a moment, then send your message again\. Your message is back in the box\.$/);
  assert.equal(sendFailText({ status: 409, data: { error: "Connect GitHub first." } }, true), "Connect GitHub first. Your message is back in the box.");
  assert.ok(!/'The message was not sent\.';/.test(ui));
});

test("M-r2-13 a picture the browser cannot open is not called too big", () => {
  const { picFailText } = fn("  function picFailText(", "picFailText");
  assert.match(picFailText({ error: "decode" }), /pixels could not be decoded/);
  assert.match(picFailText({ error: "size" }), /exceeds the size limit and compression failed/);
  assert.match(ui, /img\.onerror = \(\) => done\(\{ error: 'decode' \}\);/);
  assert.ok(!ui.includes("That picture is too big."));
});

test("M-g-11 '\\ No newline at end of file' is not numbered as a line", () => {
  const { diffLines } = fn("  function diffLines(", "diffLines", "const S = {};\n");
  // (esc is the page's; a stand-in here.)
  const { diffLines: d } = new Function("esc", "S", ui.slice(ui.indexOf("  function diffLines("), ui.indexOf("\n  }\n", ui.indexOf("  function diffLines(")) + 4) + "\nreturn { diffLines };")(esc, {});
  void diffLines;
  const patch = "@@ -1,2 +1,4 @@\n a\n-b\n\\ No newline at end of file\n+b\n+c\n+d";
  const lines = [...d({ path: "f.txt", patch }).matchAll(/data-line="(\d+)"[^>]*>([^<]*)</g)].map((m) => [m[2], Number(m[1])]);
  assert.deepEqual(lines, [[" a", 1], ["-b", 0], ["+b", 2], ["+c", 3], ["+d", 4]]);
});

test("M-b-25 / commands know their other names, match words inside them, and say when nothing matches", () => {
  const start = ui.indexOf("  const SLASH = [");
  const end = ui.indexOf("\n  }\n", ui.indexOf("  function slashHTML(")) + 4;
  const S = { draft: "" };
  const { slashMatches, slashHTML } = new Function("S", "GLOOPY", "esc", ui.slice(start, end) + "\nreturn { slashMatches, slashHTML };")(S, false, esc);
  const names = (d) => { S.draft = d; return slashMatches().map((x) => x[0]); };
  assert.deepEqual(names("/undo"), ["/rewind"]);
  assert.deepEqual(names("/checkp"), ["/rewind"]);
  assert.deepEqual(names("/allowed-tools"), ["/permissions"]);
  assert.deepEqual(names("/tools"), ["/permissions"], "a word inside a name");
  assert.deepEqual(names("/comp"), ["/compact"]);
  S.draft = "/zzz";
  assert.equal(slashHTML(), '<div class="cd-mention cd-slash cd-slash-none" role="note">No commands match "/zzz"</div>');
  assert.match(ui, /\/\^\\\/\(rewind\|checkpoint\|undo\)\$\/i\.test\(text\)/);
  assert.match(ui, /\/\^\\\/\(permissions\|allowed-tools\)\$\/i\.test\(text\)/);
});

test("M-g-15 a step cut off when the machine stopped says no result was recorded, opens to its input, and stands alone", () => {
  assert.match(ui, /state === 'gone' && !GLOOPY \? '<span class="cd-st cd-st-gone">no result was recorded<\/span>'/);
  assert.match(ui, /\(r \|\| lost \? '' : ' disabled'\)/);
  assert.match(ui, /open && lost \? '<pre class="cd-cmd-in">'/);
  assert.match(ui, /if \(neverRan\(results\[e\.id\]\) \|\| \(!GLOOPY && stateOf\(e, i\) === 'gone'\)\) \{ flush\(\);/);
  assert.match(css, /\.cd-st-gone \{/);
});

test("M-d-23 what a setup script printed shows under 'Ran setup script' when 'Initialized session' is opened", () => {
  const start = ui.indexOf("  const BOOT_DONE = ");
  const bootLine = ui.slice(start, ui.indexOf("\n", start));
  const s2 = ui.indexOf("  function startupHTML(");
  const body = ui.slice(s2, ui.indexOf("\n  }\n", s2) + 4);
  const S = { open: {}, events: [] };
  const { startupHTML } = new Function("S", "esc", "noColor", "secsWords", bootLine + "\n" + body + "\nreturn { startupHTML };")(S, esc, (x) => x.replace(/\x1b\[[0-9;]*m/g, ""), (n) => n + "s");
  S.events = [{ type: "user", text: "hi", at: 1 }, { type: "bash", tool: "setup", id: "s1" }, { type: "startup", steps: [{ k: "container", ms: 1000 }, { k: "setup", ms: 2000 }] }];
  const results = { s1: { code: 0, output: "\x1b[32minstalled <deps>\x1b[0m\n" } };
  assert.ok(!startupHTML(S.events[2], 2, results).includes("cd-init-out"), "nothing when folded");
  S.open.init2 = true;
  const html = startupHTML(S.events[2], 2, results);
  assert.ok(html.includes('<pre class="cd-init-out">installed &lt;deps&gt;</pre>'), html);
  assert.ok(html.indexOf("Ran setup script") < html.indexOf("cd-init-out"));
  assert.match(css, /\.cd-init-out \{ max-height: 240px; overflow: auto;/);
});
