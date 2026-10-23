// AUDIT S2-3 (2026-10-23): an addition's schema guard (`othersOpen` in
// worker.js) counted a part blocked on the addition itself as a concurrent
// writer, so the addition lost with `conflict` and re-ran every time.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { othersOpenIn } from "../builder/request.mjs";

const part = (n, status, extra = {}) => ({ n, status, needs: [], parent: null, ...extra });

test("S2-3: a part blocked on the addition is not beside it", () => {
  const rec = { parts: [part(0, "started"), part(1, "blocked", { needs: [0] })] };
  assert.equal(othersOpenIn(rec, 0), false);
});

test("S2-3: a part blocked behind one blocked on the addition is not beside it either", () => {
  const rec = { parts: [part(0, "started"), part(1, "blocked", { needs: [0] }), part(2, "blocked", { needs: [1] })] };
  assert.equal(othersOpenIn(rec, 0), false);
  // the chain listed out of order is found all the same
  const back = { parts: [part(0, "started"), part(1, "blocked", { needs: [2] }), part(2, "blocked", { needs: [0] })] };
  assert.equal(othersOpenIn(back, 0), false);
});

test("S2-3: a part the addition left for later (its parent) is not beside it", () => {
  const rec = { parts: [part(0, "started"), part(1, "blocked", { parent: 0 })] };
  assert.equal(othersOpenIn(rec, 0), false);
});

test("S2-3: a running, ready or independently blocked part is still open", () => {
  assert.equal(othersOpenIn({ parts: [part(0, "started"), part(1, "started")] }, 0), true);
  assert.equal(othersOpenIn({ parts: [part(0, "started"), part(1, "ready")] }, 0), true);
  assert.equal(othersOpenIn({ parts: [part(0, "started"), part(1, "queued"), part(2, "blocked", { needs: [1] })] }, 0), true);
  // a part that needs this one but is no longer blocked is not waiting on it
  assert.equal(othersOpenIn({ parts: [part(0, "started"), part(1, "waiting", { needs: [0] })] }, 0), true);
});

test("S2-3: ended parts never count, and an unreadable record is open", () => {
  assert.equal(othersOpenIn({ parts: [part(0, "started"), part(1, "done")] }, 0), false);
  assert.equal(othersOpenIn(null, 0), true);
  assert.equal(othersOpenIn({}, 0), true);
});

test("S2-3: the Worker's othersOpen asks othersOpenIn", () => {
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const a = src.indexOf("async function othersOpen(");
  const b = src.indexOf("async function turnStillMine(", a);
  assert.ok(a > 0 && b > a, "both landmarks");
  assert.match(src.slice(a, b), /return othersOpenIn\(rec, request\.part\);/);
});

// AUDIT A02-3 (2026-10-23): a routing job whose request record could not be
// read kept `holds: true` and waited for, then held, the site's publish turn
// through its model call. A routing writes nothing; it is told by its own
// stored address before any read.
test("A02-3: a routing job never holds the turn, decided before the record read", () => {
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const a = src.indexOf("if (requestOf && writesBeside(env)) {");
  const b = src.indexOf("ITS PART'S PREPARATION", a);
  assert.ok(a > 0 && b > a, "both landmarks");
  const body = src.slice(a, b).replace(/\/\/.*$/gm, "");
  const route = body.search(/if \(\/\\\/api\\\/site\\\/route\(\?!\[\\w\/-\]\)\/\.test\(String\(job\.url \|\| ""\)\)\) \{ jctx\.beside\.holds = false;/);
  const read = body.indexOf("await loadRequest(");
  assert.ok(route > 0, "the routing test sets holds false");
  assert.ok(read > route, "the record is read after the routing test");
  assert.match(body.slice(route, read), /\}\s*else try \{/, "the record read is skipped for a routing");
});
