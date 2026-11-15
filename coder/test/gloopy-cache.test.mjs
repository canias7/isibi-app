// GLOOPY'S CACHE, FIXED THE WAY CODER'S WAS (the owner, 2026-11-15: "yes pls"): Gloopy's context (the time of day, its notes
// about the owner, its schedules, permissions and the rest) is told in its conversation, not in its system message, so the
// system message is the same at every message; its saved chat keeps each answer whole (its pictures still left out); and the
// Worker keeps what each of its messages used (`usage`), as Coder's chats. So each message's request starts with the last
// one's, and Grok's cache serves it.
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCoder } from "../container/coder-agent.mjs";
import { GLOOPY_SYSTEM, GLOOPY_TOOLS, GLOOPY_HELD_BACK, gloopyContext, gloopyContextPieces, GLOOPY_CONTEXT_KEYS } from "../container/gloopy-agent.mjs";
import { CONTEXT_INTRO, STATE_HEAD, rereadHead } from "../container/coder-context.mjs";
import { ownerWords } from "../container/gloopy-check.mjs";

const call = (name, args, id) => ({ id, type: "function", function: { name, arguments: JSON.stringify(args) } });
const say = (content, calls = []) => ({ message: { role: "assistant", content, ...(calls.length ? { tool_calls: calls } : {}) }, usage: { in: 100, out: 5, cached: 60 } });
const scripted = (steps) => { let i = 0; const seen = []; return { seen, send: async (req) => { seen.push(JSON.parse(JSON.stringify(req))); return steps[Math.min(i++, steps.length - 1)]; } }; };
const T0 = Date.UTC(2026, 10, 15, 9, 0), T1 = Date.UTC(2026, 10, 15, 9, 42);
const ctxAt = (now, extra = {}) => gloopyContextPieces({ memFile: "/srv/notes/MEMORY.md", memory: "Name: Ana", now, ownerZone: "Europe/Lisbon", workDir: "/home/dev/gloopy", ...extra });
// Gloopy's own job as its machine starts it (server.mjs gloopyOpts), its context as pieces.
const GLOOPY = { system: GLOOPY_SYSTEM, tools: GLOOPY_TOOLS, holdBack: GLOOPY_HELD_BACK, nudges: false, who: "Gloopy", github: false, hooks: [], checker: false, rules: null, sessionRules: null };
async function job(steps, extra = {}) {
  const g = scripted(steps);
  const out = await runCoder({ send: g.send, exec: async () => ({ code: 0, output: extra.output || "" }), emit: () => {} }, { text: "go", ...GLOOPY, context: ctxAt(T0), ...extra });
  return { out, seen: g.seen };
}
const userTexts = (req) => req.messages.filter((m) => m.role === "user").map((m) => String(m.content));

test("GH-C1 (2026-11-15) the context's pieces: the same text as before, each part with its key", () => {
  const opts = { memFile: "/m.md", memory: "Name: Ana", now: T0, ownerZone: "Europe/Lisbon", awayH: 2, background: true, schedulesPaused: true, browser: false, workDir: "/w", machine: "THIS MACHINE: x" };
  const pieces = gloopyContextPieces(opts);
  assert.equal(GLOOPY_CONTEXT_KEYS.length, 19);
  assert.deepEqual(pieces.map((p) => p.key), [...GLOOPY_CONTEXT_KEYS], "every part says something here");
  assert.equal(pieces.map((p) => p.text).join(""), gloopyContext(opts), "the same text, piece by piece");
  assert.equal(pieces.find((p) => p.key === "i:YOUR NOTES ABOUT THE OWNER").text.trim().split("\n")[0], "YOUR NOTES ABOUT THE OWNER, kept between conversations, in /m.md:");
  assert.match(pieces.find((p) => p.key === "s:TODAY").text, /it is Sun 15 Nov, 09:00 there now/);
});

