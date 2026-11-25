// THE LIVE FINDINGS OF 2026-11-25 ON fa82c2d7: auto-fix's card showed with no "GitHub · Auto-fix" step and, after Deny, Coder
// said nothing; a pull request "on a new branch, into main" used the chat's branch and went into another coder/* branch; the
// "Update pull request" step said "git push" when only its title and description changed. No model or GitHub is called.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runCoder, AUTOFIX_DENIED, prStepDetail } from "../container/coder-agent.mjs";
import { prOpenNow } from "../src/coder-envapi.mjs";
import { branchNameOk } from "../src/coder-github.mjs";

const call = (name, args, id = name + "1") => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const script = (turns) => { let n = 0; return async () => turns[Math.min(n++, turns.length - 1)]; };

async function fixJob(answer, mode = "acceptEdits") {
  const events = [];
  let asked = 0;
  const r = await runCoder({
    send: script([say("", [call("auto_fix", { pr: "42" }, "a1")]), say("Okay, auto-fix stays off.")]),
    exec: async () => ({ code: 0, output: "" }), emit: (e) => events.push(e),
    ask: async () => { asked++; return { choice: answer }; },
  }, { text: "watch PR 42", mode, rules: { allow: [], ask: [], deny: [] } });
  return { r, events, asked, step: events.filter((e) => e.type === "bash" && e.id === "a1"), told: (r.messages.find((m) => m.tool_call_id === "a1") || {}).content || "" };
}

test("AF1 auto-fix's step \"GitHub · Auto-fix\" is drawn before its card, whatever the answer", async () => {
  for (const answer of ["yes", "no"]) {
    const t = await fixJob(answer);
    assert.equal(t.asked, 1);
    assert.equal(t.step.length, 1, answer + ": one step");
    assert.equal(t.step[0].tool, "auto_fix");
    const stepAt = t.events.indexOf(t.step[0]), cardAt = t.events.findIndex((e) => e.type === "permission");
    assert.ok(cardAt === -1 || stepAt < cardAt, "the step comes before the card");
  }
  const js = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.match(js, /auto_fix: 'Auto-fix'/);
  assert.match(js, /'GitHub · ' \+/);
});

test("AF2 after Deny the loop goes on and Coder answers in words", async () => {
  const t = await fixJob("no");
  assert.equal(t.r.autofixRequest, undefined);
  assert.equal(t.told, AUTOFIX_DENIED);
  assert.ok(t.events.some((e) => e.type === "result" && e.id === "a1" && e.code === -1 && /Denied/.test(e.output)));
  assert.equal(t.r.status, "done");
  assert.ok(t.r.messages.some((m) => m.role === "assistant" && /auto-fix stays off/.test(String(m.content || ""))), "Grok's answer is kept");
});

function ghStub(m, { defaultBranch = "main" } = {}) {
  const sent = [];
  const fetchFn = async (url, init = {}) => {
    const path = new URL(url).pathname, b = init.body ? JSON.parse(init.body) : null;
    sent.push({ path, method: init.method || "GET", body: b });
    if (path === "/repos/o/r" ) return Response.json({ default_branch: defaultBranch, permissions: { push: true } });
    if (path === "/repos/o/r/git/ref/heads/coder/c1") return Response.json({ object: { sha: "abc123" } });
    if (path === "/repos/o/r/git/refs" && init.method === "POST") return Response.json({ ref: b.ref }, { status: 201 });
    if (path === "/repos/o/r/pulls" && init.method === "POST") return Response.json({ number: 7, html_url: "https://github.com/o/r/pull/7" }, { status: 201 });
    if (path === "/repos/o/r/pulls/42" && init.method === "PATCH") return Response.json({ number: 42, title: b.title, html_url: "https://github.com/o/r/pull/42" });
    if (path === "/repos/o/r/pulls/42") return Response.json({ state: "open", merged: false });
    return Response.json({ message: "no" }, { status: 404 });
  };
  const bucket = { get: async (k) => (m.has(k) ? { text: async () => m.get(k) } : null), put: async (k, v) => { m.set(k, String(v)); } };
  return { sent, fetchFn, bucket };
}

