// SPARE MACHINES (owner, 2026-11-15: "the machine must be ready in seconds, not ~50 s"). A new chat's machine used to be made
// on a new disk, on a server that first fetched Coder's 6.9 GB image (the first message reached its machine 53.7 s after the
// Worker got it, live after deploy 201). Now a small pool of spare machines, made from the current image and stopped, waits;
// a chat claims one, gives it its own lock key and starts it. SP1 to SP5. Driven against a small stand-in for Fly.io.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const F = await import("../src/coder-fly.mjs");
const { controlKeyFor } = await import("../src/coder-control.mjs");
const APP = "gofarther-coder-machines", TOKEN = "fly-token-0123456789", TKEY = "t".repeat(44);
const IMG1 = "registry.fly.io/" + APP + ":coder-aaaaaaaaaaaa", IMG2 = "registry.fly.io/" + APP + ":coder-bbbbbbbbbbbb";

/** R2 as far as this uses it, with etags and if-match (`onlyIf`), as Cloudflare's: a put whose condition fails answers null. */
function fakeBucket() {
  const m = new Map(); let n = 0;
  return {
    m,
    async get(k) { if (!m.has(k)) return null; const v = m.get(k); return { etag: v.etag, httpEtag: '"' + v.etag + '"', text: async () => v.body }; },
    async put(k, body, o = {}) {
      const want = o.onlyIf instanceof Headers ? o.onlyIf.get("if-match") : null;
      if (want && (!m.has(k) || '"' + m.get(k).etag + '"' !== want)) return null;
      m.set(k, { body: String(body), etag: "e" + ++n }); return { key: k };
    },
    async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; },
  };
}
const envWith = (bucket, o = {}) => ({ CODER_MACHINES: "fly", FLY_API_TOKEN: TOKEN, CODER_FLY_APP: APP, CODER_FLY_IMAGE: IMG1, CODER_BUCKET: bucket, CODER_TOKEN_KEY: TKEY, ...o });

function fakeFly() {
  const w = { machines: new Map(), volumes: new Map(), api: [], door: [], keys: [], seq: 0 };
  const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json" } });
  w.fetchFn = async (url, init = {}) => {
    const u = new URL(String(url)); const method = String(init.method || "GET").toUpperCase();
    if (u.host === "api.machines.dev") {
      const p = u.pathname.replace("/v1/apps/" + APP, ""); w.api.push(method + " " + p);
      const body = init.body ? JSON.parse(init.body) : null; let m;
      if (method === "POST" && p === "/volumes") { const id = "vol_" + ++w.seq; w.volumes.set(id, { id, ...body }); return J(w.volumes.get(id)); }
      if (method === "POST" && p === "/machines") { const id = "m" + ++w.seq; w.machines.set(id, { id, name: body.name, config: body.config, state: "started", created_at: new Date().toISOString() }); return J(w.machines.get(id)); }
      if (method === "GET" && p === "/machines") return J([...w.machines.values()]);
      if (method === "GET" && p === "/volumes") return J([...w.volumes.values()]);
      if ((m = /^\/machines\/(\w+)\/(start|stop)$/.exec(p))) { const x = w.machines.get(m[1]); if (!x) return J({}, 404); x.state = m[2] === "start" ? "started" : "stopped"; return J({ ok: true }); }
      if ((m = /^\/machines\/(\w+)$/.exec(p))) {
        const x = w.machines.get(m[1]); if (!x) return J({ error: "not found" }, 404);
        if (method === "GET") return J(x);
        if (method === "POST") { x.config = body.config; x.state = "started"; return J(x); }
        if (method === "DELETE") { w.machines.delete(m[1]); return J({ ok: true }); }
      }
      if (method === "DELETE" && (m = /^\/volumes\/(\w+)$/.exec(p))) { w.volumes.delete(m[1]); return J({ ok: true }); }
      return J({ error: "unknown " + method + " " + p }, 400);
    }
    if (u.host === APP + ".fly.dev") {
      const h = new Headers(init.headers); const x = w.machines.get(h.get("fly-force-instance-id"));
      w.door.push(u.pathname);
      if (!x || x.state !== "started") return new Response("asleep", { status: 503 });
      if (u.pathname !== "/health") w.keys.push(h.get("x-coder-key"));
      let body = { ok: true };
      if (u.pathname === "/busy") body = { busy: false, working: 0, unsaved: 0, idleMs: 0 };
      return new Response(JSON.stringify({ coderStatus: 200, body }), { status: 200, headers: { "x-coder-machine": "1", "x-coder-keepalive": "1" } });
    }
    throw new Error("unexpected " + url);
  };
  return w;
}
const deps = (w, extra = {}) => ({ fetchFn: w.fetchFn, sleep: async () => {}, ...extra });
const spares = (b) => [...b.m.keys()].filter((k) => /^coder\/fly-spares\/[0-9a-f]{16}\.json$/.test(k)).map((k) => JSON.parse(b.m.get(k).body));
const now0 = Date.parse("2026-11-15T12:05:00Z");