test("GH-C2 Gloopy's system message is its instructions alone, the same at every message; its context comes before the owner's message as Coder's does", async () => {
  const a = await job([say("Hi Ana.")]);
  assert.equal(a.seen[0].messages[0].content, GLOOPY_SYSTEM);
  const texts = userTexts(a.seen[0]);
  assert.ok(texts[0].startsWith("(Note from Coder's app, not the owner:\n" + CONTEXT_INTRO + "\n"), "the whole context first");
  assert.match(texts[0], /YOUR NOTES ABOUT THE OWNER[^\n]*:\nName: Ana/);
  assert.match(texts[0], /it is Sun 15 Nov, 09:00 there now/);
  assert.ok(texts.indexOf("go") > 0, "then the owner's message (tool search's note after it, as in Coder's chats)");
  // The next message, 42 minutes later: the same system message, and only the time is told again.
  const g = scripted([say("Still here.")]);
  await runCoder({ send: g.send, exec: async () => ({ code: 0, output: "" }), emit: () => {} }, { ...GLOOPY, text: "and now?", messages: a.out.messages, context: ctxAt(T1) });
  assert.equal(g.seen[0].messages[0].content, a.seen[0].messages[0].content, "the same system message");
  const later = userTexts(g.seen[0]);
  const note = later.at(-2);
  assert.ok(note.startsWith("(Note from Coder's app, not the owner:\n" + STATE_HEAD + "\n"), note.slice(0, 200));
  assert.match(note, /it is Sun 15 Nov, 09:42 there now/);
  assert.doesNotMatch(note, /YOUR NOTES ABOUT THE OWNER|YOUR PERMISSIONS|NETWORK:/, "nothing else told again");
  assert.equal(later.at(-1), "and now?");
});

test("GH-C3 each message's request starts with the last one's, byte for byte (Grok's cache), a 15,000-character answer kept whole", async () => {
  const big = "0123456789".repeat(1500);
  const a = await job([say("", [call("bash", { command: "cat big.txt" }, "b1")]), say("Done.")], { output: big });
  const saved = a.out.messages.find((m) => m.role === "tool" && m.tool_call_id === "b1");
  assert.ok(saved && saved.content.includes(big), "the whole answer is in the saved chat");
  const g = scripted([say("ok")]);
  await runCoder({ send: g.send, exec: async () => ({ code: 0, output: "" }), emit: () => {} }, { ...GLOOPY, text: "next", messages: a.out.messages, context: ctxAt(T1) });
  const last = a.seen.at(-1).messages, next = g.seen[0].messages;
  assert.deepEqual(next.slice(0, last.length), last, "the new request begins with the last request of the message before");
  assert.equal(next[last.length].role, "assistant", "then that message's answer");
  assert.equal(next[last.length].content, "Done.");
});

test("GH-C4 its notes about the owner are told again only when its machine started again (or after a summary), as Claude Code's memory", async () => {
  const a = await job([say("Hi.")], { context: ctxAt(T0, { memory: "" }) });
  const same = scripted([say("ok")]);
  await runCoder({ send: same.send, exec: async () => ({ code: 0, output: "" }), emit: () => {} }, { ...GLOOPY, text: "next", messages: a.out.messages, context: ctxAt(T0, { memory: "Name: Ana" }) });
  assert.doesNotMatch(userTexts(same.seen[0]).slice(-3).join("\n"), /Name: Ana/, "not in the same session");
  const back = scripted([say("ok")]);
  await runCoder({ send: back.send, exec: async () => ({ code: 0, output: "" }), emit: () => {} }, { ...GLOOPY, text: "next", resumed: true, messages: a.out.messages, context: ctxAt(T0, { memory: "Name: Ana" }) });
  const note = userTexts(back.seen[0]).at(-2);
  assert.ok(note.includes(rereadHead("session_start")), note.slice(0, 300));
  assert.match(note, /YOUR NOTES ABOUT THE OWNER[^\n]*:\nName: Ana/);
});

test("GH-C5 the notes are never the owner's words for Gloopy's checks; pictures stay out of the saved chat", async () => {
  const a = await job([say("Hi.")]);
  assert.deepEqual(ownerWords(a.out.messages), ["go"]);
  const pic = { role: "user", content: "[screenshot]", images: ["data:image/png;base64,iVBORw0KGgo="] };
  const g = scripted([say("seen")]);
  const out = await runCoder({ send: g.send, exec: async () => ({ code: 0, output: "" }), emit: () => {} }, { ...GLOOPY, text: "look", messages: [...a.out.messages, pic], context: ctxAt(T1) });
  assert.ok(!out.messages.some((m) => Array.isArray(m.images)), "a note in place of each picture, as before");
});

