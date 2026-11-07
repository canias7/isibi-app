// CODER'S MACHINES ON FLY.IO (owner, 2026-11-07: "YES OPTION 2", "OK LETS START THEN").
//
// Like Claude Code, whose docs say "each session runs in an isolated,
// Anthropic-managed VM" and "after a few minutes without activity, a session's
// VM pauses with its files saved. Your next message restores the same VM":
// each chat gets its own small VM on Fly.io (a Fly Machine started from Coder's
// machine image) and its own kept disk (a Fly volume at /data, where the chat's
// files live). Coder's Worker:
//   - makes the machine and its disk when the chat first needs it;
//   - sends it the chat's requests through Fly's front door
//     (https://<app>.fly.dev, pinned to it with the fly-force-instance-id header);
//   - wakes it when it is asleep, and gives it Coder's newest machine version
//     then (never while it is awake: a job may be running);
//   - every minute, stops the machines that have had nothing to do for 10
//     minutes (a job working, or one waiting to be saved, keeps its machine on);
//   - removes a machine and its disk after 30 days unused, or with its chat.
// Cloudflare's containers stay as the fallback: CODER_MACHINES "fly" switches.

import { holdDecision } from "./coder-watch.mjs";

export const FLY_API = "https://api.machines.dev/v1";
/** Where the chat's kept disk is on its machine (the machine's CODER_DATA). */
export const FLY_DATA = "/data";
/** Quiet this long, a machine is stopped (like Cloudflare's 10 minutes; Claude Code: "a few minutes"). */
export const FLY_IDLE_MS = 10 * 60 * 1000;
/** Unused this long, a stopped machine and its disk are removed (Claude Code: "reclaimed after a period of inactivity"). */
export const FLY_RECLAIM_MS = 30 * 24 * 60 * 60 * 1000;
/** How long a waking machine has to answer. */
export const FLY_WAKE_MS = 60 * 1000;
/** A machine or disk no chat knows is removed once it is this old (it may still be being made). */
export const FLY_ORPHAN_MS = 60 * 60 * 1000;
const RECORDS = "coder/fly-machines/";

/** Fly.io machines are on when switched on and set up: the token, the app's name and the machine image. */
export function flyOn(env) {
  return !!env && String(env.CODER_MACHINES || "") === "fly" && typeof env.FLY_API_TOKEN === "string" && env.FLY_API_TOKEN.length > 10
    && /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(String(env.CODER_FLY_APP || "")) && /^registry\.fly\.io\/[a-z0-9][a-z0-9-]*[a-z0-9]:[\w.-]+$/.test(String(env.CODER_FLY_IMAGE || ""));
}

/** The machines' size and place (wrangler.jsonc vars; sensible defaults). */
export function flySettings(env) {
  const num = (v, d, lo, hi) => { const n = Number(v); return Number.isInteger(n) && n >= lo && n <= hi ? n : d; };
  return {
    app: String(env.CODER_FLY_APP),
    image: String(env.CODER_FLY_IMAGE),
    region: /^[a-z]{3}$/.test(String(env.CODER_FLY_REGION || "")) ? String(env.CODER_FLY_REGION) : "iad",
    cpus: num(env.CODER_FLY_CPUS, 2, 1, 8),
    memory: num(env.CODER_FLY_MEMORY_MB, 4096, 1024, 16384),
    disk: num(env.CODER_FLY_DISK_GB, 10, 1, 100),
  };
}

/** A chat's machine, disk and record names: the same every time, from the chat's own name. */
export async function flyNames(name) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("coder-machine:" + String(name)));
  const h = [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 20);
  return { machine: "coder-" + h, volume: "coder_" + h, key: RECORDS + h + ".json" };
}

/** Fly's Machines API. Asked too fast (429), it waits and asks again. Answers `{ ok, status, data }`. */
export async function flyApi(env, path, { method = "GET", body, fetchFn = fetch, sleep = wait } = {}) {
  for (let tries = 0; ; tries++) {
    let r;
    try { r = await fetchFn(FLY_API + path, { method, headers: { authorization: "Bearer " + env.FLY_API_TOKEN, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) }); }
    catch (e) { return { ok: false, status: 0, data: { error: String((e && e.message) || e).slice(0, 200) } }; }
    if (r.status === 429 && tries < 3) { await sleep(1000 * (tries + 1)); continue; }
    let data = null;
    try { data = await r.json(); } catch { data = null; }
    return { ok: r.ok, status: r.status, data };
  }
}
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));