test("SP1 the pool is filled every minute (CODER_FLY_SPARES, 1 by default, 0 to 5): a spare is made from the current image on its own disk, stopped once it answers (its image is then on its server) and marked ready; with 0, none", async () => {
  assert.equal(F.spareCount({}), 1); assert.equal(F.spareCount({ CODER_FLY_SPARES: "3" }), 3); assert.equal(F.spareCount({ CODER_FLY_SPARES: "0" }), 0); assert.equal(F.spareCount({ CODER_FLY_SPARES: "9" }), 1);
  const b = fakeBucket(), w = fakeFly(), env = envWith(b);
  const out = await F.runFlyMachines(env, deps(w), now0);
  assert.equal(out.spares, 1);
  let sp = spares(b); assert.equal(sp.length, 1); assert.equal(sp[0].ready, false); assert.equal(sp[0].image, IMG1);
  const m = w.machines.get(sp[0].id);
  assert.match(m.name, F.SPARE_NAME); assert.equal(m.config.metadata.coder, "spare-machine");
  assert.equal(m.config.mounts[0].volume, sp[0].volume); assert.match(w.volumes.get(sp[0].volume).name, /^cspare_[0-9a-f]{16}$/);
  // Its own key, from its spare name: no chat's.
  assert.equal(m.config.env.CODER_CONTROL_KEY, await controlKeyFor(TKEY, m.name));
  // The next minute: it answers, so it is stopped and ready; no second one (the pool has 1).
  await F.runFlyMachines(env, deps(w), now0 + 60e3);
  sp = spares(b); assert.equal(sp.length, 1); assert.equal(sp[0].ready, true); assert.equal(w.machines.get(sp[0].id).state, "stopped");
  assert.equal(w.machines.size, 1);
  // A bigger pool.
  await F.runFlyMachines(envWith(b, { CODER_FLY_SPARES: "2" }), deps(w), now0 + 120e3);
  assert.equal(spares(b).length, 2);
  // None.
  const b0 = fakeBucket(), w0 = fakeFly();
  await F.runFlyMachines(envWith(b0, { CODER_FLY_SPARES: "0" }), deps(w0), now0);
  assert.equal(w0.machines.size, 0);
});

