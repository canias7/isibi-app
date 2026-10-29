// "Working…" is not shown while a new progress line is being read (owner,
// 2026-10-29: "if the model is talking back, dont put it, just put it when it
// resumes"). The real functions from public/chat.js, run in a sandbox.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const src = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const cut = (a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i >= 0 && j > i, "landmarks: " + a); return src.slice(i, j); };
function load(now) {
  const timers = [], renders = [];
  const ctx = { Map, Date: { now: () => now.t }, setTimeout: (f, ms) => { timers.push({ f, ms }); return 1; }, renderSites: () => renders.push(1) };
  vm.createContext(ctx);
  vm.runInContext(cut("function esc(s) {", "\n}\n") + "\n}\n" + cut("function progressListHTML(", "/**\n * A BUTTON PRESS THAT TALKS") + ";this.P=progressListHTML;this.MS=4000;", ctx);
  return { ctx, timers, renders };
}

test("PT1 a new line stands alone; Working… returns once it has settled, and the thread is drawn again then", () => {
  const now = { t: 1000000 };
  const { ctx, timers, renders } = load(now);
  const a = [{ text: "Planned the pages." }];
  assert.doesNotMatch(ctx.P(a, true), /Working/, "just arrived: no Working…");
  assert.equal(timers.length, 1, "one redraw scheduled");
  assert.ok(timers[0].ms >= ctx.MS && timers[0].ms <= ctx.MS + 100);
  now.t += ctx.MS + 1;
  timers[0].f(); assert.equal(renders.length, 1);
  assert.match(ctx.P(a, true), /Working…/, "settled: Working… is back");
  const b = a.concat([{ text: "The design is set." }]);
  assert.doesNotMatch(ctx.P(b, true), /Working/, "the next line: hidden again");
});

test("PT2 a list that is not live never shows Working…; an empty live list still does", () => {
  const { ctx } = load({ t: 5 });
  assert.doesNotMatch(ctx.P([{ text: "x" }], false), /Working/);
  assert.match(ctx.P([], true), /Working…/);
});