/** A chat's machine, as Fly.io is told to make it (the whole of it: Fly takes no partial changes). */
export function machineConfig(env, volumeId) {
  const s = flySettings(env);
  return {
    image: s.image,
    env: { CODER_DATA: FLY_DATA, ...(env.CODER_MODEL ? { CODER_MODEL: String(env.CODER_MODEL) } : {}) },
    guest: { cpu_kind: "shared", cpus: s.cpus, memory_mb: s.memory },
    mounts: [{ volume: volumeId, path: FLY_DATA }],
    // Only through Fly's front door, on https; Coder starts and stops it itself.
    services: [{ protocol: "tcp", internal_port: 8080, ports: [{ port: 443, handlers: ["tls", "http"] }], autostart: false, autostop: "off" }],
    restart: { policy: "on-failure", max_retries: 3 },
    metadata: { coder: "chat-machine" },
  };
}

async function readRec(bucket, key) {
  const o = await bucket.get(key);
  if (!o) return null;
  try { const r = JSON.parse(await o.text()); return r && typeof r.id === "string" ? r : null; } catch { return null; }
}
const writeRec = (bucket, key, rec) => bucket.put(key, JSON.stringify(rec), { httpMetadata: { contentType: "application/json" } });
const json = (obj, status) => new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

/**
 * ONE REQUEST TO A CHAT'S MACHINE through Fly's front door, pinned to it. The
 * machine's "still working" answer (src: container/server.mjs) is unwrapped,
 * so callers see its real status and answer. Answers null when the machine
 * did not answer (asleep, waking, gone: Fly's own answer, or no connection);
 * a 502 when its answer was cut off on the way.
 */
export async function viaFly(env, machineId, req, body, fetchFn = fetch) {
  const u = new URL(req.url);
  const headers = new Headers(req.headers);
  headers.set("fly-force-instance-id", machineId);
  headers.set("x-coder-keepalive", "1");
  let r;
  try { r = await fetchFn("https://" + flySettings(env).app + ".fly.dev" + u.pathname + u.search, { method: req.method, headers, ...(body !== undefined ? { body } : {}) }); }
  catch { return null; }
  if (r.headers.get("x-coder-machine") !== "1") return null;
  if (r.headers.get("x-coder-keepalive") !== "1") return r;
  let w = null;
  try { w = JSON.parse(await r.text()); } catch { w = null; }
  if (!w || !Number.isInteger(w.coderStatus)) return json({ error: "The answer from Coder's machine was cut off on the way." }, 502);
  return new Response(JSON.stringify(w.body), { status: w.coderStatus, headers: { "content-type": "application/json", "x-coder-machine": "1" } });
}

/** Until the machine answers (a stopped Fly machine starts "well under a second"; Coder's service then starts). */
async function untilAnswers(env, id, { fetchFn, sleep, now }) {
  const until = now() + FLY_WAKE_MS;
  while (now() < until) {
    const h = await viaFly(env, id, new Request("http://coder/health"), undefined, fetchFn);
    if (h && h.ok) return true;
    await sleep(500);
  }
  return false;
}

/** A NEW CHAT'S MACHINE: its kept disk, then the machine on it (Fly starts it). */
async function makeMachine(env, bucket, names, deps) {
  const s = flySettings(env);
  const v = await flyApi(env, "/apps/" + s.app + "/volumes", { method: "POST", body: { name: names.volume, region: s.region, size_gb: s.disk }, ...deps });
  if (!v.ok || !v.data || typeof v.data.id !== "string") return { why: "Fly.io could not make the machine's disk (" + v.status + ")" };
  const m = await flyApi(env, "/apps/" + s.app + "/machines", { method: "POST", body: { name: names.machine, region: s.region, config: machineConfig(env, v.data.id) }, ...deps });
  if (!m.ok || !m.data || typeof m.data.id !== "string") {
    await flyApi(env, "/apps/" + s.app + "/volumes/" + v.data.id, { method: "DELETE", ...deps });
    return { why: "Fly.io could not make the machine (" + m.status + ")" };
  }
  const rec = { id: m.data.id, volume: v.data.id, region: s.region, image: s.image, at: deps.now(), used: deps.now(), stopped: false };
  await writeRec(bucket, names.key, rec);
  await untilAnswers(env, rec.id, deps);
  return { rec };
}

