// THE LIVE FINDINGS OF 2026-11-26 ON e8a426ac: pull_request with branch "live-1126-y" opened #45 from live-1126-y, but the card
// under the answer said "Pushed to the branch coder/…" and the step said "git push (the chat's branch)". The cause: the machine's
// call to Coder's server (envCaller) kept only the pull request's number, link and repository, dropping its base and head, so
// the push was never tagged. These tests go through envCaller as the live run did. And read-only gh runs without asking.
// No model or GitHub is called.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runCoder } from "../container/coder-agent.mjs";
import { envCaller } from "../container/coder-envtools.mjs";
import { bashDecision, ghReadOnly } from "../container/coder-perms.mjs";
import { pushedBranchesNote } from "../src/coder-routes.mjs";
import { GRAPHQL_REFUSED } from "../src/coder-egress.mjs";

const call = (name, args, id = name + "1") => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const script = (turns) => { let n = 0; return async () => turns[Math.min(n++, turns.length - 1)]; };

// The Worker's answer for pull_request, as prOpenNow gives it, sent back over HTTP as the live run's was.
const server = (answer) => async () => new Response(JSON.stringify(answer), { status: 200, headers: { "content-type": "application/json" } });
const via = { url: "https://gofarther.dev/api/coder/model", headers: {} };

test("GR1 envCaller keeps pull_request's base and head", async () => {
  const r = await envCaller(via, server({ number: 45, url: "u", repo: "o/r", base: "main", head: "live-1126-y", draft: false, existed: false }))({ action: "pull_request", title: "T", branch: "live-1126-y" });
  assert.equal(r.head, "live-1126-y");
  assert.equal(r.base, "main");
  const bad = await envCaller(via, server({ number: 45, url: "u", head: "x y;rm", base: "" }))({ action: "pull_request", title: "T" });
  assert.equal(bad.head, undefined);
});

test("GR2 the live path: pull_request with branch, through envCaller, tags the push and names it in the step and the card", async () => {
  const events = [];
  const r = await runCoder({
    send: script([say("", [call("pull_request", { title: "T", body: "B", branch: "live-1126-y" }, "p1")]), say("Done.")]),
    exec: async () => ({ code: 0, output: "" }), emit: (e) => events.push(e),
    pushNow: async () => ({ ok: true, pushed: true, changed: true, sha: "abcdef1234567" }),
    envApi: envCaller(via, server({ number: 45, url: "https://github.com/o/r/pull/45", repo: "o/r", base: "main", head: "live-1126-y", draft: false, existed: false })),
  }, { text: "open a PR from a new branch live-1126-y into main" });
  assert.equal(r.midPushes[0].branch, "live-1126-y");
  assert.equal(pushedBranchesNote(r.midPushes, "coder/testingforclaude-c5iy98ms"), "Pushed to the branch live-1126-y");
  const steps = events.filter((e) => e.type === "bash" && e.id === "p1").map((e) => e.command);
  assert.ok(steps.length >= 1);
  for (const s of steps) assert.doesNotMatch(s, /the chat's branch/, s);
  assert.match(steps[steps.length - 1], /into main from live-1126-y · git push \(live-1126-y\)/);
});

test("GR3 the Worker's end of turn reads the tag (pushedBranchesNote is what handleCoder adds)", () => {
  const src = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.match(src, /extraNotes\.push\(pushedBranchesNote\(res\.midPushes, meta\.branch\)\)/);
});

test("GR4 read-only gh is read-only; changes and GraphQL are not", () => {
  for (const c of ["api repos/a/b/pulls/45", "api -X GET repos/a/b/pulls --jq .[].number", "api -XGET search/issues -f q=bug", "api --method GET repos/a/b/issues -F per_page=5", "api repos/a/b/actions/runs --paginate",
    "pr view 45", "pr view 45 --json title,body --comments", "pr list --state open -L 5", "pr diff 45 --name-only", "pr checks 45", "pr status", "issue view 3", "issue list --label bug", "run view 9 --log-failed", "run list -b main", "repo view", "repo view --json name", "search prs foo --state open", "search code bar"])
    assert.equal(ghReadOnly(c.split(" ")), true, c);
  for (const c of ["api repos/a/b/pulls -f title=x", "api -X PATCH repos/a/b/pulls/1", "api --method=POST repos/a/b/issues", "api graphql -f query=x", "api -X GET graphql -f query=x", "api -X GET repos/a/b -F x=@/etc/passwd", "api repos/a/b --input f.json", "api repos/a/b -H X-HTTP-Method-Override:DELETE",
    "pr view 45 --web", "pr create -t x", "pr merge 45", "pr checkout 45", "issue create", "run rerun 9", "run download 9", "repo clone a/b", "repo view --web", "search"])
    assert.equal(ghReadOnly(c.split(" ")), false, c);
});

test("GR5 read-only gh runs without asking in default and Accept edits; a change still asks", () => {
  for (const mode of ["default", "acceptEdits"]) {
    for (const c of ["gh api -X GET repos/a/b/pulls --jq '.[].title'", "gh pr view 45", "gh pr list", "gh issue list", "gh run list", "gh repo view", "gh search issues bug", "gh api repos/a/b/pulls | head -5"])
      assert.equal(bashDecision(c, { mode, cwd: "/w", workdirs: ["/w"] }).verdict, "allow", mode + ": " + c);
    for (const c of ["gh pr create -t x -b y", "gh api -X POST repos/a/b/issues -f title=x"])
      assert.equal(bashDecision(c, { mode, cwd: "/w", workdirs: ["/w"] }).verdict, "ask", mode + ": " + c);
  }
});

test("GR6 in a default-mode job, gh pr view runs with no approval card", async () => {
  const ran = [], events = [];
  await runCoder({
    send: script([say("", [call("bash", { command: "gh pr view 45" }, "b1")]), say("Done.")]),
    exec: async (x) => { ran.push(x.command); return { code: 0, output: "title: T" }; }, emit: (e) => events.push(e), mode: () => "default",
  }, { text: "read PR 45" });
  assert.ok(ran.some((c) => /gh pr view 45/.test(String(c))));
  assert.ok(!events.some((e) => ["approval", "permission", "runask"].includes(e.type)));
});

test("GR7 GraphQL stays refused, with the REST read named for each gh command", () => {
  assert.match(GRAPHQL_REFUSED, /gh pr view N: gh api repos\/\{owner\}\/\{repo\}\/pulls\/N/);
  assert.match(GRAPHQL_REFUSED, /gh issue view N: \.\.\.\/issues\/N/);
  const src = readFileSync(new URL("../container/coder-agent.mjs", import.meta.url), "utf8");
  assert.match(src, /read with gh api REST instead: gh api repos\/OWNER\/REPO\/pulls\/N for gh pr view N/);
});
