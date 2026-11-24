// THE UNDO UNDER AN ANSWER AFTER SEVERAL JOBS (live, group 2, 2026-11-17): the Undo looks its message up by place, and the
// saved chat holds the save's own lines, so the page takes the saved chat when a job ends. No browser is started.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("UB1 a job that just ended loads the saved chat (Coder only), after the page drew what came", async () => {
  const src = await readFile(new URL("../public/coder.js", import.meta.url), "utf8");
  const a = src.indexOf("const justEnded = !GLOOPY && S.running && !r.data.running;");
  const b = src.indexOf("S.running = !!r.data.running;", a);
  const c = src.indexOf("if (justEnded && S.project && S.project.id === id && marksOff()) reloadChat(id, { ended: true });", b);
  assert.ok(a > 0 && b > a && c > b, "decided before S.running changes, reloaded after the draw");
  assert.ok(src.indexOf("draw(fresh.length > 0);", b) < c);
});

test("UB2 only when the page's copy has drifted: a mark that no longer names a message on the page", async () => {
  const src = await readFile(new URL("../public/coder.js", import.meta.url), "utf8");
  const body = src.slice(src.indexOf("function marksOff() {"), src.indexOf("function codeToRestore("));
  const marksOff = new Function("S", body + "; return marksOff();");
  const ev = [{ type: "user" }, { type: "done" }, { type: "github" }, { type: "user" }];
  assert.equal(marksOff({ project: { marks: [{ ev: 0 }, { ev: 3 }] }, events: ev }), false);
  assert.equal(marksOff({ project: { marks: [{ ev: 0 }, { ev: 2 }] }, events: ev }), true);
  assert.equal(marksOff({ project: { marks: [{ ev: 9 }] }, events: ev }), true);
});

test("UB3 the reload at a job's end never makes the page wait again: a new job begun is left alone; a chat still being saved is looked at again (3 s, 5 times), never taken as running", async () => {
  const src = await readFile(new URL("../public/coder.js", import.meta.url), "utf8");
  const body = src.slice(src.indexOf("async function reloadChat("), src.indexOf("S.project = r.data.project; S.events = r.data.events", src.indexOf("async function reloadChat(")));
  assert.match(body, /if \(ended && S\.running\) return;/);
  assert.match(body, /if \(ended && r\.data\.project\.status === 'running'\) \{ if \(tries < 20\) setTimeout\(\(\) => reloadChat\(id, \{ ended: true, tries: tries \+ 1 \}\), Math\.min\(3000 \+ tries \* 1000, 10000\)\); return; \}/);
});
