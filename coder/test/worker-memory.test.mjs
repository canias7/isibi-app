// THE WORKER'S MEMORY WITH A BIG SAVED CHAT (the coordinator's follow-up of 2026-11-14). A Cloudflare Worker has 128 MB; since
// the saved chat keeps its answers and pictures whole ("yes copy claude code"), a chat with 24 pictures is some 20 MB, and each
// route that read it held several copies at once: measured, 108 to 129 MB of JS heap (200 to 275 MB of memory) for a message's
// start, a job's end, Undo and Rewind, 108 MB for a call to Grok through the model gate, and the last-resort summary ran out.
// Now the pictures are kept apart (src/coder-live.mjs: the machine sends each at a job's end and fetches it at the next start),
// the model gate passes a call on as its bytes, the sealed live copy is read back without a list of its characters, and the
// sizes left are kept to what fits. Each route is run in a process of its own with a 48 MB heap (test/worker-memory-route.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

const L = await import("../src/coder-live.mjs");
const G = await import("../src/coder-model-gate.mjs");
const R = await import("../src/coder-routes.mjs");
const S = await import("../container/server.mjs");
const SUM = await import("../src/coder-summary.mjs");
const GH = await import("../src/coder-github.mjs");

function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { if (!m.has(k)) return null; const v = m.get(k); return { text: async () => (typeof v === "string" ? v : new TextDecoder().decode(v)) }; }, async put(k, v) { m.set(k, typeof v === "string" ? v : new Uint8Array(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}
const UID = "user-1234567890abcdef", ID = "shop-pics1", CHAT = UID + "/" + ID;
const envOf = (bucket) => ({ CODER_TOKEN_KEY: Buffer.alloc(32, 7).toString("base64"), CODER_PUBLIC_URL: "https://coder.gofarther.dev", CODER_BUCKET: bucket });
const running = (bucket, turn = 2) => bucket.put("coder/" + UID + "/" + ID + "/meta.json", JSON.stringify({ id: ID, turn, status: "running" }));
const pic = (n, chars = 3000) => "data:image/png;base64," + Buffer.alloc(Math.floor(chars * 0.75), n).toString("base64");
const shaOf = (u) => createHash("sha256").update(u).digest("hex");
/** The machine's way to the Worker's picture store (its liveFetch), straight to the real handler. */
const toStore = (env, log = []) => async (url, init = {}) => { log.push([init.method || "GET", String(url)]); return L.handleLivePic(new Request(url, { ...init, ...(init.body ? { body: init.body } : {}) }), env); };

test("WM1 a chat's pictures kept apart on the Worker (coder-live.mjs): sent with the job's own pass while it runs, named by the SHA-256 of their data URL, given back as they were sent; refused without the pass, after the job, when not a picture or over 12 MB; the ones its saved chat no longer names go at a job's end, all of them with the chat", async () => {
  const bucket = fakeBucket(), env = envOf(bucket);
  await running(bucket);
  const live = { url: "https://coder.gofarther.dev" + L.LIVE_PATH, chat: CHAT, turn: 2, pass: await L.livePass(env, CHAT, 2) };
  const hdr = (o = {}) => ({ "x-coder-chat": CHAT, "x-coder-turn": "2", "x-coder-live": live.pass, ...o });
  const post = (body, h = hdr()) => L.handleLivePic(new Request("https://coder.gofarther.dev" + L.LIVE_PIC_PATH, { method: "POST", headers: h, body }), env);
  const get = (sha, h = hdr()) => L.handleLivePic(new Request("https://coder.gofarther.dev" + L.LIVE_PIC_PATH + "?sha=" + sha, { headers: h }), env);
  assert.equal(L.LIVE_PIC_PATH, "/api/coder/live/pic");
  const a = pic(1);
  const r = await post(a);
  assert.equal(r.status, 200);
  assert.deepEqual(await r.json(), { ok: true, ref: "coder-pic:" + shaOf(a) });
  assert.ok(bucket.m.has(L.picKey(UID, ID, shaOf(a))));
  assert.equal(await (await get(shaOf(a))).text(), a, "given back as sent");
  assert.equal((await get("0".repeat(64))).status, 404);
  assert.equal((await get("../meta.json")).status, 400);
  // Refused.
  assert.equal((await post(a, hdr({ "x-coder-live": "x".repeat(43) }))).status, 403, "not this job's pass");
  assert.equal((await post("hello")).status, 400, "not a picture");
  assert.equal((await post("data:image/svg+xml;base64,PHN2Zz4=")).status, 400, "not one Grok takes");
  assert.equal((await post("data:image/png;base64,AAA$")).status, 400);
  assert.equal((await post(a, hdr({ "content-length": String(L.PIC_MAX + 1) }))).status, 413);
  assert.equal(L.PIC_MAX, 12 * 1024 * 1024);
  await bucket.put("coder/" + UID + "/" + ID + "/meta.json", JSON.stringify({ id: ID, turn: 2, status: "idle" }));
  assert.equal((await post(pic(2))).status, 409, "only while the job runs");
  // At a job's end: what the saved chat no longer names goes; with the chat, all.
  await running(bucket);
  const b = pic(2);
  await post(b);
  const saved = [{ role: "user", content: "x", images: ["coder-pic:" + shaOf(b)] }];
  assert.deepEqual([...L.picRefsIn(saved)], [shaOf(b)]);
  assert.equal(await L.prunePics(bucket, UID, ID, saved), 1);
  assert.deepEqual([...bucket.m.keys()].filter((k) => k.includes("/pics/")), [L.picKey(UID, ID, shaOf(b))]);
  await L.dropPics(bucket, UID, ID);
  assert.deepEqual([...bucket.m.keys()].filter((k) => k.includes("/pics/")), []);
  // The Worker routes them with the job's pass (worker.js), and removes them with the chat (coder-routes.mjs).
  const { readFileSync } = await import("node:fs");
  assert.match(readFileSync(new URL("../worker.js", import.meta.url), "utf8"), /url\.pathname === LIVE_PIC_PATH\) \{[^}]*res = await handleLivePic\(request, env\);/);
  const routes = readFileSync(new URL("../src/coder-routes.mjs", import.meta.url), "utf8");
  assert.match(routes, /await prunePics\(bucket, uid, id, kept\)/);
  assert.match(routes, /await dropPics\(bucket, uid, id\)/);
});

test("WM2 the machine (server.mjs): at a job's end its pictures go to the Worker and the saved chat names them (picsOut); at the next start they are put back, the same bytes, so what Grok is sent is unchanged (picsIn); one the Worker did not take, or no longer has, is left out and its message says so; a picture the Worker has is not sent again, and one this machine holds is not fetched again", async () => {
  const bucket = fakeBucket(), env = envOf(bucket);
  await running(bucket);
  const live = { url: "https://coder.gofarther.dev" + L.LIVE_PATH, chat: CHAT, turn: 2, pass: await L.livePass(env, CHAT, 2) };
  const log = [];
  const fetchFn = toStore(env, log);
  const a = pic(1), b = pic(2), big = pic(3, L.PIC_MAX + 100);
  const convo = [{ role: "user", content: "look", images: [a] }, { role: "assistant", content: "ok" }, { role: "user", appNote: true, readPics: true, content: "(Note …)", images: [b, big] }];
  const known = new Set();
  S.PICS.delete("p1");
  const saved = await S.picsOut(convo, { live, fetchFn, project: "p1", known });
  assert.deepEqual(saved[0], { role: "user", content: "look", images: ["coder-pic:" + shaOf(a)] });
  assert.deepEqual(saved[2].images, ["coder-pic:" + shaOf(b)], "the one the Worker refused (over 12 MB) is left out");
  assert.equal(saved[2].content, "(Note …)" + S.PIC_NOT_KEPT);
  assert.ok(!JSON.stringify(saved).includes("data:image"), "the saved chat carries no picture itself");
  assert.equal(log.filter(([m]) => m === "POST").length, 3);
  // The next job, on another machine (nothing held): put back from the Worker, the same bytes.
  S.PICS.delete("p1");
  log.length = 0;
  const known2 = new Set();
  const back = await S.picsIn(saved, { live, fetchFn, project: "p1", known: known2 });
  assert.deepEqual(back[0], convo[0], "the same message, byte for byte");
  assert.deepEqual(back[2].images, [b]);
  assert.equal(log.length, 2);
  assert.deepEqual([...known2].sort(), [shaOf(a), shaOf(b)].sort());
  // Its end: those the Worker has are not sent again.
  log.length = 0;
  const again = await S.picsOut(back, { live, fetchFn, project: "p1", known: known2 });
  assert.deepEqual(again, saved);
  assert.equal(log.filter(([m]) => m === "POST").length, 0);
  // On the same machine: nothing fetched again.
  log.length = 0;
  await S.picsIn(saved, { live, fetchFn, project: "p1", known: new Set() });
  assert.equal(log.length, 0);
  // One the Worker no longer has: left out, and its message says so.
  S.PICS.delete("p1");
  const gone = [{ role: "user", content: "see", images: ["coder-pic:" + "f".repeat(64), "coder-pic:" + shaOf(a)] }];
  const got = await S.picsIn(gone, { live, fetchFn, project: "p1" });
  assert.deepEqual(got[0], { role: "user", content: "see" + S.PIC_GONE, images: [a] });
  // A chat with no names: as it is, nothing asked; a machine with no way to the Worker (a test's) keeps them as they are.
  const plain = [{ role: "user", content: "hi" }];
  assert.equal(await S.picsIn(plain, { live, fetchFn }), plain);
  assert.equal(await S.picsOut(convo, { live: null, fetchFn: null }), convo);
  // Wired in the job (server.mjs): put back before runCoder, sent after it, Gloopy's left alone.
  const { readFileSync } = await import("node:fs");
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /picsIn\(Array\.isArray\(body\.messages\) \? body\.messages : \[\], picsTo\)\.then\(\(msgsIn\) => runCoder\(turnDeps, \{/);
  assert.match(server, /messages: msgsIn, text:/);
  assert.match(server, /const messages = gloopy \|\| !Array\.isArray\(r && r\.messages\) \? r && r\.messages : await picsOut\(r\.messages, picsTo\)/);
});

test("WM3 the model gate passes a call on as its bytes (never a string, never parsed whole): the chat's cache key first, the call as the machine wrote it after; one that names a cache key of its own, or does not start with its model, is read whole and the key replaced, as before; a cache key's name inside a message (a file of Coder's own code, read) is not one", async () => {
  const bucket = fakeBucket(), env = { ...envOf(bucket), XAI_API_KEY: "xai-test" };
  await running(bucket, 3);
  const a = await G.modelAccess(env, UID, ID, 3);
  const call = async (body) => {
    const seen = [];
    const r = await G.handleModel(new Request("https://coder.gofarther.dev" + G.MODEL_PATH, { method: "POST", headers: { "content-type": "application/json", "x-coder-chat": a.chat, "x-coder-turn": "3", "x-coder-until": String(a.until), "x-coder-model": a.pass }, body }), env, { fetchFn: async (u, init) => { seen.push(init.body); return Response.json({ output: [] }); } });
    return { r, sent: seen[0] };
  };
  const key = await G.cacheKeyFor(CHAT);
  const machine = JSON.stringify({ model: "grok-4.7", instructions: "be brief", input: [{ role: "user", content: "read src/coder-model-gate.mjs: {\"prompt_cache_key\": 1}" }], tools: [] });
  const one = await call(machine);
  assert.equal(one.r.status, 200);
  assert.ok(one.sent instanceof Uint8Array, "bytes");
  assert.equal(new TextDecoder().decode(one.sent), '{"prompt_cache_key":' + JSON.stringify(key) + "," + machine.slice(1));
  assert.equal(JSON.parse(new TextDecoder().decode(one.sent)).input[0].content, 'read src/coder-model-gate.mjs: {"prompt_cache_key": 1}', "the words in a message are left alone");
  // Its own key named: read whole, the chat's in its place.
  const own = await call(JSON.stringify({ model: "grok-4.7", input: [], prompt_cache_key: "another-chat" }));
  assert.equal(own.r.status, 200);
  assert.equal(JSON.parse(own.sent).prompt_cache_key, key);
  assert.equal(G.namesCacheKey(new TextEncoder().encode('{"model":"x", \n "prompt_cache_key":"y"}')), true);
  assert.equal(G.namesCacheKey(new TextEncoder().encode(machine)), false);
  // Not its model first: read whole; another model refused either way.
  const later = await call(JSON.stringify({ input: [], model: "grok-4.7" }));
  assert.equal(later.r.status, 200);
  assert.equal(JSON.parse(later.sent).prompt_cache_key, key);
  assert.equal((await call(JSON.stringify({ model: "grok-9", input: [] }))).r.status, 403);
  assert.equal((await call('{"model":"grok-9",' + '"input":[]}')).r.status, 403);
});

test("WM4 what the Worker still reads of a chat stays small: the saved chat's size taken from what is stored (no second copy to measure it); over its cap (8 MB), a picture still in it goes first, a note in its place, before any message; the text it measured is what is saved; the last-resort summary only past 6 MB; the live copy at most 4 MB; a sealed copy read back a byte at a time", async () => {
  assert.equal(R.CODER_HISTORY_MAX, 8 * 1024 * 1024);
  assert.equal(SUM.CODER_COMPACT_SAFETY, 6 * 1024 * 1024);
  assert.equal(L.LIVE_BODY_MAX, 4 * 1024 * 1024);
  const msgs = [{ role: "user", content: "look" }, { role: "user", appNote: true, content: "(Note …)", images: [pic(1, 6000), "coder-pic:" + "a".repeat(64)] }, { role: "assistant", content: "ok" }];
  const capped = R.capHistoryInfo(msgs, 3000);
  assert.deepEqual(capped.messages.map((m) => m.content), ["look", "(Note …)\n[1 picture attached]", "ok"], "every message kept, the picture out");
  assert.deepEqual(capped.messages[1].images, ["coder-pic:" + "a".repeat(64)], "a name stays");
  assert.equal(capped.text, JSON.stringify(capped.messages));
  assert.equal(R.capHistoryInfo(msgs).text, JSON.stringify(msgs), "under the cap: as it was");
  // The size as stored: no summary under it, whatever the messages.
  const out = await SUM.compactHistory([{ role: "user", content: "x".repeat(1000) }, { role: "assistant", content: "y" }, { role: "user", content: "a" }, { role: "assistant", content: "b" }, { role: "user", content: "c" }, { role: "assistant", content: "d" }, { role: "user", content: "e" }], async () => "S", { at: 500, size: 10 });
  assert.equal(out.to, 0);
  // A sealed copy of some 3 MB, read back.
  const env = envOf(fakeBucket());
  const big = Array.from({ length: 20_000 }, (_, i) => ({ role: "tool", tool_call_id: "c" + i, content: "line — " + "z".repeat(140) }));
  assert.deepEqual(await GH.unseal(env, await GH.seal(env, big)), big);
});

test("WM5 each of the Worker's routes with a chat of some 20 MB and 24 pictures, in a 48 MB heap (each in a process of its own): a message's start, a job's end, Undo, Rewind, the live save at its limit, a lost job, the last-resort summary, a 20 MB call to Grok through the model gate, a 12 MB picture sent and fetched; the page's own load never has the conversation; the chat as it was saved before (its pictures in it) ran out of memory there", { timeout: 300_000 }, () => {
  const dir = mkdtempSync(join(tmpdir(), "coder-wm-"));
  const helper = new URL("./worker-memory-route.mjs", import.meta.url).pathname;
  const run = (route, extra = {}) => {
    const r = spawnSync(process.execPath, ["--max-old-space-size=48", "--max-semi-space-size=1", helper, "run", dir, route], { encoding: "utf8", maxBuffer: 16 << 20, env: { ...process.env, ...extra } });
    const line = String(r.stdout || "").split("\n").filter((l) => l.startsWith("{")).pop();
    return { out: line ? JSON.parse(line) : null, oom: /heap out of memory|Reached heap limit/.test(String(r.stderr || "")) };
  };
  try {
    const b = spawnSync(process.execPath, [helper, "build", dir], { encoding: "utf8" });
    assert.match(String(b.stdout), /"built":true/, String(b.stderr).slice(-400));
    for (const route of ["start", "end", "undo", "rewind", "live", "lost", "summary", "gate", "picpost", "picget"]) {
      const { out, oom } = run(route);
      assert.ok(!oom && out && out.status >= 200 && out.status < 300, route + ": " + JSON.stringify(out) + (oom ? " (out of memory)" : ""));
    }
    const page = run("get");
    assert.equal(page.out.said, "conversation in it: false", "the page loads the chat's steps, never its conversation");
    // The same chat saved with its pictures in it, as it was: a message's start ran out of memory in the same heap.
    assert.equal(run("start", { WM_INLINE: "1" }).oom, true);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
