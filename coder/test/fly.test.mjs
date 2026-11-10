// CODER'S MACHINES ON FLY.IO (owner, 2026-11-07: "YES OPTION 2", "OK LETS START
// THEN"): one small VM per chat, stopped when quiet with its disk kept, like
// Claude Code's. Driven against a stand-in for Fly's Machines API and front door.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import http from "node:http";

const F = await import("../src/coder-fly.mjs");
const APP = "gofarther-coder-machines", TOKEN = "fly-token-0123456789", CONTROL = "c".repeat(32), TKEY = "t".repeat(44);
const { controlKeySync, controlKeyFor } = await import("../src/coder-control.mjs");
const IMG1 = "registry.fly.io/" + APP + ":coder-aaaaaaaaaaaa", IMG2 = "registry.fly.io/" + APP + ":coder-bbbbbbbbbbbb";

function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}
const envWith = (bucket, o = {}) => ({ CODER_MACHINES: "fly", FLY_API_TOKEN: TOKEN, CODER_FLY_APP: APP, CODER_FLY_IMAGE: IMG1, CODER_BUCKET: bucket, ...o });

/** Fly.io as far as Coder uses it: the Machines API, and the front door to each machine. */
function fakeFly() {
  // noRoom: no server has room for a machine of Fly's "performance" kind; noRoomDisk: nor for a disk meant for one.
  // snaps: the disks' saved copies (listed after `snapLag` lookups, then "waiting" for `snapWait` and "running" for `snapRun`
  // more, then "created"; Fly refuses a disk from one not yet created); badCopy: Fly refuses a disk from any copy; restoreFor:
  // a disk made from a copy is "restoring" for that many lookups (no machine on it meanwhile); noMachineOnCopy: none at all;
  // sent: the header names the machines were sent; told: what each machine's job start was told of the copy (x-coder-copy).
  const w = { machines: new Map(), volumes: new Map(), api: [], door: [], seq: 0, busy: {}, silent: new Set(), cut: new Set(), limited: 0, failVolume: false, noRoom: false, noRoomDisk: false, keys: [], snaps: new Map(), snapLag: 1, snapWait: 0, snapRun: 0, badCopy: false, restoreFor: 0, noMachineOnCopy: false, sent: [], told: [] };
  const snapState = (x) => x.lag > 0 ? "" : x.waiting > 0 ? "waiting" : x.running > 0 ? "running" : "created";
  const J = (o, s = 200, h = {}) => new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json", ...h } });
  const roomless = (cfg) => w.noRoom && cfg && cfg.guest && cfg.guest.cpu_kind === "performance";
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
        if (w.noRoomDisk && body.compute && body.compute.cpu_kind === "performance") return J({ error: "insufficient resources to place volume" }, 412);
        if (body.snapshot_id && (w.badCopy || !w.snaps.has(body.snapshot_id))) return J({ error: "snapshot not found" }, 404);
        if (body.snapshot_id && snapState(w.snaps.get(body.snapshot_id)) !== "created") return J({ error: "snapshot " + body.snapshot_id + " is not ready \u2014 try later" }, 422);
        const id = "vol_" + ++w.seq; w.volumes.set(id, { id, ...body, state: body.snapshot_id && w.restoreFor > 0 ? "restoring" : "created", restoring: body.snapshot_id ? w.restoreFor : 0, attached_machine_id: null, created_at: new Date(Date.now() - 2 * 3600e3).toISOString() }); return J(w.volumes.get(id));
      }
      if (method === "POST" && p === "/machines") {
        if (roomless(body.config)) return J({ error: "insufficient resources available to fulfill request" }, 412);
        const vol = w.volumes.get(body.config.mounts[0].volume);
        if (vol && vol.snapshot_id && (w.noMachineOnCopy || vol.state !== "created")) return J({ error: "volume " + vol.id + " didn't reach a mountable state" }, 503);
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
        if (method === "POST") { if (roomless(body.config)) return J({ error: "insufficient resources available to fulfill request" }, 412); x.config = body.config; x.state = "started"; return J(x); }
        if (method === "DELETE") { w.machines.delete(m[1]); for (const v of w.volumes.values()) if (v.attached_machine_id === m[1]) v.attached_machine_id = null; return J({ ok: true }); }
      }
      if (method === "DELETE" && (m = /^\/volumes\/(\w+)$/.exec(p))) { w.volumes.delete(m[1]); return J({ ok: true }); }
      if (method === "GET" && (m = /^\/volumes\/(\w+)$/.exec(p))) { const v = w.volumes.get(m[1]); if (!v) return J({ error: "not found" }, 404); if (v.restoring > 0 && --v.restoring === 0) v.state = "created"; return J(v); }
      if (method === "PUT" && (m = /^\/volumes\/(\w+)$/.exec(p))) { const v = w.volumes.get(m[1]); if (!v) return J({}, 404); Object.assign(v, body); return J(v); }
      if ((m = /^\/volumes\/(\w+)\/snapshots$/.exec(p))) {
        const v = w.volumes.get(m[1]);
        if (!v) return J({ error: "not found" }, 404);
        if (method === "POST") { const id = "vs_Snap" + ++w.seq; w.snaps.set(id, { id, volume: m[1], size: 36007729, retention_days: v.snapshot_retention || 5, lag: w.snapLag, waiting: w.snapWait, running: w.snapRun }); return J({ Msg: { backup: { id: "85999", volume_id: "9151365284627104", state: "prepare", type: "BACKUP_TYPE_ON_DEMAND", graph_id: id } } }); }
        if (method === "GET") {
          // As Fly's list shows them (live, 2026-11-07): an unfinished copy has no date yet and no days kept.
          const out = [];
          for (const x of w.snaps.values()) {
            if (x.volume !== m[1]) continue;
            const st = snapState(x);
            if (st === "") { x.lag--; continue; }
            out.push(st === "created" ? { id: x.id, size: x.size, digest: "d", created_at: "2026-11-07T12:00:00Z", status: "created", retention_days: x.retention_days, volume_size: 10 } : { id: x.id, size: 0, digest: "", created_at: "0001-01-01T00:00:00Z", status: st, volume_size: 10 });
            if (st === "waiting") x.waiting--; else if (st === "running") x.running--;
          }
          return J(out);
        }
      }
      return J({ error: "unknown " + method + " " + p }, 400);
    }
    if (u.host === APP + ".fly.dev") {
      const h = new Headers(init.headers);
      const id = h.get("fly-force-instance-id"), x = w.machines.get(id);
      w.door.push(u.pathname);
      // Fly's own answer: the machine is asleep, gone or not answering.
      if (!x || x.state !== "started" || w.silent.has(id)) return new Response("could not reach the machine", { status: 503 });
      if (u.pathname !== "/health") w.keys.push(h.get("x-coder-key"));
      if (u.pathname === "/turn") w.told.push(h.get("x-coder-copy"));
      assert.equal(h.get("x-coder-keepalive"), "1", "always asks for the still-working answer");
      if (w.cut.has(id)) return new Response("   {\"coderSta", { status: 200, headers: { "x-coder-machine": "1", "x-coder-keepalive": "1" } });
      let status = 200, body = { ok: true };
      if (u.pathname === "/busy") body = w.busy[id] || { busy: false, working: 0, unsaved: 0, workingMs: 0, unsavedMs: 0, idleMs: 0 };
      if (u.pathname === "/turn") { body = { ok: true, got: JSON.parse(new TextDecoder().decode(init.body)) }; status = 200; w.sent.push([...h.keys()]); }
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
  assert.deepEqual(F.flySettings(envWith(b)), { app: APP, image: IMG1, region: "iad", kind: "performance", cpus: 4, memory: 16384, disk: 10, diskMax: 50, root: 20 });
  assert.deepEqual(F.flySettings(envWith(b, { CODER_FLY_REGION: "ams", CODER_FLY_CPUS: "4", CODER_FLY_MEMORY_MB: "8192", CODER_FLY_DISK_GB: "20", CODER_FLY_ROOT_GB: "30" })), { app: APP, image: IMG1, region: "ams", kind: "performance", cpus: 4, memory: 8192, disk: 20, diskMax: 50, root: 30 });
  assert.equal(F.flySettings(envWith(b, { CODER_FLY_ROOT_GB: "99" })).root, 20, "Fly allows at most 50");
  assert.equal(F.flySettings(envWith(b, { CODER_FLY_CPUS: "99", CODER_FLY_REGION: "x" })).cpus, 4, "nonsense falls back");
  assert.deepEqual(F.machineConfig(envWith(b, { CODER_MODEL: "default" }), "vol_9"), {
    image: IMG1,
    env: { CODER_DATA: "/data", CODER_IMAGE_REF: IMG1, CODER_MODEL: "default" },
    guest: { cpu_kind: "performance", cpus: 4, memory_mb: 16384 },
    rootfs: { persist: "restart", size_gb: 20 },
    mounts: [{ volume: "vol_9", path: "/data", extend_threshold_percent: 80, add_size_gb: 10, size_gb_limit: 50 }],
    services: [{ protocol: "tcp", internal_port: 8080, ports: [{ port: 443, handlers: ["tls", "http"] }], autostart: false, autostop: "off" }],
    restart: { policy: "on-failure", max_retries: 3 },
    metadata: { coder: "chat-machine" },
  });
  assert.equal(JSON.stringify(F.machineConfig(envWith(b, { XAI_API_KEY: "xai-secret" }), "v")).includes("xai-secret"), false, "the AI key is never in the machine's settings (it stays on the Worker)");
  // ITS LOCK, ALWAYS: the control key (made from CODER_TOKEN_KEY, never that key itself) is in its settings too.
  const { controlKeySync } = await import("../src/coder-control.mjs");
  const tk = Buffer.alloc(32, 7).toString("base64");
  const withKey = F.machineConfig(envWith(b, { CODER_TOKEN_KEY: tk }), "v");
  assert.equal(withKey.env.CODER_CONTROL_KEY, controlKeySync(tk));
  assert.equal(JSON.stringify(withKey).includes(tk), false);
});

