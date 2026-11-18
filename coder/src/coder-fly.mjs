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
    gloopy: gloopySize(env),
  };
}

/**
 * GLOOPY'S COMPUTER STARTS IN SECONDS (owner, 2026-11-12: "yes build all four"; Grok Bot's computer is up at once):
 * Gloopy's machine is suspended when idle, not stopped, and resumed with its memory as it was (its browser still open)
 * in under a second (Fly.io: "a few hundred ms"; a cold start of the 6.9 GB image took about 80 seconds). Fly suspends
 * machines of at most 2 GB, so Gloopy's has its own size: one full-speed CPU and 2 GB by default (a browser and its
 * commands; Coder's chats keep their 4 CPUs and 16 GB). Fly bills a suspended machine like a stopped one (its disk
 * only), and this size costs less awake. CODER_FLY_GLOOPY_CPU_KIND / _CPUS / _MEMORY_MB may change it, within Fly's
 * rules and 2 GB.
 */
export const GLOOPY_SUSPEND_MB = 2048;
/** Gloopy's size when Fly.io has no room for it (2 shared CPUs, 2 GB: still suspendable). */
export const GLOOPY_SMALL = { cpu_kind: "shared", cpus: 2, memory_mb: 2048 };
export function gloopySize(env) {
  const kind = String(env.CODER_FLY_GLOOPY_CPU_KIND || "") === "shared" ? "shared" : "performance";
  const per = kind === "shared" ? { most: 8, step: 256, low: 256, high: 2048 } : { most: 16, step: 2048, low: 2048, high: 8192 };
  const n = Number(env.CODER_FLY_GLOOPY_CPUS);
  const cpus = Number.isInteger(n) && n >= 1 && n <= per.most ? n : kind === "shared" ? 2 : 1;
  const mb = Number(env.CODER_FLY_GLOOPY_MEMORY_MB);
  const fits = (m) => Number.isInteger(m) && m % per.step === 0 && m >= per.low * cpus && m <= per.high * cpus && m <= GLOOPY_SUSPEND_MB;
  if (fits(mb)) return { kind, cpus, memory: mb };
  if (fits(GLOOPY_SUSPEND_MB)) return { kind, cpus, memory: GLOOPY_SUSPEND_MB };
  return { kind: "performance", cpus: 1, memory: GLOOPY_SUSPEND_MB };
}

/**
 * WHAT A MACHINE'S SETTINGS ARE MADE FROM, besides its image: when they change (a new size), each
 * chat's machine gets them the next time it wakes, as with a new image (never under a job).
 */
