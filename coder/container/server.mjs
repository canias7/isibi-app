// CODER'S CONTAINER SERVICE (2026-11-05). Its own image and its own container
// class (`CoderContainer`), apart from the website builder's. It holds the
// projects being worked on under /work/<project>, runs Coder's turns (the AI
// call and the commands, here, beside the files), and hands the files back to
// the Worker, which keeps them in storage.
//
//   GET  /health
//   POST /turn    { project, text, messages, repo, base, branch, token }
//                 start a turn (409 while one runs); the repository is cloned
//                 first when this machine does not have it yet
//   GET  /state?project=&since=  the turn's events from `since`, and its ending once ended
//   POST /stop    { project }                          stop the turn at the next step
//   POST /push    { project, branch, token, message }  commit everything and push the branch
//
// THE GITHUB TOKEN NEVER REACHES THE AI'S COMMANDS (2026-11-05). Git runs here
// as root with the token in its own environment (which another user cannot
// read); every command the AI runs is started as the unprivileged `dev` user
// (CODER_RUN_UID), with a bare environment. The token is never written into
// the repository's settings.
import http from "node:http";
import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, writeFile, stat, chown } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { join, dirname, relative, resolve } from "node:path";
import { runCoder } from "./coder-agent.mjs";
import { coderSend, coderModel, pickModel } from "./coder-model.mjs";
import { cleanEnv, PROJECT_ID, PROJECT_ROOT } from "./coder-checks.mjs";

const RAW_OUTPUT_MAX = 1024 * 1024;
// The user the AI's commands run as (the image makes `dev`, 1001); unset in tests.
const RUN_UID = process.env.CODER_RUN_UID ? Number(process.env.CODER_RUN_UID) : undefined;
const RUN_GID = process.env.CODER_RUN_GID ? Number(process.env.CODER_RUN_GID) : undefined;
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", ".cache", "coverage", "__pycache__", ".venv", "venv"]);
export const EXPORT_FILE_MAX = 2 * 1024 * 1024;
export const EXPORT_TOTAL_MAX = 25 * 1024 * 1024;

// LONG COMMANDS GO TO THE BACKGROUND (owner, 2026-11-05: Claude Code's
// "background tasks"): a command still running at its time limit is not
// stopped; it keeps running, its further output goes to a log file, and the AI
// is told where, so it can read it with tail later.
export const BG_DIR = "/tmp/coder-bg";
let bgCount = 0;

/** One command in `dir`, with a bare environment and a time limit. At the limit it moves to the background (or, with `kill`, its process group is stopped). */
export function execIn(dir, command, timeoutS = 120, { uid = RUN_UID, gid = RUN_GID, kill = false, bgDir = BG_DIR } = {}) {
  return new Promise((done) => {
    let out = "", cut = false, timedOut = false;
    const p = spawn("bash", ["-lc", command], { cwd: dir, env: cleanEnv(dir), detached: true, stdio: ["ignore", "pipe", "pipe"], ...(Number.isInteger(uid) ? { uid, gid: Number.isInteger(gid) ? gid : uid } : {}) });
    const take = (b) => { if (out.length < RAW_OUTPUT_MAX) out += b.toString("utf8"); else cut = true; };
    p.stdout.on("data", take); p.stderr.on("data", take);
    let answered = false;
    const answer = (r) => { if (!answered) { answered = true; done(r); } };
    const t = setTimeout(async () => {
      timedOut = true;
      if (kill) { try { process.kill(-p.pid, "SIGKILL"); } catch { /* already gone */ } return; }
      // Into the background: the rest of its output goes to a log the AI can read.
      const log = join(bgDir, "bg-" + (++bgCount) + ".log");
      try {
        await mkdir(bgDir, { recursive: true });
        const w = createWriteStream(log, { mode: 0o644 });
        w.write(out);
        p.stdout.removeAllListeners("data"); p.stderr.removeAllListeners("data");
        p.stdout.pipe(w, { end: false }); p.stderr.pipe(w, { end: false });
        p.on("close", (code) => { w.end("\n[finished, exit code " + code + "]\n"); });
        p.unref();
      } catch { /* the log could not be made: the note still says it runs */ }
      answer({ code: -1, background: true, timedOut: true, output: out.slice(-4000) + "\n[still running in the background after " + timeoutS + "s. Its output goes on in " + log + " (read it with: tail -n 50 " + log + "; it ends with \"[finished, exit code N]\" when done)]" });
    }, Math.max(1, timeoutS) * 1000);
    p.on("error", (e) => { clearTimeout(t); answer({ code: -1, output: "could not start the command: " + e.message, timedOut: false }); });
    p.on("close", (code) => { clearTimeout(t); answer({ code: typeof code === "number" ? code : -1, output: out + (cut ? "\n[output cut at 1 MB]" : ""), timedOut }); });
  });
}