test("SP2 a new chat claims a ready spare: it gets that chat's own lock key (never the spare's or another chat's), is started and becomes the chat's machine and disk; no new disk is made and no image fetched; the pool is filled again in the background", async () => {
  const b = fakeBucket(), w = fakeFly(), env = envWith(b);
  await F.runFlyMachines(env, deps(w), now0); await F.runFlyMachines(env, deps(w), now0 + 60e3);
  const [sp] = spares(b);
  const later = [];
  const box = F.flyBox(env, "user-1-shop-a1", deps(w, { now: () => now0 + 120e3, waitUntil: (p) => later.push(p) }));
  w.api.length = 0;
  const r = await box.fetch(new Request("http://coder/turn", { method: "POST", body: "{}" }));
  assert.equal(r.status, 200);
  const names = await F.flyNames("user-1-shop-a1");
  const rec = JSON.parse(b.m.get(names.key).body);
  assert.equal(rec.id, sp.id); assert.equal(rec.volume, sp.volume); assert.equal(rec.spare, sp.h); assert.equal(rec.lock, 2); assert.equal(rec.stopped, false);
  const mine = await controlKeyFor(TKEY, names.machine);
  assert.equal(w.machines.get(sp.id).config.env.CODER_CONTROL_KEY, mine, "the chat's own key, given when it is claimed");
  assert.deepEqual(w.keys, [mine], "the job's request carries it");
  await Promise.all(later);
  assert.equal(w.api.filter((a) => a === "POST /volumes").length, 1, "no new disk for the chat (one only, for the next spare)");
  assert.ok(w.api.includes("POST /machines/" + sp.id), "the spare is updated (and so started) with the chat's key");
  // The spare's record is gone; an index says whose it is; a new spare is being made.
  await Promise.all(later);
  const left = spares(b);
  assert.equal(left.length, 1); assert.notEqual(left[0].id, sp.id); assert.equal(left[0].ready, false);
  assert.deepEqual(JSON.parse(b.m.get(F.SPARES + "claimed/" + sp.h + ".json").body).key, names.key);
  // Every minute after, it is that chat's machine: asked with the chat's key, stopped when idle as any other.
  w.keys.length = 0;
  await F.runFlyMachines(env, deps(w), now0 + 30 * 60e3);
  assert.ok(w.keys.includes(mine));
  assert.ok(w.machines.has(sp.id), "never taken for an orphan");
  // Removed with its chat (and its index).
  await F.dropFlyMachine(env, "user-1-shop-a1", deps(w));
  assert.equal(w.machines.has(sp.id), false); assert.equal(b.m.has(F.SPARES + "claimed/" + sp.h + ".json"), false);
});

test("SP3 one spare, one chat: two chats at once never get the same spare (R2's if-match); the second makes its machine as before; a spare not ready yet is never claimed; Gloopy and a disk from the environment's saved copy don't use spares", async () => {
  const b = fakeBucket(), w = fakeFly(), env = envWith(b);
  await F.runFlyMachines(env, deps(w), now0);
  // Not ready yet: a chat makes its own machine.
  const n0 = await F.claimSpare(env, b, await F.flyNames("chat-0"), deps(w, { now: () => now0 + 1 }));
  assert.equal(n0, null);
  await F.runFlyMachines(env, deps(w), now0 + 60e3);
  const [a, c] = await Promise.all([F.claimSpare(env, b, await F.flyNames("chat-a"), deps(w, { now: () => now0 + 2 })), F.claimSpare(env, b, await F.flyNames("chat-c"), deps(w, { now: () => now0 + 2 }))]);
  assert.equal([a, c].filter(Boolean).length, 1, "only one of them got it");
  // Gloopy: its own size, never a spare.
  const b2 = fakeBucket(), w2 = fakeFly(), env2 = envWith(b2);
  await F.runFlyMachines(env2, deps(w2), now0); await F.runFlyMachines(env2, deps(w2), now0 + 60e3);
  const sp = spares(b2)[0];
  await F.flyBox(env2, "gloopy-chat", deps(w2), { gloopy: true }).fetch(new Request("http://coder/turn", { method: "POST", body: "{}" }));
  assert.equal(spares(b2)[0].id, sp.id, "still there");
  const src = readFileSync(new URL("../src/coder-fly.mjs", import.meta.url), "utf8");
  assert.match(src, /const spare = !gloopy \? await claimSpare\(env, bucket, names, deps, from \? String\(from\.snapshot\) : null\)/, "a chat from a saved copy takes only a spare made from that copy (CD151b)");
  assert.ok(!F.spareUsable(env, { ...JSON.parse(JSON.stringify({ ready: true })), snap: "vs_Other1" }, Date.now()), "a copy's spare is never a plain chat's");
});