test("GH-C6 a helper (its context a text) and a caller with a text keep the context in the system message, and the cut saved chat", async () => {
  const big = "x".repeat(15000);
  const g = scripted([say("", [call("bash", { command: "cat big.txt" }, "b1")]), say("Done.")]);
  const out = await runCoder({ send: g.send, exec: async () => ({ code: 0, output: big }), emit: () => {} }, { ...GLOOPY, holdBack: null, text: "go", context: "TODAY is 2026-11-15 (UTC)." });
  assert.ok(g.seen[0].messages[0].content.endsWith("\n\nTODAY is 2026-11-15 (UTC)."), "in the system message");
  const saved = out.messages.find((m) => m.role === "tool" && m.tool_call_id === "b1");
  assert.ok(saved.content.length < 13000 && /left out of the saved chat/.test(saved.content), "cut as before");
});

test("GH-C7 connectors waiting for their sign-in are told in the conversation, not the system message", async () => {
  const a = await job([say("Hi.")], { connectorsWaiting: ["Linear"], mcp: async () => ({ text: "", isError: false }) });
  assert.equal(a.seen[0].messages[0].content, GLOOPY_SYSTEM);
  assert.match(userTexts(a.seen[0])[0], /CONNECTORS NOT SIGNED IN YET: Linear\./);
});

test("GH-C8 the Worker keeps what each of Gloopy's messages used, as Coder's chats", async () => {
  const { handleCoder, GLOOPY_ID } = await import("../src/coder-routes.mjs");
  const { createApp } = await import("../container/server.mjs");
  const roots = { root: await mkdtemp(join(tmpdir(), "gc-rw-")), gitRoot: await mkdtemp(join(tmpdir(), "gc-rg-")), memRoot: await mkdtemp(join(tmpdir(), "gc-rm-")), bgRoot: await mkdtemp(join(tmpdir(), "gc-rb-")) };
  const srv = http.createServer(createApp({ ...roots, send: async () => say("Hello.") }));
  await new Promise((r) => srv.listen(0, r));
  const base = "http://127.0.0.1:" + srv.address().port;
  const store = new Map();
  const bucket = { m: store, async get(k) { return store.has(k) ? { text: async () => store.get(k), json: async () => JSON.parse(store.get(k)), arrayBuffer: async () => new TextEncoder().encode(store.get(k)).buffer, size: store.get(k).length } : null; }, async put(k, v) { store.set(k, typeof v === "string" ? v : new TextDecoder().decode(v)); }, async delete(k) { for (const x of [].concat(k)) store.delete(x); }, async list({ prefix = "" } = {}) { return { objects: [...store.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; }, async head(k) { return store.has(k) ? { size: store.get(k).length } : null; } };
  const env = { CODER_ON: "on", CODER_USERS: "me@x.y", CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_BUCKET: bucket };
  const deps = { fetchFn: async () => new Response("{}", { status: 404 }), authUser: async () => ({ id: "u1", email: "me@x.y" }),
    container: () => ({ fetch: (req) => fetch(base + new URL(req.url).pathname + new URL(req.url).search, { method: req.method, headers: req.headers, body: req.method === "POST" ? req.body : undefined, duplex: "half" }) }) };
  const go = (path, init = {}) => handleCoder(new Request("https://coder.gofarther.dev/api/coder/" + path, { ...init, headers: { Authorization: "Bearer ok", "content-type": "application/json" } }), env, {}, deps);
  try {
    await go("gloopy");
    const sent = await go("projects/" + GLOOPY_ID + "/message", { method: "POST", body: JSON.stringify({ text: "Hi" }) });
    assert.equal(sent.status, 200, await sent.clone().text());
    let st;
    for (let i = 0; i < 200; i++) { st = await (await go("projects/" + GLOOPY_ID + "/state?since=0")).json(); if (!st.running) break; await new Promise((r) => setTimeout(r, 50)); }
    const p = (await (await go("projects/" + GLOOPY_ID)).json()).project;
    assert.equal(p.status, "idle");
    assert.ok(p.usage && p.usage.calls >= 1 && p.usage.in >= 100 && p.usage.cached >= 60, JSON.stringify(p.usage));
    assert.equal(p.usage.turn, p.turn);
  } finally { srv.close(); }
});
