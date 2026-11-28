/**
 * INSTALLED PLUGINS ON CODER'S MACHINE (2026-11-28; Claude Code's plugins/loading.md and plugins-reference "Environment
 * variables"). The Worker keeps each marketplace plugin's zip whole (src/coder-plugins.mjs) and sends, with each turn, every
 * installed plugin's parts and its switch; here:
 *   - THE FILES: each plugin is unpacked once into /opt/coder-plugins/cache/<marketplace>/<plugin>/<version>/, the folder
 *     ${CLAUDE_PLUGIN_ROOT} names (read-only to Coder's commands: "don't write state there"), and gets its own lasting folder,
 *     /opt/coder-plugins/data/<id>/, ${CLAUDE_PLUGIN_DATA} ("created on first reference and kept across plugin updates";
 *     deleted when the plugin is uninstalled). A link in the zip that leads outside the plugin is removed ("path escapes plugin
 *     directory"). The zip was checked against Claude Code's download and extraction limits when it was installed.
 *   - THE REPOSITORY'S enabledPlugins (loading.md "Find where a plugin is enabled": project .claude/settings.json, then
 *     .claude/settings.local.json, each over the owner's own switch, "for each plugin id, the value from the highest-precedence
 *     source that mentions the id"): read only once the repository's settings are trusted ("it loads only after the same trust
 *     check"). A plugin the repository enables that the owner has not installed doesn't load ("isn't installed here"). The
 *     repository's extraKnownMarketplaces is not read: "An Anthropic-hosted cloud session doesn't add the marketplaces a
 *     repository lists under extraKnownMarketplaces".
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, lstatSync, realpathSync, renameSync, chownSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { inflateRawSync } from "node:zlib";

export const PLUGIN_HOME = "/opt/coder-plugins";
const DONE = ".coder-unpacked";
const ID_RE = /^[a-z0-9][a-z0-9_.-]{0,63}(@[a-z0-9][a-z0-9_.-]{0,63})?$/i;
const okPath = (p) => typeof p === "string" && p.startsWith(PLUGIN_HOME + "/") && !p.includes("/../") && !p.includes("\0");

/** The repository's enabledPlugins, merged (settings.local.json over settings.json): { id: boolean }, {} when untrusted. */
export function repoEnabledPlugins(dir, trusted) {
  const out = {};
  if (!trusted || !dir) return out;
  for (const f of ["settings.json", "settings.local.json"]) {
    try {
      const p = join(dir, ".claude", f);
      const st = lstatSync(p);
      if (!st.isFile() || st.size > 1_000_000) continue;
      const j = JSON.parse(readFileSync(p, "utf8"));
      const e = j && j.enabledPlugins;
      if (e && typeof e === "object" && !Array.isArray(e)) for (const [k, v] of Object.entries(e)) if (typeof v === "boolean" && ID_RE.test(k)) out[k.toLowerCase()] = v;
    } catch { /* none, or not JSON */ }
  }
  return out;
}
/** Whether one plugin is on in this chat: the repository's value for its id, else the owner's switch. */
export const pluginOn = (id, ownerOn, repo) => (repo && typeof repo[String(id || "").toLowerCase()] === "boolean" ? repo[String(id).toLowerCase()] : ownerOn !== false);

/**
 * The turn's plugin parts with the repository's enabledPlugins applied: body.pluginHooks, body.pluginAgents and body.ownerSkills
 * (with body.pluginSkillsOff, the skills of the plugins the owner switched off) → only what is on in this chat.
 */
export function applyPluginSwitches(body, repo) {
  if (!body || typeof body !== "object") return body;
  const keep = (x) => !x || typeof x.id !== "string" || pluginOn(x.id, x.enabled !== false, repo);
  if (Array.isArray(body.pluginHooks)) body.pluginHooks = body.pluginHooks.filter(keep);
  if (Array.isArray(body.pluginAgents)) body.pluginAgents = body.pluginAgents.filter(keep);
  if (Array.isArray(body.pluginFiles)) body.pluginFiles = body.pluginFiles.map((f) => (f && typeof f.id === "string" ? { ...f, enabled: pluginOn(f.id, f.enabled !== false, repo) } : f));
  if (Array.isArray(body.ownerSkills)) {
    const on = body.ownerSkills.filter((s) => !s || typeof s.plugin !== "string" || pluginOn(s.plugin, true, repo));
    const back = Array.isArray(body.pluginSkillsOff) ? body.pluginSkillsOff.filter((s) => s && typeof s.plugin === "string" && pluginOn(s.plugin, false, repo)) : [];
    body.ownerSkills = [...on, ...back];
  }
  return body;
}

/** The machine's way to fetch a plugin's zip from Coder's server, with this job's pass (as the environment API's calls). */
export function zipFetcher(via, fetchFn = fetch) {
  const url = String(via.url).replace(/\/api\/coder\/model$/, "/api/coder/environment");
  return async (key) => {
    const r = await fetchFn(url, { method: "POST", headers: { ...via.headers, "content-type": "application/json" }, body: JSON.stringify({ action: "plugin_zip", key }), signal: AbortSignal.timeout(120_000) });
    if (!r.ok || !String(r.headers.get("content-type") || "").includes("zip")) throw new Error("the plugin's files could not be fetched (" + r.status + ")");
    return Buffer.from(await r.arrayBuffer());
  };
}

