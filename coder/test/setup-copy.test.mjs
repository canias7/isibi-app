// THE ENVIRONMENT'S SAVED COPY OF ITS SETUP (owner, 2026-11-07: "ok start"; like
// Claude Code's environment cache: "If it completes in under about 5 minutes, the
// filesystem is snapshotted and reused" for the environment's next sessions, and
// "Cloud sessions start from a fresh clone of your repository"). CD152: the
// Worker asks for the copy and points new chats at it; CD153: the machine waits
// while it is saved, and a disk made from it skips the setup and keeps nothing of
// the other chat's own. (Fly.io's side, CD151: test/fly.test.mjs.)
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, readFile, readdir, chmod, readlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function fakeBucket() {
  const m = new Map();
  return { m, async get(k) { return m.has(k) ? { text: async () => m.get(k) } : null; }, async put(k, v) { m.set(k, typeof v === "string" ? v : String(v)); }, async delete(k) { m.delete(k); },
    async list({ prefix = "" } = {}) { return { objects: [...m.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }; } };
}
const KEY = Buffer.alloc(32, 7).toString("base64");
const ENV = (bucket) => ({ CODER_ON: "on", CODER_USERS: "me@x.y", GITHUB_APP_CLIENT_ID: "Iv1.abc", GITHUB_APP_CLIENT_SECRET: "shh", GITHUB_APP_SLUG: "gofarther-coder", CODER_TOKEN_KEY: KEY, CODER_PUBLIC_URL: "https://coder.gofarther.dev", APP_ORIGIN: "https://gofarther.dev", CODER_BUCKET: bucket });
const UID = "user-1234567890abcdef";
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));