/** The project's files as `{ path: base64 }`, leaving out dependencies and build output; `truncated` when a limit was met. */
export async function exportFiles(dir) {
  const files = {};
  let total = 0, truncated = false;
  async function walk(d) {
    let list = [];
    try { list = await readdir(d, { withFileTypes: true }); } catch { return; }
    for (const e of list) {
      const p = join(d, e.name);
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) await walk(p); continue; }
      if (!e.isFile()) continue;
      let s; try { s = await stat(p); } catch { continue; }
      if (s.size > EXPORT_FILE_MAX || total + s.size > EXPORT_TOTAL_MAX) { truncated = true; continue; }
      total += s.size;
      files[relative(dir, p)] = (await readFile(p)).toString("base64");
    }
  }
  await walk(dir);
  return { files, truncated, bytes: total };
}

/** Write `{ path: base64 }` into `dir`; a path that would leave `dir` is skipped. */
export async function restoreFiles(dir, files) {
  let n = 0;
  for (const [rel, b64] of Object.entries(files || {})) {
    const target = resolve(dir, rel);
    if (!target.startsWith(resolve(dir) + "/") || typeof b64 !== "string") continue;
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(b64, "base64"));
    n++;
  }
  return n;
}

// ── GIT, WITH THE USER'S TOKEN, BY OUR CODE ONLY ─────────────────────────────
export const DEFAULT_REMOTE = "https://github.com/";

/** One git command as this process's user, the token only in its own environment. `{ code, output }`. */
export function gitIn(dir, args, { token = "", timeoutS = 180 } = {}) {
  const env = { PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", HOME: "/root", GIT_TERMINAL_PROMPT: "0", LANG: "C.UTF-8",
    GIT_CONFIG_COUNT: token ? "2" : "1", GIT_CONFIG_KEY_0: "safe.directory", GIT_CONFIG_VALUE_0: "*",
    ...(token ? { GIT_CONFIG_KEY_1: "http.extraHeader", GIT_CONFIG_VALUE_1: "Authorization: Basic " + Buffer.from("x-access-token:" + token).toString("base64") } : {}) };
  return new Promise((done) => {
    let out = "";
    const p = spawn("git", args, { cwd: dir, env, stdio: ["ignore", "pipe", "pipe"] });
    p.stdout.on("data", (b) => { out += b; }); p.stderr.on("data", (b) => { out += b; });
    const t = setTimeout(() => { try { p.kill("SIGKILL"); } catch { /* gone */ } }, timeoutS * 1000);
    p.on("error", (e) => { clearTimeout(t); done({ code: -1, output: e.message }); });
    p.on("close", (code) => { clearTimeout(t); done({ code: typeof code === "number" ? code : -1, output: (token ? out.split(token).join("[hidden]") : out).slice(0, 4000) }); });
  });
}

/**
 * THE REPOSITORY, READY TO WORK ON: cloned when this machine does not have it,
 * then on Coder's branch (the remote one when it exists, else a new one from
 * `base`), handed to the `dev` user. `{ ok, why? }`.
 */
