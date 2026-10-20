// The account's settings and work in progress, and a question's files, on the
// server (2026-10-20, owner: "fix, do it server side"). The real routes, end to
// end, over an in-memory bucket, with the sign-in answered by a stubbed GoTrue.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadWorkerModule } from "./fixtures/worker-harness.mjs";
const W = await loadWorkerModule();
const worker = W.default, api = W.chatStoreApi;

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
const signIn = (uid) => { globalThis.fetch = async (u, o) => String(u).includes("/auth/v1/user") ? new Response(JSON.stringify({ id: uid }), { status: 200 }) : realFetch(u, o); };
const call = (env, method, path, body, tok = "t") => worker.fetch(new Request("https://gofarther.dev" + path, {
  method, headers: { ...(tok ? { Authorization: "Bearer " + tok } : {}), "Content-Type": "application/json" },
  ...(body ? { body: JSON.stringify(body) } : {}),
}), env, { waitUntil() {}, passThroughOnException() {} });
test.afterEach(() => { globalThis.fetch = realFetch; });

test("signed out: both routes refuse and store nothing", async () => {
  const env = { SITES_BUCKET: bucket() };
  assert.equal((await call(env, "GET", "/api/site/account-state", null, "")).status, 401);
  assert.equal((await call(env, "GET", "/api/site/ask-files/abcd1234", null, "")).status, 401);
  assert.equal(env.SITES_BUCKET.m.size, 0);
});

test("a setting made on one device is read on another, and the newer one wins", async () => {
  const env = { SITES_BUCKET: bucket() }; signIn("u1");
  let r = await call(env, "PUT", "/api/site/account-state", { set: { effort: { v: "low", at: 100 }, picker: { v: "grok", at: 100 } } });
  assert.equal(r.status, 200);
  r = await call(env, "PUT", "/api/site/account-state", { set: { effort: { v: "xhigh", at: 50 } } });
  let st = (await (await call(env, "GET", "/api/site/account-state")).json()).state;
  assert.equal(st.effort.v, "low", "an older choice never replaces a newer one");
  await call(env, "PUT", "/api/site/account-state", { set: { effort: { v: "high", at: 200 }, editWatch: { v: null, at: 200 } } });
  st = (await (await call(env, "GET", "/api/site/account-state")).json()).state;
  assert.deepEqual(st.effort, { v: "high", at: 200 });
  assert.deepEqual(st.picker, { v: "grok", at: 100 });
  assert.deepEqual(st.editWatch, { v: null, at: 200 });
  assert.deepEqual([...env.SITES_BUCKET.m.keys()], ["acct/u1.json"]);
  signIn("u2");
  assert.deepEqual((await (await call(env, "GET", "/api/site/account-state")).json()).state, {}, "another account reads none of it");
});

test("only the listed names, strings, and real times are stored", async () => {
  const env = { SITES_BUCKET: bucket() }; signIn("u1");
  for (const bad of [{}, { set: {} }, { set: { secret: { v: "x", at: 1 } } }, { set: { effort: { v: 5, at: 1 } } }, { set: { effort: { v: "x" } } }, { set: { effort: { v: "x", at: 0 } } }]) {
    assert.equal((await call(env, "PUT", "/api/site/account-state", bad)).status, 400, JSON.stringify(bad));
  }
  assert.equal(env.SITES_BUCKET.m.size, 0);
});

test("a write that loses the race reads again and keeps both", async () => {
  const b = bucket(); const env = { SITES_BUCKET: b }; signIn("u1");
  await call(env, "PUT", "/api/site/account-state", { set: { side: { v: "open", at: 10 } } });
  const realGet = b.get.bind(b); let once = true;
  b.get = async (k) => { const o = await realGet(k); if (once) { once = false; await b.put(k, JSON.stringify({ v: 1, state: { side: { v: "open", at: 10 }, view: { v: "settings", at: 20 } } })); } return o; };
  assert.equal((await call(env, "PUT", "/api/site/account-state", { set: { effort: { v: "low", at: 30 } } })).status, 200);
  const st = JSON.parse(b.m.get("acct/u1.json").body).state;
  assert.equal(st.view.v, "settings"); assert.equal(st.effort.v, "low");
});