test("CD152 the Worker: a setup run on a fresh disk is saved as the environment's copy when the chat's first turn ends (2026-11-15; the job never waits for it), with a note for the chat; a new chat in the environment is pointed at the copy only once Fly.io has finished it (live test #25), and while it is being finished runs the setup itself and makes no second copy; never on Cloudflare, without a setup script, or for another script", async () => {
  const { handleCoder } = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const E = await import("../src/coder-environments.mjs");
  const { FROM_COPY, FROM_COPY_GB, CACHE_PENDING_MS } = await import("../src/coder-fly.mjs");
  const bucket = fakeBucket(); const env = ENV(bucket);
  await saveConnection(env, bucket, UID, { access: "ghu_user" }, "ana");
  const script = "apt-get install -y figlet";
  await E.writeEnvData(env, bucket, UID, "default", { script, vars: {}, secrets: [], network: null });
  const machine = { held: false, calls: [] };
  const box = () => ({ fetch: async (req) => {
    const u = new URL(req.url);
    const body = req.method === "POST" ? await req.json() : null;
    machine.calls.push({ path: u.pathname, body, copy: req.headers.get(FROM_COPY), gb: req.headers.get(FROM_COPY_GB) });
    if (u.pathname === "/turn") return Response.json({ ok: true, ...(machine.held ? { held: true } : {}) });
    // THE TURN'S END (2026-11-15: the copy is taken then): the machine's result says whether its disk is ready to be saved.
    if (u.pathname === "/state") return Response.json({ running: false, result: { status: "done", summary: "Done.", messages: [], ...(machine.copy ? { copy: true } : {}) }, events: [], next: 0 });
    if (u.pathname === "/push") return Response.json({ ok: true, pushed: false, changed: false });
    return Response.json({ ok: true });
  } });
  const snaps = [], asked = [];
  let snapAnswer = { snapshot: "vs_Good1234", volume: "vol_A1", size: 20, region: "iad", image: "registry.fly.io/app:coder-1", retention: 0, ready: false };
  let state = { status: "running" };
  const fly = { snapshot: async (name) => { snaps.push(name); return snapAnswer; }, cacheUsable: (c, key) => !!c && c.key === key && c.snapshot === "vs_Good1234", copyState: async (c) => { asked.push(c.snapshot); return state; } };
  let n = 0;
  const send = async (more, { text = "Fix it", turn = 0 } = {}) => {
    const id = "shop-c" + ++n;
    await bucket.put("coder/" + UID + "/" + id + "/meta.json", JSON.stringify({ id, repo: "ana/shop", base: "main", branch: "coder/" + id, turn, saved: turn, status: "idle", at: Date.now() }));
    machine.calls.length = 0; snaps.length = 0; asked.length = 0;
    const deps = { fetchFn: async () => new Response("{}", { status: 404 }), authUser: async () => ({ id: UID, email: "me@x.y" }), container: box, ...more };
    const r = await handleCoder(new Request("https://gofarther.dev/api/coder/projects/" + id + "/message", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) }), env, {}, deps);
    assert.equal(r.status, 200, await r.clone().text());
    return id;
  };
  const turnOf = () => machine.calls.find((c) => c.path === "/turn");
  // The chat's turn ends: what the page's next look saves. Answers the notes it added to the chat.
  const end = async (id, more) => {
    const deps = { fetchFn: async () => new Response("{}", { status: 404 }), authUser: async () => ({ id: UID, email: "me@x.y" }), container: box, ...more };
    const r = await handleCoder(new Request("https://gofarther.dev/api/coder/projects/" + id + "/state?since=0"), env, {}, deps);
    assert.equal(r.status, 200, await r.clone().text());
    const evs = JSON.parse(bucket.m.get("coder/" + UID + "/" + id + "/events.json") || "[]");
    return evs.filter((e) => e.type === "note").map((e) => e.text);
  };
  const key = await E.setupKeyOf({ script, network: null });
  const rec = () => E.readEnvCache(bucket, UID, "default");

  // THE FIRST CHAT: no copy yet. It asks for one; the machine runs the setup on a fresh disk and the job starts AT ONCE
  // (2026-11-15: no wait, no /go). The copy is taken when the turn ends.
  const a = await send(fly);
  assert.deepEqual(turnOf().body.cache, { make: true });
  assert.equal(turnOf().copy, null, "no copy to start from yet");
  assert.deepEqual(snaps, [], "nothing saved while the job starts");
  assert.deepEqual(machine.calls.map((c) => c.path), ["/turn"], "never held, never told to go");
  assert.deepEqual(JSON.parse(bucket.m.get("coder/" + UID + "/" + a + "/meta.json")).copyWant, { envId: "default", key: await E.setupKeyOf({ script, network: null }) });
  machine.copy = true;
  assert.deepEqual(await end(a, fly), [], "no note in the chat (owner, 2026-11-16)");
  machine.copy = false;
  assert.deepEqual(snaps, [UID + "-" + a], "this chat's disk is saved at the turn's end");
  assert.equal(JSON.parse(bucket.m.get("coder/" + UID + "/" + a + "/meta.json")).copyWant, null);
  const r0 = await rec();
  assert.deepEqual({ ...r0, at: 0 }, { ...snapAnswer, key, at: 0, from: a });
  assert.ok(Date.now() - r0.at < 60_000);
  // Not a secret: only Fly's name for the copy and its disk, beside the environment's sealed settings.
  assert.ok(bucket.m.has(E.envCacheKey(UID, "default")));

  // A NEW CHAT A MINUTE LATER (the live test): Fly is still finishing the copy, so this chat runs the setup
  // itself, says why in the chat, and makes no second copy.
  const b0 = await send(fly);
  machine.copy = true; snaps.length = 0;
  assert.deepEqual(await end(b0, fly), [], "no second copy even when the machine says its disk is ready");
  assert.deepEqual(snaps, []);
  machine.copy = false;
  assert.deepEqual(asked, ["vs_Good1234"], "Fly is asked where the copy stands");
  assert.equal(turnOf().copy, null, "not pointed at an unfinished copy (Fly refuses it)");
  assert.deepEqual(turnOf().body.cache, { make: false, note: "Setup: Fly.io is still finishing the environment's saved copy of the setup (asked for 1 minute ago), so this chat runs the setup script itself. New chats start from the copy once it is finished." });
  assert.deepEqual(await rec(), r0, "the copy's record is as it was");
  // A LATER MESSAGE in a chat (its machine made already): Fly is not asked; nothing pointed at.
  await send(fly, { turn: 2 });
  assert.deepEqual(asked, []);
  assert.equal(turnOf().copy, null);
  assert.deepEqual(turnOf().body.cache, { make: true });

  // FINISHED: the next new chat is pointed at it (its disk made from it, at least as big), and it is marked
  // finished, with the days Fly keeps it, so Fly is not asked again.
  state = { status: "created", retention: 8 };
  await send(fly);
  assert.deepEqual(asked, ["vs_Good1234"]);
  assert.equal(turnOf().copy, "vs_Good1234");
  assert.equal(turnOf().gb, "20");
  assert.deepEqual(turnOf().body.cache, { make: true }, "should its disk not come from the copy after all, a fresh setup makes a new one");
  assert.deepEqual(snaps, [], "nothing saved: the machine did not wait");
  assert.deepEqual(machine.calls.map((c) => c.path), ["/turn"]);
  assert.deepEqual(await rec(), { ...r0, ready: true, retention: 8 });
  await send(fly);
  assert.deepEqual(asked, [], "known to be finished");
  assert.equal(turnOf().copy, "vs_Good1234");

  // GONE FROM FLY'S LIST, OR ASKED FOR OVER HALF AN HOUR AGO AND STILL NOT FINISHED: not waited for; this
  // chat makes a new one.
  for (const [st, at, why] of [[{ status: "gone" }, Date.now(), "gone"], [{ status: "running" }, Date.now() - CACHE_PENDING_MS - 1000, "too long"], [null, Date.now() - CACHE_PENDING_MS - 1000, "no answer, too long"]]) {
    await E.writeEnvCache(bucket, UID, "default", { ...r0, at });
    state = st;
    await send(fly);
    assert.equal(turnOf().copy, null, why);
    assert.deepEqual(turnOf().body.cache, { make: true }, why);
  }
  // NO ANSWER FROM FLY about a recent copy: taken as still being finished.
  await E.writeEnvCache(bucket, UID, "default", r0);
  state = null;
  await send(fly);
  assert.equal(turnOf().body.cache.make, false);
  // A COPY RECORDED BEFORE THE FIX (no disk named): never used, never asked about; a new one is made.
  const old = { ...r0, ready: true }; delete old.volume;
  await E.writeEnvCache(bucket, UID, "default", old);
  await send({ ...fly, cacheUsable: (await import("../src/coder-fly.mjs")).cacheUsable.bind(null, { CODER_MACHINES: "fly", FLY_API_TOKEN: "fly-token-0123456789", CODER_FLY_APP: "gofarther-coder-machines", CODER_FLY_IMAGE: "registry.fly.io/app:coder-1" }) });
  assert.deepEqual([turnOf().copy, turnOf().body.cache, asked], [null, { make: true }, []]);

  // THE OWNER CHANGED THE SETUP SCRIPT: the old copy is not used; a new one is made (finished at once: said so).
  await E.writeEnvCache(bucket, UID, "default", { ...r0, ready: true });
  await E.writeEnvData(env, bucket, UID, "default", { script: script + " jq", vars: {}, secrets: [], network: null });
  snapAnswer = { ...snapAnswer, ready: true, retention: 8 };
  const c = await send(fly);
  assert.equal(turnOf().copy, null);
  machine.copy = true;
  await end(c, fly);
  machine.copy = false;
  assert.deepEqual(snaps, [UID + "-" + c]);
  assert.equal((await rec()).key, await E.setupKeyOf({ script: script + " jq", network: null }));
  // The network setting is part of it too (the variables and keys never reach the setup).
  assert.notEqual(await E.setupKeyOf({ script, network: { mode: "full" } }), key);
  assert.equal(await E.setupKeyOf({ script: "  " + script + "\n", network: { mode: "trusted" } }), key, "the same script and setting");

  // FLY.IO DID NOT START SAVING IN TIME: no copy recorded (the next new chat runs the setup and tries again).
  const before = bucket.m.get(E.envCacheKey(UID, "default"));
  snapAnswer = null;
  await E.writeEnvData(env, bucket, UID, "default", { script: script + " jq2", vars: {}, secrets: [], network: null });
  const d0 = await send(fly);
  machine.copy = true;
  await end(d0, fly);
  machine.copy = false;
  assert.equal(bucket.m.get(E.envCacheKey(UID, "default")), before);
  await E.writeEnvData(env, bucket, UID, "default", { script: script + " jq", vars: {}, secrets: [], network: null });

  // ON CLOUDFLARE (no saved copies there), or WITHOUT A SETUP SCRIPT: never asked for, never pointed at.
  await send({});
  assert.deepEqual(turnOf().body.cache, { make: false });
  assert.equal(turnOf().copy, null);
  await E.writeEnvData(env, bucket, UID, "default", { script: "", vars: {}, secrets: [], network: null });
  await send(fly);
  assert.deepEqual(turnOf().body.cache, { make: false });
  assert.equal(turnOf().copy, null);
  // A machine that says it waits all the same (an older machine): never told to go; it goes on by itself.
  machine.held = true;
  await send({});
  assert.deepEqual(machine.calls.map((x) => x.path), ["/turn"]);
  machine.held = false;
});

