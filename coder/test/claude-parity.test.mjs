// LIKE CLAUDE CODE (owner, 2026-11-06: "Finish all this", after comparing
// Coder with Claude Code's docs read that day).
import { test } from "node:test";
import assert from "node:assert/strict";

function fakeBucket() {
  const m = new Map(); let lists = 0;
  return { m, get lists() { return lists; }, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { lists++; return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}

test("CD100 GitHub like Claude Code: strangers get no reply and cost one search a day; auto-fix asks first when a comment is unclear; questions show their choices", async () => {
  const M = await import("../src/coder-mentions.mjs");
  // A login with no account: searched once, then remembered as "none" for a day.
  const bucket = fakeBucket();
  await bucket.put("coder/u1/github.json", JSON.stringify({ login: "owner" }));
  assert.equal(await M.accountForLogin(bucket, "stranger"), null);
  assert.equal(bucket.lists, 1);
  assert.equal(await M.accountForLogin(bucket, "stranger"), null);
  assert.equal(bucket.lists, 1, "no second search through every connection");
  // An old miss (over a day) is searched again; connecting GitHub replaces the record anyway.
  await bucket.put("coder/logins/stranger.json", JSON.stringify({ none: true, at: Date.now() - 25 * 3600 * 1000 }));
  await M.accountForLogin(bucket, "stranger");
  assert.equal(bucket.lists, 2);
  await bucket.put("coder/u1/profile.json", JSON.stringify({ email: "me@x.y" }));
  assert.deepEqual(await M.accountForLogin(bucket, "owner"), { uid: "u1", email: "me@x.y" });

  // AUTO-FIX: a clear fix is made; an unclear review is asked about first.
  const b2 = fakeBucket();
  await b2.put(M.branchKey("ana/shop", "coder/shop-1"), JSON.stringify({ uid: "u1", id: "shop-1" }));
  await b2.put("coder/u1/profile.json", JSON.stringify({ email: "me@x.y" }));
  await b2.put("coder/u1/github.json", JSON.stringify({ login: "ana" }));
  const sent = [];
  const coder = async (req) => {
    const u = new URL(req.url);
    if (req.method === "POST") { sent.push(await req.json()); return Response.json({ ok: true }); }
    if (u.pathname === "/api/coder/projects/shop-1") return Response.json({ ok: true, project: { id: "shop-1", status: "idle", autofix: true, autofixTries: 0, commits: [{ sha: "abc" }] } });
    return Response.json({}, { status: 404 });
  };
  const fetchFn = async () => new Response(JSON.stringify({ token: "t", id: 5 }), { status: 201 });
  const r = await M.startAutofix({ CODER_USERS: "me@x.y", CODER_BUCKET: b2 }, { coder, fetchFn }, { kind: "review", repo: "ana/shop", branch: "coder/shop-1", number: 3, login: "ana", text: "Maybe rename this?", installation: 7 });
  assert.equal(r.ok, true);
  assert.match(sent[0].text, /If it is unclear what the reviewer wants, change nothing: ask the owner with ask_user/);

  // A question from a GitHub job shows its choices (the new card's options are objects).
  const t = M.finalText({ login: "ana", repo: "ana/shop" }, { branch: "coder/shop-1", base: "main" }, [
    { type: "user", text: "x" },
    { type: "question", text: "Rename to what?", options: [{ label: "getUser", description: "matches the API" }, { label: "loadUser" }, "fetchUser"], multi: true },
  ]);
  assert.match(t, /\*\*Rename to what\?\*\*\n- getUser \(matches the API\)\n- loadUser\n- fetchUser\n\nChoose one or more, and answer with `@coder <your choice>`\./);
  assert.doesNotMatch(t, /\[object Object\]/);
});

test("CD101 Create PR and Create draft PR, like Claude Code: buttons in the chat bar; a draft opens as a draft on GitHub", async () => {
  const { runCoder } = await import("../container/coder-agent.mjs");
  const { openPullRequest } = await import("../src/coder-github.mjs");
  const call = (name, args) => ({ id: name + "1", type: "function", function: { name, arguments: JSON.stringify(args) } });
  const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
  const steps = [say("", [call("pull_request", { title: "Add a.txt", body: "Adds a.txt.", draft: true })]), say("Draft coming.")];
  let i = 0;
  const r = await runCoder({ send: async () => steps[Math.min(i++, 1)], exec: async () => ({ code: 0, output: "" }) }, { text: "Create a draft pull request for this branch." });
  assert.deepEqual(r.prRequest, { title: "Add a.txt", body: "Adds a.txt.", draft: true });
  const sent = [];
  const fetchFn = async (url, init = {}) => { sent.push(JSON.parse(init.body || "{}")); return new Response(JSON.stringify({ html_url: "https://github.com/a/b/pull/2", number: 2 }), { status: 201 }); };
  assert.deepEqual(await openPullRequest("t", "a/b", { head: "coder/x", base: "main", title: "T", body: "B", draft: true }, fetchFn), { url: "https://github.com/a/b/pull/2", number: 2 });
  assert.equal(sent[0].draft, true);
  await openPullRequest("t", "a/b", { head: "coder/x", base: "main", title: "T", body: "B" }, fetchFn);
  assert.equal("draft" in sent[1], false, "a normal pull request is not a draft");
  // The page: the two buttons appear once the branch has work and no pull request, and are off while Coder works.
  const { readFileSync } = await import("node:fs");
  const page = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.match(page, /p && !\(p\.pr && p\.pr\.url\) && Array\.isArray\(p\.commits\) && p\.commits\.length \? '<button type="button" class="cd-hbtn" id="cdMakePr"' \+ \(S\.running \|\| S\.sending \? ' disabled' : ''\) \+ '>Create PR<\/button><button type="button" class="cd-hbtn" id="cdMakeDraft"/);
  assert.match(page, /on\('#cdMakePr', 'click', \(\) => send\(PR_ASK\)\);\n\s+on\('#cdMakeDraft', 'click', \(\) => send\(PR_ASK_DRAFT\)\);/);
  assert.match(page, /const PR_ASK_DRAFT = 'Create a draft pull request for this branch\./);
  const routes = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.match(routes, /draft: want\.draft === true \}, fetchFn\)/);
});