test("a question's files are kept a day under the account, and removed", async () => {
  const env = { SITES_BUCKET: bucket() }; signIn("u1");
  assert.equal((await call(env, "PUT", "/api/site/ask-files/q_123456", { imgs: ["data:image/png;base64,AA"] })).status, 200);
  assert.deepEqual((await (await call(env, "GET", "/api/site/ask-files/q_123456")).json()).imgs, ["data:image/png;base64,AA"]);
  const k = "askfiles/u1/q_123456.json";
  const rec = JSON.parse(env.SITES_BUCKET.m.get(k).body); rec.at -= api.ASK_FILES_TTL_MS + 1;
  env.SITES_BUCKET.m.get(k).body = JSON.stringify(rec);
  assert.deepEqual((await (await call(env, "GET", "/api/site/ask-files/q_123456")).json()).imgs, [], "a day old is gone");
  signIn("u2");
  assert.deepEqual((await (await call(env, "GET", "/api/site/ask-files/q_123456")).json()).imgs, []);
  signIn("u1");
  for (const bad of [{ imgs: [] }, { imgs: [1] }, { imgs: ["a", "b", "c", "d"] }]) assert.equal((await call(env, "PUT", "/api/site/ask-files/q_123456", bad)).status, 400);
  assert.equal((await call(env, "GET", "/api/site/ask-files/a.b")).status, 400);
  await call(env, "DELETE", "/api/site/ask-files/q_123456");
  assert.equal(env.SITES_BUCKET.m.size, 0);
});

test("the page sends every listed key, reads the account before it lands, and never sends a wipe", () => {
  const src = readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  for (const k of ["zephyr_build_picker_v1", "zephyr_build_effort_v2", "zephyr_view_v1", "zephyr_side_v1", "zephyr_cred_max_v1", "zephyr_offer_end_v1", "zephyr_welcome_v1", "gf.edit.watch.v1", "gf-media-uploads"]) {
    assert.ok(new RegExp("'" + k.replace(/\./g, "\\.") + "'").test(src.slice(src.indexOf("const ACCT_KEYS = {"), src.indexOf("const ACCT_AT_KEY"))), k);
  }
  const names = [.../const ACCT_KEYS = \{([\s\S]*?)\};/.exec(src)[1].matchAll(/(\w+):\s*'/g)].map((m) => m[1]);
  assert.deepEqual(names.sort(), [...api.ACCT_STATE_NAMES].sort(), "the page's names are the server's names");
  assert.match(src, /  Storage\.prototype\.setItem = function \(k, v\) \{ const r = acctRawSet\.call\(this, k, v\); if \(this === window\.localStorage\) acctTouched/);
  assert.match(src, /if \(!name \|\| !acctFor \|\| acctApplying\) return;/);
  assert.match(src, /acctFor = ''; \/\/ nothing the wipe below removes/);
  assert.match(src, /acctFor = ''; \/\/ the wipe below is never sent/);
  const enter = src.slice(src.indexOf("function enterApp("), src.indexOf("function enterLandingAuthed("));
  assert.match(enter, /acctPull\(uid\)\.then\(\(\) => \{[\s\S]*showView\(lastView\);\s*\}\);/);
  assert.equal((src.match(/\[SITES_KEY, CRED_MAX_KEY, WELCOME_KEY, VIEW_KEY, \.\.\.acctWipeKeys\(\),/g) || []).length, 2, "both wipes clear the account's keys, so the next account never inherits them");
  assert.match(src, /askFilesServer\(id, 'PUT', list\)/);
  assert.match(src, /askFilesServer\(id, 'GET'\)/);
  assert.match(src, /askFilesServer\(id, 'DELETE'\)/);
});
