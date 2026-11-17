// Group 3 and 4 fixes (owner, 2026-11-17): pull requests marked ready, threads resolved, replies and comments at once;
// review comments posted at once; an offer to watch a new pull request; no `echo "exit:$?"`; undo names removed files.
import { test } from "node:test";
import assert from "node:assert/strict";
import { updatePullRequest } from "../src/coder-github.mjs";
import { undoLine } from "../src/coder-routes.mjs";
import { CODER_SYSTEM } from "../container/coder-agent.mjs";
import { readFileSync } from "node:fs";

function fakeGitHub(pr) {
  const calls = [];
  const fetchFn = async (url, init = {}) => {
    const path = String(url).replace("https://api.github.com", ""), body = init.body ? JSON.parse(init.body) : null;
    calls.push({ path, method: init.method || "GET", body });
    let data = {};
    if (path === "/repos/o/r/pulls/7" && (init.method || "GET") === "GET") data = pr;
    else if (path === "/graphql" && /reviewThreads/.test(body.query)) data = { data: { repository: { pullRequest: { reviewThreads: { nodes: [{ id: "T1", isResolved: false, comments: { nodes: [{ databaseId: 41 }, { databaseId: 42 }] } }] } } } } };
    else if (path === "/graphql") data = { data: { ok: true } };
    else data = { html_url: "https://github.com/o/r/pull/7#c" };
    return new Response(JSON.stringify(data), { status: 200 });
  };
  return { fetchFn, calls };
}

test("pr_update: a draft is marked ready through GitHub's GraphQL, with the pull request's node id", async () => {
  const g = fakeGitHub({ state: "open", draft: true, node_id: "PR_x" });
  const r = await updatePullRequest("tok", "o/r", 7, { op: "ready" }, { fetchFn: g.fetchFn });
  assert.equal(r.ok, true);
  assert.match(r.text, /now ready for review/);
  const q = g.calls.find((c) => c.path === "/graphql");
  assert.match(q.body.query, /markPullRequestReadyForReview/);
  assert.equal(q.body.variables.id, "PR_x");
});

test("pr_update: already ready is said, with nothing changed; back to draft uses convertPullRequestToDraft", async () => {
  const g = fakeGitHub({ state: "open", draft: false, node_id: "PR_x" });
  assert.match((await updatePullRequest("tok", "o/r", 7, { op: "ready" }, { fetchFn: g.fetchFn })).text, /already ready/);
  assert.equal(g.calls.filter((c) => c.path === "/graphql").length, 0);
  await updatePullRequest("tok", "o/r", 7, { op: "draft" }, { fetchFn: g.fetchFn });
  assert.match(g.calls.find((c) => c.path === "/graphql").body.query, /convertPullRequestToDraft/);
});

test("pr_update: resolve finds the thread holding the comment, also a reply in it", async () => {
  const g = fakeGitHub({});
  const r = await updatePullRequest("tok", "o/r", 7, { op: "resolve", commentId: 42 }, { fetchFn: g.fetchFn });
  assert.equal(r.ok, true);
  const m = g.calls.filter((c) => c.path === "/graphql").at(-1);
  assert.match(m.body.query, /resolveReviewThread/);
  assert.equal(m.body.variables.id, "T1");
  assert.match((await updatePullRequest("tok", "o/r", 7, { op: "resolve", commentId: 99 }, { fetchFn: g.fetchFn })).error, /no review thread/);
});

test("pr_update: reply and comment go to GitHub's REST addresses at once; a missing body or id is refused", async () => {
  const g = fakeGitHub({});
  assert.equal((await updatePullRequest("tok", "o/r", 7, { op: "reply", commentId: 41, body: "done" }, { fetchFn: g.fetchFn })).ok, true);
  assert.equal(g.calls.at(-1).path, "/repos/o/r/pulls/7/comments/41/replies");
  assert.equal((await updatePullRequest("tok", "o/r", 7, { op: "comment", body: "hi" }, { fetchFn: g.fetchFn })).ok, true);
  assert.equal(g.calls.at(-1).path, "/repos/o/r/issues/7/comments");
  assert.match((await updatePullRequest("tok", "o/r", 7, { op: "comment" }, { fetchFn: g.fetchFn })).error, /body/);
  assert.match((await updatePullRequest("tok", "o/r", 7, { op: "reply", body: "x" }, { fetchFn: g.fetchFn })).error, /comment_id/);
  assert.match((await updatePullRequest("tok", "o/r", 7, { op: "merge" }, { fetchFn: g.fetchFn })).error, /op is/);
});

test("Coder has pr_update, posts pr_comments at once, offers to watch a new pull request, and adds no echo of the exit code", () => {
  const src = readFileSync(new URL("../container/coder-agent.mjs", import.meta.url), "utf8");
  assert.match(src, /fn\("pr_update", /);
  assert.match(src, /action: "pr_review"/);
  assert.match(src, /action: "pr_update"/);
  assert.doesNotMatch(src, /posted on the pull request when your turn ends/);
  assert.match(CODER_SYSTEM, /never add `echo "exit:\$\?"`/);
  assert.match(CODER_SYSTEM, /After you open a pull request, end your answer by offering to watch it/);
  const w = readFileSync(new URL("../src/coder-envapi.mjs", import.meta.url), "utf8");
  assert.match(w, /body\.action === "pr_update"/);
  assert.match(w, /body\.action === "pr_review"/);
});

test("undo: a file the job had made is said as removed", () => {
  assert.equal(undoLine("Undid the last job", ["a.txt", "new.txt"], "saved to the branch b", ["new.txt"]), "Undid the last job: a.txt is back as it was; new.txt removed (2 files). Saved to the branch b.");
  assert.equal(undoLine("Undid the last job", ["new.txt"], "", ["new.txt"]), "Undid the last job: new.txt removed.");
  assert.equal(undoLine("Undid the last job", ["a.txt"], ""), "Undid the last job: a.txt is back as it was.");
  const sv = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(sv, /"--name-status", "--no-renames"/);
});
