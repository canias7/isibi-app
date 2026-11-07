// CODER'S MACHINES ON FLY.IO (owner, 2026-11-07: "YES OPTION 2", "OK LETS START
// THEN"): one small VM per chat, stopped when quiet with its disk kept, like
// Claude Code's. Driven against a stand-in for Fly's Machines API and front door.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import http from "node:http";

const F = await import("../src/coder-fly.mjs");
const APP = "gofarther-coder-machines", TOKEN = "fly-token-0123456789", CONTROL = "c".repeat(32);
const IMG1 = "registry.fly.io/" + APP + ":coder-aaaaaaaaaaaa", IMG2 = "registry.fly.io/" + APP + ":coder-bbbbbbbbbbbb";

function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}
const envWith = (bucket, o = {}) => ({ CODER_MACHINES: "fly", FLY_API_TOKEN: TOKEN, CODER_FLY_APP: APP, CODER_FLY_IMAGE: IMG1, CODER_BUCKET: bucket, ...o });

/** Fly.io as far as Coder uses it: the Machines API, and the front door to each machine. */
function fakeFly() {
  const w = { machines: new Map(), volumes: new Map(), api: [], door: [], seq: 0, busy: {}, silent: new Set(), cut: new Set(), limited: 0, failVolume: false, keys: [] };
  const J = (o, s = 200, h = {}) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", ...h } });
  w.fetchFn = async (url, init = {}) => {
    const u = new URL(String(url));
    const method = String(init.method || "GET").toUpperCase();
    if (u.host === "api.machines.dev") {
      const p = u.pathname.replace("/v1/apps/" + APP, "");
      w.api.push(method + " " + p + u.search);
      if (init.headers.authorization !== "Bearer " + TOKEN) return J({ error: "unauthorized" }, 401);
      if (w.limited > 0) { w.limited--; return J({ error: "rate limited" }, 429); }
      const body = init.body ? JSON.parse(init.body) : null;
      let m;
      if (method === "POST" && p === "/volumes") {
        if (w.failVolume) return J({ error: "no room" }, 422);
        const id = "vol_" + ++w.seq; w.volumes.set(id, { id, ...body, attached_machine_id: null, created_at: new Date(Date.now() - 2 * 3600e3).toISOString() }); return J(w.volumes.get(id));
      }
      if (method === "POST" && p === "/machines") {
        const id = "m" + ++w.seq; w.machines.set(id, { id, name: body.name, region: body.region, config: body.config, state: "started", created_at: new Date().toISOString() });
        w.volumes.get(body.config.mounts[0].volume).attached_machine_id = id; return J(w.machines.get(id));
      }
      if (method === "GET" && p === "/machines") return J([...w.machines.values()]);
      if (method === "GET" && p === "/volumes") return J([...w.volumes.values()]);
      if ((m = /^\/machines\/(\w+)\/start$/.exec(p))) { const x = w.machines.get(m[1]); if (!x) return J({}, 404); x.state = "started"; return J({ previous_state: "stopped" }); }
      if ((m = /^\/machines\/(\w+)\/stop$/.exec(p))) { const x = w.machines.get(m[1]); if (!x) return J({}, 404); x.state = "stopped"; return J({ ok: true }); }
      if ((m = /^\/machines\/(\w+)$/.exec(p))) {
        const x = w.machines.get(m[1]);
        if (!x) return J({ error: "not found" }, 404);
        if (method === "GET") return J(x);
        if (method === "POST") { x.config = body.config; x.state = "started"; return J(x); }
        if (method === "DELETE") { w.machines.delete(m[1]); for (const v of w.volumes.values()) if (v.attached_machine_id === m[1]) v.attached_machine_id = null; return J({ ok: true }); }
      }
      if (method === "DELETE" && (m = /^\/volumes\/(\w+)$/.exec(p))) { w.volumes.delete(m[1]); return J({ ok: true }); }
      return J({ error: "unknown " + method + " " + p }, 400);
    }
    if (u.host === APP + ".fly.dev") {
      const h = new Headers(init.headers);
      const id = h.get("fly-force-instance-id"), x = w.machines.get(id);
      w.door.push(u.pathname);
      // Fly's own answer: the machine is asleep, gone or not answering.
      if (!x || x.state !== "started" || w.silent.has(id)) return new Response("could not reach the machine", { status: 503 });
      if (u.pathname !== "/health") w.keys.push(h.get("x-coder-key"));
      assert.equal(h.get("x-coder-keepalive"), "1", "always asks for the still-working answer");
      if (w.cut.has(id)) return new Response("   {\"coderSta", { status: 200, headers: { "x-coder-machine": "1", "x-coder-keepalive": "1" } });
      let status = 200, body = { ok: true };
      if (u.pathname === "/busy") body = w.busy[id] || { busy: false, working: 0, unsaved: 0, workingMs: 0, unsavedMs: 0, idleMs: 0 };
      if (u.pathname === "/turn") { body = { ok: true, got: JSON.parse(new TextDecoder().decode(init.body)) }; status = 200; }
      if (u.pathname === "/claim") { status = 409; body = { ok: false }; }
      return new Response("    " + JSON.stringify({ coderStatus: status, body }), { status: 200, headers: { "x-coder-machine": "1", "x-coder-keepalive": "1" } });
    }
    throw new Error("unexpected address " + url);
  };
  return w;
}
const deps = (w, extra = {}) => ({ fetchFn: w.fetchFn, sleep: async () => {}, ...extra });
const signed = (req) => { const r = new Request(req); r.headers.set("x-coder-key", CONTROL); return r; };

