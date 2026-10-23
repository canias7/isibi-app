// Audit round 2, group 3 (2026-10-23): findings re-checked against today's
// code. Records: docs/history/2026-10-23-r2-g3.md.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { carryPanelFields } from "../site-meta.mjs";

const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8");

// ── A33-5 ────────────────────────────────────────────────────────────────────
// A restore (Versions, and Back online through the same function) wrote the
// version's staged origin: after a rename-lane rename, that is the old name,
// which 301s, so every canonical and og:url pointed at a redirect.
test("A33-5 a restore keeps the live address, not the restored version's old name", () => {
  const ver = JSON.stringify({ origin: "https://fretwork-1.gofarther.app/", description: "d" });
  const live = JSON.stringify({ origin: "https://crookes-guitar.gofarther.app/", description: "d" });
  const out = JSON.parse(carryPanelFields(ver, live, ver, { origin: true }));
  assert.equal(out.origin, "https://crookes-guitar.gofarther.app/");
  // Without the option the version's own origin stands (Publish of a rename).
  assert.equal(JSON.parse(carryPanelFields(ver, live, ver)).origin, "https://fretwork-1.gofarther.app/");

  const rs = worker.indexOf("async function restoreVersion(");
  const rsEnd = worker.indexOf("putWorker:", rs);
  assert.ok(rs > 0 && rsEnd > rs, "restoreVersion landmarks");
  assert.match(worker.slice(rs, rsEnd), /sidecar: await withPanelFields\(deps, slug, [^\n]*, \{ origin: true \}\), sidecarKey/,
    "restoreVersion does not carry the live address");
  // Back online is this same function.
  assert.match(worker, /rollback: \(\{ slug, id \}\) => restoreVersion\(env, slug, id\),/);
});
