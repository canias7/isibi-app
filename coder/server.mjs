// CODER'S CONTAINER SERVICE (2026-11-05). Its own image and its own container
// class (`CoderContainer`), apart from the website builder's. It holds the
// projects being worked on under /work/<project>, runs Coder's turns (the AI
// call and the commands, here, beside the files), and hands the files back to
// the Worker, which keeps them in storage.
//
//   GET  /health
//   POST /turn    { project, text, messages, files? }  start a turn (409 while one runs)
//   GET  /state?project=&since=  the turn's events from `since`, and its ending once ended
//   POST /stop    { project }                          stop the turn at the next step
//   POST /export  { project }                          the project's files, `{ path: base64 }`
import http from "node:http";
import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, dirname, relative, resolve } from "node:path";
import { runCoder } from "./coder-agent.mjs";
import { coderSend, coderModel } from "./coder-model.mjs";
import { cleanEnv, PROJECT_ID, PROJECT_ROOT } from "./coder-checks.mjs";

const RAW_OUTPUT_MAX = 1024 * 1024;
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", ".cache", "coverage", "__pycache__", ".venv", "venv"]);
export const EXPORT_FILE_MAX = 2 * 1024 * 1024;
export const EXPORT_TOTAL_MAX = 25 * 1024 * 1024;

/** One command in `dir`, with a bare environment and a time limit; its whole process group is stopped at the limit. */
export function execIn(dir, command, timeoutS = 120) {
  return new Promise((done) => {
    let out = "", cut = false, timedOut = false;
    const p = spawn("bash", ["-lc", command], { cwd: dir, env: cleanEnv(dir), detached: true, stdio: ["ignore", "pipe", "pipe"] });
    const take = (b) => { if (out.length < RAW_OUTPUT_MAX) out += b.toString("utf8"); else cut = true; };
    p.stdout.on("data", take); p.stderr.on("data", take);
    const t = setTimeout(() => { timedOut = true; try { process.kill(-p.pid, "SIGKILL"); } catch { /* already gone */ } }, Math.max(1, timeoutS) * 1000);
    p.on("error", (e) => { clearTimeout(t); done({ code: -1, output: "could not start the command: " + e.message, timedOut: false }); });
    p.on("close", (code) => { clearTimeout(t); done({ code: typeof code === "number" ? code : -1, output: out + (cut ? "\n[output cut at 1 MB]" : ""), timedOut }); });
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

// ── THE TURNS ────────────────────────────────────────────────────────────────
const turns = new Map(); // project → { running, stop, events, result }

export function createApp({ root = PROJECT_ROOT, env = process.env, send = null } = {}) {
  const sendFn = send || coderSend(env);
  async function startTurn(body) {
    const project = String(body.project || "");
    if (!PROJECT_ID.test(project)) return [400, { error: "bad project" }];
    const cur = turns.get(project);
    if (cur && cur.running) return [409, { error: "busy" }];
    const dir = join(root, project);
    await mkdir(dir, { recursive: true });
    if (body.files && typeof body.files === "object" && (await readdir(dir)).length === 0) await restoreFiles(dir, body.files);
    const t = { running: true, stop: false, events: [], result: null };
    turns.set(project, t);
    runCoder({
      send: sendFn,
      exec: ({ command, timeoutS }) => execIn(dir, command, timeoutS),
      stopped: () => t.stop,
      emit: (e) => { t.events.push(e); },
    }, { messages: Array.isArray(body.messages) ? body.messages : [], text: String(body.text || ""), model: coderModel(env) })
      .then((r) => { t.result = r; }, (e) => { t.result = { status: "error", messages: [], summary: String((e && e.message) || e).slice(0, 200) }; })
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
      if (url.pathname === "/export" && req.method === "POST") return send(200, await exportFiles(join(root, project)));
      return send(404, { error: "not found" });
    } catch (e) { return send(500, { error: String((e && e.message) || e).slice(0, 200) }); }
  };
}

if (import.meta.url === "file://" + process.argv[1]) {
  http.createServer(createApp()).listen(8080, () => console.log("coder: listening on 8080"));
}