// ── THE MACHINE ──
const git = (cwd, ...a) => execFileSync("git", a, { cwd, env: { ...process.env, GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "safe.directory", GIT_CONFIG_VALUE_0: "*" } }).toString();
async function fakeRemote(repo = "ana/shop") {
  const root = await mkdtemp(join(tmpdir(), "coder-gh-"));
  const work = await mkdtemp(join(tmpdir(), "coder-seed-"));
  git(work, "init", "-q", "-b", "main");
  await writeFile(join(work, "README.md"), "# shop\n");
  git(work, "-c", "user.name=a", "-c", "user.email=a@b", "add", "-A");
  git(work, "-c", "user.name=a", "-c", "user.email=a@b", "commit", "-q", "-m", "first");
  execFileSync("mkdir", ["-p", join(root, repo.split("/")[0])]);
  execFileSync("git", ["clone", "-q", "--bare", work, join(root, repo + ".git")]);
  return { remote: root + "/" };
}
async function serve(handle) {
  const srv = http.createServer(handle);
  await new Promise((r) => srv.listen(0, r));
  return { base: "http://127.0.0.1:" + srv.address().port, close: () => new Promise((r) => srv.close(r)) };
}
/** A chat's machine with its kept disk (`data`, as on Fly.io), and an AI that answers "Done.". */
async function diskMachine(opts = {}) {
  const S = await import("../container/server.mjs");
  const { remote } = await fakeRemote();
  const data = await mkdtemp(join(tmpdir(), "coder-data-"));
  await chmod(data, 0o755);
  const dirs = { root: join(data, "work"), gitRoot: join(data, "git"), memRoot: join(data, "memory"), home: join(data, "home") };
  for (const d of Object.values(dirs)) await mkdir(d, { recursive: true });
  const seen = [];
  const app = S.createApp({ ...dirs, data, image: "registry.fly.io/app:coder-1", remote, bgRoot: await mkdtemp(join(tmpdir(), "coder-bgr-")), proxyDir: await mkdtemp(join(tmpdir(), "coder-pxm-")), copyNeedsBox: false, send: async (q) => { seen.push(q); return { message: { role: "assistant", content: "Done." }, usage: { in: 1, out: 1 } }; }, ...opts });
  const { base, close } = await serve(app);
  const post = async (p, b, headers = {}) => (await fetch(base + p, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(b) })).json();
  // `copy`: what Coder's Worker tells a new machine of the environment's saved copy (x-coder-copy).
  const turn = (project, extra = {}, copy = "") => post("/turn", { project, text: "go", messages: [], repo: "ana/shop", base: "main", branch: "coder/" + project, token: "", ...extra }, copy ? { "x-coder-copy": copy } : {});
  const state = async (project) => (await fetch(base + "/state?project=" + project + "&since=0")).json();
  const done = async (project) => { let s; for (let i = 0; i < 200; i++) { s = await state(project); if (s.result) break; await wait(50); } await post("/claim", { project }); return s; };
  return { S, data, dirs, seen, post, turn, state, done, close };
}

