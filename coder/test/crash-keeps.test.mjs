// A CRASH IN THE MIDDLE OF A JOB KEEPS THE CHAT (the audit, 2026-11-20; Claude Code writes its conversation as it goes, so a
// crash keeps it and the next start picks it up). No model or GitHub is called.
import test from "node:test";
import assert from "node:assert/strict";
import { crashedConvo } from "../container/server.mjs";
import * as R from "../src/coder-routes.mjs";
import { saveConnection } from "../src/coder-github.mjs";

test("CK1 the machine hands back the conversation as far as it got, its unanswered tool calls closed", () => {
  const given = [{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }];
  const now = [...given, { role: "user", content: "fix it" }, { role: "assistant", content: "", tool_calls: [{ id: "a", type: "function", function: { name: "bash", arguments: "{}" } }, { id: "b", type: "function", function: { name: "read", arguments: "{}" } }] }, { role: "tool", tool_call_id: "a", content: "ok" }];
  const out = crashedConvo(now, given);
  assert.equal(out.length, 6);
  assert.deepEqual(out.slice(0, 5), now);
  assert.equal(out[5].tool_call_id, "b");
  assert.match(out[5].content, /stopped because of an unexpected error/);
  // Nothing from the loop yet: the conversation the job was given, never an empty one.
  assert.deepEqual(crashedConvo(null, given), given);
  assert.deepEqual(crashedConvo([], given), given);
});

test("CK2 a crashed job's commit gets a plain title, not the raw error", () => {
  assert.equal(R.turnTitle({ status: "error", summary: "TypeError: Cannot read properties of undefined (reading 'x')" }), R.CRASH_TITLE);
  assert.equal(R.turnTitle({ status: "done", summary: "Added login. More." }), "Added login.");
});

test("CK3 the Worker never saves a crashed job's empty conversation over the chat: the saved one is kept, with a note", async () => {
  const m = new Map();
  const bucket = { m, async get(k) { return m.has(k) ? { text: async () => m.get(k), json: async () => JSON.parse(m.get(k)) } : null; }, async put(k, v) { m.set(k, String(v)); }, async delete(k) { m.delete(k); }, async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
  const UID = "user-1234567890abcdef", id = "shop-ck3";
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", APP_ORIGIN: "https://gofarther.dev", CODER_BUCKET: bucket };
  await saveConnection(env, bucket, UID, { access: "ghu_user" }, "ana");
  const savedBefore = [{ role: "user", content: "first" }, { role: "assistant", content: "one" }, { role: "user", content: "second" }, { role: "assistant", content: "two" }];
  m.set("coder/" + UID + "/" + id + "/messages.json", JSON.stringify(savedBefore));
  const result = { status: "error", messages: [], summary: "TypeError: boom", edited: ["a.js"] };
  const pushed = [];
  const deps = { fetchFn: async () => new Response("{}", { status: 404 }), authUser: async () => ({ id: UID, email: "me@x.y" }), container: () => ({ fetch: async (req) => { const p = new URL(req.url).pathname; if (p === "/push") pushed.push(await req.clone().json()); return p === "/state" ? Response.json({ running: false, result, events: [], next: 2 }) : p === "/claim" ? Response.json({ ok: true, events: [{ type: "user", text: "third" }, { type: "error", text: "Coder stopped because of an unexpected error: TypeError: boom" }], result }) : p === "/push" ? Response.json({ ok: true, local: true, changed: true, sha: "abcdef1", unpushed: 1 }) : Response.json({ ok: true }); } }) };
  m.set("coder/" + UID + "/" + id + "/meta.json", JSON.stringify({ id, repo: "ana/shop", base: "main", branch: "coder/" + id, turn: 3, saved: 2, status: "running", at: Date.now(), commits: [] }));
  await R.handleCoder(new Request("https://gofarther.dev/api/coder/projects/" + id + "/state?since=2"), env, {}, deps);
  const after = JSON.parse(m.get("coder/" + UID + "/" + id + "/messages.json"));
  assert.deepEqual(after.slice(0, 4), savedBefore, "the saved conversation is kept");
  assert.ok(after.some((x) => x.appNote && /unexpected error \(TypeError: boom\)/.test(x.content)));
  assert.equal(pushed.length, 1); assert.equal(pushed[0].message, R.CRASH_TITLE);
  const meta = JSON.parse(m.get("coder/" + UID + "/" + id + "/meta.json"));
  assert.equal(meta.commits[0].title, R.CRASH_TITLE);
});
