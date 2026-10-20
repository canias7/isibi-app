// The conversation's window and its auto-compaction at 75% (2026-10-20, owner:
// "lets do the context window, maybe auto compact at 75 percent").
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { planWindow, compactSplit, compact, turnsOf, readSummary, COMPACT_AT, KEEP_RECENT, CHARS_PER_TOKEN, compactRequest } from "../builder/chat-context.mjs";
import { converseRequest } from "../builder/site-converse.mjs";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";
const W = await loadWorkerModule();
const worker = W.default, api = W.chatStoreApi;

const msg = (r, t, extra = {}) => ({ r, t, ...extra });
const many = (n, len) => Array.from({ length: n }, (_, i) => msg(i % 2 ? "a" : "u", String(i).padEnd(len, "x")));

test("compaction is at 75% of the window", () => assert.equal(COMPACT_AT, 0.75));

test("every message is shown under the line: nothing dropped, oldest first", () => {
  const msgs = many(200, 100);
  const p = planWindow({ msgs, window: 1_000_000, fixedChars: 1000 });
  assert.equal(p.turns.length, 200, "the 30-turn window is gone");
  assert.equal(p.turns[0].text, msgs[0].t);
  assert.equal(p.over, false);
});

test("held replies, empty messages and compaction notes are not turns; offered answers are said", () => {
  const t = turnsOf([msg("u", "hi"), msg("a", "…", { held: { x: 1 } }), msg("a", "  "), msg("a", "note", { compact: true }), msg("a", "Pick", { opts: ["A", "B"] })]);
  assert.deepEqual(t.map((x) => x.text), ["hi", "Pick\n(Answers offered: A / B)"]);
});

test("the message being sent goes once, as the message", () => {
  const p = planWindow({ msgs: [msg("u", "one"), msg("a", "two"), msg("u", "three")], window: 1000, current: "three" });
  assert.deepEqual(p.turns.map((t) => t.text), ["one", "two"]);
});

test("over 75% it is over the line, under it is not, measured on the whole call", () => {
  const win = 1000; // tokens: 3,000 characters
  const under = planWindow({ msgs: [msg("u", "x".repeat(1500))], window: win, fixedChars: 600 });
  assert.equal(under.over, false);
  const over = planWindow({ msgs: [msg("u", "x".repeat(1500))], window: win, fixedChars: 900 });
  assert.equal(over.over, true, Math.round(over.used * 100) + "%");
});

test("a compaction keeps the newest turns whole, up to 15% of the window, and summarizes the rest", () => {
  const msgs = many(100, 300);
  const plan = planWindow({ msgs, window: 10_000, fixedChars: 0 });
  const split = compactSplit(plan);
  const keptChars = plan.turns.slice(split.older.length).reduce((n, t) => n + t.text.length, 0);
  assert.ok(keptChars <= 10_000 * KEEP_RECENT * CHARS_PER_TOKEN, keptChars);
  assert.ok(split.older.length > 0 && split.older.length < 100);
  assert.equal(split.upTo, plan.turns[split.older.length].index, "the summary stops where the kept turns start");
});

test("after a compaction the call carries the summary and only the messages after it", async () => {
  const msgs = many(100, 300);
  const plan = planWindow({ msgs, window: 10_000, fixedChars: 0 });
  let sent = null;
  const c = await compact({ send: async (req) => { sent = req; return { content: [{ type: "text", text: "SUMMARY" }], usage: { input_tokens: 9, output_tokens: 3 } }; } }, { plan, model: "grok-4.6" });
  assert.equal(c.ok, true);
  assert.ok(sent.messages[0].content.includes(msgs[0].t), "the oldest message is summarized");
  const after = planWindow({ msgs, summary: c.summary, window: 10_000 });
  assert.equal(after.summary.text, "SUMMARY");
  assert.equal(after.turns[0].index, c.summary.upTo);
  assert.ok(after.used < plan.used);
  assert.deepEqual(c.usage, { in: 9, out: 3, cacheRead: 0, cacheWrite: 0, model: "grok-4.6" }, "every token of it is billed");
  const req = converseRequest({ message: "next", history: { turns: after.turns, left: 0 }, summary: after.summary, model: "grok-4.6" });
  assert.match(req.messages[0].content.map((b) => b.text).join("\n"), /EARLIER IN THIS CONVERSATION[\s\S]*SUMMARY[\s\S]*THE CONVERSATION SO FAR/);
});

test("a second compaction folds the first summary in", () => {
  const r = compactRequest({ prior: { text: "OLD SUMMARY" }, older: [{ role: "user", text: "hi" }], model: "m" });
  assert.match(r.messages[0].content, /THE SUMMARY SO FAR[\s\S]*OLD SUMMARY[\s\S]*Owner: hi/);
});

