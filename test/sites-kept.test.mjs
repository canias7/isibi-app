// Audit A15-3: the browser keeps at most twenty site records. It kept the first
// twenty by position, so an open, active site past index 20 (adopted early in
// this browser) was written out of storage on every save and lost its
// requests and undo offer on reload. `sitesKept` keeps the open site, then the
// most recently changed, in the list's own order; `sitesSave` writes those.
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
const sitesKept = new Function(fnSource("function sitesKept(") + "\nreturn sitesKept;")();

const sites = (n) => Array.from({ length: n }, (_, i) => ({ id: "s" + i, updatedAt: 1000 + (n - i) }));

test("an open site past the twentieth is kept, and so is a recently changed one", () => {
  const all = sites(25);
  all[22].updatedAt = 1; // the open site, not changed for a long time
  all[23].updatedAt = 99999; // changed just now
  const kept = sitesKept(all, "s22");
  assert.equal(kept.length, 20);
  assert.ok(kept.some((s) => s.id === "s22"), "the open site was dropped");
  assert.ok(kept.some((s) => s.id === "s23"), "the most recently changed site was dropped");
  // the least recently changed others go, and the list keeps its own order
  assert.ok(!kept.some((s) => s.id === "s19" || s.id === "s20"), kept.map((s) => s.id).join(","));
  const idx = kept.map((s) => all.indexOf(s));
  assert.deepEqual(idx, idx.slice().sort((a, b) => a - b), "the kept records were reordered");
});

test("twenty or fewer: every record, in order (control)", () => {
  const all = sites(20);
  assert.deepEqual(sitesKept(all, "s3"), all);
  assert.notEqual(sitesKept(all, null), all, "the caller's list itself was handed back");
});

test("sitesSave writes the records sitesKept chooses, with the open site", () => {
  const save = fnSource("function sitesSave(");
  assert.match(save, /sitesKept\(sitesCache \|\| \[\], siteOpenId\)/);
  assert.doesNotMatch(save, /slice\(0, 20\)/);
});
