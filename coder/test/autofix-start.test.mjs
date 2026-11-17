// Live test, 2026-11-17 (owner: "do it how claude code does it"): auto-fix looks at a check already failing when it is
// turned on; commits get a short imperative title.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { failedCheckNow } from "../src/coder-mentions.mjs";
import { commitTitleFor, COMMIT_ASK } from "../container/coder-agent.mjs";

const gh = (map) => async (url) => { const p = String(url).replace("https://api.github.com", ""); const hit = Object.keys(map).find((k) => p.startsWith(k)); return new Response(JSON.stringify(hit ? map[hit] : {}), { status: hit ? 200 : 404 }); };

test("a check already failing on the pull request's newest commit is found, with the app's installation", async () => {
  const fetchFn = gh({
    "/repos/o/r/pulls/31": { head: { sha: "abc", ref: "coder/x" } },
    "/repos/o/r/commits/abc/check-runs": { check_runs: [{ id: 5, name: "lint", status: "completed", conclusion: "success" }, { id: 7, name: "test", status: "completed", conclusion: "failure", app: { slug: "github-actions" }, output: { title: "1 failing" } }] },
    "/repos/o/r/installation": { id: 99 },
  });
  const f = await failedCheckNow({}, "tok", "o/r", 31, { fetchFn, appJwtFn: async () => "jwt" });
  assert.deepEqual({ kind: f.kind, branch: f.branch, number: f.number, sha: f.sha, installation: f.installation, checkId: f.checkId, appSlug: f.appSlug }, { kind: "check", branch: "coder/x", number: 31, sha: "abc", installation: 99, checkId: 7, appSlug: "github-actions" });
  assert.match(f.text, /The check "test" failed \(failure\): 1 failing/);
});

test("nothing failing (or still running) starts nothing", async () => {
  const fetchFn = gh({ "/repos/o/r/pulls/31": { head: { sha: "abc", ref: "b" } }, "/repos/o/r/commits/abc/check-runs": { check_runs: [{ id: 1, status: "in_progress", conclusion: null }, { id: 2, status: "completed", conclusion: "success" }] }, "/repos/o/r/installation": { id: 9 } });
  assert.equal(await failedCheckNow({}, "tok", "o/r", 31, { fetchFn, appJwtFn: async () => "jwt" }), null);
});

test("the Worker starts the fix once the chat is saved, and says so in the chat", () => {
  const w = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.match(w, /const pending = await failedCheckNow\(env, token, meta\.repo, number, \{ fetchFn \}\)/);
  assert.match(w, /A check is failing on it now, so Coder starts fixing it\./);
  assert.match(w, /await saveMeta\(bucket, uid, ended\);[\s\S]{0,400}if \(afPending && ended\.autofix === true\) \{[\s\S]{0,200}startAutofix\(env,/);
});

test("commit title: Claude Code's kind (short, imperative), cleaned; the Worker uses it before the answer's first sentence", async () => {
  const say = (c) => async () => ({ message: { content: c } });
  assert.equal(await commitTitleFor(say("Fix sum to add instead of subtract.")), "Fix sum to add instead of subtract");
  assert.equal(await commitTitleFor(say('Commit title: "Add greet test"\nmore')), "Add greet test");
  assert.equal(await commitTitleFor(say("x".repeat(80))), "");
  assert.match(COMMIT_ASK, /imperative mood, at most 60 characters/);
  const w = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.ok(!/commitTitle\(s\.result\.summary\)/.test(w));
  assert.match(w, /commitTitle\(s\.result\.commitTitle \|\| s\.result\.summary\)/);
  const a = readFileSync(new URL("../container/coder-agent.mjs", import.meta.url), "utf8");
  assert.match(a, /if \(!endPushed && \(edited\.size \|\| changedNow\) && typeof deps\.send === "function" && who === "Coder"\) commitTitle = await commitTitleFor/);
});