test("CD125 Fly.io machines: on only when switched on and set up; each chat's machine, disk and record have fixed names; the machine is made like Claude Code's VM: its own disk at /data, reached only through Fly's front door, started and stopped by Coder", async () => {
  const b = fakeBucket();
  assert.equal(F.flyOn(envWith(b)), true);
  for (const o of [{ CODER_MACHINES: "cloudflare" }, { FLY_API_TOKEN: "" }, { CODER_FLY_APP: "Bad_App" }, { CODER_FLY_IMAGE: "none" }, { CODER_FLY_IMAGE: "docker.io/x:y" }]) assert.equal(F.flyOn(envWith(b, o)), false, JSON.stringify(o));
  const a = await F.flyNames("user-1-shop-a1"), a2 = await F.flyNames("user-1-shop-a1"), c = await F.flyNames("user-1-shop-b2");
  assert.deepEqual(a, a2, "the same chat, the same names");
  assert.notEqual(a.machine, c.machine);
  assert.match(a.machine, /^coder-[0-9a-f]{20}$/); assert.match(a.volume, /^coder_[0-9a-f]{20}$/); assert.match(a.key, /^coder\/fly-machines\/[0-9a-f]{20}\.json$/);
  assert.deepEqual(F.flySettings(envWith(b)), { app: APP, image: IMG1, region: "iad", cpus: 2, memory: 4096, disk: 10 });
  assert.deepEqual(F.flySettings(envWith(b, { CODER_FLY_REGION: "ams", CODER_FLY_CPUS: "4", CODER_FLY_MEMORY_MB: "8192", CODER_FLY_DISK_GB: "20" })), { app: APP, image: IMG1, region: "ams", cpus: 4, memory: 8192, disk: 20 });
  assert.equal(F.flySettings(envWith(b, { CODER_FLY_CPUS: "99", CODER_FLY_REGION: "x" })).cpus, 2, "nonsense falls back");
  assert.deepEqual(F.machineConfig(envWith(b, { CODER_MODEL: "default" }), "vol_9"), {
    image: IMG1,
    env: { CODER_DATA: "/data", CODER_MODEL: "default" },
    guest: { cpu_kind: "shared", cpus: 2, memory_mb: 4096 },
    mounts: [{ volume: "vol_9", path: "/data" }],
    services: [{ protocol: "tcp", internal_port: 8080, ports: [{ port: 443, handlers: ["tls", "http"] }], autostart: false, autostop: "off" }],
    restart: { policy: "on-failure", max_retries: 3 },
    metadata: { coder: "chat-machine" },
  });
  assert.equal(JSON.stringify(F.machineConfig(envWith(b, { XAI_API_KEY: "xai-secret" }), "v")).includes("xai-secret"), false, "the AI key is a Fly secret, never in the machine's settings");
  // ITS LOCK, ALWAYS: the control key (made from CODER_TOKEN_KEY, never that key itself) is in its settings too.
  const { controlKeySync } = await import("../src/coder-control.mjs");
  const tk = Buffer.alloc(32, 7).toString("base64");
  const withKey = F.machineConfig(envWith(b, { CODER_TOKEN_KEY: tk }), "v");
  assert.equal(withKey.env.CODER_CONTROL_KEY, controlKeySync(tk));
  assert.equal(JSON.stringify(withKey).includes(tk), false);
});