test("CD153 the machine: after a setup that ran on a fresh disk and worked, the job starts at once (2026-11-15) and the copy's note is written at the turn's end, the disk synced (result.copy); the copy's note stays on the disk (live test #25: Fly saves a disk when it gets to it); never after a failed setup, on a disk a job has worked on, or unasked. A disk made from the copy: the other chat's own files go, the setup does not run again (said in the chat and to Coder); a copy of another setup, or one that says nothing, leaves a fresh disk, and the chat says why, as it does when the copy could not be used at all", async () => {
  const m = await diskMachine({ holdMs: 60_000 });
  const script = "echo setup-ran";
  try {
    // A FRESH DISK, ASKED FOR A COPY (2026-11-15): the setup runs and works; the job starts AT ONCE (no wait for the copy).
    const r = await m.turn("shop-aaa1", { setup: { script }, cache: { make: true } });
    assert.deepEqual(r, { ok: true }, "never held");
    const s = await m.done("shop-aaa1");
    assert.equal(s.result.status, "done");
    assert.equal(m.seen.length, 1, "Coder started without waiting");
    assert.equal(s.result.copy, true, "the turn's end says the disk is ready to be saved");
    // (Its start-up says so, in Claude Code's words: "Saving setup for next time", after the machine, before the clone.)
    const up = s.events.find((e) => e.type === "startup");
    assert.deepEqual(up.steps.map((x) => x.k), ["container", "saving", "clone", "setup"], JSON.stringify(up));
    assert.ok(!s.events.some((e) => e.type === "note"));
    // THE COPY'S NOTE, written at the turn's end, the disk synced: what the Worker then has Fly.io save.
    const note = JSON.parse(await readFile(join(m.data, m.S.COPY_NOTE), "utf8"));
    const { normNetwork } = await import("../container/coder-secrets.mjs");
    const sha = m.S.setupSha(script, normNetwork(undefined));
    assert.deepEqual({ ...note, at: 0 }, { from: "shop-aaa1", sha, image: "registry.fly.io/app:coder-1", at: 0 }, "the copy's own note, on the disk being saved");
    assert.ok(note.at >= s.result.timing.answered, "written once the turn was over");
    // The turn's step times, for the Worker (where a message's seconds go).
    for (const k of ["got", "cloneStart", "cloneEnd", "setupStart", "ready", "began", "firstAsk", "firstAnswer", "answered", "ended"]) assert.ok(Number(s.result.timing[k]) > 0, k);
    assert.ok(s.result.timing.got <= s.result.timing.began && s.result.timing.began <= s.result.timing.firstAsk && s.result.timing.firstAnswer <= s.result.timing.ended);
    assert.equal(existsSync(join(m.data, m.S.USED_NOTE)), true);
    assert.deepEqual(await m.post("/go", { project: "shop-aaa1" }), { ok: true, went: false }, "an older Worker's go changes nothing");
    // A DISK A JOB HAS WORKED ON: never saved as the copy (the setup changed; since 2026-11-14 it does not run again on this
    // machine, as Claude Code's: test/env-tools.test.mjs EN14); its own note stays.
    assert.deepEqual(await m.turn("shop-aaa1", { setup: { script: script + " again" }, cache: { make: true } }), { ok: true });
    await m.done("shop-aaa1");
    assert.equal(JSON.parse(await readFile(join(m.data, m.S.COPY_NOTE), "utf8")).from, "shop-aaa1");
  } finally { await m.close(); }

  // UNASKED, OR A FAILED SETUP: no wait.
  for (const [extra, why] of [[{ setup: { script } }, "unasked"], [{ setup: { script: "echo x; exit 3" }, cache: { make: true } }, "a failed setup"], [{ cache: { make: true } }, "no setup script"]]) {
    const k = await diskMachine({ holdMs: 60_000 });
    try {
      assert.deepEqual(await k.turn("shop-bbb1", extra), { ok: true }, why);
      assert.equal((await k.done("shop-bbb1")).result.status, "done", why);
      assert.equal(existsSync(join(k.data, k.S.COPY_NOTE)), false, why);
    } finally { await k.close(); }
  }
  // A DISK FROM BEFORE THE MARK (a chat that has worked already): its project is on it, so it is not fresh.
  const older = await diskMachine({ holdMs: 60_000 });
  try {
    await mkdir(join(older.dirs.root, "shop-hhh1"), { recursive: true });
    assert.deepEqual(await older.turn("shop-hhh1", { setup: { script }, cache: { make: true } }), { ok: true });
    assert.equal((await older.done("shop-hhh1")).result.status, "done");
    assert.equal(existsSync(join(older.data, older.S.COPY_NOTE)), false);
  } finally { await older.close(); }
  // A DISK MADE FROM THE COPY (a new chat, B): what was A's own goes; the setup does not run again.
  const b = await diskMachine({ holdMs: 60_000 });
  try {
    const { normNetwork } = await import("../container/coder-secrets.mjs");
    const sha = b.S.setupSha(script, normNetwork(undefined));
    const at = Date.now() - 3600e3;
    await writeFile(join(b.data, b.S.COPY_NOTE), JSON.stringify({ from: "shop-aaa1", sha, image: "registry.fly.io/app:coder-1", at }));
    await writeFile(join(b.data, b.S.USED_NOTE), "1");
    for (const p of [join(b.dirs.root, "shop-aaa1"), join(b.dirs.gitRoot, "shop-aaa1.git"), join(b.dirs.memRoot, "shop-aaa1"), join(b.dirs.home, ".cache"), join(b.data, ".coder-admin", "v1", "upper")]) await mkdir(p, { recursive: true });
    await writeFile(join(b.dirs.root, "shop-aaa1", "a.txt"), "A's file\n");
    await writeFile(join(b.dirs.home, ".cache", "pip.txt"), "installed by the setup\n");
    const r = await b.turn("shop-eee1", { setup: { script }, cache: { make: true } }, "used");
    assert.deepEqual(r, { ok: true }, "nothing to save: the setup did not run");
    const s = await b.done("shop-eee1");
    assert.equal(s.result.status, "done");
    assert.ok(!s.events.some((e) => e.tool === "setup"), "the setup did not run");
    // (Said as Claude Code's start-up says it, a step: "Restored saved setup", with when the copy was made; no note. 2026-11-18.)
    assert.ok(!s.events.some((e) => e.type === "note"), "no note in the chat");
    const up = s.events.find((e) => e.type === "startup");
    assert.ok(up && up.steps.some((x) => x.k === "restored" && x.built > 0), JSON.stringify(up));
    assert.ok(up.steps.findIndex((x) => x.k === "restored") < up.steps.findIndex((x) => x.k === "clone"), "before the clone, as Claude Code's");
    assert.ok(!up.steps.some((x) => x.k === "setup" || x.k === "saving"));
    // (In the chat's context, told in the conversation since fix round 4: context-cache.test.mjs.)
    assert.match(JSON.stringify(b.seen[0].messages.filter((m) => m.ctx).map((m) => m.content)), /started from the environment's saved copy of its result[\s\S]*run the project's own install yourself/, "and to Coder");
    // (Beside it, root's link named after its repository, where the setup script starts: E7 of recheck 2, server.mjs repoLinks.)
    assert.deepEqual((await readdir(b.dirs.root)).sort(), ["shop", "shop-eee1"], "A's repository is gone; B's is a fresh clone");
    assert.equal(await readlink(join(b.dirs.root, "shop")), "shop-eee1");
    assert.ok(!(await readdir(b.dirs.gitRoot)).some((n) => n.startsWith("shop-aaa1")), "A's git folder too");
    assert.ok(!(await readdir(b.dirs.memRoot)).includes("shop-aaa1"), "A's memory too");
    assert.equal(await readFile(join(b.dirs.home, ".cache", "pip.txt"), "utf8"), "installed by the setup\n", "what the setup installed stays");
    assert.equal(existsSync(join(b.data, ".coder-admin", "v1", "upper")), true, "the admin sandbox's layer stays");
    assert.equal(existsSync(join(b.data, b.S.COPY_NOTE)), false);
    // The next message does not run the setup either (it runs once on a chat's machine, as Claude Code's).
    await b.turn("shop-eee1", { setup: { script }, cache: { make: true } });
    assert.ok(!(await b.done("shop-eee1")).events.some((e) => e.tool === "setup"));
  } finally { await b.close(); }

  // A COPY OF ANOTHER SETUP (an older script) or ANOTHER CODER VERSION: cleared down to a fresh disk; the setup runs.
  for (const odd of [{ sha: "0".repeat(64) }, { image: "registry.fly.io/app:coder-0" }, { at: Date.now() - 8 * 86400e3 }]) {
    const c = await diskMachine({ holdMs: 60_000 });
    try {
      const { normNetwork } = await import("../container/coder-secrets.mjs");
      await writeFile(join(c.data, c.S.COPY_NOTE), JSON.stringify({ from: "shop-aaa1", sha: c.S.setupSha(script, normNetwork(undefined)), image: "registry.fly.io/app:coder-1", at: Date.now() - 3600e3, ...odd }));
      for (const p of [join(c.dirs.home, ".cache"), join(c.data, ".coder-admin", "v1")]) await mkdir(p, { recursive: true });
      assert.deepEqual(await c.turn("shop-fff1", { setup: { script }, cache: { make: true } }), { ok: true }, JSON.stringify(odd) + ": a fresh disk, whose setup is saved as the new copy");
      const s = await c.done("shop-fff1");
      assert.equal(s.result.copy, true, "saved as the new copy at the turn's end");
      assert.ok(s.events.some((e) => e.tool === "setup"), "the setup ran");
      // (Why, kept with the start-up's record for us; the chat shows Claude Code's steps only: no note. 2026-11-18.)
      assert.ok(!s.events.some((e) => e.type === "note"), "no note in the chat");
      const up = s.events.find((e) => e.type === "startup");
      assert.match(up.copyWhy, /^not usable: (it was made for another setup script or network setting|it was made by an older version of Coder|it is over seven days old)$/);
      assert.ok(up.steps.some((x) => x.k === "saving"), "this chat makes the new copy: \"Saving setup for next time\"");
      // (Only this job's snapshot of the shell's startup file is there: tool 4, docs pass 2.)
      assert.deepEqual(await readdir(c.dirs.home), [".cache"], "the other setup's home is gone");
      assert.deepEqual(await readdir(join(c.dirs.home, ".cache")), ["coder"]);
      // (zsh's where zsh is installed: Bash docs pass 9, the shell Claude Code's cloud machine runs commands in.)
      assert.deepEqual(await readdir(join(c.dirs.home, ".cache", "coder")), [["/usr/bin/zsh", "/bin/zsh", "/usr/local/bin/zsh"].some((z) => existsSync(z)) ? "shell-snapshot.zsh" : "shell-snapshot.sh"]);
      assert.equal(existsSync(join(c.data, ".coder-admin")), false, "and its admin layer");
    } finally { await c.close(); }
  }

  // THIS CHAT'S OWN NOTE: it stays, nothing touched (a copy Fly saves of this disk later still says what it is).
  const own = await diskMachine({ holdMs: 60_000 });
  try {
    await mkdir(join(own.dirs.home, ".cache"), { recursive: true });
    await writeFile(join(own.data, own.S.COPY_NOTE), JSON.stringify({ from: "shop-ggg1", sha: "0".repeat(64), image: "x", at: Date.now() }));
    assert.equal(await own.S.takeCopy({ data: own.data, project: "shop-ggg1", sha: "1".repeat(64), image: "y", dirs: own.dirs }), null);
    assert.equal(existsSync(join(own.dirs.home, ".cache")), true, "nothing cleared");
    assert.equal(existsSync(join(own.data, own.S.COPY_NOTE)), true);
    // ...unless this disk was just made from a copy (a machine of this chat made again): then it is a copy like any other.
    await mkdir(join(own.dirs.root, "shop-ggg1"), { recursive: true });
    assert.deepEqual(await own.S.takeCopy({ data: own.data, project: "shop-ggg1", sha: "1".repeat(64), image: "y", dirs: own.dirs, fromCopy: true }), { why: "it was made for another setup script or network setting" });
    assert.deepEqual([await readdir(own.dirs.root), existsSync(join(own.dirs.home, ".cache")), existsSync(join(own.data, own.S.COPY_NOTE))], [[], false, false]);
    // A DISK JUST MADE FROM A COPY THAT SAYS NOTHING: what it holds is not known, so it is cleared down to a fresh disk.
    await mkdir(join(own.dirs.root, "shop-zzz1"), { recursive: true }); await mkdir(join(own.dirs.home, ".cache"), { recursive: true }); await mkdir(join(own.data, ".coder-admin", "v1"), { recursive: true });
    await writeFile(join(own.data, own.S.USED_NOTE), "1");
    assert.deepEqual(await own.S.takeCopy({ data: own.data, project: "shop-ggg1", sha: "1", image: "y", dirs: own.dirs, fromCopy: true }), { why: "the copy did not say what it is a copy of" });
    assert.deepEqual([await readdir(own.dirs.root), await readdir(own.dirs.home), existsSync(join(own.data, ".coder-admin")), existsSync(join(own.data, own.S.USED_NOTE))], [[], [], false, false]);
    // No note (and not just made from a copy): nothing touched. Folders not on the kept disk are never cleared.
    await mkdir(join(own.dirs.home, ".cache"), { recursive: true });
    assert.equal(await own.S.takeCopy({ data: own.data, project: "shop-ggg1", sha: "1", image: "y", dirs: own.dirs }), null);
    assert.equal(existsSync(join(own.dirs.home, ".cache")), true);
    const outside = await mkdtemp(join(tmpdir(), "coder-outside-"));
    await writeFile(join(outside, "keep.txt"), "x");
    await writeFile(join(own.data, own.S.COPY_NOTE), "{broken");
    await mkdir(join(own.dirs.home, ".cache"), { recursive: true });
    assert.deepEqual(await own.S.takeCopy({ data: own.data, project: "shop-ggg1", sha: "1", image: "y", dirs: { root: outside, gitRoot: join(own.data, "..", "x"), memRoot: own.dirs.memRoot, home: own.dirs.home } }), { why: "its note could not be read" });
    assert.equal(existsSync(join(outside, "keep.txt")), true, "outside the kept disk: untouched");
    assert.equal(existsSync(join(own.dirs.home, ".cache")), false, "a broken note: a fresh disk");
    assert.equal(await own.S.takeCopy({ data: null, project: "shop-ggg1", sha: "1", image: "y", dirs: own.dirs }), null, "no kept disk (Cloudflare): nothing");
  } finally { await own.close(); }
});

