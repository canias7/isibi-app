// A shell command obeys the write tools' limits (2026-11-04, carry-over G10/A-3),
// and a component is never lost to two name rules (carry-over A-2).
// syncFromRun took back every file a command changed or deleted with no scope,
// helper, home-page or size check, and a name the agent accepted ("Hero") but
// the container's shell refuses vanished after any command.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { syncFromRun, makeWorkspace, writableKey } from "../builder/site-agent.mjs";

const PAGES = [{ path: "index.tsx", source: "home" }, { path: "about.tsx", source: "about" }, { path: "shop.tsx", source: "shop" }];
const PARTS = [{ name: "footer", source: "foot" }];
function state({ onlyWrite = "" } = {}) {
  return { ws: makeWorkspace(PAGES, PARTS), written: new Set(), dirty: false, onlyWrite };
}
// What a command left in the container: the files listed back, as agent-shell's readSiteFiles does.
const back = (pages, parts = PARTS) => ({ pages, parts, css: null });
const scopeAbout = { mayWrite: (k) => (k === "about.tsx" ? "" : "this part changes only /about") };

test("a command's change inside the scope is taken (control)", () => {
  const st = state();
  const moved = syncFromRun(st, back([PAGES[0], { path: "about.tsx", source: "about v2" }, PAGES[2]]), scopeAbout);
  assert.deepEqual(moved, ["about.tsx"]);
  assert.equal(st.ws.get("about.tsx"), "about v2");
  assert.deepEqual(st.refusedByRun, []);
});

test("a command's change outside the part's scope is put back and said", () => {
  const st = state();
  syncFromRun(st, back([PAGES[0], { path: "about.tsx", source: "about v2" }, { path: "shop.tsx", source: "Store!" }]), scopeAbout);
  assert.equal(st.ws.get("shop.tsx"), "shop", "a scoped part rewrote /shop through a command");
  assert.equal(st.ws.get("about.tsx"), "about v2");
  assert.match(st.refusedByRun.join("|"), /^shop\.tsx: this part changes only \/about$/);
});

test("rm index.tsx through a command never removes the home page", () => {
  const st = state();
  const moved = syncFromRun(st, back([PAGES[1], PAGES[2]]));
  assert.ok(st.ws.has("index.tsx"), "the home page was removed by a command");
  assert.ok(!moved.includes("index.tsx"));
  assert.match(st.refusedByRun.join("|"), /index\.tsx: the home page cannot be removed/);
});

test("a helper's command changes only its own file; an empty or oversized result is refused", () => {
  const st = state({ onlyWrite: "about.tsx" });
  syncFromRun(st, back([PAGES[0], { path: "about.tsx", source: "x".repeat(120001) }, { path: "shop.tsx", source: "hijacked" }]));
  assert.equal(st.ws.get("shop.tsx"), "shop");
  assert.equal(st.ws.get("about.tsx"), "about", "an oversized file was taken");
  const st2 = state();
  syncFromRun(st2, back([PAGES[0], { path: "about.tsx", source: "   " }, PAGES[2]]));
  assert.equal(st2.ws.get("about.tsx"), "about", "an emptied file was taken");
});

test("one component name rule: what the agent may write is exactly what the container keeps", () => {
  const shell = readFileSync(new URL("../builder/agent-shell.mjs", import.meta.url), "utf8");
  const m = /const PART = (\/.*\/[a-z]*);/.exec(shell);
  assert.ok(m, "the container's part rule was found");
  const PART = eval(m[1]);
  for (const name of ["hero", "price-list", "a1", "Hero", "2col", "a--b", "end-", "x_y", "-lead", "h"]) {
    assert.equal(writableKey("-parts/" + name).ok, PART.test(name), name + ": the agent and the container disagree");
  }
  assert.match(writableKey("-parts/Hero").why, /lowercase words joined by single dashes/);
});

test("a component the container was never given is not deleted by a command", () => {
  const st = state();
  st.ws.set("-parts/Odd", "legacy"); // a name kept from before the one rule
  syncFromRun(st, back(PAGES));
  assert.equal(st.ws.get("-parts/Odd"), "legacy", "a file the command never saw was removed");
});
