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
import { controlKeySync, controlKeyFor } from "./coder-control.mjs";

export const FLY_API = "https://api.machines.dev/v1";
/** Where the chat's kept disk is on its machine (the machine's CODER_DATA). */
export const FLY_DATA = "/data";
/** Quiet this long, a machine is stopped (like Cloudflare's 10 minutes; Claude Code: "a few minutes"). */
export const FLY_IDLE_MS = 10 * 60 * 1000;
/** Unused this long, a stopped machine and its disk are removed (Claude Code: "reclaimed after a period of inactivity"). */
export const FLY_RECLAIM_MS = 30 * 24 * 60 * 60 * 1000;
/** How long a waking machine has to answer. */
export const FLY_WAKE_MS = 60 * 1000;
/**
 * How long a machine being made or updated has to answer: Fly.io first fetches
 * Coder's image, which with all of Claude Code's tools is about 6.9 GB (owner,
 * 2026-11-07). A plain wake keeps FLY_WAKE_MS.
 */
export const FLY_PULL_MS = 5 * 60 * 1000;
/** A machine or disk no chat knows is removed once it is this old (it may still be being made). */
export const FLY_ORPHAN_MS = 60 * 60 * 1000;
const RECORDS = "coder/fly-machines/";

/** Fly.io machines are on when switched on and set up: the token, the app's name and the machine image. */
export function flyOn(env) {
  return !!env && String(env.CODER_MACHINES || "") === "fly" && typeof env.FLY_API_TOKEN === "string" && env.FLY_API_TOKEN.length > 10
    && /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(String(env.CODER_FLY_APP || "")) && /^registry\.fly\.io\/[a-z0-9][a-z0-9-]*[a-z0-9]:[\w.-]+$/.test(String(env.CODER_FLY_IMAGE || ""));
}

/**
 * THE SIZE CHATS HAD BEFORE (2 shared CPUs, 4 GB): what a chat's machine gets when Fly.io
 * cannot give it the size below (no room on the server that holds its disk), so the chat
 * still works.
 */
export const FLY_SMALL = { cpu_kind: "shared", cpus: 2, memory_mb: 4096 };
/** The work disk grows by this much each time it is 80% full (up to `diskMax`). */
export const FLY_DISK_STEP_GB = 10;

/** The machines' size and place (wrangler.jsonc vars; sensible defaults). */
export function flySettings(env) {
  const num = (v, d, lo, hi) => { const n = Number(v); return Number.isInteger(n) && n >= lo && n <= hi ? n : d; };
  // THE SIZE (owner, 2026-11-07: "4 CPUs, 16 GB", the size of Claude Code's machine): Fly.io's
  // "performance" CPUs, which always run at full speed. Its "shared" ones (what chats had before)
  // are slowed to 1/16 of a CPU each after a short burst, and their disk is 4 times slower.
  // Fly's rules: shared, up to 8 CPUs with 256 MB to 2 GB each, in steps of 256 MB;
  // performance, up to 16 CPUs with 2 to 8 GB each, in steps of 2 GB. A size outside them falls back.
  const kind = String(env.CODER_FLY_CPU_KIND || "") === "shared" ? "shared" : "performance";
  const per = kind === "shared" ? { most: 8, step: 256, low: 256, high: 2048 } : { most: 16, step: 2048, low: 2048, high: 8192 };
  const cpus = num(env.CODER_FLY_CPUS, 4, 1, per.most);
  const mb = Number(env.CODER_FLY_MEMORY_MB);
  const memory = Number.isInteger(mb) && mb % per.step === 0 && mb >= per.low * cpus && mb <= per.high * cpus ? mb : Math.min(Math.max(16384, per.low * cpus), per.high * cpus);
  const disk = num(env.CODER_FLY_DISK_GB, 10, 1, 500);
  return {
    app: String(env.CODER_FLY_APP),
    image: String(env.CODER_FLY_IMAGE),
    region: /^[a-z]{3}$/.test(String(env.CODER_FLY_REGION || "")) ? String(env.CODER_FLY_REGION) : "iad",
    kind,
    cpus,
    memory,
    disk,
    // THE WORK DISK GROWS BY ITSELF (owner, 2026-11-07: "Grow to 50 GB"): Fly.io adds 10 GB each
    // time it is 80% full, up to this. Only a chat that uses the room pays for it.
    diskMax: num(env.CODER_FLY_DISK_MAX_GB, Math.max(50, disk), disk, 500),
    // THE MACHINE'S OWN DISK MAY GROW TO 20 GB (Fly.io's default is 8; owner, 2026-11-07, all of
    // Claude Code's tools): with the chat's 10 GB disk, 30 GB, like Claude Code's machine. Fly.io
    // bills a sleeping machine's disk by what is used, not by this limit.
    root: num(env.CODER_FLY_ROOT_GB, 20, 8, 50),
  };
}