test("CD192 why a new chat did not start from the environment's saved copy is kept with its start-up's record, not said in the chat (2026-11-18, the owner: \"match claude code pls\"; live test #25, 2026-11-07: it once fell back to an empty disk unseen): Fly.io would not make the disk (the Worker's word), or Fly is still finishing the copy; only on a fresh disk with a setup script, said once, before the setup runs", async () => {
  // FLY WOULD NOT MAKE THE DISK FROM THE COPY: the Worker made an empty one and says why.
  const a = await diskMachine({ holdMs: 60_000 });
  const script = "echo setup-ran";
  try {
    assert.deepEqual(await a.turn("shop-aaa1", { setup: { script } }, "missed: Fly.io would not make a disk from it (422: snapshot vs_X is not ready)"), { ok: true });
    const s = await a.done("shop-aaa1");
    assert.ok(!s.events.some((e) => e.type === "note"), "no note in the chat (2026-11-18: Claude Code's start-up shows only its steps)");
    const up = s.events.find((e) => e.type === "startup");
    assert.equal(up.copyWhy, "missed: Fly.io would not make a disk from it (422: snapshot vs_X is not ready)", "kept with the start-up's record");
    assert.ok(s.events.some((e) => e.tool === "setup"), "the setup ran");
    assert.ok(!up.steps.some((x) => x.k === "restored"));
  } finally { await a.close(); }
  // FLY IS STILL FINISHING THE COPY: the Worker's note, on this chat's fresh disk.
  const b = await diskMachine({ holdMs: 60_000 });
  try {
    const note = "Setup: Fly.io is still finishing the environment's saved copy of the setup (asked for 1 minute ago), so this chat runs the setup script itself.";
    assert.deepEqual(await b.turn("shop-bbb1", { setup: { script }, cache: { make: false, note } }), { ok: true }, "no copy made: one is being finished");
    const s = await b.done("shop-bbb1");
    assert.ok(!s.events.some((e) => e.type === "note"), "no note in the chat");
    const up = s.events.find((e) => e.type === "startup");
    assert.equal(up.copyWhy, "still finishing: " + note);
    assert.ok(!up.steps.some((x) => x.k === "saving" || x.k === "restored"), "no copy made here: one is being finished");
    // Its next message (the disk has had a job): nothing kept.
    await b.turn("shop-bbb1", { setup: { script }, cache: { make: false, note } });
    const s2 = await b.done("shop-bbb1");
    assert.ok(!s2.events.some((e) => e.type === "note"));
    assert.ok(!s2.events.some((e) => e.type === "startup" && e.copyWhy));
  } finally { await b.close(); }
  // NO SETUP SCRIPT: nothing to say about its copy.
  const c = await diskMachine({ holdMs: 60_000 });
  try {
    await c.turn("shop-ccc1", { cache: { make: false, note: "Setup: x" } }, "missed: y");
    const s = await c.done("shop-ccc1");
    assert.ok(!s.events.some((e) => e.type === "note"));
    assert.ok(!s.events.some((e) => e.type === "startup" && e.copyWhy));
  } finally { await c.close(); }
  // The Worker's word only: the AI's commands cannot reach the machine's control panel (it needs the machine's key).
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.ok(src.indexOf('if (want && req.headers["x-coder-key"] !== want) return send(403') < src.indexOf('const told = String(req.headers["x-coder-copy"] || "") || warmCopy.get(p0)'), "the key is checked first");
  assert.ok(src.indexOf('if (want && req.headers["x-coder-key"] !== want) return send(403') < src.indexOf('if (url.pathname === "/warm" && req.method === "POST")'), "for an early start's word too");
  // A MACHINE STARTED EARLY (/warm, 2026-11-15): what became of the copy is told then, and its first turn says it.
  const w = await diskMachine({ holdMs: 60_000 });
  try {
    assert.deepEqual(await w.post("/warm", { project: "shop-www1" }, { "x-coder-copy": "missed: Fly.io would not make a disk from it" }), { ok: true, warm: true });
    assert.deepEqual(await w.post("/warm", { project: "../x" }), { error: "bad project" });
    await w.turn("shop-www1", { setup: { script } });
    const s = await w.done("shop-www1");
    assert.ok(!s.events.some((e) => e.type === "note"));
    assert.equal(s.events.find((e) => e.type === "startup").copyWhy, "missed: Fly.io would not make a disk from it");
  } finally { await w.close(); }
});