test("CD126 a chat's machine on Fly.io: made with its disk on first use, then asked straight through the front door; asleep, it is woken; a new machine version is taken only while asleep; gone, a new one is made; a cut answer is never sent twice", async () => {
  const b = fakeBucket(), w = fakeFly(), env = envWith(b);
  const box = F.flyBox(env, "user-1-shop-a1", deps(w));
  const names = await F.flyNames("user-1-shop-a1");
  // FIRST USE: its disk, then the machine on it; once it answers, the request.
  const r1 = await box.fetch(signed(new Request("http://coder/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: "shop-a1", text: "hi" }) })));
  assert.equal(r1.status, 200);
  assert.deepEqual((await r1.json()).got, { project: "shop-a1", text: "hi" }, "the request's body arrives whole");
  assert.deepEqual(w.api, ["POST /volumes", "POST /machines"]);
  const [vol] = [...w.volumes.values()], [mach] = [...w.machines.values()];
  assert.deepEqual({ name: vol.name, region: vol.region, size_gb: vol.size_gb }, { name: names.volume, region: "iad", size_gb: 10 });
  assert.equal(mach.name, names.machine);
  assert.deepEqual(mach.config, F.machineConfig(env, vol.id));
  assert.deepEqual(w.door, ["/health", "/turn"]);
  assert.deepEqual(w.keys, [CONTROL], "the machine's control key goes along");
  const rec = JSON.parse(b.m.get(names.key));
  assert.deepEqual({ id: rec.id, volume: rec.volume, image: rec.image, stopped: rec.stopped }, { id: mach.id, volume: vol.id, image: IMG1, stopped: false });
  // AWAKE: straight through, no Fly API call. Its real status comes through.
  w.api.length = 0; w.door.length = 0;
  const r2 = await box.fetch(signed(new Request("http://coder/claim", { method: "POST", body: "{}" })));
  assert.equal(r2.status, 409);
  assert.deepEqual(w.api, []); assert.deepEqual(w.door, ["/claim"]);
  // ASLEEP (stopped by Coder): woken (started), then asked.
  mach.state = "stopped"; await b.put(names.key, JSON.stringify({ ...rec, stopped: true }));
  w.api.length = 0; w.door.length = 0;
  assert.equal((await box.fetch(signed(new Request("http://coder/state?project=shop-a1")))).status, 200);
  assert.deepEqual(w.api, ["GET /machines/" + mach.id, "POST /machines/" + mach.id + "/start"]);
  assert.deepEqual(w.door, ["/health", "/state"], "not asked while asleep");
  assert.equal(JSON.parse(b.m.get(names.key)).stopped, false);
  // A NEW VERSION OF CODER'S MACHINE (after a deploy), while it is awake: not changed under a job.
  const env2 = envWith(b, { CODER_FLY_IMAGE: IMG2 });
  const box2 = F.flyBox(env2, "user-1-shop-a1", deps(w));
  w.api.length = 0;
  await box2.fetch(signed(new Request("http://coder/state?project=shop-a1")));
  assert.deepEqual(w.api, [], "answered by the running version");
  assert.equal(mach.config.image, IMG1);
  // ... and taken when it wakes next (its disk stays).
  mach.state = "stopped"; await b.put(names.key, JSON.stringify({ ...JSON.parse(b.m.get(names.key)), stopped: true }));
  w.api.length = 0;
  await box2.fetch(signed(new Request("http://coder/state?project=shop-a1")));
  assert.deepEqual(w.api, ["GET /machines/" + mach.id, "POST /machines/" + mach.id], "updated (which starts it), not started twice");
  assert.equal(mach.config.image, IMG2);
  assert.deepEqual(mach.config.mounts, [{ volume: vol.id, path: "/data" }], "the same disk");
  assert.equal(JSON.parse(b.m.get(names.key)).image, IMG2);
  // STOPPED BY SOMEONE ELSE (the record says awake): the front door's own answer means "wake it".
  mach.state = "stopped";
  w.door.length = 0;
  assert.equal((await box2.fetch(signed(new Request("http://coder/state?project=shop-a1")))).status, 200);
  assert.deepEqual(w.door, ["/state", "/health", "/state"]);
  // A CUT ANSWER (the machine had the request): a 502, never sent twice.
  w.cut.add(mach.id); w.door.length = 0;
  const cut = await box2.fetch(signed(new Request("http://coder/push", { method: "POST", body: "{}" })));
  assert.equal(cut.status, 502);
  assert.deepEqual(w.door, ["/push"]);
  w.cut.delete(mach.id);
  // GONE (removed on Fly.io): forgotten; the chat's next job gets a new machine and disk.
  w.machines.delete(mach.id); w.api.length = 0;
  assert.equal((await box2.fetch(signed(new Request("http://coder/state?project=shop-a1")))).status, 503);
  assert.deepEqual(w.api, ["GET /machines/" + mach.id]);
  assert.equal(b.m.has(names.key), false);
  assert.equal((await box2.fetch(signed(new Request("http://coder/turn", { method: "POST", body: "{}" })))).status, 200);
  assert.deepEqual(w.api, ["GET /machines/" + mach.id, "POST /volumes", "POST /machines"]);
  assert.notEqual(JSON.parse(b.m.get(names.key)).id, mach.id);
  // ONLY A JOB'S START (or an Undo) MAKES A MACHINE: the every-minute check asking about a
  // new chat whose machine is still being made never makes a second one.
  const b5 = fakeBucket(), w5 = fakeFly();
  const asked = await F.flyBox(envWith(b5), "user-5-new-1", deps(w5)).fetch(signed(new Request("http://coder/state?project=new-1")));
  assert.equal(asked.status, 503);
  assert.deepEqual(w5.api, [], "nothing made");
  assert.equal((await F.flyBox(envWith(b5), "user-5-new-1", deps(w5)).fetch(signed(new Request("http://coder/undo", { method: "POST", body: "{}" })))).status, 200, "an Undo needs the repo, so it may");
  // FLY.IO SAYS "TOO FAST": it waits and asks again. CANNOT MAKE THE DISK: the reason, no half-made machine.
  const b3 = fakeBucket(), w3 = fakeFly(); const waits = [];
  w3.limited = 2;
  assert.equal((await F.flyBox(envWith(b3), "user-2-x-1", { ...deps(w3), sleep: async (ms) => { waits.push(ms); } }).fetch(signed(new Request("http://coder/turn", { method: "POST", body: "{}" })))).status, 200);
  assert.deepEqual(waits.slice(0, 2), [1000, 2000]);
  const b4 = fakeBucket(), w4 = fakeFly(); w4.failVolume = true;
  const no = await F.flyBox(envWith(b4), "user-3-y-1", deps(w4)).fetch(signed(new Request("http://coder/turn", { method: "POST", body: "{}" })));
  assert.equal(no.status, 503);
  assert.match((await no.json()).error, /^Fly\.io could not make the machine's disk \(422\)$/);
  assert.equal(w4.machines.size, 0);
});

test("CD127 every minute on Fly.io: an awake machine with nothing to do for 10 minutes is stopped (a job working or waiting to be saved keeps it on); unused for 30 days, it is removed with its disk; machines and disks no chat knows are removed once an hour old", async () => {
  const b = fakeBucket(), w = fakeFly(), env = envWith(b);
  const now = Date.parse("2026-11-07T12:05:00Z");
  const make = async (chat, state, rec = {}) => {
    const n = await F.flyNames(chat), vid = "vol_" + chat, id = "m_" + chat.replace(/\W/g, "");
    w.volumes.set(vid, { id: vid, name: n.volume, attached_machine_id: id, created_at: new Date(now - 86400e3).toISOString() });
    w.machines.set(id, { id, name: n.machine, state, config: { mounts: [{ volume: vid, path: "/data" }] }, created_at: new Date(now - 86400e3).toISOString() });
    await b.put(n.key, JSON.stringify({ id, volume: vid, image: IMG1, at: now - 86400e3, used: now - 5 * 60e3, stopped: state !== "started", ...rec }));
    return { id, n, vid };
  };
  const idle = await make("idle", "started"); w.busy[idle.id] = { busy: false, working: 0, unsaved: 0, workingMs: 0, unsavedMs: 0, idleMs: 11 * 60e3 };
  const working = await make("working", "started"); w.busy[working.id] = { busy: true, working: 1, unsaved: 0, workingMs: 5 * 60e3, unsavedMs: 0, idleMs: 20 * 60e3 };
  const unsaved = await make("unsaved", "started"); w.busy[unsaved.id] = { busy: true, working: 0, unsaved: 1, workingMs: 0, unsavedMs: 60e3, idleMs: 20 * 60e3 };
  const recent = await make("recent", "started"); w.busy[recent.id] = { busy: false, working: 0, unsaved: 0, workingMs: 0, unsavedMs: 0, idleMs: 2 * 60e3 };
  const waking = await make("waking", "started", { used: now - 60e3 }); w.silent.add(waking.id);
  const silent = await make("silent", "started", { used: now - 20 * 60e3 }); w.silent.add(silent.id);
  const old = await make("old", "stopped", { used: now - 31 * 86400e3 });
  const keep = await make("keep", "stopped", { used: now - 2 * 86400e3 });
  // Machines no chat knows: one made two hours ago, one just now (its record may not be saved yet).
  w.machines.set("m_orphan", { id: "m_orphan", name: "coder-" + "a".repeat(20), state: "stopped", config: { mounts: [{ volume: "vol_orphan", path: "/data" }] }, created_at: new Date(now - 2 * 3600e3).toISOString() });
  w.volumes.set("vol_orphan", { id: "vol_orphan", name: "coder_" + "a".repeat(20), attached_machine_id: "m_orphan", created_at: new Date(now - 2 * 3600e3).toISOString() });
  w.machines.set("m_new", { id: "m_new", name: "coder-" + "b".repeat(20), state: "started", config: { mounts: [] }, created_at: new Date(now - 60e3).toISOString() });
  w.machines.set("m_other", { id: "m_other", name: "someone-elses", state: "started", created_at: new Date(now - 86400e3).toISOString() });
  const sent = [];
  const out = await F.runFlyMachines(env, { ...deps(w), sign: (r) => { sent.push(r.url); return signed(r); } }, now);
  assert.deepEqual(out, { checked: 6, stopped: 2, removed: 2 });
  const st = (x) => (w.machines.get(x.id) || { state: "removed" }).state;
  assert.deepEqual([idle, working, unsaved, recent, waking, silent].map(st), ["stopped", "started", "started", "started", "started", "stopped"]);
  assert.equal(JSON.parse(b.m.get(idle.n.key)).stopped, true, "the record knows it is asleep");
  assert.equal(st(old), "removed"); assert.equal(w.volumes.has(old.vid), false, "with its disk"); assert.equal(b.m.has(old.n.key), false);
  assert.equal(st(keep), "stopped", "2 days unused: kept");
  assert.equal(w.machines.has("m_orphan"), false); assert.equal(w.volumes.has("vol_orphan"), false);
  assert.equal(w.machines.has("m_new"), true, "still being made"); assert.equal(w.machines.has("m_other"), true, "not Coder's");
  assert.ok(sent.every((u) => u === "http://coder/busy"));
  assert.ok(w.keys.every((k) => k === CONTROL), "each /busy carries the control key");
  // ONCE AN HOUR (minute 17): kept disks no machine uses, once an hour old.
  w.volumes.set("vol_loose", { id: "vol_loose", name: "coder_" + "c".repeat(20), attached_machine_id: null, created_at: new Date(now - 3 * 3600e3).toISOString() });
  w.volumes.set("vol_fresh", { id: "vol_fresh", name: "coder_" + "d".repeat(20), attached_machine_id: null, created_at: new Date(now - 60e3).toISOString() });
  await F.runFlyMachines(env, { ...deps(w), sign: signed }, now);
  assert.equal(w.volumes.has("vol_loose"), true, "only at minute 17");
  await F.runFlyMachines(env, { ...deps(w), sign: signed }, Date.parse("2026-11-07T13:17:00Z"));
  assert.equal(w.volumes.has("vol_loose"), false);
  assert.equal(w.volumes.has("vol_fresh"), false, "an hour later it is old too");
  assert.equal(w.volumes.has(keep.vid), true, "a chat's own disk stays");
  // The decision on its own.
  assert.equal(F.shouldStop({ working: 0, unsaved: 0, idleMs: F.FLY_IDLE_MS }, {}, now), true);
  assert.equal(F.shouldStop({ working: 0, unsaved: 0, idleMs: F.FLY_IDLE_MS - 1 }, {}, now), false);
  assert.equal(F.shouldStop({ working: 1, workingMs: 3 * 3600e3, idleMs: F.FLY_IDLE_MS }, {}, now), true, "a stuck job past its 2 hours");
  // Off: nothing.
  assert.deepEqual(await F.runFlyMachines(envWith(b, { CODER_MACHINES: "cloudflare" }), deps(w), now), { checked: 0, stopped: 0, removed: 0 });
  // A REMOVED CHAT takes its machine and disk.
  await F.dropFlyMachine(env, "keep", deps(w));
  assert.equal(w.machines.has(keep.id), false); assert.equal(w.volumes.has(keep.vid), false); assert.equal(b.m.has(keep.n.key), false);
});

test("CD128 the machine on Fly.io: its answers say they are its own; asked for it, it sends a space every few seconds while it works and its real status last; only the Worker's own requests count as being busy; the chat's files go on the kept disk", async () => {
  const { createApp, dataDirs, KEEPALIVE_MS } = await import("../container/server.mjs");
  assert.equal(KEEPALIVE_MS, 15000, "well within Fly's 60 quiet seconds");
  const srv = http.createServer(createApp({ env: { CODER_CONTROL_KEY: CONTROL }, keepaliveMs: 5 }));
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  const port = srv.address().port, base = "http://127.0.0.1:" + port;
  try {
    const plain = await fetch(base + "/health");
    assert.equal(plain.headers.get("x-coder-machine"), "1");
    assert.deepEqual(await plain.json(), { ok: true });
    // Wrapped: 200 at once, the real status and answer last.
    const w = await fetch(base + "/stop", { method: "POST", headers: { "x-coder-key": CONTROL, "x-coder-keepalive": "1" }, body: JSON.stringify({ project: "shop-a1" }) });
    assert.equal(w.status, 200);
    assert.equal(w.headers.get("x-coder-keepalive"), "1");
    assert.deepEqual(JSON.parse(await w.text()), { coderStatus: 200, body: { ok: true, running: false } });
    const no = await fetch(base + "/stop", { method: "POST", headers: { "x-coder-keepalive": "1" }, body: "{}" });
    assert.deepEqual(JSON.parse(await no.text()), { coderStatus: 403, body: { error: "not allowed" } });
    // A slow request: spaces while it waits (here, a body that comes slowly), then the answer.
    const text = await new Promise((ok, bad) => {
      const req = http.request({ host: "127.0.0.1", port, path: "/stop", method: "POST", headers: { "x-coder-key": CONTROL, "x-coder-keepalive": "1", "content-type": "application/json" } }, (res) => { let s = ""; res.on("data", (c) => { s += c; }); res.on("end", () => ok(s)); });
      req.on("error", bad);
      req.write('{"project":');
      setTimeout(() => req.end('"shop-a1"}'), 60);
    });
    assert.match(text, /^ +\{"coderStatus":200,/, "spaces came first");
    // QUIET TIME: /busy and requests without the key never count; the Worker's own requests do.
    const busy = async () => (await (await fetch(base + "/busy", { headers: { "x-coder-key": CONTROL } })).json()).idleMs;
    await new Promise((ok) => setTimeout(ok, 30));
    const a = await busy();
    await fetch(base + "/state?project=shop-a1");
    await new Promise((ok) => setTimeout(ok, 30));
    assert.ok((await busy()) > a, "a request without the key keeps nobody awake");
    await fetch(base + "/state?project=shop-a1", { headers: { "x-coder-key": CONTROL } });
    assert.ok((await busy()) < 30, "the Worker's request does");
  } finally { await new Promise((ok) => srv.close(ok)); }
  // ON FLY.IO WITHOUT ITS KEY: nothing but /health (its panel is never open on the internet).
  const open = http.createServer(createApp({ env: { FLY_MACHINE_ID: "m123" } }));
  await new Promise((ok) => open.listen(0, "127.0.0.1", ok));
  try {
    const ob = "http://127.0.0.1:" + open.address().port;
    assert.equal((await fetch(ob + "/health")).status, 200);
    for (const [p, m] of [["/turn", "POST"], ["/state?project=shop-a1", "GET"], ["/busy", "GET"], ["/stop", "POST"]]) {
      const r = await fetch(ob + p, { method: m, ...(m === "POST" ? { body: "{}" } : {}) });
      assert.equal(r.status, 503, p);
      assert.deepEqual(await r.json(), { error: "this machine has no control key" });
    }
  } finally { await new Promise((ok) => open.close(ok)); }
  // THE KEPT DISK: projects, git folders and memory live there; the setup's marks do not.
  const { mkdtemp, stat } = await import("node:fs/promises"); const { tmpdir } = await import("node:os"); const { join } = await import("node:path");
  const top = await mkdtemp(join(tmpdir(), "coder-data-"));
  const d = dataDirs(join(top, "data"), { setupRoot: join(top, "setup"), owner: null });
  assert.deepEqual(d, { root: join(top, "data", "work"), gitRoot: join(top, "data", "git"), memRoot: join(top, "data", "memory"), setupRoot: join(top, "setup") });
  for (const p of Object.values(d)) assert.equal((await stat(p)).mode & 0o777, 0o755);
  for (const bad of [undefined, "", "data", "/data/../etc", "/da ta"]) assert.deepEqual(dataDirs(bad), {}, String(bad));
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /const mark = join\(setupRoot \|\| gitRoot, project \+ "\.setup-done"\);/);
  assert.match(server, /const lastFile = join\(setupRoot \|\| gitRoot, project \+ "\.setup-last"\);/);
  assert.match(readFileSync(new URL("../container/Dockerfile", import.meta.url), "utf8"), /mkdir -p \/srv\/coder-git \/srv\/coder-memory \/srv\/coder-bg \/srv\/coder-setup/);
});

test("CD129 wiring: the switch between Fly.io and Cloudflare, the every-minute Fly step, a removed chat's machine, and the deploy button's Fly.io steps (the token only from GitHub's secrets, never shown)", async () => {
  const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(worker, /if \(flyOn\(env\)\) return \{ kind: "fly", sign, container: \(name\) => \{ const box = flyBox\(env, name\); return \{ fetch: \(req\) => box\.fetch\(sign\(req\)\) \}; \}, drop: \(name\) => dropFlyMachine\(env, name\) \};/);
  assert.match(worker, /return \{ kind: "cloudflare", sign, container: \(name\) => \{ const box = getContainer\(env\.CODER_CONTAINER, name\); return \{ fetch: \(req\) => box\.fetch\(sign\(req\)\) \}; \}, drop: async \(\) => \{\} \};/);
  assert.match(worker, /if \(m\.kind === "fly"\) ctx\.waitUntil\(runFlyMachines\(env, \{ sign: m\.sign \}\)/);
  assert.match(worker, /res = await handleCoder\(request, env, ctx, \{ authUser: \(r\) => authUser\(r, env\), container: m\.container, dropMachine: m\.drop \}\);/);
  const { controlKeySync } = await import("../src/coder-control.mjs");
  assert.match(controlKeySync("k".repeat(44)), /^[0-9a-f]{32}$/);
  const wr = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  assert.match(wr, /"CODER_MACHINES": "cloudflare",\n\s+"CODER_FLY_APP": "gofarther-coder-machines",\n\s+"CODER_FLY_REGION": "iad",/, "Cloudflare until the deploy switches it");
  // A REMOVED CHAT: its machine goes too.
  const { handleCoder } = await import("../src/coder-routes.mjs");
  const b = fakeBucket(); const dropped = [];
  await b.put("coder/user-1234567890abcdef/shop-z1/meta.json", JSON.stringify({ id: "shop-z1", repo: "ana/shop", status: "idle", turn: 1 }));
  const r = await handleCoder(new Request("https://gofarther.dev/api/coder/projects/shop-z1", { method: "DELETE" }), { CODER_ON: "on", CODER_USERS: "me@x.y", CODER_BUCKET: b }, {}, { authUser: async () => ({ id: "user-1234567890abcdef", email: "me@x.y" }), container: () => ({ fetch: async () => Response.json({}) }), dropMachine: async (n) => { dropped.push(n); } });
  assert.equal(r.status, 200);
  assert.deepEqual(dropped, ["user-1234567890abcdef-shop-z1"]);
  // THE DEPLOY BUTTON.
  const y = readFileSync(new URL("../../.github/workflows/deploy-coder.yml", import.meta.url), "utf8");
  assert.match(y, /machines:\n\s+description: [^\n]*\n\s+type: choice\n\s+options: \[fly, cloudflare\]\n\s+default: fly/);
  assert.match(y, /if \[ -n "\$FLY_API_TOKEN" \] && \[ "\$WANT" = "fly" \]; then/, "only with the secret, and fly picked");
  for (const step of ["Fly.io: install flyctl", "Fly.io: the app, its addresses and Coder's keys (made once; fine if they exist)", "Fly.io: build Coder's machine and send it", "Fly.io: give the Worker the token"]) {
    assert.match(y, new RegExp("- name: \"" + step.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\"(\\n\\s+id: \\w+)?\\n\\s+if: steps\\.fly\\.outputs\\.on == 'true'"), step);
  }
  assert.match(y, /FLY_API_TOKEN: \$\{\{ secrets\.FLY_API_TOKEN \}\}/);
  assert.doesNotMatch(y, /echo (?!"::add-mask::)[^\n]*\$\{?(FLY_API_TOKEN|XAI_API_KEY|ck)\b/, "never shown (only masked)");
  assert.match(y, /echo "::add-mask::\$ck"/);
  assert.match(y, /printf 'XAI_API_KEY=%s\\nCODER_CONTROL_KEY=%s\\n' "\$XAI_API_KEY" "\$ck" \| flyctl secrets import -a "\$FLY_APP" --stage/, "keys from standard input, not a command line");
  assert.match(y, /img="registry\.fly\.io\/\$FLY_APP:coder-\$\{GITHUB_SHA::12\}"\n\s+docker build -t "\$img" container\n\s+docker push "\$img"/);
  assert.match(y, /printf '%s' "\$FLY_API_TOKEN" \| npx --yes wrangler@4\.107\.0 secret put FLY_API_TOKEN/);
  assert.match(y, /command: deploy --var CODER_MACHINES:\$\{\{ steps\.fly\.outputs\.on == 'true' && 'fly' \|\| 'cloudflare' \}\} --var CODER_FLY_APP:\$\{\{ env\.FLY_APP \}\} --var CODER_FLY_IMAGE:\$\{\{ steps\.flyimage\.outputs\.image \|\| 'none' \}\}/);
});
