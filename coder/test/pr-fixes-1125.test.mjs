// THE LIVE FINDINGS OF 2026-11-25 (test PR canias7/testingforclaude#42): the pull request's step was labelled "GitHub · Push
// branch"; asking to change its title and description said "updated" while GitHub kept the old ones (the update path never
// called GitHub); auto-fix turned on with no card and no step although its GitHub connector row says Ask. No model or GitHub
// is called: the loop runs on a stub and GitHub is a stand-in that records what it was sent.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runCoder, GH_AUTOFIX_ASK_WHY } from "../container/coder-agent.mjs";
import { prOpenNow } from "../src/coder-envapi.mjs";
import { editPullRequest } from "../src/coder-github.mjs";
import { applyToolChoices } from "../container/coder-toolchoices.mjs";

const call = (name, args, id = name + "1") => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const script = (turns) => { let n = 0; return async () => turns[Math.min(n++, turns.length - 1)]; };

async function prJob(answer) {
  const events = [];
  const r = await runCoder({
    send: script([say("", [call("pull_request", { title: "New title", body: "New body", draft: true }, "p1")]), say("Done.")]),
    exec: async () => ({ code: 0, output: "" }), emit: (e) => events.push(e),
    pushNow: async () => ({ ok: true, pushed: true, changed: true, sha: "abcdef1234567" }),
    envApi: async () => answer,
  }, { text: "make a draft PR" });
  return { r, events, steps: events.filter((e) => e.type === "bash" && e.id === "p1"), results: events.filter((e) => e.type === "result" && e.id === "p1") };
}