test("CD192b a finished copy offered too late for a chat's machine (live, 2026-11-18: every new chat's machine was started when the repository was picked, before the copy was known to be finished; each then ran the setup and saved a new, unfinished copy over the finished one, so no chat ever started from it): told \"late\", the setup runs, why is kept with the start-up's record, and no second copy is made", async () => {
  const m = await diskMachine({ holdMs: 60_000 });
  const script = "echo setup-ran";
  try {
    assert.deepEqual(await m.turn("shop-lat1", { setup: { script }, cache: { make: true } }, "late"), { ok: true });
    const s = await m.done("shop-lat1");
    assert.equal(s.result.status, "done");
    // (Not said in the chat since 2026-11-18, as Claude Code's start-up: kept with the start-up's record.)
    assert.ok(!s.events.some((e) => e.type === "note"));
    const up = s.events.find((e) => e.type === "startup");
    assert.equal(up.copyWhy, "late: this chat's machine was already started without it");
    assert.ok(!up.steps.some((x) => x.k === "saving"), "it makes no copy");
    assert.ok(s.events.some((e) => e.tool === "setup"), "the setup ran");
    assert.equal(s.result.copy, undefined, "no second copy over the finished one");
    assert.equal(existsSync(join(m.data, m.S.COPY_NOTE)), false);
    // Its next message: not said again.
    await m.turn("shop-lat1", { setup: { script }, cache: { make: true } }, "late");
    assert.ok(!(await m.done("shop-lat1")).events.some((e) => e.type === "note"));
  } finally { await m.close(); }
  // Without the word (the same fresh disk otherwise): its copy is made, as before.
  const c = await diskMachine({ holdMs: 60_000 });
  try {
    await c.turn("shop-lat2", { setup: { script }, cache: { make: true } });
    assert.equal((await c.done("shop-lat2")).result.copy, true);
  } finally { await c.close(); }
  // NO SETUP SCRIPT: nothing to say.
  const d = await diskMachine({ holdMs: 60_000 });
  try {
    await d.turn("shop-lat3", { cache: { make: true } }, "late");
    assert.ok(!(await d.done("shop-lat3")).events.some((e) => e.type === "note"));
  } finally { await d.close(); }
});

