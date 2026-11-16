// THE LIVE BUG OF 2026-11-16 (push_branch then pull_request, mid-turn): the turn-end pause ended the admin sandbox, the pull
// request's answer was dropped on the way back, and nothing was queued, so no pull request opened. No model or GitHub is called.
import test from "node:test";
import assert from "node:assert/strict";
import { runCoder } from "../container/coder-agent.mjs";
import { envCaller } from "../container/coder-envtools.mjs";

const call = (name, args, id = name + "1") => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 1, out: 1 } });
const script = (turns) => { let n = 0; const seen = []; return { seen, send: async (q) => { seen.push(q); return turns[Math.min(n++, turns.length - 1)]; } }; };
const lastTool = (seen) => String(seen[seen.length - 1].messages.filter((m) => m.role === "tool").pop().content);

test("PF1 a mid-turn push only pauses: the admin sandbox is not stopped, no process is killed, and all is resumed after", async () => {
  const S = await import("../container/server.mjs");
  let stopped = 0, killed = 0, resumed = 0, pausedWith = null;
  const box = { pid: 4242, stop: () => { stopped++; } };
  const go = await S.quietly({ midTurn: true, uid: 1000, gid: 1000, deps: { box, kill: () => { killed++; return true; }, pause: async (o) => { pausedWith = o; return { ok: true, procs: new Map() }; }, resume: () => { resumed++; } } });
  assert.equal(typeof go, "function");
  assert.equal(pausedWith.boxPid, 4242, "the sandbox is paused, not ended");
  go(); go();
  assert.deepEqual([stopped, killed, resumed], [0, 0, 1]);
  // The pause failed: nothing is ended, and nothing is done (the push waits for the turn's end).
  const no = await S.quietly({ midTurn: true, uid: 1000, gid: 1000, deps: { box, kill: () => { killed++; return true; }, pause: async () => ({ ok: false, why: "x" }) } });
  assert.equal(no, null);
  assert.deepEqual([stopped, killed], [0, 0]);
  // (The turn's end still ends what is not running in the background, as before.)
  await S.quietly({ uid: 1000, gid: 1000, deps: { kill: () => { killed++; return true; } } }).then((f) => f && f());
  assert.equal(killed, 1);
});

test("PF2 pushMidTurn asks for the mid-turn pause, never the turn-end one", async () => {
  const S = await import("../container/server.mjs");
  const asked = [];
  const r = await S.pushMidTurn({ body: {}, project: "p", root: "/nowhere", gitRoot: "/nowhere", gitVia: false, remote: "", quiet: async (o) => { asked.push(o); return null; } });
  assert.deepEqual(asked, [{ midTurn: true }]);
  assert.equal(r.ok, false);
});

test("PF3 the server's pull request answer reaches Coder (it was dropped as 'did not answer')", async () => {
  const via = { url: "https://gofarther.dev/api/coder/model", headers: { "x-coder-chat": "u/c" } };
  let seen = null;
  const api = envCaller(via, async (url, init) => { seen = [String(url), JSON.parse(init.body)]; return Response.json({ number: 7, url: "https://github.com/o/r/pull/7", repo: "o/r", draft: false, existed: false }); });
  const r = await api({ action: "pull_request", title: "T" });
  assert.equal(seen[0], "https://gofarther.dev/api/coder/environment");
  assert.deepEqual(r, { number: 7, url: "https://github.com/o/r/pull/7", repo: "o/r", draft: false, existed: false });
});

test("PF4 pull_request after a push with nothing new: counted as pushed, the pull request opens now", async () => {
  const s = script([say("", [call("push_branch", {}, "p1")]), say("", [call("pull_request", { title: "Add login", body: "" })]), say("done")]);
  let n = 0;
  const pushNow = async () => (n++ === 0 ? { ok: true, pushed: true, changed: true, sha: "94ae9a5000" } : { ok: true, pushed: false, changed: false });
  const api = envCaller({ url: "https://x/api/coder/model", headers: {} }, async () => Response.json({ number: 3, url: "https://github.com/o/r/pull/3", repo: "o/r" }));
  const r = await runCoder({ send: s.send, exec: async () => ({ code: 0, output: "" }), pushNow, envApi: api }, { text: "push then PR" });
  assert.match(lastTool(s.seen), /^ok: Pull request #3 opened/);
  assert.equal(r.prRequest, undefined);
  assert.deepEqual(r.midNotes, ["Pull request #3 opened: https://github.com/o/r/pull/3"]);
});

test("PF5 the server gave no answer: the pull request is queued for the turn's end, never forgotten", async () => {
  const s = script([say("", [call("pull_request", { title: "T", body: "" })]), say("ok")]);
  const api = envCaller({ url: "https://x/api/coder/model", headers: {} }, async () => Response.json({}));
  const r = await runCoder({ send: s.send, exec: async () => ({ code: 0, output: "" }), pushNow: async () => ({ ok: true, pushed: false }), envApi: api }, { text: "pr" });
  assert.deepEqual(r.prRequest, { title: "T", body: "" });
  assert.match(lastTool(s.seen), /opens when your turn ends/);
});

test("PF6 the turn's end: a queued pull request after mid-turn pushes (the last with nothing new) opens", async () => {
  const R = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const m = new Map();
  const bucket = { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, String(v)); }, async delete(k) { m.delete(k); }, async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
  const UID = "user-1234567890abcdef", id = "shop-pf6";
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", APP_ORIGIN: "https://gofarther.dev", CODER_BUCKET: bucket };
  await saveConnection(env, bucket, UID, { access: "ghu_user" }, "ana");
  for (const midPushes of [[{ sha: "94ae9a5", changed: true, pushed: true, edited: [] }, { sha: "", changed: false, pushed: false, edited: [] }], [{ sha: "", changed: false, pushed: false, edited: [] }]]) {
    const result = { status: "done", summary: "Added login.", messages: [], dirty: false, midPushes, prRequest: { title: "Add login", body: "" } };
    const gh = [];
    const deps = { fetchFn: async (u, init = {}) => { gh.push([new URL(String(u)).pathname, init.method || "GET"]); return init.method === "POST" && new URL(String(u)).pathname === "/repos/ana/shop/pulls" ? Response.json({ number: 9, html_url: "https://github.com/ana/shop/pull/9" }, { status: 201 }) : new Response("{}", { status: 404 }); }, authUser: async () => ({ id: UID, email: "me@x.y" }), container: () => ({ fetch: async (req) => { const p = new URL(req.url).pathname; return p === "/state" ? Response.json({ running: false, result, events: [], next: 2 }) : p === "/claim" ? Response.json({ ok: true, events: [{ type: "user", text: "pr" }, { type: "done", text: "Done." }], result }) : p === "/push" ? Response.json({ ok: true, local: true, changed: false, unpushed: 0 }) : Response.json({ ok: true }); } }) };
    m.delete("coder/" + UID + "/" + id + "/events.json");
    await bucket.put("coder/" + UID + "/" + id + "/meta.json", JSON.stringify({ id, repo: "ana/shop", base: "main", branch: "coder/" + id, turn: 1, saved: 0, status: "running", at: Date.now(), commits: [] }));
    await R.handleCoder(new Request("https://gofarther.dev/api/coder/projects/" + id + "/state?since=2"), env, {}, deps);
    assert.ok(gh.some(([p, mth]) => p === "/repos/ana/shop/pulls" && mth === "POST"), "the queued pull request is opened");
    const meta = JSON.parse(m.get("coder/" + UID + "/" + id + "/meta.json"));
    assert.equal(meta.pr && meta.pr.number, 9);
  }
});
