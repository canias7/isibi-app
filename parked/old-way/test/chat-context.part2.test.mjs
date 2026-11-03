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

test("WIRING: the route hands the router the kept chat, and the reply a test window", () => {
  const src = readFileSync(new URL("../../../worker.js", import.meta.url), "utf8");
  assert.match(src, /rKept = await chatRouterWindow\(env, ru\.id, rb\.chat, rb\.message\)/);
  assert.match(src, /history: rb\.history,\s*kept: rKept,/);
  assert.match(src, /window: testWindowFor\(ru\.id, rb\.testWindow\) \}\) : null;/);
});