test("CD152b a new chat's machine started early (/warm) asks Fly.io about a copy not yet known to be finished, as the first message does (live, 2026-11-18: the early start came first, so no new chat ever started from the copy): finished, it is kept as finished and the machine is made from it; still being finished, or no answer, the machine is made without it; a copy known to be finished, or not usable, is not asked about", async () => {
  const { handleCoder } = await import("../src/coder-routes.mjs");
  const { saveConnection } = await import("../src/coder-github.mjs");
  const E = await import("../src/coder-environments.mjs");
  const { FROM_COPY, FROM_COPY_GB } = await import("../src/coder-fly.mjs");
  const bucket = fakeBucket(); const env = ENV(bucket);
  await saveConnection(env, bucket, UID, { access: "ghu_user" }, "ana");
  const script = "apt-get install -y figlet";
  await E.writeEnvData(env, bucket, UID, "default", { script, vars: {}, secrets: [], network: null });
  const key = await E.setupKeyOf({ script, network: null });
  const calls = [], asked = [];
  let state = { status: "running" };
  const box = () => ({ fetch: async (req) => { calls.push({ path: new URL(req.url).pathname, copy: req.headers.get(FROM_COPY), gb: req.headers.get(FROM_COPY_GB) }); return Response.json({ ok: true, warm: true }); } });
  const deps = { fetchFn: async () => new Response("{}", { status: 404 }), authUser: async () => ({ id: UID, email: "me@x.y" }), container: box, snapshot: async () => null, cacheUsable: (c, k) => !!c && c.key === k && c.snapshot === "vs_Good1234", copyState: async (c) => { asked.push(c.snapshot); return state; } };
  let n = 0;
  const warm = async () => {
    const id = "shop-w" + ++n;
    await bucket.put("coder/" + UID + "/" + id + "/meta.json", JSON.stringify({ id, repo: "ana/shop", base: "main", branch: "coder/" + id, turn: 0, saved: 0, status: "idle", at: Date.now() }));
    calls.length = 0; asked.length = 0;
    const r = await handleCoder(new Request("https://gofarther.dev/api/coder/projects/" + id + "/warm", { method: "POST" }), env, {}, deps);
    assert.deepEqual(await r.json(), { ok: true, warm: true });
    assert.equal(calls.length, 1);
    return calls[0];
  };
  const r0 = { snapshot: "vs_Good1234", volume: "vol_A1", size: 30, region: "iad", image: "registry.fly.io/app:coder-1", retention: 0, ready: false, key, at: Date.now() - 60_000, from: "shop-c1" };
  const without = { path: "/warm", copy: null, gb: null }, from = { path: "/warm", copy: "vs_Good1234", gb: "30" };
  // STILL BEING FINISHED: asked; the machine is made without it; the record as it was.
  await E.writeEnvCache(bucket, UID, "default", r0);
  assert.deepEqual([await warm(), asked], [without, ["vs_Good1234"]]);
  assert.equal((await E.readEnvCache(bucket, UID, "default")).ready, false);
  // NO ANSWER FROM FLY: the same.
  state = null;
  assert.deepEqual([await warm(), asked], [without, ["vs_Good1234"]]);
  // FINISHED (Fly: created): kept as finished, with Fly's days, and the machine is made from it.
  state = { status: "created", retention: 8 };
  assert.deepEqual([await warm(), asked], [from, ["vs_Good1234"]]);
  const now = await E.readEnvCache(bucket, UID, "default");
  assert.deepEqual([now.ready, now.retention, now.snapshot], [true, 8, "vs_Good1234"]);
  // KNOWN TO BE FINISHED: not asked again.
  assert.deepEqual([await warm(), asked], [from, []]);
  // NOT USABLE (made for another setup): not asked, not used.
  await E.writeEnvCache(bucket, UID, "default", { ...r0, key: "f".repeat(64) });
  assert.deepEqual([await warm(), asked], [without, []]);
});

