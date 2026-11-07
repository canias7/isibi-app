// AUTO-FIX LIKE CLAUDE CODE'S (owner, 2026-11-07, item 2: "it's always on, only works on Coder's own pull
// requests, and answers in the chat rather than on GitHub"). Claude Code's docs: turned on for a pull
// request ("turn on Auto-fix"), for any existing one ("paste the PR URL into a session and tell Claude to
// auto-fix it"), "tell Claude to stop watching the PR"; it "explains what was done in the session" and "may
// reply to review comment threads ... posted using your GitHub account ... labeled as coming from Claude
// Code". (Readings of GitHub's news: CD48 in test/coder.test.mjs.)
import { test } from "node:test";
import assert from "node:assert/strict";

function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}
const KEY = Buffer.alloc(32, 7).toString("base64");
const UID = "user-1234567890abcdef", ID = "shop-af01";
const pull = (n, o = {}) => ({ number: n, state: "open", html_url: "https://github.com/ana/shop/pull/" + n, head: { ref: "feature/totals", sha: "f00d", repo: { id: 1 } }, base: { ref: "main", repo: { id: 1 } }, ...o });

test("CD169 auto-fix asked for in the chat: any open pull request of the chat's repository (by address or number), whose branch the chat then works on; never a fork's, a closed one, another chat's branch or another repository's; off again when asked", async () => {
  const { autofixFor } = await import("../src/coder-routes.mjs");
  const { branchKey } = await import("../src/coder-mentions.mjs");
  const bucket = fakeBucket();
  const prs = { 12: pull(12), 13: pull(13, { head: { ref: "feature/x", repo: { id: 999 } } }), 14: pull(14, { state: "closed" }), 15: pull(15, { head: { ref: "coder/shop-zz99", repo: { id: 1 } } }), 16: pull(16, { head: { ref: "coder/" + ID, repo: { id: 1 } } }) };
  const fetchFn = async (url) => { const m = /\/repos\/ana\/shop\/pulls\/(\d+)$/.exec(String(url)); return m && prs[m[1]] ? Response.json(prs[m[1]]) : new Response("{}", { status: 404 }); };
  const meta = { id: ID, repo: "ana/shop", base: "main", branch: "coder/" + ID, commits: [{ sha: "a1", turn: 1 }] };
  // ANY PULL REQUEST OF THE REPOSITORY: the chat moves onto its branch, and GitHub's news about it reaches this chat.
  let r = await autofixFor({}, bucket, UID, meta, { pr: "https://github.com/ana/shop/pull/12", on: true }, "tok", fetchFn);
  assert.deepEqual(r.meta, { autofix: true, autofixTries: 0, pr: { number: 12, url: "https://github.com/ana/shop/pull/12" }, branch: "feature/totals", base: "main", commits: [], pushed: true });
  assert.match(r.note, /^Auto-fix is on for pull request #12: when a check fails or you review it, Coder fixes it in this chat, on its branch feature\/totals \(this chat now works on that branch\)\. Turn it off with the Auto-fix button, or ask Coder\.$/);
  assert.deepEqual(JSON.parse(bucket.m.get(branchKey("ana/shop", "feature/totals"))), { uid: UID, id: ID });
  // The chat's own pull request: auto-fix on, the branch stays.
  r = await autofixFor({}, bucket, UID, meta, { pr: "#16" }, "tok", fetchFn);
  assert.deepEqual(r.meta, { autofix: true, autofixTries: 0, pr: { number: 16, url: "https://github.com/ana/shop/pull/16" } });
  // REFUSED: a fork's, a closed one, another chat's branch, another repository's, nonsense.
  for (const [pr, why] of [["13", /comes from a fork, whose branch Coder cannot push to/], ["14", /is closed/], ["99", /GitHub shows no pull request #99/], ["https://github.com/ana/other/pull/3", /is in ana\/other; open a chat on that repository/], ["drop table", /give the pull request's address or number/]]) {
    const x = await autofixFor({}, bucket, UID, meta, { pr }, "tok", fetchFn);
    assert.equal(x.meta, undefined, pr);
    assert.match(x.note, why, pr);
  }
  await bucket.put(branchKey("ana/shop", "coder/shop-zz99"), JSON.stringify({ uid: UID, id: "shop-zz99" }));
  assert.match((await autofixFor({}, bucket, UID, meta, { pr: "15" }, "tok", fetchFn)).note, /belongs to another chat; turn it on there/);
  // OFF, when asked: only the pull request it is on for.
  assert.deepEqual((await autofixFor({}, bucket, UID, { ...meta, pr: { number: 12 }, autofix: true }, { pr: "12", on: false }, "tok", fetchFn)).meta, { autofix: false });
  assert.match((await autofixFor({}, bucket, UID, { ...meta, pr: { number: 12 }, autofix: true }, { pr: "7", on: false }, "tok", fetchFn)).note, /was not on for pull request #7/);
});

test("CD170 Coder's tools: auto_fix only when the owner asks in the chat (never from a job GitHub started); reply_review only in the review comment's thread the auto-fix job was started for; both done by the Worker when the turn ends", async () => {
  const { runCoder } = await import("../container/coder-agent.mjs");
  const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
  const run = async (calls, opts) => {
    let i = 0;
    const steps = [{ message: { role: "assistant", content: "", tool_calls: calls } }, { message: { role: "assistant", content: "Done." } }];
    return runCoder({ send: async () => steps[i++], exec: async () => ({ code: 0, output: "" }) }, { text: "go", ...opts });
  };
  let r = await run([call("auto_fix", { pr: "https://github.com/ana/shop/pull/12" }, "a1")]);
  assert.deepEqual(r.autofixRequest, { pr: "https://github.com/ana/shop/pull/12", on: true });
  assert.match(r.messages.find((m) => m.tool_call_id === "a1").content, /^ok: auto-fix is turned on for that pull request when your turn ends/);
  r = await run([call("auto_fix", { pr: "12", on: false }, "a1")]);
  assert.deepEqual(r.autofixRequest, { pr: "12", on: false });
  r = await run([call("auto_fix", { pr: "12" }, "a1")], { github: true });
  assert.equal(r.autofixRequest, undefined, "never from a job GitHub started");
  // reply_review: only the comment this job was started for.
  r = await run([call("reply_review", { comment_id: 4242, body: "Renamed it to cartTotal." }, "r1"), call("reply_review", { comment_id: 5555, body: "x" }, "r2")], { github: true, replyTo: { pr: 9, ids: [4242] } });
  assert.deepEqual(r.reviewReplies, [{ id: 4242, body: "Renamed it to cartTotal." }]);
  assert.match(r.messages.find((m) => m.tool_call_id === "r2").content, /^error: only the review comment this auto-fix job was started for can be answered \(4242\)/);
  r = await run([call("reply_review", { comment_id: 4242, body: "x" }, "r1")]);
  assert.equal(r.reviewReplies, undefined, "no thread: nothing");
});

test("CD171 at the job's end, the Worker answers in the review thread as the owner, marked as Coder's (only the thread the job was for), and applies auto-fix asked for in the chat; the job's thread is forgotten after", async () => {
  const { handleCoder } = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const bucket = fakeBucket();
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: KEY, CODER_PUBLIC_URL: "https://coder.gofarther.dev", APP_ORIGIN: "https://gofarther.dev", CODER_BUCKET: bucket };
  await saveConnection(env, bucket, UID, { access: "ghu_user" }, "ana");
  const k = (f) => "coder/" + UID + "/" + ID + "/" + f;
  const gh = [];
  const fetchFn = async (url, init = {}) => {
    const u = String(url);
    gh.push([String(init.method || "GET"), u, init.body ? JSON.parse(init.body) : null]);
    if (/\/pulls\/12$/.test(u)) return Response.json(pull(12));
    if (/\/pulls\/9\/comments\/\d+\/replies$/.test(u)) return Response.json({ id: 1 }, { status: 201 });
    return new Response("{}", { status: 404 });
  };
  let result = null;
  const deps = {
    fetchFn, authUser: async () => ({ id: UID, email: "me@x.y" }),
    container: () => ({ fetch: async (req) => {
      const p = new URL(req.url).pathname;
      if (p === "/state") return Response.json({ running: false, events: [], next: 0, result });
      if (p === "/claim") return Response.json({ ok: true });
      if (p === "/push") return Response.json({ ok: true, pushed: false });
      return Response.json({ ok: true });
    } }),
  };
  const go = (path, init = {}) => handleCoder(new Request("https://gofarther.dev/api/coder/" + path, { ...init, headers: { "content-type": "application/json" } }), env, {}, deps);
  const setMeta = (o) => bucket.put(k("meta.json"), JSON.stringify({ id: ID, repo: "ana/shop", base: "main", branch: "coder/" + ID, turn: 2, saved: 1, status: "running", at: Date.now(), ...o }));
  // AN AUTO-FIX JOB FOR REVIEW COMMENT 4242: its answer goes in that thread, as the owner, marked as Coder's.
  await setMeta({ jobReplyTo: { pr: 9, ids: [4242] } });
  result = { status: "done", messages: [{ role: "user", content: "fix" }, { role: "assistant", content: "Done." }], summary: "Renamed it", reviewReplies: [{ id: 4242, body: "Renamed it to cartTotal." }, { id: 777, body: "not mine to answer" }] };
  let st = await (await go("projects/" + ID + "/state?since=0")).json();
  const posts = gh.filter(([m]) => m === "POST");
  assert.deepEqual(posts, [["POST", "https://api.github.com/repos/ana/shop/pulls/9/comments/4242/replies", { body: "Renamed it to cartTotal.\n\n— Coder (gofarther.dev), for @ana" }]]);
  assert.ok(JSON.parse(bucket.m.get(k("events.json"))).some((e) => e.text === "Answered in 1 review thread on pull request #9 (as you, marked as Coder's)."));
  assert.equal(st.project.jobReplyTo, null, "forgotten after the job");
  // AUTO-FIX ASKED FOR IN THE CHAT: applied at the job's end.
  gh.length = 0;
  await setMeta({ turn: 3, saved: 2 });
  result = { status: "done", messages: [{ role: "user", content: "watch PR 12" }, { role: "assistant", content: "Watching it." }], summary: "", autofixRequest: { pr: "12", on: true } };
  st = await (await go("projects/" + ID + "/state?since=0")).json();
  assert.equal(st.project.autofix, true);
  assert.equal(st.project.branch, "feature/totals");
  assert.deepEqual(st.project.pr, { number: 12, url: "https://github.com/ana/shop/pull/12" });
  assert.ok(JSON.parse(bucket.m.get(k("events.json"))).some((e) => /^Auto-fix is on for pull request #12/.test(e.text)));
  // A JOB THAT WAS NOT FOR A REVIEW THREAD answers in none.
  gh.length = 0;
  await setMeta({ turn: 4, saved: 3 });
  result = { status: "done", messages: [], summary: "", reviewReplies: [{ id: 4242, body: "again" }] };
  await go("projects/" + ID + "/state?since=0");
  assert.deepEqual(gh.filter(([m]) => m === "POST"), []);
});
