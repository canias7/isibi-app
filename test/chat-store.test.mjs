// The chat kept on the server (2026-10-20, owner: "nothing can be local, it
// needs to be seen from every device"). The real route, end to end, over an
// in-memory bucket, with the sign-in answered by a stubbed GoTrue.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";
const W = await loadWorkerModule();
const worker = W.default, chatStoreApi = W.chatStoreApi;

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
function signIn(uid) {
  globalThis.fetch = async (u, o) => String(u).includes("/auth/v1/user")
    ? new Response(JSON.stringify({ id: uid, email: uid + "@x.test" }), { status: 200, headers: { "Content-Type": "application/json" } })
    : realFetch(u, o);
}
const call = (env, method, chat, body, tok = "t") => worker.fetch(new Request("https://gofarther.dev/api/site/chat/" + chat, {
  method, headers: { ...(tok ? { Authorization: "Bearer " + tok } : {}), "Content-Type": "application/json" },
  ...(body ? { body: JSON.stringify(body) } : {}),
}), env, { waitUntil() {}, passThroughOnException() {} });

test.afterEach(() => { globalThis.fetch = realFetch; });

test("signed out is refused, and nothing is stored", async () => {
  const env = { SITES_BUCKET: bucket() };
  const r = await call(env, "GET", "site_abcd", null, "");
  assert.equal(r.status, 401);
  assert.equal(env.SITES_BUCKET.m.size, 0);
});

test("a chat written on one device is read back on another, under the account's own key", async () => {
  const env = { SITES_BUCKET: bucket() }; signIn("u1");
  const none = await (await call(env, "GET", "site_abcd")).json();
  assert.equal(none.ok, true); assert.equal(none.chat, null);
  const w = await call(env, "PUT", "site_abcd", { baseRev: 0, msgs: [{ role: "user", text: "a bakery" }], name: "Bakery", slug: "bakery-1" });
  assert.equal(w.status, 200); assert.equal((await w.json()).rev, 1);
  assert.deepEqual([...env.SITES_BUCKET.m.keys()], ["chat/u1/site_abcd.json"]);
  const back = await (await call(env, "GET", "site_abcd")).json();
  assert.equal(back.chat.rev, 1); assert.equal(back.chat.name, "Bakery");
  assert.deepEqual(back.chat.msgs, [{ role: "user", text: "a bakery" }]);
  signIn("u2");
  assert.equal((await (await call(env, "GET", "site_abcd")).json()).chat, null, "another account never reads it");
});

test("a write over an older revision is refused with the newer copy", async () => {
  const env = { SITES_BUCKET: bucket() }; signIn("u1");
  await call(env, "PUT", "site_abcd", { baseRev: 0, msgs: [{ t: 1 }] });
  await call(env, "PUT", "site_abcd", { baseRev: 1, msgs: [{ t: 1 }, { t: 2 }] });
  const stale = await call(env, "PUT", "site_abcd", { baseRev: 1, msgs: [{ t: 1 }, { t: 3 }] });
  assert.equal(stale.status, 409);
  const d = await stale.json();
  assert.equal(d.chat.rev, 2); assert.deepEqual(d.chat.msgs, [{ t: 1 }, { t: 2 }]);
});

test("a chat id the page could not have minted is refused, not read", async () => {
  const env = { SITES_BUCKET: bucket() }; signIn("u1");
  for (const id of ["", "ab", "a.b.c.d", "x".repeat(81)]) assert.equal((await call(env, "GET", id)).status, 400, id);
  assert.equal(env.SITES_BUCKET.m.size, 0);
});

test("a malformed write is refused, and delete clears it", async () => {
  const env = { SITES_BUCKET: bucket() }; signIn("u1");
  for (const bad of [{ msgs: [] }, { baseRev: -1, msgs: [] }, { baseRev: 0, msgs: "x" }, { baseRev: 0, msgs: [1] }]) {
    assert.equal((await call(env, "PUT", "site_abcd", bad)).status, 400, JSON.stringify(bad));
  }
  await call(env, "PUT", "site_abcd", { baseRev: 0, msgs: [] });
  assert.equal(env.SITES_BUCKET.m.size, 1);
  await call(env, "DELETE", "site_abcd");
  assert.equal(env.SITES_BUCKET.m.size, 0);
});

test("readChatPut keeps only the last messages, and never coerces", () => {
  const { readChatPut, CHAT_MAX_MSGS } = chatStoreApi;
  const r = readChatPut({ baseRev: 0, msgs: Array.from({ length: CHAT_MAX_MSGS + 5 }, (_, i) => ({ i })), name: 5 });
  assert.equal(r.msgs.length, CHAT_MAX_MSGS); assert.equal(r.msgs[0].i, 5); assert.equal(r.name, "");
  assert.equal(readChatPut({ baseRev: "0", msgs: [] }), null);
});

test("the page reads the chat on open, writes it after reading, and deletes it with its site", () => {
  const src = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  const open = src.indexOf("function openProject("), save = src.indexOf("function sitesSave(");
  assert.ok(open > 0 && save > 0);
  assert.match(src.slice(open, open + 3000), /chatPull\(os\)/);
  assert.match(src.slice(save, save + 3000), /chatPushChanged\(\)/);
  assert.match(src, /if \(!key \|\| !chatPulled\.has\(key\)\) continue;/, "never written before it was read");
  assert.match(src, /r\.status === 409/);
  assert.match(src, /chatDelete\(gone\)/);
});
