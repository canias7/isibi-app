// THE BUILDER TALKS WHILE IT WORKS — THE PAGE (2026-10-13).
//
// The page's own functions, cut out of public/chat.js and public/edit-poll.js
// and driven: a line's explanation is read from the poll, kept on the reply a
// finished job leaves (so a reload or another visit shows it), and drawn as
// one folded section under the lines — escaped, closed until opened, with a
// fixed label, and absent when no line carries one.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import EditPoll from "../public/edit-poll.js";

const chat = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const cut = (head) => {
  const at = chat.indexOf(head);
  assert.ok(at >= 0, head + " is gone from chat.js");
  const end = chat.indexOf("\n}\n", at);
  return chat.slice(at, end + 2);
};
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const draw = (lines, live = false, done = false) => {
  const ctx = vm.createContext({ esc });
  vm.runInContext(cut("function progressListHTML("), ctx);
  return ctx.progressListHTML(lines, live, done);
};

test("POLL — a line's explanation is read when it is a string with words in it, and left off otherwise; nothing else of the line changes", () => {
  const got = EditPoll.progressLines({ progress: [
    { n: 0, ms: 5, text: "I'm on it.", explain: "  I chose a new page.  " },
    { n: 1, ms: 9, text: "Building it.", explain: ["not", "a string"] },
    { n: 2, ms: 9, text: "Done soon.", explain: "   " },
  ] });
  assert.deepEqual(got, [
    { n: 0, ms: 5, text: "I'm on it.", explain: "I chose a new page." },
    { n: 1, ms: 9, text: "Building it." },
    { n: 2, ms: 9, text: "Done soon." },
  ]);
});

test("DRAWN — the explanations, in order, in one folded section under the lines, escaped, closed until opened; none drawn when no line has one", () => {
  const html = draw([{ text: "I'll add a page." }, { text: "Designing it.", explain: "A new page keeps your <Home> page as it is." }, { text: "Building it.", explain: "Then I check it builds." }], true);
  assert.match(html, /^<ul class="st-req-prog">.*<\/ul><details class="st-req-why"><summary>More detail<\/summary><p>A new page keeps your &lt;Home&gt; page as it is\.<\/p><p>Then I check it builds\.<\/p><\/details><div class="st-think st-working">Working…<\/div>$/);
  assert.doesNotMatch(html, /<details[^>]* open/, "the section opens by itself");
  assert.doesNotMatch(draw([{ text: "a" }, { text: "b", explain: "  " }]), /details/, "an empty section was drawn");
  assert.equal(draw([]), "");
});

test("KEPT — a finished job's lines are kept on its reply with their explanations, so a reload draws them again", () => {
  const s = { id: "o1", msgs: [{ r: "u", t: "add a page" }, { r: "a", t: "Done." }] };
  const ctx = vm.createContext({ siteById: () => s, sitesSave: () => {}, renderSites: () => {}, siteOpenId: "o1" });
  vm.runInContext(cut("function siteKeepJobProgress("), ctx);
  ctx.siteKeepJobProgress("o1", "j1", 0, [{ n: 0, ms: 1, text: "I'm on it.", explain: "A new page." }, { n: 1, ms: 2, text: "Building." }]);
  assert.deepEqual(JSON.parse(JSON.stringify(s.msgs[1].prog)), [
    { job: "j1", n: 0, ms: 1, text: "I'm on it.", explain: "A new page." },
    { job: "j1", n: 1, ms: 2, text: "Building." },
  ]);
  const again = JSON.parse(JSON.stringify(s));
  assert.match(draw(again.msgs[1].prog, false, true), /<details class="st-req-why"><summary>More detail<\/summary><p>A new page\.<\/p><\/details>/);
});