/**
 * WAKE A CHAT'S MACHINE. Asleep: started, with Coder's newest machine version
 * if there is one (its disk stays). Awake but silent: given time to answer
 * (never changed under a job). Gone: answers null (a new one is made).
 */
async function wakeMachine(env, bucket, names, rec, deps) {
  const s = flySettings(env);
  const m = await flyApi(env, "/apps/" + s.app + "/machines/" + rec.id, deps);
  if (m.status === 404) { await bucket.delete(names.key); return null; }
  const state = m.data && m.data.state;
  if (state !== "started" && state !== "starting") {
    if (rec.image !== s.image) {
      const u = await flyApi(env, "/apps/" + s.app + "/machines/" + rec.id, { method: "POST", body: { config: machineConfig(env, rec.volume) }, ...deps });
      if (u.ok) rec = { ...rec, image: s.image };
      else await flyApi(env, "/apps/" + s.app + "/machines/" + rec.id + "/start", { method: "POST", ...deps });
    } else await flyApi(env, "/apps/" + s.app + "/machines/" + rec.id + "/start", { method: "POST", ...deps });
  }
  rec = { ...rec, stopped: false, used: deps.now() };
  await writeRec(bucket, names.key, rec);
  await untilAnswers(env, rec.id, deps);
  return rec;
}

/**
 * A CHAT'S MACHINE ON FLY.IO, as `{ fetch(Request) }` (the same as a Cloudflare
 * container's, so the rest of Coder is unchanged). A request goes straight to
 * an awake machine; an asleep, new or silent one is made or woken first, then
 * asked again.
 */
export function flyBox(env, name, deps0 = {}) {
  const deps = { fetchFn: deps0.fetchFn || fetch, sleep: deps0.sleep || wait, now: deps0.now || Date.now };
  const bucket = env.CODER_BUCKET;
  return {
    fetch: async (req) => {
      const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer();
      const names = await flyNames(name);
      let rec = await readRec(bucket, names.key);
      if (rec && !rec.stopped) {
        const r = await viaFly(env, rec.id, req, body, deps.fetchFn);
        if (r) return r;
      }
      if (rec) rec = await wakeMachine(env, bucket, names, rec, deps);
      if (!rec) {
        // ONLY A JOB'S START, OR AN UNDO (which needs the repo), MAKES A MACHINE.
        // Anything else (the every-minute check asking about a job whose machine
        // is still being made, a Stop) never makes a second one.
        const u = new URL(req.url);
        if (!(req.method === "POST" && (u.pathname === "/turn" || u.pathname === "/undo"))) return json({ error: "This chat has no machine on Fly.io yet." }, 503);
        const made = await makeMachine(env, bucket, names, deps);
        if (!made.rec) return json({ error: made.why }, 503);
        rec = made.rec;
      }
      const r = await viaFly(env, rec.id, req, body, deps.fetchFn);
      return r || json({ error: "Coder's machine on Fly.io did not answer. Try again in a minute." }, 503);
    },
  };
}

/** Remove a machine and its kept disk (the disk once the machine is gone). */
async function removeMachine(env, id, volume, deps) {
  const s = flySettings(env);
  await flyApi(env, "/apps/" + s.app + "/machines/" + id + "?force=true", { method: "DELETE", ...deps });
  if (volume) await flyApi(env, "/apps/" + s.app + "/volumes/" + volume, { method: "DELETE", ...deps });
}

/** A REMOVED CHAT's machine and disk go too. */
export async function dropFlyMachine(env, name, deps0 = {}) {
  if (!flyOn(env)) return;
  const deps = { fetchFn: deps0.fetchFn || fetch, sleep: deps0.sleep || wait, now: deps0.now || Date.now };
  const names = await flyNames(name);
  const rec = await readRec(env.CODER_BUCKET, names.key);
  if (!rec) return;
  await removeMachine(env, rec.id, rec.volume, deps);
  await env.CODER_BUCKET.delete(names.key);
}