test("SP4 nothing leaks: a spare from an older image or size, older than 7 days, never ready in 15 minutes, or gone from Fly is removed with its disk and made again; spare disks no machine uses are cleared once an hour; a spare left half-claimed stays its chat's", async () => {
  const b = fakeBucket(), w = fakeFly(), env = envWith(b);
  await F.runFlyMachines(env, deps(w), now0); await F.runFlyMachines(env, deps(w), now0 + 60e3);
  const old = spares(b)[0];
  // A new image: the old spare goes (machine and disk), a new one is made from the new image.
  await F.runFlyMachines(envWith(b, { CODER_FLY_IMAGE: IMG2 }), deps(w), now0 + 120e3);
  assert.equal(w.machines.has(old.id), false); assert.equal(w.volumes.has(old.volume), false);
  let sp = spares(b); assert.equal(sp.length, 1); assert.equal(sp[0].image, IMG2);
  // Older than 7 days: recycled.
  const env2 = envWith(b, { CODER_FLY_IMAGE: IMG2 });
  await F.runFlyMachines(env2, deps(w), now0 + 180e3);
  const aged = spares(b)[0];
  await F.runFlyMachines(env2, deps(w), aged.at + F.SPARE_MAX_AGE_MS + 1);
  assert.equal(w.machines.has(aged.id), false); assert.notEqual(spares(b)[0].id, aged.id);
  // Never ready (its image never came): removed after 15 minutes.
  const b3 = fakeBucket(), w3 = fakeFly(), env3 = envWith(b3);
  await F.runFlyMachines(env3, deps(w3), now0);
  const stuck = spares(b3)[0]; w3.machines.get(stuck.id).state = "starting";
  await F.runFlyMachines(env3, deps(w3), now0 + F.SPARE_READY_MS + 1);
  assert.equal(w3.machines.has(stuck.id), false); assert.equal(w3.volumes.has(stuck.volume), false);
  // Gone from Fly: its record and disk go.
  const gone = spares(b3)[0]; w3.machines.delete(gone.id);
  await F.runFlyMachines(env3, deps(w3), now0 + F.SPARE_READY_MS + 60e3);
  assert.equal(w3.volumes.has(gone.volume), false); assert.ok(!spares(b3).some((x) => x.id === gone.id));
  // A loose spare disk, once an hour (minute 17).
  w3.volumes.set("vol_loose", { id: "vol_loose", name: "cspare_" + "a".repeat(16), attached_machine_id: null, created_at: new Date(now0 - 3 * 3600e3).toISOString() });
  await F.runFlyMachines(env3, deps(w3), Date.parse("2026-11-15T13:17:00Z"));
  assert.equal(w3.volumes.has("vol_loose"), false);
  // Half-claimed (the chat got it, the spare's record was not removed): after an hour only the record goes.
  const b4 = fakeBucket(), w4 = fakeFly(), env4 = envWith(b4, { CODER_FLY_SPARES: "1" });
  await F.runFlyMachines(env4, deps(w4), now0); await F.runFlyMachines(env4, deps(w4), now0 + 60e3);
  const s4 = spares(b4)[0]; const n4 = await F.flyNames("chat-4");
  await b4.put(F.SPARES + s4.h + ".json", JSON.stringify({ ...s4, claimed: n4.key, claimedAt: now0 }));
  await b4.put(n4.key, JSON.stringify({ id: s4.id, volume: s4.volume, lock: 2, at: now0, used: now0 + 2 * 3600e3, stopped: true, spare: s4.h }));
  await F.runFlyMachines(env4, deps(w4), now0 + 2 * 3600e3);
  assert.ok(w4.machines.has(s4.id), "the chat keeps its machine"); assert.ok(!spares(b4).some((x) => x.id === s4.id));
});

test("SP5 the Worker passes its background hook to the machines, and the README says how the pool works", () => {
  const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(worker, /flyBox\(env, name, \{ waitUntil/);
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  assert.match(readme, /CODER_FLY_SPARES/);
});
