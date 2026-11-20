// APPROVAL CARDS SHOW EVERYTHING (audit I31): Claude Code's prompts scroll so all of a command or a change can be read, and
// it offers "don't ask again" only when the prompt can show everything it would allow. Coder's cards had carried only the
// first 40 lines, with "… N more lines" and nothing to open.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const A = await import("../container/coder-agent.mjs");
const read = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });

async function cardFor(c, mode = "acceptEdits") {
  const events = []; let n = 0;
  const steps = [say("", [c]), say("ok")];
  await A.runCoder({ send: async () => steps[Math.min(n++, 1)], exec: async () => ({ code: 0, output: "ok" }), emit: (e) => events.push(e), here: () => "/work/shop", root: "/work/shop", where: (p) => (p.startsWith("/") ? p : "/work/shop/" + p), ask: async () => ({ choice: "no" }) }, { text: "go", mode, messages: [] });
  return events.find((e) => e.type === "permission");
}

test("CF1 a 60-line command's card carries all 60 lines; past the cap the rest are counted and the card offers no \"don't ask again\" or switch to Auto", async () => {
  const cmd = Array.from({ length: 60 }, (_, i) => "curl -sS https://example.com/" + i).join("\n");
  assert.deepEqual(A.cardLines(cmd).lines.length, 60);
  assert.equal(A.cardLines(cmd).more, undefined);
  const card = await cardFor(call("bash", { command: cmd }, "b1"));
  assert.equal(card.lines.length, 60);
  assert.equal(card.lines[49], "curl -sS https://example.com/49");
  // Over the cap: counted, and only a one-time Yes.
  const huge = Array.from({ length: A.CARD_LINES_MAX + 3 }, (_, i) => "curl -sS https://example.com/" + i).join("\n");
  assert.equal(A.cardLines(huge).more, 3);
  const big = await cardFor(call("bash", { command: huge }, "b2"));
  assert.equal(big.more, 3);
  assert.equal(big.rules, undefined, "no don't-ask-again rules");
  assert.equal(big.toAuto, undefined);
  // (A short command still gets its rule.)
  assert.ok(Array.isArray((await cardFor(call("bash", { command: "curl -sS https://example.com/x" }, "b3"))).rules));
});

test("CF2 a 50-line edit's card carries every removed and every added line (new lines always show), and marks a change cut past the cap", () => {
  const gone = Array.from({ length: 50 }, (_, i) => "old " + i), come = Array.from({ length: 50 }, (_, i) => "new " + i);
  const ch = A.changeLines("update", gone, come);
  assert.equal(ch.lines.length, 100);
  assert.equal(ch.lines[0], "-old 0");
  assert.equal(ch.lines[99], "+new 49");
  assert.equal(ch.cut, undefined);
  // A huge removal still leaves room for the new lines.
  const many = Array.from({ length: A.CARD_LINES_MAX * 2 }, (_, i) => "old " + i);
  const c2 = A.changeLines("update", many, ["new"]);
  assert.equal(c2.lines.at(-1), "+new");
  assert.equal(c2.cut, true);
  assert.ok(c2.more > 0);
  assert.equal(A.changeLines("create", [], ["x".repeat(3000)]).cut, true, "a line cut short is a cut");
});

test("CF3 the page: the first 40 lines, then \"Show all N lines\" opens the rest in the scrolling box; a card that could not get everything offers only a one-time Yes", () => {
  const js = read("public/coder.js");
  const grab = (name) => { const k = js.indexOf("  function " + name + "("); let d = 0, j = js.indexOf("{", k); for (; j < js.length; j++) { if (js[j] === "{") d++; else if (js[j] === "}" && --d === 0) break; } return js.slice(k, j + 1); };
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const S = { autoOff: false };
  const make = new Function("S", "esc", "ruleShown", "const CARD_FIRST = 40;\n" + grab("cardShown") + grab("cardMore") + grab("permOptions") + "\nreturn { cardShown, cardMore, permOptions };");
  const P = make(S, esc, (r) => r);
  const lines = Array.from({ length: 60 }, (_, i) => "line " + i);
  assert.equal(P.cardShown(lines, "p:1").length, 40);
  assert.match(P.cardMore(lines, "p:1", 0), /data-card-all="p:1">Show all 60 lines</);
  S.cardAll = { "p:1": true };
  assert.equal(P.cardShown(lines, "p:1")[49], "line 49", "line 50 shows once opened");
  assert.equal(P.cardMore(lines, "p:1", 0), "");
  assert.match(P.cardMore(lines, "p:1", 7), /7 more lines are too long to show here, so this can only be allowed once\./);
  // Options: a whole card keeps "don't ask again"; one with lines left out, or a cut change, only Yes and No.
  assert.deepEqual(P.permOptions({ tool: "bash", rules: ["Bash(npm test)"], toAuto: true }).map((o) => o[0]), ["yes", "always", "auto", "no"]);
  assert.deepEqual(P.permOptions({ tool: "bash", more: 3, rules: ["Bash(npm test)"], toAuto: true }).map((o) => o[0]), ["yes", "no"]);
  assert.deepEqual(P.permOptions({ tool: "edit", change: { cut: true } }).map((o) => o[0]), ["yes", "no"]);
  assert.match(js, /on\('\[data-card-all\]', 'click'/);
  const css = read("public/coder.css");
  assert.match(css, /\.cd-perm-pre \{[^}]*max-height: 260px; overflow: auto;/, "the box scrolls");
  assert.match(css, /\.cd-card-all \{/);
});