/**
 * WHAT A MACHINE'S SETTINGS ARE MADE FROM, besides its image: when they change (a new size), each
 * chat's machine gets them the next time it wakes, as with a new image (never under a job).
 */
export function flyShape(s) {
  return [s.kind, s.cpus, s.memory, s.diskMax, s.root].join("/");
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

/**
 * A chat's machine, as Fly.io is told to make it (the whole of it: Fly takes no
 * partial changes). ITS WHOLE DISK IS KEPT while it sleeps (owner, 2026-11-07:
 * "Do 1 and 3"; like Claude Code, where a paused VM keeps what was installed and
 * the setup does not run again): Fly's persist_rootfs "restart" keeps the
 * machine's own disk across restarts, and a new Coder version (an update) still
 * starts it fresh. That disk may grow to `root` GB (Fly's `rootfs`, which
 * also keeps it). `bigRoot: false` asks the older way, Fly's default size;
 * `keepRoot: false` leaves it out (if Fly ever refuses them: CONFIG_TRIES).
 * Its size is `flySettings`' (4 full CPUs, 16 GB); `small` is the size chats
 * had before (FLY_SMALL). Its work disk grows by itself up to `diskMax` GB;
 * `grow: false` leaves that out (SIZE_TRIES).
 */
export function machineConfig(env, volumeId, { keepRoot = true, bigRoot = true, lock = "", small = false, grow = true } = {}) {
  const s = flySettings(env);
  return {
    image: s.image,
    // ITS LOCK, ALWAYS: on Fly.io a machine is on the internet (Fly's front door), so its control
    // key is given here too, not only as a Fly secret (made from CODER_TOKEN_KEY; never the key itself).
    // CODER_IMAGE_REF: which Coder version this is, so the admin sandbox's own layer starts fresh with a new one.
    env: { CODER_DATA: FLY_DATA, CODER_IMAGE_REF: s.image, ...(env.CODER_MODEL ? { CODER_MODEL: String(env.CODER_MODEL) } : {}), ...(lock ? { CODER_CONTROL_KEY: lock } : env.CODER_TOKEN_KEY ? { CODER_CONTROL_KEY: controlKeySync(env.CODER_TOKEN_KEY) } : {}) },
    guest: { ...(small ? FLY_SMALL : { cpu_kind: s.kind, cpus: s.cpus, memory_mb: s.memory }), ...(keepRoot && !bigRoot ? { persist_rootfs: "restart" } : {}) },
    ...(keepRoot && bigRoot ? { rootfs: { persist: "restart", size_gb: s.root } } : {}),
    // The chat's work disk, which Fly.io makes bigger by itself when it is 80% full (Fly's auto-extend).
    mounts: [{ volume: volumeId, path: FLY_DATA, ...(grow && s.diskMax > s.disk ? { extend_threshold_percent: 80, add_size_gb: FLY_DISK_STEP_GB, size_gb_limit: s.diskMax } : {}) }],
    // Only through Fly's front door, on https; Coder starts and stops it itself.
    services: [{ protocol: "tcp", internal_port: 8080, ports: [{ port: 443, handlers: ["tls", "http"] }], autostart: false, autostop: "off" }],
    restart: { policy: "on-failure", max_retries: 3 },
    metadata: { coder: "chat-machine" },
  };
}

/** The machine's settings, the newest first: if Fly.io refuses one (400 or 422), the next. */
export const CONFIG_TRIES = [{}, { bigRoot: false }, { keepRoot: false }];
/**
 * THE SIZE, THEN THE SIZE BEFORE (owner, 2026-11-07: 4 CPUs, 16 GB): if Fly.io will not make or
 * update a chat's machine at the size (no room for it on the server that holds the chat's disk,
 * or any other refusal), it is asked again at the size chats had before, so the chat still works;
 * last, without the growing disk. Not for a refusal of Coder's own key (401, 403) or a machine
 * that is gone (404). Answers Fly's answer, with `small` when the size before was used.
 */
export const SIZE_TRIES = [{}, { small: true }, { small: true, grow: false }];
async function withConfig(call) {
  let r, used = {};
  for (const size of SIZE_TRIES) {
    for (const o of CONFIG_TRIES) { used = { ...o, ...size }; r = await call(used); if (r.status !== 400 && r.status !== 422) break; }
    if (r.ok || r.status === 401 || r.status === 403 || r.status === 404) break;
  }
  return { ...r, small: !!used.small };
}

/**
 * THE LOCK KEY OF ONE CHAT'S MACHINE (step 2): its own (`controlKeyFor` its Fly
 * name) once it was made or updated with it (`rec.lock` 2), else the old shared
 * one, which a machine from before keeps until its next update.
 */
export async function machineLock(env, machine, rec) {
  if (!env.CODER_TOKEN_KEY) return "";
  return rec && rec.lock === 2 ? controlKeyFor(env.CODER_TOKEN_KEY, machine) : controlKeySync(env.CODER_TOKEN_KEY);
}
/** The request with this machine's own lock key (never another's). */
/** The message route's hint for a new chat's disk (the environment's saved copy): for flyBox only, never sent on. */
export const FROM_COPY = "x-coder-from-copy";
export const FROM_COPY_GB = "x-coder-from-copy-gb";
/** What became of that copy, told to the new machine with its first job (flyBox only sets it): "used", or "missed: why". */
export const COPY_INFO = "x-coder-copy";
async function locked(env, machine, rec, req) {
  const r = new Request(req.url, { method: req.method, headers: req.headers });
  r.headers.delete(FROM_COPY); r.headers.delete(FROM_COPY_GB); r.headers.delete(COPY_INFO);
  const k = await machineLock(env, machine, rec);
  if (k) r.headers.set("x-coder-key", k); else r.headers.delete("x-coder-key");
  return r;
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
async function untilAnswers(env, id, { fetchFn, sleep, now }, waitMs = FLY_WAKE_MS) {
  const until = now() + waitMs;
  while (now() < until) {
    const h = await viaFly(env, id, new Request("http://coder/health"), undefined, fetchFn);
    if (h && h.ok) return true;
    await sleep(500);
  }
  return false;
}

// ── THE ENVIRONMENT'S SAVED COPY OF ITS SETUP (owner, 2026-11-07: "ok start"; like
// Claude Code's environment cache: "If it completes in under about 5 minutes, the
// filesystem is snapshotted and reused" for the environment's next sessions).
// Right after the setup script ran on a fresh chat disk, Fly.io saves a copy of
// that disk (a snapshot; the message route asks, src/coder-routes.mjs); a new chat
// in the same environment gets its disk made from the copy, and its machine skips
// the setup (container/server.mjs). Every chat still clones its repository fresh.
/** Claude Code: the copy is made again "after about 7 days". */
export const CACHE_MS = 7 * 24 * 60 * 60 * 1000;
/** Days Fly.io keeps the copy (its default is 5): past the seven. */
export const CACHE_KEEP_DAYS = 8;
// FLY.IO SAVES A DISK WHEN IT GETS TO IT (live test #25, 2026-11-07: its docs, "Scheduled to snapshot
// volume", and "the state of the new snapshot will go from waiting to running to created"; a copy took
// minutes to finish). The chat's machine waits (container/server.mjs, up to 2 minutes) until Fly has
// started saving its disk, and CACHE_SETTLE_MS more, so the copy is of the disk as the setup left it.
/** How long the Worker waits for Fly.io to start saving the disk (within the machine's 2-minute wait). */
export const CACHE_START_MS = 80 * 1000;
/** Once Fly.io says it is saving the disk: this much longer before the job goes on. */
export const CACHE_SETTLE_MS = 10 * 1000;
/** A copy Fly.io is still finishing this long after it was asked for is no longer waited for: a new chat may make another. */
export const CACHE_PENDING_MS = 30 * 60 * 1000;
/** How long a disk made from a copy may take to be restored (Fly: "restoring", then "created") before an empty one is made instead. */
export const FLY_RESTORE_MS = 5 * 60 * 1000;
const SNAP_ID = /^vs_\w{4,80}$/;
const VOL_ID = /^vol_\w{1,80}$/;
/** A copy's state in Fly's list: its own word, else finished once it has a real date (an unfinished one's is 0001-01-01). */
const snapStatus = (x) => String((x && x.status) || (Date.parse(String((x && x.created_at) || "")) > Date.parse("2000-01-01") ? "created" : "running"));
/** Fly's answer, short and plain, for a note in the chat. */
export const flyWhy = (r) => (String((r && r.status) || "no answer") + (r && r.data && r.data.error ? ": " + String(r.data.error) : "")).replace(/[^\x20-\x7e]/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);

/**
 * May a new chat start from this copy? Made for this setup, by this Coder version, in this region, not too old,
 * still kept by Fly, and known by its disk (a copy recorded before 2026-11-07's fix is not: one is made again).
 * Whether Fly.io has finished it is asked separately (copyState).
 */
export function cacheUsable(env, c, key, now = Date.now()) {
  if (!c || !SNAP_ID.test(String(c.snapshot)) || !VOL_ID.test(String(c.volume)) || !key || c.key !== key) return false;
  const s = flySettings(env);
  if (c.image !== s.image || c.region !== s.region) return false;
  const age = now - Number(c.at);
  const kept = Number(c.retention) > 0 ? Number(c.retention) * 24 * 3600 * 1000 - 12 * 3600 * 1000 : CACHE_MS;
  return age >= 0 && age < Math.min(CACHE_MS, kept);
}

/**
 * SAVE A COPY OF A CHAT'S KEPT DISK (a Fly.io snapshot, kept CACHE_KEEP_DAYS days), while its machine
 * waits: answers once Fly.io has started saving it (running) or finished (created), CACHE_SETTLE_MS
 * later when only started: { snapshot, volume, size, region, image, retention, ready } (`ready`:
 * finished; until then no chat can start from it: Fly refuses). Null when Fly did not start in time.
 */
export async function snapshotChat(env, name, deps0 = {}) {
  if (!flyOn(env)) return null;
  const deps = { fetchFn: deps0.fetchFn || fetch, sleep: deps0.sleep || wait, now: deps0.now || Date.now };
  const s = flySettings(env);
  const rec = await readRec(env.CODER_BUCKET, (await flyNames(name)).key);
  if (!rec || !VOL_ID.test(String(rec.volume))) return null;
  const path = "/apps/" + s.app + "/volumes/" + rec.volume;
  // Kept past the seven days (this disk's later daily copies too; Fly's default is 5 days).
  const v = await flyApi(env, path, { method: "PUT", body: { snapshot_retention: CACHE_KEEP_DAYS }, ...deps });
  const made = await flyApi(env, path + "/snapshots", { method: "POST", ...deps });
  const b = made.ok && made.data && made.data.Msg && made.data.Msg.backup;
  const id = b ? String(b.graph_id || "") : "";
  if (!SNAP_ID.test(id)) return null;
  // "Wait a few moments for the snapshot to get created and then get the list of snapshots to confirm."
  const until = deps.now() + CACHE_START_MS;
  for (;;) {
    const l = await flyApi(env, path + "/snapshots", deps);
    const hit = l.ok && Array.isArray(l.data) ? l.data.find((x) => x && x.id === id) : null;
    const st = hit ? snapStatus(hit) : "";
    if (st === "running" || st === "created") {
      if (st === "running") await deps.sleep(CACHE_SETTLE_MS);
      return { snapshot: id, volume: rec.volume, size: Number(v.ok && v.data && v.data.size_gb) || s.disk, region: rec.region || s.region, image: rec.image, retention: Number(hit.retention_days) || 0, ready: st === "created" };
    }
    if (deps.now() >= until) return null;
    await deps.sleep(2000);
  }
}

/** WHERE A SAVED COPY STANDS on Fly.io: { status } ("created": finished; "running", "waiting"), { status: "gone" } when its disk's list lacks it, or null (no answer). */
export async function copyState(env, c, deps0 = {}) {
  if (!flyOn(env) || !c || !SNAP_ID.test(String(c.snapshot)) || !VOL_ID.test(String(c.volume))) return null;
  const deps = { fetchFn: deps0.fetchFn || fetch, sleep: deps0.sleep || wait, now: deps0.now || Date.now };
  const l = await flyApi(env, "/apps/" + flySettings(env).app + "/volumes/" + c.volume + "/snapshots", deps);
  if (!l.ok || !Array.isArray(l.data)) return null;
  const hit = l.data.find((x) => x && x.id === c.snapshot);
  return hit ? { status: snapStatus(hit), retention: Number(hit.retention_days) || 0 } : { status: "gone" };
}

/**
 * A NEW CHAT'S MACHINE: its kept disk, then the machine on it (Fly starts it).
 * `from` (the environment's saved copy): the disk is made from it (machineFromCopy);
 * if that cannot be done, an empty one, as before, with why (`copyMiss`, said in the chat).
 */
async function makeMachine(env, bucket, names, deps, from = null) {
  const s = flySettings(env);
  let copyMiss = "";
  if (from && SNAP_ID.test(String(from.snapshot))) {
    const got = await machineFromCopy(env, bucket, names, deps, from);
    if (got.rec) return got;
    copyMiss = got.why;
  }
  // ITS DISK GOES ON A SERVER WITH ROOM FOR ITS SIZE (Fly's `compute`: a machine can only run where
  // its disk is); else on one with room for the size before; else anywhere, as before.
  let v;
  for (const compute of [{ cpu_kind: s.kind, cpus: s.cpus, memory_mb: s.memory }, FLY_SMALL, null]) {
    v = await flyApi(env, "/apps/" + s.app + "/volumes", { method: "POST", body: { name: names.volume, region: s.region, size_gb: s.disk, ...(compute ? { compute } : {}) }, ...deps });
    if (v.ok || v.status === 401 || v.status === 403) break;
  }
  if (!v.ok || !v.data || typeof v.data.id !== "string") return { why: "Fly.io could not make the machine's disk (" + v.status + ")" };
  // Fly refused the settings (should it not take a bigger or kept disk, or the size): made the older way, as before.
  const lock = await controlKeyFor(env.CODER_TOKEN_KEY, names.machine);
  const m = await withConfig((o) => flyApi(env, "/apps/" + s.app + "/machines", { method: "POST", body: { name: names.machine, region: s.region, config: machineConfig(env, v.data.id, { ...o, lock }) }, ...deps }));
  if (!m.ok || !m.data || typeof m.data.id !== "string") {
    await flyApi(env, "/apps/" + s.app + "/volumes/" + v.data.id, { method: "DELETE", ...deps });
    return { why: "Fly.io could not make the machine (" + m.status + ")" };
  }
  const rec = { id: m.data.id, volume: v.data.id, region: s.region, image: s.image, shape: flyShape(s), small: m.small, lock: 2, at: deps.now(), used: deps.now(), stopped: false, ...(copyMiss ? { copyMiss } : {}) };
  await writeRec(bucket, names.key, rec);
  await untilAnswers(env, rec.id, deps, FLY_PULL_MS);
  return { rec, ...(copyMiss ? { copyMiss } : {}) };
}

/**
 * A NEW CHAT'S DISK MADE FROM THE ENVIRONMENT'S SAVED COPY, at least as big (Fly: "a new volume of equal
 * or greater size"), then its machine once Fly has restored the copy into it ("restoring", then
 * "created"). Answers { rec }, or { why } with what was made removed again (live test #25, 2026-11-07:
 * Fly's refusal was once passed over in silence).
 */
async function machineFromCopy(env, bucket, names, deps, from) {
  const s = flySettings(env);
  const copy = { snapshot_id: String(from.snapshot), size_gb: Math.min(500, Math.max(s.disk, Math.ceil(Number(from.size) || 0))) };
  let v;
  for (const compute of [{ cpu_kind: s.kind, cpus: s.cpus, memory_mb: s.memory }, FLY_SMALL, null]) {
    v = await flyApi(env, "/apps/" + s.app + "/volumes", { method: "POST", body: { name: names.volume, region: s.region, ...(compute ? { compute } : {}), ...copy }, ...deps });
    if (v.ok || v.status === 401 || v.status === 403) break;
  }
  if (!v.ok || !v.data || typeof v.data.id !== "string") return { why: "Fly.io would not make a disk from it (" + flyWhy(v) + ")" };
  const vol = v.data.id;
  const drop = () => flyApi(env, "/apps/" + s.app + "/volumes/" + vol, { method: "DELETE", ...deps });
  const until = deps.now() + FLY_RESTORE_MS;
  for (let state = String(v.data.state || "created"); state !== "created"; ) {
    if (deps.now() >= until) { await drop(); return { why: "its disk was still being restored (" + state.slice(0, 30) + ") after " + Math.round(FLY_RESTORE_MS / 60000) + " minutes" }; }
    await deps.sleep(2000);
    const g = await flyApi(env, "/apps/" + s.app + "/volumes/" + vol, deps);
    if (g.status === 404) return { why: "its disk went while being restored" };
    if (g.ok && g.data) state = String(g.data.state || "created");
  }
  const lock = await controlKeyFor(env.CODER_TOKEN_KEY, names.machine);
  const m = await withConfig((o) => flyApi(env, "/apps/" + s.app + "/machines", { method: "POST", body: { name: names.machine, region: s.region, config: machineConfig(env, vol, { ...o, lock }) }, ...deps }));
  if (!m.ok || !m.data || typeof m.data.id !== "string") { await drop(); return { why: "Fly.io could not start a machine on it (" + flyWhy(m) + ")" }; }
  const rec = { id: m.data.id, volume: vol, region: s.region, image: s.image, shape: flyShape(s), small: m.small, lock: 2, at: deps.now(), used: deps.now(), stopped: false, from: copy.snapshot_id };
  await writeRec(bucket, names.key, rec);
  await untilAnswers(env, rec.id, deps, FLY_PULL_MS);
  return { rec };
}

/**
 * WAKE A CHAT'S MACHINE. Asleep: started, with Coder's newest machine version
 * if there is one (its disk stays), or its new size (flyShape). Awake but silent:
 * given time to answer (never changed under a job). Gone: answers null (a new
 * one is made). A machine that got the size before (no room for the new one)
 * keeps it until the next new version: each try would start its own disk fresh.
 */
async function wakeMachine(env, bucket, names, rec, deps) {
  const s = flySettings(env);
  const m = await flyApi(env, "/apps/" + s.app + "/machines/" + rec.id, deps);
  if (m.status === 404) { await bucket.delete(names.key); return null; }
  const state = m.data && m.data.state;
  let pulled = false;
  if (state !== "started" && state !== "starting") {
    const shape = flyShape(s);
    if (rec.image !== s.image || rec.shape !== shape) {
      // Updated, it gets its own lock key too (step 2).
      const lock = await controlKeyFor(env.CODER_TOKEN_KEY, names.machine);
      const u = await withConfig((o) => flyApi(env, "/apps/" + s.app + "/machines/" + rec.id, { method: "POST", body: { config: machineConfig(env, rec.volume, { ...o, lock }) }, ...deps }));
      if (u.ok) { rec = { ...rec, image: s.image, shape, small: u.small, lock: 2 }; pulled = true; }
      else await flyApi(env, "/apps/" + s.app + "/machines/" + rec.id + "/start", { method: "POST", ...deps });
    } else await flyApi(env, "/apps/" + s.app + "/machines/" + rec.id + "/start", { method: "POST", ...deps });
  }
  rec = { ...rec, stopped: false, used: deps.now() };
  await writeRec(bucket, names.key, rec);
  await untilAnswers(env, rec.id, deps, pulled ? FLY_PULL_MS : FLY_WAKE_MS);
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
        const r = await viaFly(env, rec.id, await locked(env, names.machine, rec, req), body, deps.fetchFn);
        if (r) return r;
      }
      if (rec) rec = await wakeMachine(env, bucket, names, rec, deps);
      let copy = "";
      if (!rec) {
        // ONLY A JOB'S START, OR AN UNDO (which needs the repo), MAKES A MACHINE.
        // Anything else (the every-minute check asking about a job whose machine
        // is still being made, a Stop) never makes a second one.
        const u = new URL(req.url);
        if (!(req.method === "POST" && (u.pathname === "/turn" || u.pathname === "/undo"))) return json({ error: "This chat has no machine on Fly.io yet." }, 503);
        // A new chat in an environment with a saved copy: its disk from the copy (the message route's hint).
        const from = u.pathname === "/turn" && SNAP_ID.test(String(req.headers.get(FROM_COPY) || "")) ? { snapshot: req.headers.get(FROM_COPY), size: Number(req.headers.get(FROM_COPY_GB)) || 0 } : null;
        const made = await makeMachine(env, bucket, names, deps, from);
        if (!made.rec) return json({ error: made.why }, 503);
        rec = made.rec;
        // The machine says in the chat what became of the copy (used, or why not).
        if (from) copy = rec.from ? "used" : "missed: " + (made.copyMiss || "no reason given");
      }
      const fwd = await locked(env, names.machine, rec, req);
      if (copy) fwd.headers.set(COPY_INFO, copy.replace(/[^\x20-\x7e]/g, " ").slice(0, 220));
      const r = await viaFly(env, rec.id, fwd, body, deps.fetchFn);
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

/**
 * IS A CHAT'S MACHINE AWAKE? From Coder's own record only, so asking never wakes it (Gloopy's live view, 2026-11-09:
 * a machine asleep has no browser running, and a look is no reason to wake it).
 */
export async function flyAwake(env, name) {
  if (!flyOn(env)) return false;
  const rec = await readRec(env.CODER_BUCKET, (await flyNames(name)).key);
  return !!rec && !rec.stopped;
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
 * Each machine is asked with its own lock key (machineLock).
 */
export async function runFlyMachines(env, deps0 = {}, now = Date.now()) {
  const out = { checked: 0, stopped: 0, removed: 0 };
  if (!flyOn(env)) return out;
  const deps = { fetchFn: deps0.fetchFn || fetch, sleep: deps0.sleep || wait, now: () => now };
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
      const r = await viaFly(env, m.id, await locked(env, m.name, rec, new Request("http://coder/busy")), undefined, deps.fetchFn);
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