test("AF3 the pull request's base is the repository's default branch, never the chat's starting coder/* branch", async () => {
  const meta = { id: "c1", repo: "o/r", base: "coder/older", branch: "coder/c1" };
  const g = ghStub(new Map([["coder/u/c1/meta.json", JSON.stringify(meta)]]));
  const r = await prOpenNow({}, g.bucket, "u", "c1", meta, { title: "T", body: "B" }, { fetchFn: g.fetchFn, token: "tok" });
  assert.equal(r.number, 7);
  const post = g.sent.find((x) => x.path === "/repos/o/r/pulls" && x.method === "POST");
  assert.deepEqual([post.body.base, post.body.head], ["main", "coder/c1"]);
  assert.deepEqual([r.base, r.head], ["main", "coder/c1"]);
});

test("AF4 an explicit base and a new branch are honoured: the branch is made at the chat's commit, the pull request goes into the base", async () => {
  const meta = { id: "c1", repo: "o/r", base: "coder/older", branch: "coder/c1", pr: { number: 42, url: "x" } };
  const g = ghStub(new Map([["coder/u/c1/meta.json", JSON.stringify(meta)]]));
  const r = await prOpenNow({}, g.bucket, "u", "c1", meta, { title: "T", body: "B", base: "develop", branch: "feature/login" }, { fetchFn: g.fetchFn, token: "tok" });
  assert.equal(r.number, 7, "a new pull request, not the chat's open #42");
  const ref = g.sent.find((x) => x.path === "/repos/o/r/git/refs" && x.method === "POST");
  assert.deepEqual(ref.body, { ref: "refs/heads/feature/login", sha: "abc123" });
  const post = g.sent.find((x) => x.path === "/repos/o/r/pulls" && x.method === "POST");
  assert.deepEqual([post.body.base, post.body.head], ["develop", "feature/login"]);
  assert.ok(!g.sent.some((x) => x.path === "/repos/o/r"), "an explicit base needs no lookup");
  // Bad names are refused; head and base the same are refused.
  assert.match((await prOpenNow({}, g.bucket, "u", "c1", meta, { title: "T", base: "a..b" }, { fetchFn: g.fetchFn, token: "tok" })).error, /not a branch name/);
  assert.match((await prOpenNow({}, g.bucket, "u", "c1", meta, { title: "T", base: "x", branch: "x" }, { fetchFn: g.fetchFn, token: "tok" })).error, /both x/);
  assert.equal(branchNameOk("main"), "main");
  assert.equal(branchNameOk("-x"), "");
});

test("AF5 the agent sends the base and branch it was given; the tool offers them", async () => {
  let sentToServer = null;
  await runCoder({
    send: script([say("", [call("pull_request", { title: "T", body: "B", base: "main", branch: "feature/x" }, "p1")]), say("Done.")]),
    exec: async () => ({ code: 0, output: "" }), emit: () => {},
    pushNow: async () => ({ ok: true, pushed: true, changed: true, sha: "abcdef1234567" }),
    envApi: async (b) => { sentToServer = b; return { number: 7, url: "u", base: "main", head: "feature/x", existed: false }; },
  }, { text: "new branch and a PR into main" });
  assert.deepEqual([sentToServer.base, sentToServer.branch], ["main", "feature/x"]);
  const src = readFileSync(new URL("../container/coder-agent.mjs", import.meta.url), "utf8");
  assert.match(src, /repo: \{ type: "string" \}, base: \{ type: "string"/);
});

test("AF6 the Update pull request step names the push only when one happened", async () => {
  assert.equal(prStepDetail({ number: 42, existed: true }, "", false), "pull request #42 · title/description updated");
  assert.equal(prStepDetail({ number: 42, existed: true }, "", true), "pull request #42 · title/description updated · git push (the chat's branch)");
  assert.equal(prStepDetail({ number: 7, base: "main", head: "coder/c1" }, "", true), "pull request #7 into main from coder/c1 · git push (coder/c1)");
  const events = [];
  await runCoder({
    send: script([say("", [call("pull_request", { title: "T", body: "B" }, "p1")]), say("Done.")]),
    exec: async () => ({ code: 0, output: "" }), emit: (e) => events.push(e),
    pushNow: async () => ({ ok: true, pushed: false, changed: false }),
    envApi: async () => ({ number: 42, url: "u", existed: true }),
  }, { text: "change the PR title" });
  const last = events.filter((e) => e.type === "bash" && e.id === "p1").at(-1);
  assert.equal(last.verb, "Update pull request");
  assert.equal(last.command, "pull request #42 · title/description updated");
});