/**
 * SHOULD THIS AWAKE MACHINE BE STOPPED? Not while a job works or waits to be
 * saved (the same limits as the Cloudflare hold), nor within 10 minutes of the
 * Worker's last request; a machine that does not answer is given 10 minutes
 * from when it was woken.
 */
export function shouldStop(busy, rec, now) {
  if (busy && holdDecision(busy).hold) return false;
  if (busy && typeof busy.idleMs === "number" && Number.isFinite(busy.idleMs) && busy.idleMs >= 0) return busy.idleMs >= FLY_IDLE_MS;
  return now - Number((rec && (rec.used || rec.at)) || 0) >= FLY_IDLE_MS;
}

/**
 * EVERY MINUTE (worker.js): each chat machine that is awake is asked whether
 * it has work, and stopped when it has none for 10 minutes; a stopped one
 * unused for 30 days is removed with its disk; a machine no chat knows is
 * removed once it is an hour old. Once an hour, disks no machine uses go too.
 * `deps.sign(Request)` adds the machine's control key.
 */
export async function runFlyMachines(env, deps0 = {}, now = Date.now()) {
  const out = { checked: 0, stopped: 0, removed: 0 };
  if (!flyOn(env)) return out;
  const deps = { fetchFn: deps0.fetchFn || fetch, sleep: deps0.sleep || wait, now: () => now };
  const sign = deps0.sign || ((r) => r);
  const s = flySettings(env), bucket = env.CODER_BUCKET;
  const list = await flyApi(env, "/apps/" + s.app + "/machines", deps);
  if (!list.ok || !Array.isArray(list.data)) return out;
  const known = new Set();
  for (const m of list.data) {
    const hit = /^coder-([0-9a-f]{20})$/.exec(String((m && m.name) || ""));
    if (!hit || typeof m.id !== "string") continue;
    const key = RECORDS + hit[1] + ".json";
    const rec = await readRec(bucket, key);
    const made = Date.parse(String(m.created_at || "")) || 0;
    const vol = m.config && Array.isArray(m.config.mounts) && m.config.mounts[0] ? m.config.mounts[0].volume : null;
    if (!rec || rec.id !== m.id) {
      if (now - made > FLY_ORPHAN_MS) { await removeMachine(env, m.id, vol, deps); out.removed++; }
      else if (vol) known.add(vol);
      continue;
    }
    known.add(rec.volume);
    if (m.state === "started") {
      out.checked++;
      const r = await viaFly(env, m.id, sign(new Request("http://coder/busy")), undefined, deps.fetchFn);
      const busy = r && r.ok ? await r.json().catch(() => null) : null;
      if (shouldStop(busy, rec, now)) {
        const st = await flyApi(env, "/apps/" + s.app + "/machines/" + m.id + "/stop", { method: "POST", ...deps });
        if (st.ok) { out.stopped++; await writeRec(bucket, key, { ...rec, stopped: true, stoppedAt: now }); }
      }
    } else if ((m.state === "stopped" || m.state === "suspended") && now - Number(rec.used || rec.at || 0) > FLY_RECLAIM_MS) {
      await removeMachine(env, m.id, rec.volume, deps);
      await bucket.delete(key);
      known.delete(rec.volume);
      out.removed++;
    }
  }
  // ONCE AN HOUR: kept disks no machine uses (a machine removed before its disk could go).
  if (new Date(now).getUTCMinutes() === 17) {
    const vols = await flyApi(env, "/apps/" + s.app + "/volumes", deps);
    for (const v of vols.ok && Array.isArray(vols.data) ? vols.data : []) {
      if (!/^coder_[0-9a-f]{20}$/.test(String((v && v.name) || "")) || known.has(v.id) || v.attached_machine_id) continue;
      if (now - (Date.parse(String(v.created_at || "")) || now) > FLY_ORPHAN_MS) { await flyApi(env, "/apps/" + s.app + "/volumes/" + v.id, { method: "DELETE", ...deps }); out.removed++; }
    }
  }
  return out;
}
