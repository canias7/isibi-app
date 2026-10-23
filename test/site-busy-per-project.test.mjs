// #138 (audit A15-6), the owner's choice (2026-10-23): an account runs builds
// and chats on DIFFERENT sites at the same time. One project's work must not
// block sending in another, and must never be ended, stopped or overwritten
// by another project's work. One job per site stays: a project's own busy
// state still refuses its own Send.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const SRC = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
function fnSource(head) {
  const at = SRC.indexOf(head);
  assert.ok(at >= 0, head + " is not in public/chat.js");
  let depth = 0;
  for (let i = SRC.indexOf("{", at); i < SRC.length; i++) {
    if (SRC[i] === "{") depth++;
    else if (SRC[i] === "}" && --depth === 0) return SRC.slice(at, i + 1);
  }
  assert.fail(head + " has no closing brace");
}
function block() {
  const a = SRC.indexOf("// ── BUSY SLOTS BEGIN");
  const b = SRC.indexOf("// ── BUSY SLOTS END");
  assert.ok(a > 0 && b > a, "the per-project busy state is not in public/chat.js");
  return SRC.slice(a, b);
}

function page(open) {
  const ctx = vm.createContext({
    siteBusy: false, siteBusyFor: null, siteBuild: null, siteTicker: null, siteAbort: null, siteOpenId: open,
    paintReactLive: () => {}, setInterval: () => 1, clearInterval: () => {},
  });
  vm.runInContext([block(), fnSource("function siteBuildStart("), fnSource("function siteBuildStop("),
    fnSource("function siteStop("), fnSource("function siteBusyHere(")].join("\n"), ctx);
  const open2 = (id) => { vm.runInContext("siteSlotSwap(siteOpenId, " + JSON.stringify(id) + "); siteOpenId = " + JSON.stringify(id) + ";", ctx); };
  return { ctx, open: open2, run: (code) => vm.runInContext(code, ctx) };
}

test("A builds, B is opened: B is free to send, A stays busy, and B's work starts in the page", () => {
  const p = page("A");
  p.run("siteBusyBegin('A'); siteBuildStart(true, 'A');");
  assert.equal(p.ctx.siteBusy, true);
  p.open("B");
  assert.equal(p.ctx.siteBusy, false, "A's build still blocks sending in B");
  assert.equal(p.ctx.siteBuild, null, "A's live steps are drawn in B");
  assert.equal(p.run("siteBusyAt('A')"), true, "A's build was lost on the switch");
  p.run("siteBusyBegin('B'); siteBuildStart(true, 'B');");
  assert.equal(p.ctx.siteBusy, true);
  assert.equal(p.ctx.siteBusyFor, "B");
});

test("A's work ending while B is open never ends B's, and A's live steps come back when A is opened", () => {
  const p = page("A");
  p.run("siteBusyBegin('A'); siteBuildStart(true, 'A'); siteBuild.code = 'a-code';");
  p.open("B");
  p.run("siteBusyBegin('B'); siteBuildStart(true, 'B'); siteBuild.code = 'b-code';");
  p.open("A");
  assert.equal(p.ctx.siteBusy, true);
  assert.equal(p.ctx.siteBuild.code, "a-code", "A's own build was not swapped back in");
  p.open("B");
  p.run("siteBusyEnd('A'); siteBuildStop('A');");
  assert.equal(p.ctx.siteBusy, true, "A's finish ended B's work");
  assert.equal(p.ctx.siteBuild.code, "b-code", "A's finish cleared B's live steps");
  assert.equal(p.run("siteBusyAt('A')"), false);
  p.run("siteBusyEnd('B'); siteBuildStop('B');");
  assert.equal(p.ctx.siteBusy, false);
  assert.equal(p.run("siteSlots.size"), 0, "a finished project's slot was kept");
});

test("work started for a project that is not open waits in its slot, never in the open project's state", () => {
  const p = page("B");
  p.run("siteBusyBegin('A'); siteBuildStart(true, 'A');");
  assert.equal(p.ctx.siteBusy, false, "a background build took the open project's busy state");
  assert.equal(p.ctx.siteBuild, null);
  assert.equal(p.run("siteBusyAt('A')"), true);
  p.open("A");
  assert.equal(p.ctx.siteBusy, true);
  assert.ok(p.ctx.siteBuild, "the background build's steps are not shown in its own project");
});

test("Stop stops only its own project's send", () => {
  const p = page("B");
  const seen = [];
  p.ctx.seen = seen;
  p.run("siteAborts.set('A', { abort: () => seen.push('A') }); siteAborts.set('B', { abort: () => seen.push('B') });");
  p.run("siteStop({ id: 'B' });");
  assert.deepEqual(seen, ["B"], "Stop in B stopped A's build");
});

test("CONTROL: one job per site stays — a project's own busy state still refuses its own Send", () => {
  const p = page("A");
  p.run("siteBusyBegin('A');");
  p.open("B");
  p.open("A");
  assert.equal(p.ctx.siteBusy, true);
  assert.match(SRC, /if \(!t \|\| siteBusy\) return; ta\.value = ''; draft\.t = ''; siteSend\(t\);/, "the project's own Send is no longer refused while it is busy");
});

test("the page no longer refuses Send because another project is building", () => {
  assert.doesNotMatch(SRC, /Another project is still building/, "the cross-project refusal is still on the page");
  const owed = fnSource("function siteBuildsDrain(");
  assert.match(owed, /if \(siteBusyAt\(b\.chat\)\) \{ i\+\+; continue; \}/, "an owed build waits for an unrelated project");
  const op = fnSource("function openProject(");
  assert.match(op, /siteSlotSwap\(siteOpenId, id \|\| null\);\n\s*siteOpenId = id \|\| null;/, "opening a project does not swap in its own busy state");
});