export function flyShape(s, gloopy = false) {
  return gloopy ? ["gloopy", s.gloopy.kind, s.gloopy.cpus, s.gloopy.memory, s.diskMax, s.root].join("/") : [s.kind, s.cpus, s.memory, s.diskMax, s.root].join("/");
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
export function machineConfig(env, volumeId, { keepRoot = true, bigRoot = true, lock = "", small = false, grow = true, gloopy = false } = {}) {
  const s = flySettings(env);
  const size = gloopy ? (small ? GLOOPY_SMALL : { cpu_kind: s.gloopy.kind, cpus: s.gloopy.cpus, memory_mb: s.gloopy.memory }) : small ? FLY_SMALL : { cpu_kind: s.kind, cpus: s.cpus, memory_mb: s.memory };
  return {
    image: s.image,
    // ITS LOCK, ALWAYS: on Fly.io a machine is on the internet (Fly's front door), so its control
    // key is given here too, not only as a Fly secret (made from CODER_TOKEN_KEY; never the key itself).
    // CODER_IMAGE_REF: which Coder version this is, so the admin sandbox's own layer starts fresh with a new one.
    env: { CODER_DATA: FLY_DATA, CODER_IMAGE_REF: s.image, ...(env.CODER_MODEL ? { CODER_MODEL: String(env.CODER_MODEL) } : {}), ...(lock ? { CODER_CONTROL_KEY: lock } : env.CODER_TOKEN_KEY ? { CODER_CONTROL_KEY: controlKeySync(env.CODER_TOKEN_KEY) } : {}) },
    guest: { ...size, ...(keepRoot && !bigRoot ? { persist_rootfs: "restart" } : {}) },
    ...(keepRoot && bigRoot ? { rootfs: { persist: "restart", size_gb: s.root } } : {}),
    // The chat's work disk, which Fly.io makes bigger by itself when it is 80% full (Fly's auto-extend).
    mounts: [{ volume: volumeId, path: FLY_DATA, ...(grow && s.diskMax > s.disk ? { extend_threshold_percent: 80, add_size_gb: FLY_DISK_STEP_GB, size_gb_limit: s.diskMax } : {}) }],
    // Only through Fly's front door, on https; Coder starts and stops it itself.
    services: [{ protocol: "tcp", internal_port: 8080, ports: [{ port: 443, handlers: ["tls", "http"] }], autostart: false, autostop: "off" }],
    restart: { policy: "on-failure", max_retries: 3 },
    metadata: { coder: gloopy ? "gloopy-machine" : "chat-machine" },
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
/** A request whose answer is a stream (Gloopy's live view): for viaFly only, never sent on. */
export const STREAM_HEADER = "x-coder-stream";
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
/** A chat's "machine being made" mark (`{ at }`), or null. */
async function readMaking(bucket, key) {
  const o = await bucket.get(key);
  if (!o) return null;
  try { const r = JSON.parse(await o.text()); return r && Number(r.at) > 0 ? r : null; } catch { return null; }
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
  // A STREAM (Gloopy's live view, 2026-11-10) is passed on as it comes, so it is asked without the "still working"
  // signal (it sends something every few seconds itself).
  if (headers.get(STREAM_HEADER) === "1") headers.delete("x-coder-keepalive"); else headers.set("x-coder-keepalive", "1");
  headers.delete(STREAM_HEADER);
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

/** How long a request waits for a machine slow to wake before it is said to have not answered. */
export const FLY_RETRY_MS = 60_000;
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
async function makeMachine(env, bucket, names, deps, from = null, gloopy = false) {
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
  for (const compute of gloopy ? [{ cpu_kind: s.gloopy.kind, cpus: s.gloopy.cpus, memory_mb: s.gloopy.memory }, GLOOPY_SMALL, null] : [{ cpu_kind: s.kind, cpus: s.cpus, memory_mb: s.memory }, FLY_SMALL, null]) {
    v = await flyApi(env, "/apps/" + s.app + "/volumes", { method: "POST", body: { name: names.volume, region: s.region, size_gb: s.disk, ...(compute ? { compute } : {}) }, ...deps });
    if (v.ok || v.status === 401 || v.status === 403) break;
  }
  if (!v.ok || !v.data || typeof v.data.id !== "string") return { why: "Fly.io could not make the machine's disk (" + v.status + ")" };
  // Fly refused the settings (should it not take a bigger or kept disk, or the size): made the older way, as before.
  const lock = await controlKeyFor(env.CODER_TOKEN_KEY, names.machine);
  const m = await withConfig((o) => flyApi(env, "/apps/" + s.app + "/machines", { method: "POST", body: { name: names.machine, region: s.region, config: machineConfig(env, v.data.id, { ...o, lock, gloopy }) }, ...deps }));
  if (!m.ok || !m.data || typeof m.data.id !== "string") {
    await flyApi(env, "/apps/" + s.app + "/volumes/" + v.data.id, { method: "DELETE", ...deps });
    return { why: "Fly.io could not make the machine (" + m.status + ")" };
  }
  const rec = { id: m.data.id, volume: v.data.id, region: s.region, image: s.image, shape: flyShape(s, gloopy), small: m.small, lock: 2, at: deps.now(), used: deps.now(), stopped: false, ...(gloopy ? { gloopy: true } : {}), ...(copyMiss ? { copyMiss } : {}) };
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
async function wakeMachine(env, bucket, names, rec, deps, gloopy = false) {
  const s = flySettings(env);
  // An older Gloopy machine (made at Coder's size) is marked, and gets Gloopy's size below.
  if (gloopy && !rec.gloopy) rec = { ...rec, gloopy: true };
  const m = await flyApi(env, "/apps/" + s.app + "/machines/" + rec.id, deps);
  if (m.status === 404) { await bucket.delete(names.key); return null; }
  const state = m.data && m.data.state;
  let pulled = false;
  if (state !== "started" && state !== "starting") {
    const shape = flyShape(s, !!rec.gloopy);
    if (rec.image !== s.image || rec.shape !== shape) {
      // Updated, it gets its own lock key too (step 2).
      const lock = await controlKeyFor(env.CODER_TOKEN_KEY, names.machine);
      const u = await withConfig((o) => flyApi(env, "/apps/" + s.app + "/machines/" + rec.id, { method: "POST", body: { config: machineConfig(env, rec.volume, { ...o, lock, gloopy: !!rec.gloopy }) }, ...deps }));
      if (u.ok) { rec = { ...rec, image: s.image, shape, small: u.small, lock: 2 }; pulled = true; }
      else await flyApi(env, "/apps/" + s.app + "/machines/" + rec.id + "/start", { method: "POST", ...deps });
    } else await flyApi(env, "/apps/" + s.app + "/machines/" + rec.id + "/start", { method: "POST", ...deps });
  }
  rec = { ...rec, stopped: false, suspended: undefined, used: deps.now() };
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
export function flyBox(env, name, deps0 = {}, { gloopy = false } = {}) {
  const deps = { fetchFn: deps0.fetchFn || fetch, sleep: deps0.sleep || wait, now: deps0.now || Date.now, ...(typeof deps0.waitUntil === "function" ? { waitUntil: deps0.waitUntil } : {}) };
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
      if (rec) rec = await wakeMachine(env, bucket, names, rec, deps, gloopy);
      let copy = "";
      if (!rec) {
        // ONLY A JOB'S START, OR AN UNDO (which needs the repo), MAKES A MACHINE.
        // Anything else (the every-minute check asking about a job whose machine
        // is still being made, a Stop) never makes a second one.
        const u = new URL(req.url);
        // (And /warm, 2026-11-15: a new chat's machine started when the owner picks its repository, before the first message.)
        if (!(req.method === "POST" && (u.pathname === "/turn" || u.pathname === "/undo" || u.pathname === "/warm"))) return json({ error: "This chat has no machine on Fly.io yet." }, 503);
        // ONE MAKER AT A TIME (2026-11-15): the early start (/warm) and the first message can come together; the second waits
        // for the first's machine instead of making another.
        const makingKey = names.key + ".making";
        const other = await readMaking(bucket, makingKey);
        if (other && deps.now() - Number(other.at) < FLY_PULL_MS) {
          for (const until = deps.now() + FLY_PULL_MS; !rec && deps.now() < until; ) {
            await deps.sleep(2000);
            const r0 = await readRec(bucket, names.key);
            if (r0 && !r0.stopped) rec = r0;
            else if (!(await readMaking(bucket, makingKey))) break;
          }
          if (!rec) return json({ error: "Coder's machine for this chat is still being made. Try again in a minute." }, 503);
        } else {
          await writeRec(bucket, makingKey, { at: deps.now() });
          try {
            // A new chat in an environment with a saved copy: its disk from the copy (the message route's hint).
            const from = (u.pathname === "/turn" || u.pathname === "/warm") && SNAP_ID.test(String(req.headers.get(FROM_COPY) || "")) ? { snapshot: req.headers.get(FROM_COPY), size: Number(req.headers.get(FROM_COPY_GB)) || 0 } : null;
            // A SPARE FIRST (2026-11-15): a machine already made from this image, stopped on a server that has the image, is
            // given this chat's own lock key and started in seconds; the pool is filled again in the background. Not for
            // Gloopy (its own size) nor a disk from the environment's saved copy (that disk must be made from the copy).
            const spare = !gloopy ? await claimSpare(env, bucket, names, deps, from ? String(from.snapshot) : null).catch(() => null) : null;
            // (No spare from this copy yet: one is made for the next chat in this environment.)
            if (from && !spare && typeof deps.waitUntil === "function") deps.waitUntil(ensureCopySpare(env, from, deps).catch(() => null));
            const made = spare ? { rec: spare } : await makeMachine(env, bucket, names, deps, from, gloopy);
            if (!made.rec) return json({ error: made.why }, 503);
            rec = made.rec;
            // The machine says in the chat what became of the copy (used, or why not).
            if (from) copy = rec.from ? "used" : "missed: " + (made.copyMiss || "no reason given");
          } finally { if (typeof bucket.delete === "function") await bucket.delete(makingKey).catch(() => {}); }
        }
      }
      const fwd = await locked(env, names.machine, rec, req);
      if (copy) fwd.headers.set(COPY_INFO, copy.replace(/[^\x20-\x7e]/g, " ").slice(0, 220));
      let r = await viaFly(env, rec.id, fwd, body, deps.fetchFn);
      // A MACHINE SLOW TO WAKE, WAITED FOR (live, 2026-11-18: a new chat said "did not answer. Try again in a minute", and
      // the next try took 107 s; Claude Code waits while its machine starts). No answer from Coder's own service means
      // the request never reached it, so it is sent again once the machine answers, for up to FLY_RETRY_MS.
      for (const until = deps.now() + FLY_RETRY_MS; !r && deps.now() < until; ) {
        await untilAnswers(env, rec.id, deps, Math.min(15000, Math.max(1000, until - deps.now())));
        r = await viaFly(env, rec.id, fwd, body, deps.fetchFn);
      }
      return r || json({ error: "Coder's machine on Fly.io did not answer. Try again in a minute." }, 503);
    },
  };
}

/**
 * THE LINK FROM THE OWNER'S DESKTOP APP TO GLOOPY'S MACHINE (2026-11-11: routing Gloopy's browser through the owner's
 * computer): a WebSocket to the machine while it is awake (never waking it: a link is no reason to), with its key; its
 * answer (101, with the socket) is handed back as it is, and Cloudflare joins it to the app's (its own way of passing a
 * WebSocket on; live test, 2026-11-11: messages from the machine did not come through a relay of our own). Null when the
 * machine isn't up or won't take it.
 */
export async function flyRouteLink(env, name, deps0 = {}) {
  if (!flyOn(env)) return null;
  const fetchFn = deps0.fetchFn || fetch;
  const names = await flyNames(name);
  const rec = await readRec(env.CODER_BUCKET, names.key);
  if (!rec || rec.stopped) return null;
  const key = await machineLock(env, names.machine, rec);
  let up = null;
  try { up = await fetchFn("https://" + flySettings(env).app + ".fly.dev/gloopy/route", { headers: { Upgrade: "websocket", Connection: "Upgrade", "Sec-WebSocket-Version": "13", "fly-force-instance-id": rec.id, ...(key ? { "x-coder-key": key } : {}) } }); } catch { up = null; }
  return up && up.webSocket ? up : null;
}


// ── SPARE MACHINES (owner, 2026-11-15: "the machine must be ready in seconds, not ~50 s") ──────────────────────────────────
// Why the early start (/warm) did not help (live, after deploy 201: the first message reached its machine 53.7 s after the
// Worker got it, though /warm had started 15 s before): a new chat's machine is made on a NEW disk, which Fly.io puts on
// whatever server has room, and that server first fetches Coder's 6.9 GB image (about 60 to 80 s). /warm and the message
// shared that one making (the `.making` mark), so /warm only took 15 s off it. A machine whose image is already on its server
// starts in a few seconds. So a small pool of spare machines is kept, each made from the current image with its own disk
// and then STOPPED (a stopped machine costs only its disk): a new chat claims one, which is given that chat's own lock key
// (never another chat's: a spare is made with a key of its own, derived from its spare name, that no chat has) and started;
// from then on it is that chat's machine and disk, like any other. The pool is filled again in the background.
export const SPARES = "coder/fly-spares/";
/** A spare's machine name (its disk is cspare_ and the same 16 letters). */
export const SPARE_NAME = /^cspare-([0-9a-f]{16})$/;
/** A spare older than this is recycled (removed and made again), so none is kept for ever. */
export const SPARE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** A spare not ready (its image fetched, its service answering) this long after it was made is removed. */
export const SPARE_READY_MS = 15 * 60 * 1000;
/** How many spares are kept (CODER_FLY_SPARES, 0 to 5; 0: none; default 1). */
export function spareCount(env) {
  const n = Number(env && env.CODER_FLY_SPARES);
  return Number.isInteger(n) && n >= 0 && n <= 5 ? n : 1;
}
async function readJson(bucket, key) {
  const o = await bucket.get(key);
  if (!o) return null;
  try { return JSON.parse(await o.text()); } catch { return null; }
}
/** The spares' records (not the claimed index), with their keys. */
async function spareRecs(bucket) {
  const out = [];
  let cursor;
  do {
    const page = await bucket.list({ prefix: SPARES, cursor });
    for (const o of page.objects || []) {
      if (!/^[0-9a-f]{16}\.json$/.test(o.key.slice(SPARES.length))) continue;
      const r = await readJson(bucket, o.key);
      if (r && (typeof r.id === "string" || r.restoring === true)) out.push({ key: o.key, rec: r });
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return out;
}
/** Can a chat start on this spare now? Ready (stopped, image fetched), from the current image and size, in this region, not old. */
export function spareUsable(env, rec, now = Date.now(), snap = null) {
  const s = flySettings(env);
  return !!rec && (rec.snap || null) === (snap || null) && rec.ready === true && !rec.claimed && rec.image === s.image && rec.shape === flyShape(s) && rec.region === s.region && now - Number(rec.at || 0) < SPARE_MAX_AGE_MS;
}

/** MAKE ONE SPARE: its disk, then its machine (Fly starts it and fetches the image); it is stopped once it answers (tendSpares). */
export async function makeSpare(env, deps0 = {}, copy = null) {
  if (!flyOn(env)) return null;
  const deps = { fetchFn: deps0.fetchFn || fetch, sleep: deps0.sleep || wait, now: deps0.now || Date.now };
  const s = flySettings(env), bucket = env.CODER_BUCKET;
  const h = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, "0")).join("");
  // A SPARE FROM AN ENVIRONMENT'S SAVED COPY (the owner, 2026-11-18: "do it claude code way"; a new chat in an environment
  // with a setup script waited ~80 s for its disk to be restored and a new server to fetch the image; Claude Code's docs:
  // "New sessions start with your dependencies, tools, and Docker images already on disk"): its disk is the copy.
  const snap = copy && SNAP_ID.test(String(copy.snapshot)) ? String(copy.snapshot) : null;
  const size = snap ? { snapshot_id: snap, size_gb: Math.min(500, Math.max(s.disk, Math.ceil(Number(copy.size) || 0))) } : { size_gb: s.disk };
  let v;
  for (const compute of [{ cpu_kind: s.kind, cpus: s.cpus, memory_mb: s.memory }, FLY_SMALL, null]) {
    v = await flyApi(env, "/apps/" + s.app + "/volumes", { method: "POST", body: { name: "cspare_" + h, region: s.region, ...size, ...(compute ? { compute } : {}) }, ...deps });
    if (v.ok || v.status === 401 || v.status === 403) break;
  }
  if (!v.ok || !v.data || typeof v.data.id !== "string") return null;
  // (Still being restored: its machine is made by the every-minute run once the disk is ready, tendSpares.)
  if (snap && String(v.data.state || "created") !== "created") {
    const rec = { volume: v.data.id, region: s.region, image: s.image, shape: flyShape(s), at: deps.now(), ready: false, restoring: true, snap, size: size.size_gb, h };
    await writeRec(bucket, SPARES + h + ".json", rec);
    return rec;
  }
  return spareMachine(env, deps, h, v.data.id, snap, size.size_gb);
}
/** A spare's machine on its disk (made at once, or once a saved copy is restored into the disk). */
async function spareMachine(env, deps, h, volume, snap = null, gb = 0) {
  const s = flySettings(env), bucket = env.CODER_BUCKET;
  const v = { data: { id: volume } };
  // ITS OWN KEY, from its spare name: no chat's (a chat's is made from that chat's name); replaced when a chat claims it.
  const lock = env.CODER_TOKEN_KEY ? await controlKeyFor(env.CODER_TOKEN_KEY, "cspare-" + h) : "";
  const m = await withConfig((o) => flyApi(env, "/apps/" + s.app + "/machines", { method: "POST", body: { name: "cspare-" + h, region: s.region, config: { ...machineConfig(env, v.data.id, { ...o, lock }), metadata: { coder: "spare-machine" } } }, ...deps }));
  if (!m.ok || !m.data || typeof m.data.id !== "string") { await flyApi(env, "/apps/" + s.app + "/volumes/" + v.data.id, { method: "DELETE", ...deps }); return null; }
  const rec = { id: m.data.id, volume: v.data.id, region: s.region, image: s.image, shape: flyShape(s), small: m.small, at: deps.now(), ready: false, h, ...(snap ? { snap, size: gb } : {}) };
  await writeRec(bucket, SPARES + h + ".json", rec);
  return rec;
}
/** How many spares made from saved copies are kept at most (one per copy; the oldest goes first). */
export const COPY_SPARES_MAX = 3;
/** A spare from a saved copy for this copy, unless there is one (ready, being made or restored); the oldest goes past the cap. */
export async function ensureCopySpare(env, copy, deps0 = {}) {
  if (!flyOn(env) || spareCount(env) < 1 || !copy || !SNAP_ID.test(String(copy.snapshot))) return null;
  const now = (deps0.now || Date.now)();
  const all = (await spareRecs(env.CODER_BUCKET)).filter(({ rec }) => rec.snap && !rec.claimed);
  if (all.some(({ rec }) => rec.snap === String(copy.snapshot) && now - Number(rec.at || 0) < SPARE_MAX_AGE_MS)) return null;
  const old = all.sort((a, b) => Number(a.rec.at || 0) - Number(b.rec.at || 0));
  for (let i = 0; i <= old.length - COPY_SPARES_MAX; i++) {
    await removeMachine(env, old[i].rec.id || null, old[i].rec.volume, { fetchFn: deps0.fetchFn || fetch, sleep: deps0.sleep || wait, now: deps0.now || Date.now });
    await env.CODER_BUCKET.delete(old[i].key);
  }
  return makeSpare(env, deps0, copy);
}

/**
 * A NEW CHAT TAKES A SPARE: the first ready one is marked taken (only if nobody took it first: R2's if-match), given this
 * chat's own lock key (Fly's update, which starts it; its image is already on its server), and becomes the chat's machine
 * and disk (the chat's record; an index says which chat a spare's machine now belongs to). Null when there is none (a
 * machine is made as before). The pool is filled again in the background.
 */
export async function claimSpare(env, bucket, names, deps, snap = null) {
  if (spareCount(env) < 1) return null;
  const s = flySettings(env), now = deps.now();
  for (const { key } of await spareRecs(bucket)) {
    const o = await bucket.get(key);
    if (!o) continue;
    let sr; try { sr = JSON.parse(await o.text()); } catch { continue; }
    if (!spareUsable(env, sr, now, snap)) continue;
    const cond = o.etag ? { onlyIf: new Headers({ "if-match": o.httpEtag || '"' + o.etag + '"' }) } : {};
    let took;
    try { took = await bucket.put(key, JSON.stringify({ ...sr, claimed: names.key, claimedAt: now }), { httpMetadata: { contentType: "application/json" }, ...cond }); } catch { took = null; }
    if (took === null) continue; // another chat took it first
    await writeRec(bucket, SPARES + "claimed/" + sr.h + ".json", { key: names.key, machine: names.machine, at: now });
    const lock = await controlKeyFor(env.CODER_TOKEN_KEY, names.machine);
    const u = await withConfig((o2) => flyApi(env, "/apps/" + s.app + "/machines/" + sr.id, { method: "POST", body: { config: machineConfig(env, sr.volume, { ...o2, lock }) }, ...deps }));
    if (!u.ok) {
      // Gone or refused: removed, and the next spare (or a new machine) is used.
      await removeMachine(env, sr.id, sr.volume, deps);
      await bucket.delete(key); await bucket.delete(SPARES + "claimed/" + sr.h + ".json");
      continue;
    }
    // (Fly starts a machine it updates; if it says otherwise, it is started.)
    const st = u.data && u.data.state;
    if (st && st !== "started" && st !== "starting" && st !== "replacing" && st !== "updating") await flyApi(env, "/apps/" + s.app + "/machines/" + sr.id + "/start", { method: "POST", ...deps });
    const rec = { id: sr.id, volume: sr.volume, region: sr.region, image: sr.image, shape: sr.shape, small: u.small, lock: 2, at: now, used: now, stopped: false, spare: sr.h, ...(snap ? { from: snap } : {}) };
    await writeRec(bucket, names.key, rec);
    await bucket.delete(key);
    const refill = (snap ? ensureCopySpare(env, { snapshot: snap, size: sr.size }, deps) : refillSpares(env, deps)).catch(() => null);
    if (typeof deps.waitUntil === "function") deps.waitUntil(refill);
    await untilAnswers(env, rec.id, deps, FLY_WAKE_MS);
    return rec;
  }
  return null;
}

/** Spares are made until the pool has `spareCount` (ready or being made, from the current image). */
export async function refillSpares(env, deps0 = {}) {
  if (!flyOn(env)) return 0;
  const now = (deps0.now || Date.now)();
  const s = flySettings(env);
  const have = (await spareRecs(env.CODER_BUCKET)).filter(({ rec }) => !rec.snap && !rec.claimed && rec.image === s.image && rec.shape === flyShape(s) && rec.region === s.region && now - Number(rec.at || 0) < SPARE_MAX_AGE_MS).length;
  let made = 0;
  for (let i = have; i < spareCount(env); i++) if (await makeSpare(env, deps0)) made++;
  return made;
}

/**
 * EVERY MINUTE (runFlyMachines): each spare being made is stopped once it answers (its image is then on its server) and
 * marked ready; one from an older image or size, older than SPARE_MAX_AGE_MS, never ready in SPARE_READY_MS, or gone from
 * Fly is removed with its disk; a spare left marked taken (its claim cut off) is removed too; then the pool is filled.
 */
export async function tendSpares(env, bucket, deps, now, machines) {
  const out = { removed: 0, made: 0, volumes: [] };
  const s = flySettings(env);
  const byId = new Map((Array.isArray(machines) ? machines : []).map((m) => [m && m.id, m]));
  for (const { key, rec } of await spareRecs(bucket)) {
    if (rec.restoring) {
      const g = await flyApi(env, "/apps/" + s.app + "/volumes/" + rec.volume, deps);
      const late = now - Number(rec.at || 0) >= SPARE_READY_MS;
      if (g.status === 404 || late || rec.image !== s.image) { await removeMachine(env, null, g.status === 404 ? null : rec.volume, deps); await bucket.delete(key); out.removed++; continue; }
      out.volumes.push(rec.volume);
      if (g.ok && g.data && String(g.data.state || "created") === "created") {
        const made = await spareMachine(env, { ...deps, now: () => now }, rec.h, rec.volume, rec.snap, rec.size);
        if (!made) { await removeMachine(env, null, rec.volume, deps); await bucket.delete(key); out.removed++; }
        else await writeRec(bucket, key, { ...made, at: rec.at });
      }
      continue;
    }
    const m = byId.get(rec.id);
    const old = rec.image !== s.image || rec.shape !== flyShape(s) || rec.region !== s.region || now - Number(rec.at || 0) >= SPARE_MAX_AGE_MS;
    const stuck = !rec.ready && now - Number(rec.at || 0) >= SPARE_READY_MS;
    const dropped = rec.claimed && now - Number(rec.claimedAt || 0) >= FLY_ORPHAN_MS;
    if (rec.claimed && !dropped) { out.volumes.push(rec.volume); continue; }
    if (dropped) {
      // Its claim was cut off after the chat got it: the chat keeps it (only the spare's record goes).
      const owner = await readRec(bucket, String(rec.claimed));
      if (owner && owner.id === rec.id) { await bucket.delete(key); out.volumes.push(rec.volume); continue; }
      await bucket.delete(SPARES + "claimed/" + rec.h + ".json");
    }
    if (!m || old || stuck || dropped || spareCount(env) < 1) {
      await removeMachine(env, m ? rec.id : null, rec.volume, deps);
      await bucket.delete(key);
      out.removed++;
      continue;
    }
    out.volumes.push(rec.volume);
    if (!rec.ready && m.state === "started") {
      const h = await viaFly(env, rec.id, new Request("http://coder/health"), undefined, deps.fetchFn);
      if (h && h.ok) {
        const st = await flyApi(env, "/apps/" + s.app + "/machines/" + rec.id + "/stop", { method: "POST", ...deps });
        if (st.ok) await writeRec(bucket, key, { ...rec, ready: true, readyAt: now });
      }
    } else if (rec.ready && m.state === "started") {
      await flyApi(env, "/apps/" + s.app + "/machines/" + rec.id + "/stop", { method: "POST", ...deps });
    }
  }
  out.made = await refillSpares(env, { ...deps, now: () => now });
  return out;
}

/** Remove a machine and its kept disk (the disk once the machine is gone). */
async function removeMachine(env, id, volume, deps) {
  const s = flySettings(env);
  if (id) await flyApi(env, "/apps/" + s.app + "/machines/" + id + "?force=true", { method: "DELETE", ...deps });
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

/**
 * HOW MANY COMMITS THE CHAT'S DISK HOLDS THAT GITHUB DOES NOT HAVE (owner, 2026-11-16: work is pushed at a stopping point, not
 * after every message): kept on the machine's record, so the monthly reclaim never removes a disk with unpushed work on it.
 */
export async function markFlyUnpushed(env, name, n) {
  if (!flyOn(env)) return false;
  const names = await flyNames(name);
  const rec = await readRec(env.CODER_BUCKET, names.key);
  if (!rec || (Number(rec.unpushed) || 0) === (Number(n) || 0)) return false;
  await writeRec(env.CODER_BUCKET, names.key, { ...rec, unpushed: Number(n) || 0 });
  return true;
}
/** May an idle machine's disk be reclaimed? Never while it holds commits not pushed to GitHub. */
export const reclaimable = (rec, now) => !(Number(rec && rec.unpushed) > 0) && now - Number(rec.used || rec.at || 0) > FLY_RECLAIM_MS;

/** A REMOVED CHAT's machine and disk go too. */
export async function dropFlyMachine(env, name, deps0 = {}) {
  if (!flyOn(env)) return;
  const deps = { fetchFn: deps0.fetchFn || fetch, sleep: deps0.sleep || wait, now: deps0.now || Date.now };
  const names = await flyNames(name);
  const rec = await readRec(env.CODER_BUCKET, names.key);
  if (!rec) return;
  await removeMachine(env, rec.id, rec.volume, deps);
  await env.CODER_BUCKET.delete(names.key);
  if (rec.spare) await env.CODER_BUCKET.delete(SPARES + "claimed/" + rec.spare + ".json");
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
    const sp = SPARE_NAME.exec(String((m && m.name) || ""));
    if ((!hit && !sp) || typeof m.id !== "string") continue;
    // A SPARE (2026-11-15): not claimed yet, it is tended below (tendSpares); claimed, it is that chat's machine, under the
    // chat's own record and lock key (the index says which chat).
    const idx = sp ? await readJson(bucket, SPARES + "claimed/" + sp[1] + ".json") : null;
    if (sp && !(idx && typeof idx.key === "string")) {
      const vol0 = m.config && Array.isArray(m.config.mounts) && m.config.mounts[0] ? m.config.mounts[0].volume : null;
      if (vol0) known.add(vol0);
      continue;
    }
    const key = sp ? idx.key : RECORDS + hit[1] + ".json";
    const lockName = sp ? String(idx.machine || m.name) : m.name;
    const rec = await readRec(bucket, key);
    const made = Date.parse(String(m.created_at || "")) || 0;
    const vol = m.config && Array.isArray(m.config.mounts) && m.config.mounts[0] ? m.config.mounts[0].volume : null;
    if (!rec || rec.id !== m.id) {
      // (A spare being claimed this moment: its chat's record comes in a second; tendSpares sees to one left half-claimed.)
      if (sp) { if (vol) known.add(vol); continue; }
      if (now - made > FLY_ORPHAN_MS) { await removeMachine(env, m.id, vol, deps); out.removed++; }
      else if (vol) known.add(vol);
      continue;
    }
    known.add(rec.volume);
    if (m.state === "started") {
      out.checked++;
      const r = await viaFly(env, m.id, await locked(env, lockName, rec, new Request("http://coder/busy")), undefined, deps.fetchFn);
      const busy = r && r.ok ? await r.json().catch(() => null) : null;
      if (shouldStop(busy, rec, now)) {
        // GLOOPY'S IS SUSPENDED (2026-11-12): woken, it is as it was in under a second; if Fly won't, it is stopped.
        const sus = rec.gloopy ? await flyApi(env, "/apps/" + s.app + "/machines/" + m.id + "/suspend", { method: "POST", ...deps }) : null;
        const st = sus && sus.ok ? sus : await flyApi(env, "/apps/" + s.app + "/machines/" + m.id + "/stop", { method: "POST", ...deps });
        if (st.ok) { out.stopped++; if (sus && sus.ok) out.suspended = (out.suspended || 0) + 1; await writeRec(bucket, key, { ...rec, stopped: true, stoppedAt: now, suspended: sus && sus.ok ? true : undefined }); }
      }
    } else if ((m.state === "stopped" || m.state === "suspended") && reclaimable(rec, now)) {
      await removeMachine(env, m.id, rec.volume, deps);
      await bucket.delete(key);
      if (sp) await bucket.delete(SPARES + "claimed/" + sp[1] + ".json");
      known.delete(rec.volume);
      out.removed++;
    }
  }
  // THE SPARES: made ready, recycled when old or from an older image, and the pool filled up again.
  const spr = await tendSpares(env, bucket, deps, now, list.data);
  for (const v of spr.volumes) known.add(v);
  out.removed += spr.removed;
  if (spr.made) out.spares = spr.made;
  // ONCE AN HOUR: kept disks no machine uses (a machine removed before its disk could go).
  if (new Date(now).getUTCMinutes() === 17) {
    const vols = await flyApi(env, "/apps/" + s.app + "/volumes", deps);
    for (const v of vols.ok && Array.isArray(vols.data) ? vols.data : []) {
      if (!/^(?:coder_[0-9a-f]{20}|cspare_[0-9a-f]{16})$/.test(String((v && v.name) || "")) || known.has(v.id) || v.attached_machine_id) continue;
      if (now - (Date.parse(String(v.created_at || "")) || now) > FLY_ORPHAN_MS) { await flyApi(env, "/apps/" + s.app + "/volumes/" + v.id, { method: "DELETE", ...deps }); out.removed++; }
    }
  }
  return out;
}