test("a failed summary charges nothing", async () => {
  const plan = planWindow({ msgs: many(100, 300), window: 10_000 });
  assert.deepEqual((await compact({ send: async () => { throw new Error("down"); } }, { plan, model: "m" })).usage, null);
  assert.deepEqual((await compact({ send: async () => ({ content: [] }) }, { plan, model: "m" })).usage, null);
});

test("a summary that claims more messages than the chat has is not believed", () => {
  assert.equal(readSummary({ text: "s", upTo: 5 }, 4), null);
  assert.equal(readSummary({ text: "s", upTo: 0 }, 4), null);
  assert.deepEqual(readSummary({ text: "s", upTo: 4 }, 4).upTo, 4);
});

function bucket() {
  const m = new Map(); let n = 0;
  return {
    m,
    async get(k) { const v = m.get(k); return v ? { etag: v.etag, text: async () => v.body } : null; },
    async put(k, body, o = {}) {
      const cur = m.get(k), oi = o.onlyIf || {};
      if (oi.etagMatches && (!cur || cur.etag !== oi.etagMatches)) return null;
      if (oi.etagDoesNotMatch === "*" && cur) return null;
      const etag = "e" + (++n); m.set(k, { body: String(body), etag }); return { etag };
    },
    async delete(k) { m.delete(k); },
  };
}

test("SERVER: the window is read from the kept chat, compacted past 75%, and the summary is kept", async () => {
  const env = { SITES_BUCKET: bucket() };
  const msgs = many(4000, 300); // ~1.2M characters: over 75% of Grok's 500K tokens
  env.SITES_BUCKET.m.set("chat/u1/site_abcd.json", { body: JSON.stringify({ v: 1, rev: 3, msgs }), etag: "e0" });
  let calls = 0;
  const send = async () => { calls++; return { content: [{ type: "text", text: "THE SUMMARY" }], usage: { input_tokens: 100, output_tokens: 10 } }; };
  const w = await api.chatWindowFor(env, "u1", "site_abcd", { model: "grok-4.6", fixedChars: 20000, send });
  assert.equal(calls, 1); assert.equal(w.compacted, true);
  assert.equal(w.summary.text, "THE SUMMARY");
  assert.ok(w.plan.used < COMPACT_AT);
  const kept = JSON.parse(env.SITES_BUCKET.m.get("chat/u1/site_abcd.json").body);
  assert.equal(kept.summary.text, "THE SUMMARY"); assert.equal(kept.rev, 3, "the page's revision is untouched");
  const again = await api.chatWindowFor(env, "u1", "site_abcd", { model: "grok-4.6", fixedChars: 20000, send });
  assert.equal(calls, 1, "the next message reads the kept summary and does not compact again");
  assert.equal(again.summary.text, "THE SUMMARY");
  assert.equal(await api.chatWindowFor(env, "u2", "site_abcd", { model: "grok-4.6", send }), null, "another account's chat is never read");
});

test("SERVER: under the line nothing is compacted and nothing is charged", async () => {
  const env = { SITES_BUCKET: bucket() };
  env.SITES_BUCKET.m.set("chat/u1/site_abcd.json", { body: JSON.stringify({ v: 1, rev: 1, msgs: many(50, 100) }), etag: "e0" });
  const w = await api.chatWindowFor(env, "u1", "site_abcd", { model: "grok-4.6", send: async () => { throw new Error("must not be called"); } });
  assert.equal(w.compacted, false); assert.equal(w.usage, null); assert.equal(w.history.turns.length, 50);
});

const realFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = realFetch; });
const signIn = (uid) => { globalThis.fetch = async (u, o) => String(u).includes("/auth/v1/user") ? new Response(JSON.stringify({ id: uid }), { status: 200 }) : realFetch(u, o); };
const call = (env, method, path, body, tok = "t") => worker.fetch(new Request("https://gofarther.dev" + path, {
  method, headers: { ...(tok ? { Authorization: "Bearer " + tok } : {}), "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}),
}), env, { waitUntil() {}, passThroughOnException() {} });

test("SERVER: the page's write keeps the summary; the context route measures the conversation", async () => {
  const env = { SITES_BUCKET: bucket() }; signIn("u1");
  env.SITES_BUCKET.m.set("chat/u1/site_abcd.json", { body: JSON.stringify({ v: 1, rev: 1, msgs: many(10, 50), summary: { text: "S", upTo: 4, at: 1 } }), etag: "e0" });
  assert.equal((await call(env, "PUT", "/api/site/chat/site_abcd", { baseRev: 1, msgs: many(12, 50) })).status, 200);
  assert.equal(JSON.parse(env.SITES_BUCKET.m.get("chat/u1/site_abcd.json").body).summary.text, "S");
  const d = await (await call(env, "GET", "/api/site/chat/site_abcd/context?picker=grok")).json();
  assert.equal(d.ok, true); assert.equal(d.window, 500_000); assert.equal(d.compactAt, 0.75); assert.equal(d.summarized, 4);
  assert.equal(d.turns, 8); assert.ok(d.parts.summary > 0 && d.parts.conversation > 0 && d.parts.fixed > 0);
  assert.equal((await call(env, "GET", "/api/site/chat/site_abcd/context", null, "")).status, 401);
});

test("WIRING: the route reads the kept chat for the reply, bills the compaction, and tells the page", () => {
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(src, /rWin = ru && ru\.id \? await chatWindowFor\(env, ru\.id, rb\.chat,/);
  assert.match(src, /history: rWin \? rWin\.history : readHistory\(rb\.history\), summary: rWin \? rWin\.summary : null/);
  assert.match(src, /\+ \(rCompact \? pageCredits\(rCompact\) : 0\);/);
  assert.match(src, /compacted: rCompacted \? true : undefined,/);
  const page = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  assert.match(page, /chatFlushFor\(siteById\(origin\) \|\| site\) : Promise\.resolve\(\)\)\.then\(\(\) => apiFetch\('\/api\/site\/route'/);
  assert.match(page, /chat: \(typeof chatKeyOf === 'function' && chatKeyOf\(siteById\(origin\) \|\| site\)\) \|\| undefined,/);
  assert.match(page, /if \(d && d\.compacted === true\)/);
  assert.match(page, /'\/context\?picker='/);
});

// ── CACHING (2026-10-20, owner: "but the catching is in place too right?") ──
import { historyBlock, historyParts, requestChars } from "../builder/site-converse.mjs";
import { toXaiRequest } from "../builder/model-xai.mjs";
import { anthropicWire } from "../builder/build-call.mjs";

test("CACHE: each turn is its own block, the last marked, the new message after it; the words are the same", () => {
  const h = { turns: [{ role: "user", text: "one" }, { role: "assistant", text: "two" }, { role: "user", text: "three" }], left: 0 };
  assert.equal(historyParts(h).join("\n"), historyBlock(h), "the conversation reads exactly as it did");
  const gap = { turns: [{ role: "user", text: "one" }, { role: "assistant", text: "two", cut: true, full: 900 }], left: 3 };
  assert.equal(historyParts(gap).join("\n"), historyBlock(gap), "with parts not shown, it still reads exactly as it did");
  const req = converseRequest({ message: "now", history: h, model: "claude-sonnet-5", cacheKey: "chat-site_abcd" });
  const c = req.messages[0].content;
  const marked = c.filter((b) => b.cache_control);
  assert.equal(marked.length, 1);
  assert.equal(marked[0].text, "Owner: three", "the mark is on the newest turn of the conversation");
  assert.match(c[c.length - 1].text, /THEIR LATEST MESSAGE\nnow/, "the new message comes after the cached part");
  assert.ok(req.system[0].cache_control, "the instructions are cached too");
  // THE NEXT REPLY STARTS WITH THE SAME BLOCKS, so the cache is read.
  const h2 = { turns: [...h.turns, { role: "assistant", text: "four" }, { role: "user", text: "five" }], left: 0 };
  const c2 = converseRequest({ message: "later", history: h2, model: "claude-sonnet-5" }).messages[0].content;
  const strip = (b) => b.text;
  assert.deepEqual(c2.slice(0, c.length - 1).map(strip), c.slice(0, -1).map(strip), "the earlier request's blocks are the next one's prefix");
  assert.ok(requestChars(req) > 0);
});

test("CACHE: without a conversation the message stays one string, as before", () => {
  assert.equal(typeof converseRequest({ message: "hi", model: "m" }).messages[0].content, "string");
});

test("CACHE: Grok gets the chat's own cache key; Anthropic never sees our field", () => {
  const h = { turns: [{ role: "user", text: "one" }], left: 0 };
  const req = converseRequest({ message: "now", history: h, model: "grok-4.6", cacheKey: "chat-site_abcd" });
  assert.equal(toXaiRequest(req).body.prompt_cache_key, "gofarther-chat-site_abcd");
  assert.equal(Object.hasOwn(anthropicWire(req), "cacheKey"), false);
  assert.ok(anthropicWire(req).messages[0].content.some((b) => b.cache_control), "the cache marks still go to Anthropic");
  const plain = { model: "m", messages: [] };
  assert.equal(anthropicWire(plain), plain);
});

test("CACHE WIRING: the reply is sent its chat's key, and the Anthropic call strips it", () => {
  const src = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(src, /cacheKey: typeof rb\.chat === "string" && \/\^\[A-Za-z0-9_-\]\{4,80\}\$\/\.test\(rb\.chat\) \? "chat-" \+ rb\.chat : "",/);
  const call = readFileSync(new URL("../builder/build-call.mjs", import.meta.url), "utf8");
  assert.match(call, /JSON\.stringify\(streaming \? \{ \.\.\.anthropicWire\(req\), stream: true \} : anthropicWire\(req\)\)/);
});