test("CD126 a chat's machine on Fly.io: made with its disk on first use, then asked straight through the front door; asleep, it is woken; a new machine version is taken only while asleep; gone, a new one is made; a cut answer is never sent twice", async () => {
  const b = fakeBucket(), w = fakeFly(), env = envWith(b, { CODER_TOKEN_KEY: TKEY });
  const box = F.flyBox(env, "user-1-shop-a1", deps(w));
  const names = await F.flyNames("user-1-shop-a1");
  const own = await controlKeyFor(TKEY, names.machine);
  // FIRST USE: its disk, then the machine on it; once it answers, the request.
  const r1 = await box.fetch(signed(new Request("http://coder/turn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: "shop-a1", text: "hi" }) })));
  assert.equal(r1.status, 200);
  assert.deepEqual((await r1.json()).got, { project: "shop-a1", text: "hi" }, "the request's body arrives whole");
  assert.deepEqual(w.api, ["POST /volumes", "POST /machines"]);
  const [vol] = [...w.volumes.values()], [mach] = [...w.machines.values()];
  assert.deepEqual({ name: vol.name, region: vol.region, size_gb: vol.size_gb }, { name: names.volume, region: "iad", size_gb: 10 });
  assert.deepEqual(vol.compute, { cpu_kind: "performance", cpus: 4, memory_mb: 16384 }, "its disk on a server with room for its size");
  assert.equal(mach.name, names.machine);
  assert.deepEqual(mach.config, F.machineConfig(env, vol.id, { lock: own }), "made with its own lock key (step 2)");
  assert.equal(mach.config.env.CODER_CONTROL_KEY, own);
  assert.deepEqual(w.door, ["/health", "/turn"]);
  assert.deepEqual(w.keys, [own], "its own lock key goes along, never the one the caller sent");
  const rec = JSON.parse(b.m.get(names.key));
  assert.deepEqual({ id: rec.id, volume: rec.volume, image: rec.image, shape: rec.shape, small: rec.small, stopped: rec.stopped, lock: rec.lock }, { id: mach.id, volume: vol.id, image: IMG1, shape: "performance/4/16384/50/20", small: false, stopped: false, lock: 2 });
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
  const env2 = envWith(b, { CODER_FLY_IMAGE: IMG2, CODER_TOKEN_KEY: TKEY });
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
  assert.deepEqual(mach.config.mounts, [{ volume: vol.id, path: "/data", extend_threshold_percent: 80, add_size_gb: 10, size_gb_limit: 50 }], "the same disk");
  assert.equal(JSON.parse(b.m.get(names.key)).image, IMG2);
  // A MACHINE FROM BEFORE (the shared lock key) gets its own at this update, and is asked with it from then on (step 2).
  assert.equal(mach.config.env.CODER_CONTROL_KEY, own);
  assert.equal(JSON.parse(b.m.get(names.key)).lock, 2);
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
  const b = fakeBucket(), w = fakeFly(), env = envWith(b, { CODER_TOKEN_KEY: TKEY });
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
  const modern = await make("modern", "started", { lock: 2 }); w.busy[modern.id] = { busy: false, working: 0, unsaved: 0, workingMs: 0, unsavedMs: 0, idleMs: 60e3 };
  const waking = await make("waking", "started", { used: now - 60e3 }); w.silent.add(waking.id);
  const silent = await make("silent", "started", { used: now - 20 * 60e3 }); w.silent.add(silent.id);
  const old = await make("old", "stopped", { used: now - 31 * 86400e3 });
  const keep = await make("keep", "stopped", { used: now - 2 * 86400e3 });
  // Machines no chat knows: one made two hours ago, one just now (its record may not be saved yet).
  w.machines.set("m_orphan", { id: "m_orphan", name: "coder-" + "a".repeat(20), state: "stopped", config: { mounts: [{ volume: "vol_orphan", path: "/data" }] }, created_at: new Date(now - 2 * 3600e3).toISOString() });
  w.volumes.set("vol_orphan", { id: "vol_orphan", name: "coder_" + "a".repeat(20), attached_machine_id: "m_orphan", created_at: new Date(now - 2 * 3600e3).toISOString() });
  w.machines.set("m_new", { id: "m_new", name: "coder-" + "b".repeat(20), state: "started", config: { mounts: [] }, created_at: new Date(now - 60e3).toISOString() });
  w.machines.set("m_other", { id: "m_other", name: "someone-elses", state: "started", created_at: new Date(now - 86400e3).toISOString() });
  const out = await F.runFlyMachines(env, deps(w), now);
  assert.deepEqual(out, { checked: 7, stopped: 2, removed: 2 });
  const st = (x) => (w.machines.get(x.id) || { state: "removed" }).state;
  assert.deepEqual([idle, working, unsaved, recent, waking, silent].map(st), ["stopped", "started", "started", "started", "started", "stopped"]);
  assert.equal(JSON.parse(b.m.get(idle.n.key)).stopped, true, "the record knows it is asleep");
  assert.equal(st(old), "removed"); assert.equal(w.volumes.has(old.vid), false, "with its disk"); assert.equal(b.m.has(old.n.key), false);
  assert.equal(st(keep), "stopped", "2 days unused: kept");
  assert.equal(w.machines.has("m_orphan"), false); assert.equal(w.volumes.has("vol_orphan"), false);
  assert.equal(w.machines.has("m_new"), true, "still being made"); assert.equal(w.machines.has("m_other"), true, "not Coder's");
  assert.ok(w.door.every((u) => u === "/busy"));
  // EACH MACHINE'S OWN LOCK KEY (step 2): its own once it has one; the old shared one for a machine from before.
  const legacy = controlKeySync(TKEY), mine = await controlKeyFor(TKEY, modern.n.machine);
  assert.deepEqual([...w.keys].sort(), [legacy, legacy, legacy, legacy, mine].sort(), "each /busy carries that machine's key");
  assert.notEqual(mine, legacy);
  // ONCE AN HOUR (minute 17): kept disks no machine uses, once an hour old.
  w.volumes.set("vol_loose", { id: "vol_loose", name: "coder_" + "c".repeat(20), attached_machine_id: null, created_at: new Date(now - 3 * 3600e3).toISOString() });
  w.volumes.set("vol_fresh", { id: "vol_fresh", name: "coder_" + "d".repeat(20), attached_machine_id: null, created_at: new Date(now - 60e3).toISOString() });
  await F.runFlyMachines(env, deps(w), now);
  assert.equal(w.volumes.has("vol_loose"), true, "only at minute 17");
  await F.runFlyMachines(env, deps(w), Date.parse("2026-11-07T13:17:00Z"));
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
  // The AI's home is on the kept disk too (2026-11-07): what it installs for itself and its caches stay, never in a project.
  assert.deepEqual(d, { root: join(top, "data", "work"), gitRoot: join(top, "data", "git"), memRoot: join(top, "data", "memory"), setupRoot: join(top, "setup"), home: join(top, "data", "home") });
  for (const p of Object.values(d)) assert.equal((await stat(p)).mode & 0o777, 0o755);
  for (const bad of [undefined, "", "data", "/data/../etc", "/da ta"]) assert.deepEqual(dataDirs(bad), {}, String(bad));
  const server = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.match(server, /const mark = join\(setupRoot \|\| gitRoot, project \+ "\.setup-done"\);/);
  assert.match(server, /const lastFile = join\(setupRoot \|\| gitRoot, project \+ "\.setup-last"\);/);
  assert.match(readFileSync(new URL("../container/Dockerfile", import.meta.url), "utf8"), /mkdir -p \/srv\/coder-git \/srv\/coder-memory \/srv\/coder-bg \/srv\/coder-setup/);
});

test("CD129 wiring: the switch between Fly.io and Cloudflare, the every-minute Fly step, a removed chat's machine, and the deploy button's Fly.io steps (the token only from GitHub's secrets, never shown)", async () => {
  const worker = readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  assert.match(worker, /if \(flyOn\(env\)\) return \{ kind: "fly", sign, container: \(name\) => \{ const box = flyBox\(env, name\); return \{ fetch: \(req\) => box\.fetch\(req\) \}; \}, drop: \(name\) => dropFlyMachine\(env, name\), snapshot: \(name\) => snapshotChat\(env, name\), cacheUsable: \(c, key\) => cacheUsable\(env, c, key\), copyState: \(c\) => copyState\(env, c\) \};/, "on Fly.io, flyBox adds each machine's own key; the environment's saved copy is Fly's");
  assert.match(worker, /return \{ kind: "cloudflare", sign, container: \(name\) => \{ const box = getContainer\(env\.CODER_CONTAINER, name\); return \{ fetch: \(req\) => box\.fetch\(sign\(req\)\) \}; \}, drop: async \(\) => \{\} \};/);
  assert.match(worker, /if \(m\.kind === "fly"\) job\(runFlyMachines\(env\)/);
  assert.match(worker, /res = await handleCoder\(request, env, ctx, \{ authUser: \(r\) => authUser\(r, env\), container: m\.container, dropMachine: m\.drop, snapshot: m\.snapshot, cacheUsable: m\.cacheUsable, copyState: m\.copyState \}\);/);
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
  // NO KEYS ON FLY.IO ITSELF (2026-11-07): the Grok key stays on the Worker, each machine's lock key is in its own
  // settings; the shared copies Fly.io held are taken away, and none is given again.
  assert.doesNotMatch(y, /flyctl secrets import/);
  assert.match(y, /for k in XAI_API_KEY CODER_CONTROL_KEY; do\n[\s\S]{0,240}flyctl secrets unset "\$k" -a "\$FLY_APP" --stage/);
  assert.match(y, /img="registry\.fly\.io\/\$FLY_APP:coder-\$\(git rev-parse HEAD:coder\/container \| cut -c1-12\)"\n/, "named after the machine's own folder: a deploy that does not change it leaves the machines as they are");
  // ALL OF CLAUDE CODE'S TOOLS (2026-11-07): Fly.io's machines get the full image, built only when that version is not there yet.
  // (2026-11-10: the tools are built once and kept on Fly.io; each deploy builds only Coder's own files on top, CD376.)
  assert.match(y, /if docker manifest inspect "\$img" >\/dev\/null 2>&1; then\n[^\n]*not built again[^\n]*\n\s+else\n[^\n]*\n(\s+#[^\n]*\n)*\s+base="registry\.fly\.io\/\$FLY_APP:coder-tools-[^\n]*\n\s+if docker manifest inspect "\$base" >\/dev\/null 2>&1; then\n[^\n]*only Coder's own files are built[^\n]*\n\s+else\n\s+docker build --build-arg CODER_IMAGE=full --target full -t "\$base" container\n\s+send "\$base"\n\s+fi\n\s+docker build --build-arg CODER_IMAGE="\$base" -t "\$img" container [^\n]*\n\s+send "\$img"\n\s+fi\n/);
  // (Fly.io's image store cut the upload off twice in a row on 2026-11-10: each upload is tried up to five times.)
  assert.match(y, /send\(\) \{\n\s+for try in 1 2 3 4 5; do\n\s+if docker push "\$1"; then return 0; fi\n\s+if \[ "\$try" = 5 \]; then echo "The upload to Fly\.io failed five times\."; return 1; fi\n/);
  // The name is the same as long as coder/container is (a change elsewhere, like the notes, keeps it).
  const { execFileSync } = await import("node:child_process");
  const tree = (rev) => execFileSync("git", ["rev-parse", rev + ":coder/container"], { cwd: new URL("../..", import.meta.url).pathname }).toString().trim();
  assert.match(tree("HEAD"), /^[0-9a-f]{40}$/);
  assert.match(y, /printf '%s' "\$FLY_API_TOKEN" \| npx --yes wrangler@4\.107\.0 secret put FLY_API_TOKEN/);
  assert.match(y, /command: deploy --var CODER_MACHINES:\$\{\{ steps\.fly\.outputs\.on == 'true' && 'fly' \|\| 'cloudflare' \}\} --var CODER_FLY_APP:\$\{\{ env\.FLY_APP \}\} --var CODER_FLY_IMAGE:\$\{\{ steps\.flyimage\.outputs\.image \|\| 'none' \}\}/);
});

test("CD143 the size (owner, 2026-11-07: \"4 CPUs, 16 GB\", like Claude Code's machine; \"Grow to 50 GB\"): full CPUs and 16 GB, a work disk that grows by itself, its disk placed where that size fits; with no room, the size chats had before, so the chat still works; a machine from before gets the new size when it next wakes, never under a job", async () => {
  const b = fakeBucket();
  // FLY.IO'S RULES: a size outside them falls back.
  const S = (o) => { const s = F.flySettings(envWith(b, o)); return [s.kind, s.cpus, s.memory, s.disk, s.diskMax]; };
  assert.deepEqual(S({}), ["performance", 4, 16384, 10, 50], "4 full CPUs, 16 GB; a 10 GB disk that grows to 50");
  assert.deepEqual(S({ CODER_FLY_CPU_KIND: "shared", CODER_FLY_CPUS: "2", CODER_FLY_MEMORY_MB: "4096" }), ["shared", 2, 4096, 10, 50], "the size before, if ever wanted");
  assert.deepEqual(S({ CODER_FLY_CPU_KIND: "shared", CODER_FLY_CPUS: "9" }), ["shared", 4, 8192, 10, 50], "shared: at most 8 CPUs and 2 GB each");
  assert.deepEqual(S({ CODER_FLY_CPUS: "4", CODER_FLY_MEMORY_MB: "4096" }), ["performance", 4, 16384, 10, 50], "full CPUs need 2 GB each");
  assert.deepEqual(S({ CODER_FLY_MEMORY_MB: "9000" }), ["performance", 4, 16384, 10, 50], "in steps of 2 GB");
  assert.deepEqual(S({ CODER_FLY_CPUS: "16" }), ["performance", 16, 32768, 10, 50]);
  assert.deepEqual(S({ CODER_FLY_CPUS: "1" }), ["performance", 1, 8192, 10, 50], "at most 8 GB a CPU");
  assert.deepEqual(S({ CODER_FLY_CPU_KIND: "huge", CODER_FLY_CPUS: "17" }), ["performance", 4, 16384, 10, 50]);
  assert.deepEqual(S({ CODER_FLY_DISK_MAX_GB: "100" }), ["performance", 4, 16384, 10, 100]);
  assert.deepEqual(S({ CODER_FLY_DISK_MAX_GB: "5", CODER_FLY_DISK_GB: "600" }), ["performance", 4, 16384, 10, 50], "Fly allows 500 GB at most; never less than the disk");
  assert.equal(F.flyShape(F.flySettings(envWith(b))), "performance/4/16384/50/20");
  assert.deepEqual(F.FLY_SMALL, { cpu_kind: "shared", cpus: 2, memory_mb: 4096 }, "the size chats had before");
  assert.deepEqual(F.SIZE_TRIES, [{}, { small: true }, { small: true, grow: false }]);
  assert.deepEqual(F.machineConfig(envWith(b), "v", { small: true }).guest, F.FLY_SMALL);
  assert.deepEqual(F.machineConfig(envWith(b), "v", { small: true, grow: false }).mounts, [{ volume: "v", path: "/data" }]);
  assert.deepEqual(F.machineConfig(envWith(b, { CODER_FLY_DISK_MAX_GB: "10" }), "v").mounts, [{ volume: "v", path: "/data" }], "no room to grow: Fly is not asked to");
  const turn = () => signed(new Request("http://coder/turn", { method: "POST", body: "{}" }));

  // NO ROOM FOR THE SIZE (Fly.io refuses it): the chat's machine is made at the size before, and works.
  const b1 = fakeBucket(), w1 = fakeFly(); w1.noRoom = true;
  assert.equal((await F.flyBox(envWith(b1), "user-1-a-1", deps(w1)).fetch(turn())).status, 200);
  assert.deepEqual(w1.api, ["POST /volumes", "POST /machines", "POST /machines"]);
  const [m1] = [...w1.machines.values()], n1 = await F.flyNames("user-1-a-1");
  assert.deepEqual(m1.config.guest, F.FLY_SMALL);
  assert.equal(m1.config.mounts[0].size_gb_limit, 50, "its disk still grows");
  assert.deepEqual((({ shape, small }) => ({ shape, small }))(JSON.parse(b1.m.get(n1.key))), { shape: "performance/4/16384/50/20", small: true });
  // ... AND IT IS NOT TRIED AGAIN AT EACH WAKE (each try would start its own disk fresh): only with Coder's next version.
  m1.state = "stopped"; await b1.put(n1.key, JSON.stringify({ ...JSON.parse(b1.m.get(n1.key)), stopped: true }));
  w1.api.length = 0; w1.noRoom = false;
  await F.flyBox(envWith(b1), "user-1-a-1", deps(w1)).fetch(signed(new Request("http://coder/state?project=a-1")));
  assert.deepEqual(w1.api, ["GET /machines/" + m1.id, "POST /machines/" + m1.id + "/start"], "woken as it is");
  m1.state = "stopped"; await b1.put(n1.key, JSON.stringify({ ...JSON.parse(b1.m.get(n1.key)), stopped: true }));
  w1.api.length = 0;
  await F.flyBox(envWith(b1, { CODER_FLY_IMAGE: IMG2 }), "user-1-a-1", deps(w1)).fetch(signed(new Request("http://coder/state?project=a-1")));
  assert.deepEqual(w1.api, ["GET /machines/" + m1.id, "POST /machines/" + m1.id], "a new version: the size is asked for again");
  assert.deepEqual(m1.config.guest, { cpu_kind: "performance", cpus: 4, memory_mb: 16384 }, "and given, now that there is room");
  assert.equal(JSON.parse(b1.m.get(n1.key)).small, false);

  // NO ROOM FOR ITS DISK ON A SERVER THAT FITS THE SIZE: the disk where the size before fits, then that size.
  const b2 = fakeBucket(), w2 = fakeFly(); w2.noRoom = true; w2.noRoomDisk = true;
  assert.equal((await F.flyBox(envWith(b2), "user-2-b-1", deps(w2)).fetch(turn())).status, 200);
  assert.deepEqual(w2.api, ["POST /volumes", "POST /volumes", "POST /machines", "POST /machines"]);
  assert.deepEqual([...w2.volumes.values()].map((v) => v.compute), [F.FLY_SMALL], "one disk, placed for the size before");
  assert.deepEqual([...w2.machines.values()][0].config.guest, F.FLY_SMALL);

  // A MACHINE FROM BEFORE THIS CHANGE (2 shared CPUs, 4 GB, the same image): never changed while awake;
  // given the new size and the growing disk when it next wakes (an update, which keeps its work disk).
  const b3 = fakeBucket(), w3 = fakeFly(), n3 = await F.flyNames("user-3-c-1");
  w3.volumes.set("vol_old", { id: "vol_old", name: n3.volume, size_gb: 10, attached_machine_id: "m_old" });
  const old = { id: "m_old", name: n3.machine, state: "started", config: { image: IMG1, guest: { cpu_kind: "shared", cpus: 2, memory_mb: 4096 }, mounts: [{ volume: "vol_old", path: "/data" }] } };
  w3.machines.set("m_old", old);
  await b3.put(n3.key, JSON.stringify({ id: "m_old", volume: "vol_old", region: "iad", image: IMG1, lock: 2, at: 1, used: 1, stopped: false }));
  await F.flyBox(envWith(b3), "user-3-c-1", deps(w3)).fetch(signed(new Request("http://coder/state?project=c-1")));
  assert.deepEqual(w3.api, [], "awake: straight through, never changed under a job");
  assert.equal(old.config.guest.cpu_kind, "shared");
  old.state = "stopped"; await b3.put(n3.key, JSON.stringify({ ...JSON.parse(b3.m.get(n3.key)), stopped: true }));
  await F.flyBox(envWith(b3), "user-3-c-1", deps(w3)).fetch(signed(new Request("http://coder/state?project=c-1")));
  assert.deepEqual(w3.api, ["GET /machines/m_old", "POST /machines/m_old"], "asleep: updated (which starts it)");
  assert.deepEqual(old.config.guest, { cpu_kind: "performance", cpus: 4, memory_mb: 16384 });
  assert.deepEqual(old.config.mounts, [{ volume: "vol_old", path: "/data", extend_threshold_percent: 80, add_size_gb: 10, size_gb_limit: 50 }], "the same work disk, now growing");
  assert.deepEqual((({ shape, small, image }) => ({ shape, small, image }))(JSON.parse(b3.m.get(n3.key))), { shape: "performance/4/16384/50/20", small: false, image: IMG1 });

  // CODER'S OWN KEY REFUSED: not asked again and again at other sizes.
  const b4 = fakeBucket(), w4 = fakeFly();
  const no = await F.flyBox(envWith(b4, { FLY_API_TOKEN: "fly-token-wrong-000000" }), "user-4-d-1", deps(w4)).fetch(turn());
  assert.equal(no.status, 503);
  assert.deepEqual(w4.api, ["POST /volumes"]);
});

test("CD151 the environment's saved copy of its setup, on Fly.io (owner, 2026-11-07: \"ok start\"; like Claude Code's cache): a chat's disk is saved, kept 8 days, while its machine waits for Fly to start saving it (live test #25: Fly saves a disk when it gets to it); a new chat's disk is made from a finished copy only, at least as big, once Fly has restored it; Fly refusing, an empty one as before, with why told to the machine; the hint never reaches a machine; only a copy of this setup, Coder version and region, under 7 days old (and still kept), is ever used", async () => {
  const b = fakeBucket(), w = fakeFly(), env = envWith(b, { CODER_TOKEN_KEY: TKEY });
  const turn = (box, more = {}) => box.fetch(signed(new Request("http://coder/turn", { method: "POST", headers: { "content-type": "application/json", ...more }, body: JSON.stringify({ project: "p", text: "hi" }) })));
  // A's machine and disk (an ordinary new chat); the disk has grown to 20 GB by itself.
  assert.equal((await turn(F.flyBox(env, "user-1-shop-a1", deps(w)))).status, 200);
  assert.deepEqual(w.told, [null], "no copy offered: nothing told");
  const [volA] = [...w.volumes.values()];
  volA.size_gb = 20;
  // SAVED: kept past the seven days, then asked for; Fly lists it a moment later, "waiting", then "running"
  // (it is saving the disk now); the machine is let go a little after that. Not yet finished: not ready.
  w.api.length = 0;
  w.snapWait = 1; w.snapRun = 2;
  const slept = [];
  const snap = await F.snapshotChat(env, "user-1-shop-a1", deps(w, { sleep: async (ms) => { slept.push(ms); } }));
  const sid = [...w.snaps.keys()][0];
  assert.deepEqual(snap, { snapshot: sid, volume: volA.id, size: 20, region: "iad", image: IMG1, retention: 0, ready: false });
  assert.deepEqual(w.api, ["PUT /volumes/" + volA.id, "POST /volumes/" + volA.id + "/snapshots", ...Array(3).fill("GET /volumes/" + volA.id + "/snapshots")], "not listed, waiting, running");
  assert.deepEqual(slept, [2000, 2000, F.CACHE_SETTLE_MS], "then a little longer, so Fly has the disk as the setup left it");
  assert.equal(volA.snapshot_retention, F.CACHE_KEEP_DAYS);
  assert.equal(F.CACHE_KEEP_DAYS, 8);
  assert.ok(F.CACHE_START_MS + F.CACHE_SETTLE_MS + 20_000 <= (await import("../container/server.mjs")).HOLD_MS, "all within the machine's own wait");
  // WHERE IT STANDS (a new chat asks before starting from it): still running; then finished, with Fly's days.
  assert.deepEqual(await F.copyState(env, snap, deps(w)), { status: "running", retention: 0 });
  assert.deepEqual(await F.copyState(env, snap, deps(w)), { status: "created", retention: 8 });
  assert.deepEqual(await F.copyState(env, { ...snap, snapshot: "vs_Gone1234" }, deps(w)), { status: "gone" });
  assert.equal(await F.copyState(env, { ...snap, volume: "../x" }, deps(w)), null);
  assert.equal(await F.copyState({ ...env, CODER_MACHINES: "" }, snap, deps(w)), null);
  // Finished at once: ready, no extra wait. Never started in time: no copy (the machine goes on by itself).
  w.snapLag = 0; w.snapWait = 0; w.snapRun = 0; slept.length = 0;
  const quick = await F.snapshotChat(env, "user-1-shop-a1", deps(w, { sleep: async (ms) => { slept.push(ms); } }));
  assert.deepEqual([quick.ready, quick.retention, slept], [true, 8, []]);
  let clock = 0;
  w.snapWait = 1000;
  assert.equal(await F.snapshotChat(env, "user-1-shop-a1", deps(w, { now: () => clock, sleep: async (ms) => { clock += ms; } })), null);
  assert.ok(clock >= F.CACHE_START_MS && clock < F.CACHE_START_MS + 5000, "it waited its 80 seconds");
  assert.equal(await F.snapshotChat(env, "user-1-nobody", deps(w)), null);
  assert.equal(await F.snapshotChat({ ...env, CODER_MACHINES: "" }, "user-1-shop-a1", deps(w)), null);
  w.snapWait = 0;

  // A COPY FLY HAS NOT FINISHED (the live test: the second chat came a minute later): Fly refuses it; an empty
  // disk, as before, and the machine is told why (it says so in the chat).
  w.snapRun = 50;
  const pending = await F.snapshotChat(env, "user-1-shop-a1", deps(w));
  assert.equal(pending.ready, false);
  const boxE = F.flyBox(env, "user-1-shop-e1", deps(w));
  assert.equal((await turn(boxE, { [F.FROM_COPY]: pending.snapshot, [F.FROM_COPY_GB]: "20" })).status, 200);
  const recE = JSON.parse(b.m.get((await F.flyNames("user-1-shop-e1")).key));
  assert.equal(recE.from, undefined);
  assert.match(recE.copyMiss, /^Fly\.io would not make a disk from it \(422: snapshot vs_\w+ is not ready try later\)$/, "Fly's own words, plain (its dash dropped)");
  assert.equal(w.told.at(-1), "missed: " + recE.copyMiss);
  const ne1 = (await F.flyNames("user-1-shop-e1")).volume;
  assert.deepEqual([...w.volumes.values()].filter((v) => v.name === ne1).map((v) => v.snapshot_id), [undefined], "its empty disk");
  w.snapRun = 0;

  // B, A NEW CHAT IN THE SAME ENVIRONMENT: its disk from the finished copy, at least as big as A's was,
  // and its machine made once Fly has restored the copy into it.
  w.api.length = 0;
  w.restoreFor = 2;
  const boxB = F.flyBox(env, "user-1-shop-b1", deps(w));
  assert.equal((await turn(boxB, { [F.FROM_COPY]: snap.snapshot, [F.FROM_COPY_GB]: "20" })).status, 200);
  const nb1 = (await F.flyNames("user-1-shop-b1")).volume;
  const volB = [...w.volumes.values()].find((v) => v.name === nb1);
  assert.equal(volB.snapshot_id, snap.snapshot);
  assert.equal(volB.size_gb, 20);
  assert.deepEqual(w.api.slice(0, 4), ["POST /volumes", "GET /volumes/" + volB.id, "GET /volumes/" + volB.id, "POST /machines"], "restored first, then its machine");
  assert.equal(JSON.parse(b.m.get((await F.flyNames("user-1-shop-b1")).key)).from, snap.snapshot, "its record says where its disk came from");
  assert.equal(w.told.at(-1), "used", "the machine is told its disk came from the copy");
  for (const sent of w.sent) assert.ok(!sent.includes(F.FROM_COPY) && !sent.includes(F.FROM_COPY_GB), "the hint never reaches a machine");
  // An awake machine of its own already: the hint changes nothing, and nothing is told again.
  w.api.length = 0;
  assert.equal((await turn(boxB, { [F.FROM_COPY]: snap.snapshot, [F.FROM_COPY_GB]: "20" })).status, 200);
  assert.deepEqual(w.api, []);
  assert.equal(w.told.at(-1), null);
  // Nobody else can tell a machine about a copy: the Worker's own word only.
  assert.equal((await turn(boxB, { [F.COPY_INFO]: "used" })).status, 200);
  assert.equal(w.told.at(-1), null);

  // RESTORED TOO SLOWLY: that disk goes; an empty one, as before; why told.
  clock = 0;
  w.restoreFor = 1e9;
  const slow = { now: () => clock, sleep: async (ms) => { clock += ms; } };
  assert.equal((await turn(F.flyBox(env, "user-1-shop-f1", deps(w, slow)), { [F.FROM_COPY]: snap.snapshot, [F.FROM_COPY_GB]: "20" })).status, 200);
  const recF = JSON.parse(b.m.get((await F.flyNames("user-1-shop-f1")).key));
  assert.match(recF.copyMiss, /^its disk was still being restored \(restoring\) after 5 minutes$/);
  const nf1 = (await F.flyNames("user-1-shop-f1")).volume;
  assert.deepEqual([...w.volumes.values()].filter((v) => v.name === nf1).map((v) => v.snapshot_id), [undefined], "only the empty disk is left");
  w.restoreFor = 0;
  // NO MACHINE ON IT: that disk goes too; an empty one, as before.
  w.noMachineOnCopy = true;
  assert.equal((await turn(F.flyBox(env, "user-1-shop-g1", deps(w)), { [F.FROM_COPY]: snap.snapshot, [F.FROM_COPY_GB]: "20" })).status, 200);
  const recG = JSON.parse(b.m.get((await F.flyNames("user-1-shop-g1")).key));
  assert.match(recG.copyMiss, /^Fly\.io could not start a machine on it \(503: volume vol_\w+ didn't reach a mountable state\)$/);
  const ng1 = (await F.flyNames("user-1-shop-g1")).volume;
  assert.deepEqual([...w.volumes.values()].filter((v) => v.name === ng1).map((v) => v.snapshot_id), [undefined]);
  w.noMachineOnCopy = false;
  // FLY REFUSES A DISK FROM THE COPY (gone, say): an empty disk, as before; the chat still starts.
  w.badCopy = true;
  assert.equal((await turn(F.flyBox(env, "user-1-shop-c1", deps(w)), { [F.FROM_COPY]: snap.snapshot, [F.FROM_COPY_GB]: "20" })).status, 200);
  const nc1 = (await F.flyNames("user-1-shop-c1")).volume;
  const volC = [...w.volumes.values()].find((v) => v.name === nc1);
  assert.equal(volC.snapshot_id, undefined);
  assert.equal(volC.size_gb, 10);
  assert.equal(JSON.parse(b.m.get((await F.flyNames("user-1-shop-c1")).key)).copyMiss, "Fly.io would not make a disk from it (404: snapshot not found)");
  // A made-up name is never sent to Fly, nor told to the machine.
  w.api.length = 0;
  await turn(F.flyBox(env, "user-1-shop-d1", deps(w)), { [F.FROM_COPY]: "../etc", [F.FROM_COPY_GB]: "20" });
  const nd1 = (await F.flyNames("user-1-shop-d1")).volume;
  assert.equal([...w.volumes.values()].find((v) => v.name === nd1).snapshot_id, undefined);
  assert.equal(w.told.at(-1), null);

  // WHICH COPY MAY BE USED.
  const key = "a".repeat(64), now = Date.parse("2026-11-07T12:00:00Z");
  const c = { snapshot: "vs_Abcd1234", volume: "vol_Abcd1234", size: 20, region: "iad", image: IMG1, retention: 8, key, at: now - 3600e3 };
  assert.equal(F.cacheUsable(env, c, key, now), true);
  assert.equal(F.cacheUsable(env, c, "b".repeat(64), now), false, "another setup script or network setting");
  assert.equal(F.cacheUsable({ ...env, CODER_FLY_IMAGE: IMG2 }, c, key, now), false, "a new Coder version");
  assert.equal(F.cacheUsable({ ...env, CODER_FLY_REGION: "ord" }, c, key, now), false, "another region");
  assert.equal(F.cacheUsable(env, { ...c, at: now - F.CACHE_MS - 1 }, key, now), false, "over seven days old");
  assert.equal(F.cacheUsable(env, { ...c, at: now - F.CACHE_MS + 3600e3 }, key, now), true);
  assert.equal(F.cacheUsable(env, { ...c, retention: 5, at: now - 4.6 * 86400e3 }, key, now), false, "no longer kept by Fly (5 days)");
  assert.equal(F.cacheUsable(env, { ...c, retention: 5, at: now - 4.4 * 86400e3 }, key, now), true);
  assert.equal(F.cacheUsable(env, { ...c, snapshot: "../x" }, key, now), false);
  assert.equal(F.cacheUsable(env, { ...c, volume: undefined }, key, now), false, "a copy recorded before the fix (no disk): one is made again");
  assert.equal(F.cacheUsable(env, { ...c, at: now + 3600e3 }, key, now), false, "from the future");
  assert.equal(F.cacheUsable(env, null, key, now), false);
  assert.equal(F.cacheUsable(env, c, "", now), false);
});
