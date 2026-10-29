// THE SITE AGENT'S COMMAND LINE (2026-10-29, the owner: "can we try it with
// commands?"). The Claude Code way: the agent types a shell command and reads
// what it printed, instead of only pressing the tools we built.
//
// Runs in the site's build container, in a WORK FOLDER of its own per agent
// run (never the build's `/app`, which a build may be using): a copy of the
// template's source with the site's files written in, the template's
// installed packages linked read-only. Each command:
//   - runs as the unprivileged user the render check uses (`renderAs`), so it
//     cannot write the image, the packages or anything of root's;
//   - gets a clean environment: PATH, HOME (the work folder), LANG, CI. No key,
//     token or secret of ours is in it (build-keys.mjs keeps them out of this
//     process's environment too, and a child of another user cannot read the
//     job runner's memory);
//   - has NO INTERNET (2026-10-29, the owner: "fix this"): it runs in a network
//     of its own with nothing in it (`unshare --net`, inside a user namespace
//     so no privilege is needed). A container that cannot do that runs no
//     command at all — never one with the internet (`netCut`);
//   - is stopped at its time limit, with its whole process group;
//   - has its output cut at `MAX_OUTPUT` characters.
// After each command the site's files are read back, so an edit a command
// made (`sed -i`, a script) reaches the agent's workspace.
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

export const RUN_TIMEOUT_MS = 90_000;
export const MAX_OUTPUT = 30_000;
export const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const SESSION = /^[a-f0-9]{16,64}$/;
const PAGE = /^[a-z0-9_$][a-z0-9._$/-]*\.tsx$/i;
const PART = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

/** The work folder for one agent run, or null for an id that is not one. */
export function sessionDir(root, id) {
  return SESSION.test(String(id || "")) ? path.join(root, String(id)) : null;
}

/**
 * Make the work folder once: the template's files copied (its `src` included,
 * so the kit's components are there to read), its packages linked, the routes
 * folder reset to the template's own base files. `owner` ({ uid, gid }) is the
 * user commands run as; the folder is handed to it.
 */
export function prepareSandbox(dir, { app, routesBase, owner = null }) {
  if (fs.existsSync(path.join(dir, ".ready"))) return false;
  fs.mkdirSync(dir, { recursive: true });
  for (const name of fs.readdirSync(app)) {
    if (["node_modules", "dist", ".git", ".routes-base"].includes(name)) continue;
    fs.cpSync(path.join(app, name), path.join(dir, name), { recursive: true, dereference: false });
  }
  const nm = path.join(app, "node_modules");
  if (fs.existsSync(nm) && !fs.existsSync(path.join(dir, "node_modules"))) fs.symlinkSync(nm, path.join(dir, "node_modules"), "dir");
  resetSiteFiles(dir, routesBase);
  if (owner) chownTree(dir, owner);
  fs.writeFileSync(path.join(dir, ".ready"), String(Date.now()));
  return true;
}

function chownTree(dir, { uid, gid }) {
  const walk = (p) => {
    let st;
    try { st = fs.lstatSync(p); } catch { return; }
    try { fs.lchownSync(p, uid, gid); } catch { /* best effort */ }
    if (st.isDirectory() && !st.isSymbolicLink()) for (const n of fs.readdirSync(p)) walk(path.join(p, n));
  };
  walk(dir);
}

function resetSiteFiles(dir, routesBase) {
  const routes = path.join(dir, "src", "routes");
  fs.rmSync(routes, { recursive: true, force: true });
  fs.mkdirSync(path.join(routes, "-parts"), { recursive: true });
  if (routesBase && fs.existsSync(routesBase)) for (const n of fs.readdirSync(routesBase)) fs.copyFileSync(path.join(routesBase, n), path.join(routes, n));
}

/** The base files the template's routes folder always holds (never the site's). */
export function baseNames(routesBase) {
  try { return new Set(fs.readdirSync(routesBase)); } catch { return new Set(); }
}

/** Write the agent's workspace into the work folder: pages, parts, the stylesheet. */
export function writeSiteFiles(dir, { pages = [], parts = [], css = null }, { routesBase, stylesBase = null, owner = null } = {}) {
  resetSiteFiles(dir, routesBase);
  const routes = path.join(dir, "src", "routes");
  for (const p of pages) {
    if (!p || typeof p.source !== "string" || !PAGE.test(String(p.path)) || String(p.path).includes("..")) continue;
    const full = path.join(routes, p.path);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, p.source);
  }
  for (const p of parts) {
    if (!p || typeof p.source !== "string" || !PART.test(String(p.name))) continue;
    fs.writeFileSync(path.join(routes, "-parts", p.name + ".tsx"), p.source);
  }
  if (typeof css === "string") fs.writeFileSync(path.join(dir, "src", "styles.css"), css);
  else if (stylesBase && fs.existsSync(stylesBase)) fs.copyFileSync(stylesBase, path.join(dir, "src", "styles.css"));
  if (owner) chownTree(path.join(dir, "src"), owner);
}

