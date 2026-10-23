// Audit A15-6: `siteBusy`, `siteBuild` and `siteAbort` are one per page. A
// build running in project A drew its live steps and the Stop button in every
// other project, and Stop there aborted A's follow, so A's chat never got its
// site. The busy state now records its origin (`siteBusyFor`): the steps and
// Stop are drawn only there (`siteBusyHere`), Stop elsewhere stops nothing,
// and another project's Send says why it cannot send.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

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

function page({ busy, busyFor }) {
  const seen = { aborted: 0 };
  const make = new Function("seen", "busy", "busyFor", [
    "let siteBusy = busy; let siteBusyFor = busyFor;",
    "const siteAbort = { abort: () => { seen.aborted++; } };",
    fnSource("function siteStop("),
    fnSource("function siteBusyHere("),
    "return { siteStop, siteBusyHere };",
  ].join("\n"));
  return { ...make(seen, busy, busyFor), seen };
}
const A = { id: "chat-a" }, B = { id: "chat-b" };

test("a build in A is busy in A only, and Stop in B stops nothing", () => {
  const p = page({ busy: true, busyFor: A.id });
  assert.equal(p.siteBusyHere(A), true);
  assert.equal(p.siteBusyHere(B), false, "A's busy state is drawn in B");
  p.siteStop(B);
  assert.equal(p.seen.aborted, 0, "Stop in B aborted A's build");
  p.siteStop(A);
  assert.equal(p.seen.aborted, 1, "Stop in A did not stop A's build");
});

test("CONTROL: nothing busy is busy nowhere; an origin never recorded keeps the page-wide behaviour", () => {
  assert.equal(page({ busy: false, busyFor: A.id }).siteBusyHere(A), false);
  const old = page({ busy: true, busyFor: null });
  assert.equal(old.siteBusyHere(B), true);
  old.siteStop(B);
  assert.equal(old.seen.aborted, 1);
});

test("every place that takes the busy state names its project, and the workspace asks siteBusyHere", () => {
  const sets = SRC.match(/siteBusy = true;[^\n]*/g) || [];
  assert.ok(sets.length >= 8, "the busy setters moved: " + sets.length);
  for (const s of sets) assert.match(s, /^siteBusy = true; siteBusyFor = [\w.]+;/, s);
  const ws = fnSource("function renderSiteWorkspace(");
  assert.match(ws, /\(siteBusyHere\(site\) \|\| siteRunningWork\(site\)\s*\?\s*'<button type="button" class="st-sendc st-stopc" id="stStop"/, "Stop is drawn from the page-wide flag");
  assert.match(ws, /\)\.join\(''\) \+ \(siteBusyHere\(site\)\s*\?\s*\(siteBuild/, "the live steps are drawn from the page-wide flag");
  assert.match(fnSource("function siteStopWork("), /siteStop\(site\);/);
});
