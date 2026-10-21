// THE HISTORY PANEL IS THE SERVER'S (2026-10-21, owner: "since i added something
// new, it doesnt show here, so the version control is not working properly").
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const a = src.indexOf("function historyRows(");
const b = src.indexOf("\n}\n", a);
const historyRows = new Function(src.slice(a, b + 2) + " return historyRows;")();

const V = (id, label, at) => ({ id, label, at });

test("an addition saved to the draft shows, newest first, as saved and not published, above the live one", () => {
  const rows = historyRows(
    [V("0003", "Scroll video section", 3), V("0002", "build me a website", 2), V("0001", "first try", 1)],
    { live: "0002", draft: "0003", revisions: [{ revision: 4, version: "0003", at: 3, held: [] }] });
  assert.deepEqual(rows.map((r) => [r.id, r.kind]), [["0003", "saved"], ["0002", "live"], ["0001", "old"]]);
});

test("a saved change with no new build (stored data) is its own row; nothing is called live when nothing is", () => {
  const held = historyRows([V("0002", "build", 2)], { live: "0002", draft: "0002", revisions: [{ revision: 5, version: "0002", at: 9, held: [{ op: "row" }] }] });
  assert.deepEqual(held.map((r) => r.kind), ["held", "live"]);
  const never = historyRows([V("0001", "build", 1)], { live: null, draft: "0001", revisions: [] });
  assert.deepEqual(never.map((r) => r.kind), ["saved"], "a never-published site's build reads as live or restorable");
});

test("only an older, published version offers Restore; the old browser list and its restore are gone", () => {
  const a2 = src.indexOf("async function historyRailLoad(");
  const body = src.slice(a2, src.indexOf("\n}\n", a2));
  assert.match(body, /r\.kind === 'old' \? '<button type="button" class="st-hi-restore" data-vrestore=/);
  assert.match(body, /apiFetch\('\/api\/site\/' \+ encodeURIComponent\(slug\) \+ '\/versions'\)/);
  assert.match(body, /apiFetch\('\/api\/site\/' \+ encodeURIComponent\(slug\) \+ '\/draft'\)/);
  assert.match(src, /if \(siteRail === 'history'\) historyRailLoad\(siteById\(siteOpenId\)\);/, "the panel is never filled");
  assert.ok(!/function siteSnap\(|function siteRestore\(|data-restore=/.test(src), "the old browser-only history is back");
});