/** Read the site's files back: what a command left in the routes folder and the stylesheet. */
export function readSiteFiles(dir, { routesBase } = {}) {
  const routes = path.join(dir, "src", "routes");
  const base = baseNames(routesBase);
  const pages = [], parts = [];
  const walk = (rel) => {
    let names = [];
    try { names = fs.readdirSync(path.join(routes, rel)); } catch { return; }
    for (const n of names) {
      const r = rel ? rel + "/" + n : n;
      const full = path.join(routes, r);
      let st;
      try { st = fs.lstatSync(full); } catch { continue; }
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) { if (r !== "-parts") walk(r); continue; }
      if (!rel && base.has(n)) continue;
      if (PAGE.test(r)) pages.push({ path: r, source: fs.readFileSync(full, "utf8") });
    }
  };
  walk("");
  try {
    for (const n of fs.readdirSync(path.join(routes, "-parts"))) {
      const m = n.match(/^(.+)\.tsx$/);
      const full = path.join(routes, "-parts", n);
      if (m && PART.test(m[1]) && fs.lstatSync(full).isFile()) parts.push({ name: m[1], source: fs.readFileSync(full, "utf8") });
    }
  } catch { /* no parts folder */ }
  let css = null;
  try { css = fs.readFileSync(path.join(dir, "src", "styles.css"), "utf8"); } catch { css = null; }
  return { pages, parts, css };
}

/** The sandbox's no-internet wrapper: a command in a network namespace of its own. */
export const NET_CUT = ["unshare", "--net", "--map-root-user"];
export const NO_NET_MSG = "Commands are switched off here: this container cannot cut a command off from the internet, and none runs with it.";

let netChecked = null;
/**
 * Can a command be cut off from the internet here, as this user? Asked once
 * per process (the answer is the container's), by running the wrapper itself.
 */
export function netCut(as = null, { check = (a) => spawnSync(NET_CUT[0], [...NET_CUT.slice(1), "true"], { timeout: 10000, ...(a ? { uid: a.uid, gid: a.gid } : {}) }) } = {}) {
  if (netChecked !== null) return netChecked;
  try { const r = check(as); netChecked = !!(r && r.status === 0); } catch { netChecked = false; }
  return netChecked;
}
export function _resetNetCut() { netChecked = null; }

/** Run one command in the work folder, with no internet. Never throws; answers `{ code, output, timedOut }`. */
export function runCommand(dir, command, { as = null, timeoutMs = RUN_TIMEOUT_MS, spawnFn = spawn, cut = netCut } = {}) {
  if (!cut(as)) return Promise.resolve({ code: 126, output: NO_NET_MSG, timedOut: false, refused: "no-net-cut" });
  return new Promise((resolve) => {
    let out = "", cut = false, done = false, timedOut = false;
    const finish = (code) => { if (!done) { done = true; resolve({ code, output: out + (cut ? "\n… (output cut at " + MAX_OUTPUT + " characters)" : ""), timedOut }); } };
    let child;
    try {
      child = spawnFn(NET_CUT[0], [...NET_CUT.slice(1), "/bin/sh", "-c", String(command)], {
        cwd: dir, detached: true, stdio: ["ignore", "pipe", "pipe"],
        env: { PATH: "/usr/local/bin:/usr/bin:/bin:" + path.join(dir, "node_modules", ".bin"), HOME: dir, LANG: "C.UTF-8", CI: "1", NO_COLOR: "1" },
        ...(as ? { uid: as.uid, gid: as.gid } : {}),
      });
    } catch (e) { out = "could not start: " + String((e && e.message) || e); return finish(127); }
    const take = (d) => { if (out.length < MAX_OUTPUT) { out += d; if (out.length > MAX_OUTPUT) { out = out.slice(0, MAX_OUTPUT); cut = true; } } else cut = true; };
    child.stdout && child.stdout.on("data", take);
    child.stderr && child.stderr.on("data", take);
    const timer = setTimeout(() => { timedOut = true; try { process.kill(-child.pid, "SIGKILL"); } catch { try { child.kill("SIGKILL"); } catch { /* gone */ } } }, timeoutMs);
    child.on("error", (e) => { clearTimeout(timer); out += String((e && e.message) || e); finish(127); });
    child.on("close", (code) => { clearTimeout(timer); finish(timedOut ? 124 : (code == null ? 1 : code)); });
  });
}

/** Remove work folders older than `SESSION_TTL_MS` (a run that never came back). */
export function sweepSessions(root, now = Date.now()) {
  let names = [];
  try { names = fs.readdirSync(root); } catch { return 0; }
  let n = 0;
  for (const name of names) {
    const d = path.join(root, name);
    try {
      const ready = Number(fs.readFileSync(path.join(d, ".ready"), "utf8"));
      if (Number.isFinite(ready) && now - ready > SESSION_TTL_MS) { fs.rmSync(d, { recursive: true, force: true }); n++; }
    } catch { /* not a session folder */ }
  }
  return n;
}