export async function prepareRepo({ dir, repo, base, branch, token, remote = DEFAULT_REMOTE }) {
  const url = remote + repo + ".git";
  const has = await stat(join(dir, ".git")).then(() => true, () => false);
  if (!has) {
    await mkdir(dir, { recursive: true });
    const c = await gitIn(dir, ["clone", "--depth", "50", "--branch", base, url, "."], { token });
    if (c.code !== 0) return { ok: false, why: "could not clone " + repo + ": " + c.output.slice(0, 300) };
    await gitIn(dir, ["config", "user.name", "Coder (Go Farther)"]);
    await gitIn(dir, ["config", "user.email", "coder@gofarther.dev"]);
  }
  const remoteHas = await gitIn(dir, ["ls-remote", "--heads", "origin", branch], { token });
  if (remoteHas.code === 0 && remoteHas.output.trim()) {
    await gitIn(dir, ["fetch", "--depth", "50", "origin", branch + ":refs/remotes/origin/" + branch], { token });
    const co = await gitIn(dir, ["checkout", "-B", branch, "origin/" + branch]);
    if (co.code !== 0) return { ok: false, why: "could not open the branch " + branch };
  } else {
    const cur = await gitIn(dir, ["rev-parse", "--abbrev-ref", "HEAD"]);
    if (cur.output.trim() !== branch) await gitIn(dir, ["checkout", "-B", branch]);
  }
  if (Number.isInteger(RUN_UID)) await new Promise((r) => spawn("chown", ["-R", RUN_UID + ":" + (RUN_GID ?? RUN_UID), dir]).on("close", r));
  return { ok: true };
}

/** Everything Coder changed, committed and pushed to its branch. `{ ok, pushed, sha?, why? }`. */
export async function pushRepo({ dir, branch, token, message }) {
  await gitIn(dir, ["add", "-A"]);
  const st = await gitIn(dir, ["status", "--porcelain"]);
  if (st.output.trim()) {
    const c = await gitIn(dir, ["commit", "-m", String(message || "Changes by Coder").slice(0, 300)]);
    if (c.code !== 0) return { ok: false, pushed: false, why: "could not commit: " + c.output.slice(0, 200) };
  }
  const p = await gitIn(dir, ["push", "origin", "HEAD:refs/heads/" + branch], { token });
  if (p.code !== 0) return { ok: false, pushed: false, why: "could not push: " + p.output.slice(0, 300) };
  const sha = (await gitIn(dir, ["rev-parse", "HEAD"])).output.trim();
  return { ok: true, pushed: !/Everything up-to-date/.test(p.output), sha };
}

// ── THE REPO'S RULES AND THE MEMORY ──────────────────────────────────────────
export const NOTES_MAX = 20000;
export const MEMORY_MAX = 25000;
const NOTE_FILES = ["CODER.md", "CLAUDE.md", "AGENTS.md"];
/** The repo's own instruction files, as `[{ name, text }]` (at most NOTES_MAX characters in all). */
export async function repoNotes(dir) {
  const out = [];
  let left = NOTES_MAX;
  for (const name of NOTE_FILES) {
    if (left <= 0) break;
    let text = "";
    try { text = await readFile(join(dir, name), "utf8"); } catch { continue; }
    text = text.slice(0, left);
    left -= text.length;
    out.push({ name, text });
  }
  return out;
}
/** What the AI is told about the repo's rules and its memory, beside its own instructions. */
export function contextText(notes, memFile, memory) {
  const parts = [];
  for (const n of notes) parts.push("THE REPO'S OWN INSTRUCTIONS (" + n.name + "). Follow them:\n" + n.text);
  parts.push("YOUR MEMORY FOR THIS REPO, kept between chats, in " + memFile + (memory.trim() ? ":\n" + memory : " (empty so far).") +
    "\nWhen you learn something lasting about this repo or the owner's preferences (how to run the tests, a convention, a correction they gave you), add one short line to that file with bash. Keep it under 200 lines; never put secrets in it.");
  return parts.join("\n\n");
}

// ── THE TURNS ────────────────────────────────────────────────────────────────
const turns = new Map(); // project → { running, stop, events, result }