test("CD153b a setup that took longer than about five minutes is not saved as the environment's copy, as Claude Code's (the owner, 2026-11-18: \"match pls\"; its docs: \"When setup takes longer than that, the environment isn't cached\"): the job runs as usual, and the next new chat runs the setup itself; one within the limit is saved", async () => {
  const S = await import("../container/server.mjs");
  assert.equal(S.COPY_SETUP_MAX_MS, 5 * 60 * 1000, "about five minutes");
  // (The limit made small here: a setup taking ~0.4 s is "too long" against 100 ms.)
  const slow = await diskMachine({ holdMs: 60_000, copySetupMaxMs: 100 });
  try {
    assert.deepEqual(await slow.turn("shop-slo1", { setup: { script: "sleep 0.4; echo setup-ran" }, cache: { make: true } }), { ok: true });
    const s = await slow.done("shop-slo1");
    assert.equal(s.result.status, "done");
    assert.ok(s.events.some((e) => e.tool === "setup"), "the setup ran");
    assert.equal(s.result.copy, undefined, "not saved");
    assert.equal(existsSync(join(slow.data, S.COPY_NOTE)), false);
  } finally { await slow.close(); }
  // Within the limit: saved, as before.
  const quick = await diskMachine({ holdMs: 60_000, copySetupMaxMs: 60_000 });
  try {
    await quick.turn("shop-qck1", { setup: { script: "echo setup-ran" }, cache: { make: true } });
    assert.equal((await quick.done("shop-qck1")).result.copy, true);
  } finally { await quick.close(); }
  // The rule in the machine's own words.
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("../container/server.mjs", import.meta.url), "utf8");
  assert.ok(src.includes('copyInfo !== "late" && setupTook >= 0 && setupTook <= copySetupMaxMs);'));
  // Said where the script is written, as Claude Code's docs say it ("keep the script's total runtime under roughly five
  // minutes so the environment cache can build").
  const page = readFileSync(new URL("../public/coder.js", import.meta.url), "utf8");
  assert.ok(page.includes("Keep it under about 5 minutes. Then Coder saves a copy of what it set up, and new chats start from that copy without running it again. A script still running at 5 minutes is stopped, and no copy is saved."));
});
