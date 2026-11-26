// THE LIVE FINDINGS OF 2026-11-26 ON 39d77a37: Grok changed pull request #44's title and description with
// `gh api -X PATCH …/pulls/44` (and made a branch with gh api), so the chat showed "Ran a command" instead of the GitHub step;
// and the card under the answer said "Pushed to the branch coder/…" for a push to the named branch live-1126-x.
// Like Claude Code's cloud session, GitHub work goes through the GitHub tools; gh stays for reading. No model or GitHub is called.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runCoder } from "../container/coder-agent.mjs";
import { ghWriteBlocked } from "../container/coder-bashcheck.mjs";
import { pushedBranchesNote } from "../src/coder-routes.mjs";

const call = (name, args, id = name + "1") => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const script = (turns) => { let n = 0; return async () => turns[Math.min(n++, turns.length - 1)]; };

test("GT1 gh changes to GitHub are refused, each pointing to its tool", () => {
  assert.match(ghWriteBlocked("gh api -X PATCH repos/a/b/pulls/44 -f title=x"), /Not run: .*Use pull_request/);
  assert.match(ghWriteBlocked("gh api --method POST repos/a/b/git/refs -f ref=refs/heads/x -f sha=abc"), /push_branch/);
  assert.match(ghWriteBlocked("gh api --method=PUT repos/a/b/pulls/4/merge"), /Not run/);
  assert.match(ghWriteBlocked("gh api -XDELETE repos/a/b/git/refs/heads/x"), /Not run/);
  assert.match(ghWriteBlocked("gh api repos/a/b/issues/4/comments -f body=hi"), /pr_update with op "comment"/);
  assert.match(ghWriteBlocked("gh pr create --title T --body B"), /Use pull_request/);
  assert.match(ghWriteBlocked("gh pr edit 44 --title T"), /pull_request \(called again/);
  assert.match(ghWriteBlocked("gh pr merge 44 --squash"), /owner's to do/);
  assert.match(ghWriteBlocked("gh pr comment 44 --body hi"), /pr_update/);
  assert.match(ghWriteBlocked("gh pr close 44"), /Not run/);
  assert.match(ghWriteBlocked("cd repo && GH_X=1 gh pr edit 44 --body B"), /Not run/);
});

test("GT2 plain read-only gh keeps working", () => {
  for (const c of ["gh api repos/a/b/pulls/44", "gh api -X GET repos/a/b/pulls", "gh api search/issues -X GET -f q=bug", "gh api search/code?q=x", "gh pr view 44", "gh pr list", "gh pr diff 44", "gh pr checks 44", "gh api rate_limit --jq .resources", "git push", "echo gh pr create"])
    assert.equal(ghWriteBlocked(c), "", c);
});

test("GT3 the agent does not run a gh PATCH; Coder is told the tool", async () => {
  const ran = [], events = [];
  const r = await runCoder({
    send: script([say("", [call("bash", { command: "gh api -X PATCH repos/o/r/pulls/44 -f title=New" }, "b1")]), say("Done.")]),
    exec: async (x) => { ran.push(x.command); return { code: 0, output: "" }; }, emit: (e) => events.push(e),
  }, { text: "change PR 44's title" });
  assert.ok(!ran.some((c) => /PATCH/.test(String(c))));
  const res = events.find((e) => e.type === "result" && e.id === "b1");
  assert.ok(res && res.ran === false && /pull_request/.test(res.output));
  assert.ok(r);
});

test("GT4 Coder's instructions send all GitHub work to the GitHub tools", () => {
  const src = readFileSync(new URL("../container/coder-agent.mjs", import.meta.url), "utf8");
  assert.match(src, /use Coder's GitHub tools \(pull_request, pr_read, pr_update, pr_comments, reply_review, auto_fix, review, push_branch\) for ALL GitHub work/);
  assert.match(src, /Never change GitHub with gh/);
  assert.doesNotMatch(src, /and other REST calls work/);
});

test("GT5 the card names the branch really pushed, and each when more than one", () => {
  assert.equal(pushedBranchesNote([{ pushed: true, branch: "live-1126-x" }], "coder/c-1"), "Pushed to the branch live-1126-x");
  assert.equal(pushedBranchesNote([{ pushed: true }], "coder/c-1"), "Pushed to the branch coder/c-1");
  assert.equal(pushedBranchesNote([{ pushed: true }, { pushed: true, branch: "live-1126-x" }, { pushed: false, branch: "z" }], "coder/c-1"), "Pushed to the branches coder/c-1 and live-1126-x");
});

test("GT6 pull_request with a branch marks its push with that branch", async () => {
  const r = await runCoder({
    send: script([say("", [call("pull_request", { title: "T", body: "B", branch: "live-1126-x" }, "p1")]), say("Done.")]),
    exec: async () => ({ code: 0, output: "" }), emit: () => {},
    pushNow: async () => ({ ok: true, pushed: true, changed: true, sha: "abcdef1234567" }),
    envApi: async () => ({ number: 45, url: "u", base: "main", head: "live-1126-x", existed: false }),
  }, { text: "PR on a new branch live-1126-x" });
  assert.equal(r.midPushes[0].branch, "live-1126-x");
  assert.equal(pushedBranchesNote(r.midPushes, "coder/testingforclaude-ira6x9sc"), "Pushed to the branch live-1126-x");
});
