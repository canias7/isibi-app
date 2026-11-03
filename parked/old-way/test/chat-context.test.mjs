// PARKED (2026-11-03, park-old-way): the old-way half of test/chat-context.test.mjs — it tests the old way (router, lanes, GF_OLD_LANES). Not run by the suite (test/*.test.mjs); see parked/old-way/README.md.
// The conversation's window and its auto-compaction at 75% (2026-10-20, owner:
// "lets do the context window, maybe auto compact at 75 percent").
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { planWindow, compactSplit, compact, turnsOf, readSummary, COMPACT_AT, KEEP_RECENT, CHARS_PER_TOKEN, compactRequest } from "../../../builder/chat-context.mjs";
import { converseRequest } from "../../../builder/site-converse.mjs";
import { loadWorkerModule } from "../../../test/fixtures/worker-harness.mjs";
const W = await loadWorkerModule();
const worker = W.default, api = W.chatStoreApi;

const msg = (r, t, extra = {}) => ({ r, t, ...extra });
const many = (n, len) => Array.from({ length: n }, (_, i) => msg(i % 2 ? "a" : "u", String(i).padEnd(len, "x")));

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

const realFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = realFetch; });
const signIn = (uid) => { globalThis.fetch = async (u, o) => String(u).includes("/auth/v1/user") ? new Response(JSON.stringify({ id: uid }), { status: 200 }) : realFetch(u, o); };
const call = (env, method, path, body, tok = "t") => worker.fetch(new Request("https://gofarther.dev" + path, {
  method, headers: { ...(tok ? { Authorization: "Bearer " + tok } : {}), "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}),
}), env, { waitUntil() {}, passThroughOnException() {} });

// ── CACHING (2026-10-20, owner: "but the catching is in place too right?") ──
import { historyBlock, historyParts, requestChars } from "../../../builder/site-converse.mjs";
import { toXaiRequest } from "../../../builder/model-xai.mjs";
import { anthropicWire } from "../../../builder/build-call.mjs";

// ── CACHING ON EVERY CALL (2026-10-20, owner: "go look for the caching and fix") ──
import { promptKey } from "../../../builder/model-xai.mjs";

// ── THE ROUTER READS THE KEPT CHAT; A TEST WINDOW (2026-10-20, owner: "do 1 and 2") ──
import { routeMessage, askRequest, KEPT_TURNS } from "../builder/site-ask.mjs";

test("ROUTER: given the kept chat, it is shown the summary and up to 40 recent messages, not 8", async () => {
  const turns = Array.from({ length: 60 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", text: "turn " + i }));
  let sent = null;
  const send = async (req) => { sent = req; return { content: [{ type: "tool_use", name: "route", input: { intent: "ask", answer: "ok" } }], usage: {} }; };
  await routeMessage({ send }, { message: "do the thing we said", site: { name: "x", pages: ["/"] }, hasSite: true, kept: { turns, summary: { text: "THEY WANT A BLUE HEADER", upTo: 10 } } }).catch(() => null);
  const text = sent.messages[0].content;
  assert.match(text, /EARLIER IN THIS CONVERSATION[\s\S]*THEY WANT A BLUE HEADER[\s\S]*THE CONVERSATION SO FAR/);
  assert.equal(KEPT_TURNS, 40);
  assert.ok(text.includes("turn 59") && text.includes("turn 20\n"), "the newest 40 turns are shown");
  assert.ok(!text.includes("turn 19\n"), "older ones are left to the summary");
  let plain = null;
  await routeMessage({ send: async (req) => { plain = req; return { content: [], usage: {} }; } }, { message: "hi", site: { name: "x", pages: ["/"] }, hasSite: true, history: turns }).catch(() => null);
  assert.ok(!plain.messages[0].content.includes("turn 40\n"), "without the kept chat the page's short window stays");
  assert.ok(!/EARLIER IN THIS CONVERSATION/.test(askRequest({ message: "m", site: { name: "x", pages: [] } }).messages[0].content));
});

test("ROUTER: the window's start moves in steps of 20, so the next message's prompt starts the same", async () => {
  const mk = (n) => Array.from({ length: n }, (_, i) => ({ role: i % 2 ? "assistant" : "user", text: "turn " + i }));
  const shown = async (n) => { let sent = null; await routeMessage({ send: async (req) => { sent = req; return { content: [], usage: {} }; } }, { message: "next", site: { name: "x", pages: ["/"] }, hasSite: true, kept: { turns: mk(n) } }).catch(() => null); return sent.messages[0].content; };
  const a = await shown(61), b = await shown(62), c = await shown(80);
  const head = (t) => t.slice(0, t.indexOf("turn 60"));
  assert.equal(head(a), head(b), "one more message changed what comes before it, so the cache cannot match");
  assert.ok(a.includes("Owner: turn 20\n") && !a.includes("Owner: turn 18\n"), "the window starts at turn 20");
  assert.ok(c.includes("Owner: turn 40\n") && !c.includes("Owner: turn 38\n"), "at 80 messages it has stepped to 40");
  assert.match(a, /20 earlier messages are not shown/, "the messages before the window are said, never passed off as the whole");
});