export function createApp({ root = PROJECT_ROOT, env = process.env, send = null, remote = DEFAULT_REMOTE } = {}) {
  const sendFn = send || coderSend(env);
  async function startTurn(body) {
    const project = String(body.project || "");
    if (!PROJECT_ID.test(project)) return [400, { error: "bad project" }];
    const cur = turns.get(project);
    if (cur && cur.running) return [409, { error: "busy" }];
    const dir = join(root, project);
    // THE USER'S REPOSITORY (GitHub): cloned when this machine does not have it, on Coder's branch.
    if (body.repo) {
      const prep = await prepareRepo({ dir, repo: String(body.repo), base: String(body.base || "main"), branch: String(body.branch || "coder/" + project), token: String(body.token || ""), remote });
      if (!prep.ok) return [502, { error: prep.why }];
    } else {
      await mkdir(dir, { recursive: true });
      if (body.files && typeof body.files === "object" && (await readdir(dir)).length === 0) await restoreFiles(dir, body.files);
    }
    // THE REPO'S OWN RULES (CODER.md, CLAUDE.md, AGENTS.md) and THE MEMORY FOR
    // THIS REPO (kept between chats by the Worker), told to the AI each turn.
    const notes = await repoNotes(dir);
    const memDir = join(root, ".memory", project);
    const memFile = join(memDir, "MEMORY.md");
    await mkdir(memDir, { recursive: true });
    await writeFile(memFile, typeof body.memory === "string" ? body.memory.slice(0, MEMORY_MAX) : "");
    if (Number.isInteger(RUN_UID)) { try { await chown(memDir, RUN_UID, RUN_GID ?? RUN_UID); await chown(memFile, RUN_UID, RUN_GID ?? RUN_UID); } catch { /* tests */ } }
    const context = contextText(notes, memFile, typeof body.memory === "string" ? body.memory : "");
    const t = { running: true, stop: false, events: [], result: null };
    turns.set(project, t);
    runCoder({
      send: sendFn,
      exec: ({ command, timeoutS }) => execIn(dir, command, timeoutS),
      stopped: () => t.stop,
      emit: (e) => { t.events.push(e); },
    }, { messages: Array.isArray(body.messages) ? body.messages : [], text: String(body.text || ""), context, ...(body.model ? pickModel(body.model, body.effort) : { model: coderModel(env) }) })
      .then(async (r) => { let memory = null; try { memory = (await readFile(memFile, "utf8")).slice(0, MEMORY_MAX); } catch { /* none */ } t.result = { ...r, memory }; }, (e) => { t.result = { status: "error", messages: [], summary: String((e && e.message) || e).slice(0, 200) }; })
      .finally(() => { t.running = false; });
    return [200, { ok: true }];
  }
  return async function handle(req, res) {
    const url = new URL(req.url, "http://coder");
    const send = (status, obj) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
    try {
      let body = {};
      if (req.method === "POST") { let s = ""; for await (const c of req) s += c; body = s ? JSON.parse(s) : {}; }
      if (url.pathname === "/health") return send(200, { ok: true });
      if (url.pathname === "/turn" && req.method === "POST") { const [st, o] = await startTurn(body); return send(st, o); }
      const project = String(body.project || url.searchParams.get("project") || "");
      if (!PROJECT_ID.test(project)) return send(400, { error: "bad project" });
      const t = turns.get(project);
      if (url.pathname === "/state") {
        if (!t) return send(200, { status: "idle", events: [], running: false });
        const since = Math.max(0, Number(url.searchParams.get("since")) || 0);
        return send(200, { running: t.running, events: t.events.slice(since), next: t.events.length, ...(t.result ? { result: t.result } : {}) });
      }
      if (url.pathname === "/stop" && req.method === "POST") { if (t) t.stop = true; return send(200, { ok: true }); }
      if (url.pathname === "/push" && req.method === "POST") {
        if (t && t.running) return send(409, { error: "busy" });
        return send(200, await pushRepo({ dir: join(root, project), branch: String(body.branch || "coder/" + project), token: String(body.token || ""), message: String(body.message || "") }));
      }
      if (url.pathname === "/export" && req.method === "POST") return send(200, await exportFiles(join(root, project)));
      return send(404, { error: "not found" });
    } catch (e) { return send(500, { error: String((e && e.message) || e).slice(0, 200) }); }
  };
}

if (import.meta.url === "file://" + process.argv[1]) {
  http.createServer(createApp()).listen(8080, () => console.log("coder: listening on 8080"));
}