test("PF1 the pull request's step is \"Create pull request\" (or \"Update pull request\"), never the push's; the push is its detail line", async () => {
  let t = await prJob({ number: 42, url: "https://github.com/o/r/pull/42", draft: true, existed: false });
  assert.ok(t.steps.length >= 1 && t.steps.every((e) => e.tool === "pull_request"), "no push_branch step");
  assert.equal(t.steps.at(-1).verb, "Create pull request");
  assert.match(t.steps.at(-1).command, /git push/);
  assert.equal(t.results.length, 1);
  assert.match(t.results[0].output, /Draft pull request #42 opened[\s\S]*pushed to GitHub now \(commit abcdef1\)/);
  t = await prJob({ number: 42, url: "https://github.com/o/r/pull/42", existed: true });
  assert.equal(t.steps.at(-1).verb, "Update pull request");
  // A refusal from GitHub is the step's result and what Coder is told: never "updated".
  t = await prJob({ error: "error: GitHub did not update pull request #42's title and description: Validation Failed" });
  assert.equal(t.results.at(-1).code, 1);
  assert.match(t.r.messages.find((m) => m.tool_call_id === "p1").content, /^error: GitHub did not update/);
  // The page names the step by its verb.
  const js = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.match(js, /e\.tool === 'pull_request' && \/\^Update pull request\$\/\.test/);
});

test("PF2 updating an open pull request PATCHes its title and description on GitHub and checks the answer", async () => {
  const key = "coder/u/c1/meta.json";
  const meta = { id: "c1", repo: "o/r", base: "main", branch: "coder/c1", pr: { number: 42, url: "https://github.com/o/r/pull/42" } };
  const m = new Map([[key, JSON.stringify(meta)]]);
  const bucket = { get: async (k) => (m.has(k) ? { text: async () => m.get(k) } : null), put: async (k, v) => { m.set(k, String(v)); } };
  const sent = [];
  let patchAnswer = null;
  const fetchFn = async (url, init = {}) => {
    const b = init.body ? JSON.parse(init.body) : null;
    sent.push({ path: new URL(url).pathname, method: init.method || "GET", body: b });
    if (new URL(url).pathname === "/repos/o/r/pulls/42" && init.method === "PATCH") return patchAnswer ? patchAnswer(b) : Response.json({ number: 42, state: "open", title: b.title, body: b.body, html_url: "https://github.com/o/r/pull/42" });
    if (new URL(url).pathname === "/repos/o/r/pulls/42") return Response.json({ state: "open", merged: false, title: "Old title" });
    return Response.json({ message: "no" }, { status: 404 });
  };
  const env = { CODER_PUBLIC_URL: "https://gofarther.dev" };
  const r = await prOpenNow(env, bucket, "u", "c1", meta, { title: "New title", body: "New body" }, { fetchFn, token: "tok" });
  assert.deepEqual([r.number, r.existed], [42, true]);
  const patch = sent.find((x) => x.method === "PATCH");
  assert.ok(patch, "GitHub's PATCH was called");
  assert.equal(patch.path, "/repos/o/r/pulls/42");
  assert.equal(patch.body.title, "New title");
  assert.match(patch.body.body, /^New body/);
  assert.ok(!sent.some((x) => x.method === "POST"), "not opened twice");
  // GitHub refuses: a real error, never "updated".
  patchAnswer = () => Response.json({ message: "Validation Failed", errors: [{ message: "title is too long" }] }, { status: 422 });
  const bad = await prOpenNow(env, bucket, "u", "c1", meta, { title: "New title", body: "x" }, { fetchFn, token: "tok" });
  assert.equal(bad.number, undefined);
  assert.match(bad.error, /GitHub did not update pull request #42's title and description: Validation Failed: title is too long/);
  // GitHub answers ok but keeps another title: not taken as done.
  patchAnswer = () => Response.json({ number: 42, title: "Old title" });
  assert.match((await prOpenNow(env, bucket, "u", "c1", meta, { title: "New title" }, { fetchFn, token: "tok" })).error, /kept the title "Old title"/);
  // editPullRequest on its own.
  patchAnswer = null;
  assert.deepEqual(await editPullRequest("tok", "o/r", 42, { title: "T", body: "B" }, fetchFn), { ok: true, url: "https://github.com/o/r/pull/42", number: 42 });
});

async function fixJob(args, { rules = { allow: [], ask: [], deny: [] }, answer = "yes", mode = "acceptEdits", canAsk = true } = {}) {
  const events = [], cards = [];
  const r = await runCoder({
    send: script([say("", [call("auto_fix", args, "a1")]), say("ok")]),
    exec: async () => ({ code: 0, output: "" }), emit: (e) => events.push(e),
    ...(canAsk ? { ask: async (pid) => { cards.push(events.find((e) => e.type === "permission" && e.pid === pid)); return { choice: answer }; } } : {}),
  }, { text: "watch PR 42", mode, rules });
  return { r, events, cards, told: (r.messages.find((m) => m.tool_call_id === "a1") || {}).content || "" };
}

test("PF3 auto-fix on asks first by its GitHub row's default (Ask), shows a \"GitHub · Auto-fix\" step; Always allow, an allow rule and turning it off do not ask", async () => {
  let t = await fixJob({ pr: "42" });
  assert.equal(t.cards.length, 1, "a card");
  assert.equal(t.cards[0].tool, "auto_fix");
  assert.equal(t.cards[0].why, GH_AUTOFIX_ASK_WHY);
  assert.deepEqual(t.r.autofixRequest, { pr: "42", on: true });
  const step = t.events.find((e) => e.type === "bash" && e.id === "a1");
  assert.deepEqual([step.tool, step.verb], ["auto_fix", "Turn on"]);
  assert.ok(t.events.some((e) => e.type === "result" && e.id === "a1" && e.code === 0));
  t = await fixJob({ pr: "42" }, { answer: "no" });
  assert.equal(t.r.autofixRequest, undefined, "Deny: not turned on");
  t = await fixJob({ pr: "42" }, { canAsk: false });
  assert.equal(t.r.autofixRequest, undefined, "no one to ask: not turned on");
  t = await fixJob({ pr: "42" }, { rules: applyToolChoices({ allow: [], ask: [], deny: [] }, { "github:auto_fix": "allow" }) });
  assert.equal(t.cards.length, 0, "Always allow: no card");
  assert.deepEqual(t.r.autofixRequest, { pr: "42", on: true });
  t = await fixJob({ pr: "42" }, { rules: { allow: ["mcp__github__auto_fix"], ask: [], deny: [] } });
  assert.equal(t.cards.length, 0, "an allow rule: no card");
  t = await fixJob({ pr: "42" }, { mode: "auto" });
  assert.equal(t.cards.length, 1, "Auto: its Ask still asks, as an Ask choice does");
  t = await fixJob({ pr: "42", on: false });
  assert.equal(t.cards.length, 0, "turning it off: no card");
  assert.deepEqual(t.r.autofixRequest, { pr: "42", on: false });
  assert.equal(t.events.find((e) => e.type === "bash" && e.id === "a1").verb, "Turn off");
});
