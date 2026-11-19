// THE README SAYS WHAT CODER DOES NOW (owner, 2026-11-07: "fix this"; the docs
// comparison found old lines): checked against the code itself.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("CD150 the README says what Coder does now: pull requests only on the owner's word, many tools, 8 minutes for a start, no saved keys for the setup script (old lines said otherwise); and those are true", async () => {
  const md = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  for (const old of [/its only tool/, /opens a\s+\*\*pull request\*\* into the main branch/, /given 3 minutes/, /setup script use saved keys/]) assert.doesNotMatch(md, old, String(old));
  assert.match(md, /A \*\*pull request\*\*\s+opens only when the user presses Create PR or Create draft PR in the chat,\s+or asks Coder for one/);
  assert.match(md, /given 8 minutes before the job counts as lost \(`START_GRACE_MS`/);
  assert.match(md, /setup script never gets the owner's saved keys or variables/);
  assert.doesNotMatch(readFileSync(new URL("../../CLAUDE.md", import.meta.url), "utf8"), /one tool, `bash`/);
  // TRUE IN THE CODE: the start's grace, the tools, and no keys while the setup runs.
  const { START_GRACE_MS } = await import("../src/coder-routes.mjs");
  assert.equal(START_GRACE_MS, 8 * 60 * 1000);
  const { CODER_TOOLS } = await import("../container/coder-agent.mjs");
  const names = CODER_TOOLS.map((t) => (t.function || t).name);
  for (const n of ["read", "edit", "write", "grep", "glob", "bash"]) assert.ok(names.includes(n), n);
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /if \(px && secretList\.length\) px\.setSecrets\(\[\]\);/, "no keys while the setup script runs");
});

test("RD-audit2 the README names every deploy secret, every GitHub event Coder handles, and every Settings key (audit L-ops-52, L-ops-53, L-ops-57)", async () => {
  const md = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  const section = (h) => { const i = md.indexOf("\n## " + h + "\n"); const j = md.indexOf("\n## ", i + 4); return md.slice(i, j < 0 ? undefined : j); };
  const wf = readFileSync(new URL("../../.github/workflows/deploy-coder.yml", import.meta.url), "utf8");
  const deploy = section("Deploy");
  for (const n of new Set(wf.match(/secrets\.[A-Z_]+/g).map((x) => x.slice(8)))) assert.ok(deploy.includes(n), n);
  const app = section("The GitHub App").toLowerCase();
  const src = ["coder-mentions.mjs", "coder-review.mjs"].map((f) => readFileSync(new URL("../src/" + f, import.meta.url), "utf8")).join("\n");
  for (const ev of new Set([...src.matchAll(/event === "([a-z_]+)"/g)].map((m) => m[1]).filter((e) => e !== "ping"))) assert.ok(app.includes(ev.replace(/_/g, " ")), ev);
  const { prefsOf } = await import("../src/coder-routes.mjs");
  const i = md.indexOf("**Settings** (owner, 2026-11-10"), settings = md.slice(i, md.indexOf("\n\n**", i + 10));
  for (const k of Object.keys(prefsOf({}))) assert.ok(settings.includes("`" + k + "`"), k);
  assert.doesNotMatch(settings, /2 GB unless/);
});
