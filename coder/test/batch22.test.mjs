// Claude Code fixes, batch 22.
import { test } from "node:test";
import assert from "node:assert/strict";

function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k), json: async () => JSON.parse(m.get(k)) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}

test("B22 I36: a job's added rules never erase a Never or Ask rule; the owner's editor still moves a rule", async () => {
  const R = await import("../src/coder-routes.mjs");
  const bucket = fakeBucket();
  await R.changeRules(bucket, "u1", "ana/shop", "deny", ["Bash(git push *)"]);
  await R.changeRules(bucket, "u1", "ana/shop", "ask", ["Bash(npm publish *)"]);
  const r = await R.changeRules(bucket, "u1", "ana/shop", "allow", ["Bash(git push *)", "Bash(npm publish *)", "Bash(ls)"], { add: true });
  assert.deepEqual(r.deny, ["Bash(git push *)"]);
  assert.deepEqual(r.ask, ["Bash(npm publish *)"]);
  assert.ok(r.allow.includes("Bash(ls)"));
  const moved = await R.changeRules(bucket, "u1", "ana/shop", "allow", ["Bash(git push *)"]);
  assert.deepEqual(moved.deny, []);
});

test("B22 L-server-21: auto-fix refuses a pull request from the default branch", async () => {
  const { autofixFor } = await import("../src/coder-routes.mjs");
  const pr = { number: 7, state: "open", html_url: "https://github.com/ana/shop/pull/7", head: { ref: "main", repo: { id: 1, default_branch: "main" } }, base: { ref: "release", repo: { id: 1, default_branch: "main" } } };
  const fetchFn = async () => Response.json(pr);
  const meta = { id: "shop-af01", repo: "ana/shop", base: "main", branch: "coder/shop-af01" };
  const r = await autofixFor({}, fakeBucket(), "u1", meta, { pr: "#7" }, "tok", fetchFn);
  assert.equal(r.meta, undefined);
  assert.match(r.note, /cannot run on the default branch \(main\)/);
  const ok = await autofixFor({}, fakeBucket(), "u1", meta, { pr: "#7" }, "tok", async () => Response.json({ ...pr, head: { ref: "feature/x", repo: pr.head.repo }, base: { ref: "main", repo: pr.base.repo } }));
  assert.equal(ok.meta.branch, "feature/x");
});

test("B22 L-machine-08: messages kept after a summary lose their old token counts", async () => {
  const { compactHistory } = await import("../src/coder-summary.mjs");
  const msgs = [];
  for (let i = 0; i < 8; i++) msgs.push({ role: "user", content: "q" + i + "x".repeat(200) }, { role: "assistant", content: "a" + i, tokens: 999999 });
  const out = await compactHistory(msgs, async () => "summary", { at: 10 });
  assert.ok(out.to > 0);
  assert.ok(out.messages.every((m) => m.tokens === undefined));
});

test("B22 M-r2-16: a restore that put back nothing is a failure and keeps the later jobs", async () => {
  const R = await import("../src/coder-routes.mjs");
  assert.match(R.restoreNone(["a.txt"]), /^Failed to restore the code: No files were restored\. 1 path was skipped for link safety: .*a\.txt/);
  const src = (await import("node:fs")).readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.match(src, /if \(!\(restored\.length === 0 && skippedFiles\.length > 0\)\) commits = commits\.filter/);
  assert.match(R.restoreSkipped(["a.txt"]), /^Restored the code, but skipped 1 file/);
});

test("B22 I46: a job started from GitHub gets no memory and saves none", async () => {
  const src = (await import("node:fs")).readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.match(src, /const memoryP = soon\(async \(\) => \{ if \(body\.fromGithub === true\) return "";/);
  assert.match(src, /memNew !== oldMemory && meta\.jobFromGithub !== true \? bucket\.put/);
});
