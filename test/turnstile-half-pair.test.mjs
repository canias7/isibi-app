// Audit A30-7: a site with TURNSTILE_SECRET and no TURNSTILE_SITE_KEY can
// render no widget, so no token can exist; the check must read as off there,
// and a refused verdict must be logged so the owner's refusals can be seen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const between = (a, b) => {
  const i = worker.indexOf(a);
  const j = worker.indexOf(b, i + a.length);
  assert.ok(i > 0 && j > i, "landmarks: " + a + " … " + b);
  return worker.slice(i, j);
};

test("half a pair is off: the secret is dropped when the site key is absent, after both are read", () => {
  const cfg = between("const siteTurnstileKeys = memoize(turnstileCfg,", "\n});\n");
  const loop = cfg.indexOf("for (const r of (rows || [])");
  const off = cfg.search(/if \(out\.secret && !out\.siteKey\) \{[\s\S]{0,200}?out\.secret = "";/);
  assert.ok(loop > 0 && off > loop, "a secret without its site key still switches the check on");
  assert.match(cfg.slice(off, off + 300), /console\.error\("turnstile:", slug,/, "the half pair is not said");
  assert.ok(cfg.lastIndexOf("return out;") > off);
});

test("a refused verdict is logged, not only an unknown one", () => {
  const gate = between("async function turnstileGate(", "\n}\n");
  const said = gate.indexOf('if (!verdict.ok || verdict.state === "unknown") console.error("turnstile:", slug, verdict.state, verdict.reason);');
  const pass = gate.indexOf("if (verdict.ok) return out;");
  assert.ok(said > 0 && pass > said, "a refusal leaves no trace");
  // And a declared writing function's refusal, judged in the same gate.
  assert.ok(gate.includes('if (verdict && (!verdict.ok || verdict.state === "unknown")) console.error("turnstile:", slug, verdict.state, verdict.reason);'), "a function's refusal leaves no trace");
});