/**
 * The files of a zip under `base`, written into `dest` (its folders made, an executable's mode kept). A link stored in the zip
 * is not made, and a name that would leave `dest` is skipped. The zip was checked against Claude Code's extraction limits on
 * the Worker when the plugin was installed.
 */
export function unzipInto(bytes, base, dest) {
  const b = Buffer.from(bytes);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 22 - 65535); i--) if (b.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("not a zip archive");
  let count = b.readUInt16LE(eocd + 10), p = b.readUInt32LE(eocd + 16);
  if ((count === 0xffff || p === 0xffffffff) && eocd >= 20 && b.readUInt32LE(eocd - 20) === 0x07064b50) { const z = Number(b.readBigUInt64LE(eocd - 12)); count = Number(b.readBigUInt64LE(z + 32)); p = Number(b.readBigUInt64LE(z + 48)); }
  mkdirSync(dest, { recursive: true });
  for (let k = 0; k < count; k++) {
    if (b.readUInt32LE(p) !== 0x02014b50) throw new Error("the zip archive's directory is damaged");
    const method = b.readUInt16LE(p + 10), csize = b.readUInt32LE(p + 20), nl = b.readUInt16LE(p + 28), xl = b.readUInt16LE(p + 30), cl = b.readUInt16LE(p + 32), attr = b.readUInt32LE(p + 38), off = b.readUInt32LE(p + 42);
    const name = b.subarray(p + 46, p + 46 + nl).toString("utf8");
    p += 46 + nl + xl + cl;
    if (!name.startsWith(base)) continue;
    const rel = name.slice(base.length);
    const parts = rel.split("/").filter(Boolean);
    if (!parts.length || parts.some((x) => x === ".." || x === ".") || rel.includes("\\")) continue;
    const mode = attr >>> 16;
    if ((mode & 0o170000) === 0o120000) continue;
    const to = join(dest, ...parts);
    if (name.endsWith("/")) { mkdirSync(to, { recursive: true }); continue; }
    const start = off + 30 + b.readUInt16LE(off + 26) + b.readUInt16LE(off + 28);
    const raw = b.subarray(start, start + csize);
    const data = method === 0 ? raw : method === 8 ? inflateRawSync(raw) : null;
    if (!data) throw new Error("unsupported zip compression");
    mkdirSync(join(to, ".."), { recursive: true });
    writeFileSync(to, data, { mode: mode & 0o111 ? 0o755 : 0o644 });
  }
}

/** Removes each link under `root` that leads outside it. */
function dropEscapingLinks(root) {
  const real = realpathSync(root);
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      const st = lstatSync(p);
      if (st.isSymbolicLink()) { let to = ""; try { to = realpathSync(p); } catch { to = ""; } if (!to || (to !== real && !to.startsWith(real + "/"))) rmSync(p, { force: true }); }
      else if (st.isDirectory()) walk(p);
    }
  };
  walk(root);
}

/**
 * Unpacks each plugin not on the disk yet (files: [{ id, key, base, root, data }]), makes its data folder (owned by the user
 * Coder's commands run as), and deletes the data folders of plugins no longer installed. → [{ id, error }] for those that failed.
 */
export async function ensurePluginFiles(files, fetchZip, { uid = null, gid = null, home = PLUGIN_HOME, map = (p) => p } = {}) {
  const failed = [];
  if (!Array.isArray(files)) return failed;
  const list = files.filter((f) => f && ID_RE.test(String(f.id || "")) && okPath(f.root) && okPath(f.data) && typeof f.key === "string").slice(0, 30);
  for (const f0 of list) {
    const f = { ...f0, root: map(f0.root), data: map(f0.data) };
    try {
      if (!existsSync(join(f.root, DONE))) {
        const bytes = await fetchZip(f.key);
        const tmp = join(home, ".tmp-" + process.pid + "-" + Date.now());
        mkdirSync(tmp, { recursive: true, mode: 0o700 });
        try {
          const base = String(f.base || "").replace(/^\/+/, "");
          unzipInto(bytes, base, join(tmp, "x"));
          const from = join(tmp, "x");
          dropEscapingLinks(from);
          writeFileSync(join(from, DONE), String(Date.now()));
          rmSync(f.root, { recursive: true, force: true });
          mkdirSync(join(f.root, ".."), { recursive: true, mode: 0o755 });
          renameSync(from, f.root);
          execFileSync("chmod", ["-R", "u+rwX,go+rX,go-w", f.root], { stdio: "ignore" });
        } finally { rmSync(tmp, { recursive: true, force: true }); }
      }
      if (!existsSync(f.data)) {
        mkdirSync(f.data, { recursive: true, mode: 0o755 });
        if (Number.isInteger(uid)) { try { chownSync(f.data, uid, Number.isInteger(gid) ? gid : uid); } catch { /* not root */ } }
      }
    } catch (e) { failed.push({ id: f.id, error: String((e && e.message) || e).slice(0, 200) }); }
  }
  // (Uninstalled: its lasting folder goes, as Claude Code's "deletes the ${CLAUDE_PLUGIN_DATA} directory when you uninstall".)
  try {
    const keep = new Set(list.map((f) => f.data.split("/").pop()));
    for (const n of readdirSync(join(home, "data"))) if (!keep.has(n)) rmSync(join(home, "data", n), { recursive: true, force: true });
  } catch { /* no data folder yet */ }
  return failed;
}
