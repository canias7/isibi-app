/**
 * PLUGIN MARKETPLACES, AS CLAUDE CODE HAS THEM (2026-11-23; its plugins docs: plugin-marketplaces.md, plugins/host-marketplace.md
 * "Stay within the download limits for hosted files", plugins/marketplace-reference.md).
 *
 * The owner adds a marketplace by its Git URL (a GitHub repository: "owner/repo", https://github.com/owner/repo(.git), with
 * #ref for a branch or tag), whose .claude-plugin/marketplace.json lists its plugins, or by a bare marketplace.json URL. Each
 * plugin entry's `source` is one of Claude Code's: a relative path ("./plugins/x", inside a Git-hosted marketplace only), a
 * `github` repository ({ source: "github", repo, ref?, path? }) or an `archive` zip ({ source: "archive", url, sha256? }).
 * Installing one downloads its files (a GitHub repository as GitHub's own zip of it) and keeps the plugin's skills, commands,
 * agents and hooks for the owner, as a catalog plugin is kept (src/coder-plugins.mjs), named plugin@marketplace on the page.
 *
 * Claude Code's limits, the same here:
 *   - marketplace.json: at most 5 MiB, 10 seconds for the server; a redirect to another origin must be https:// and not to a
 *     loopback, link-local or cloud-metadata host.
 *   - an archive zip: at most 256 MiB, 120 seconds, at most five redirects, each to such an https:// address.
 *   - after download the zip fails past 100,000 entries, 512 MiB for one file unpacked, 1 GiB unpacked in all, or unpacking to
 *     more than 50 times the zip's size (read from the zip's own directory, before anything is unpacked).
 * Coder runs on Cloudflare, which cannot run git: another Git host than GitHub is refused, with the reason.
 */
export const MARKETPLACE_JSON_MAX = 5 * 1024 * 1024, MARKETPLACE_JSON_MS = 10_000;
export const ARCHIVE_MAX = 256 * 1024 * 1024, ARCHIVE_MS = 120_000, ARCHIVE_REDIRECTS = 5;
export const ZIP_ENTRIES_MAX = 100_000, ZIP_FILE_MAX = 512 * 1024 * 1024, ZIP_TOTAL_MAX = 1024 * 1024 * 1024, ZIP_RATIO_MAX = 50;
export const MARKETPLACES_MAX = 20;
const NAME_RE = /^[a-z0-9][a-z0-9_.-]{0,63}$/i;
const clip = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u0008\u000b-\u001f]/g, "").slice(0, n);

/** A host Claude Code never follows a redirect to: loopback, link-local, private and cloud metadata. */
export function blockedHost(host) {
  const h = String(host || "").toLowerCase().replace(/^\[|\]$/g, "");
  if (!h || h === "localhost" || h.endsWith(".localhost") || h === "metadata.google.internal" || h === "metadata" || h.endsWith(".internal")) return true;
  if (/^127\./.test(h) || /^169\.254\./.test(h) || h === "0.0.0.0" || /^10\./.test(h) || /^192\.168\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h === "100.100.100.200") return true;
  if (h === "::1" || /^fe[89ab][0-9a-f]:/.test(h) || /^f[cd][0-9a-f]{2}:/.test(h) || h.startsWith("::ffff:")) return true;
  return false;
}
/** A URL Coder may fetch: https:// and not a blocked host. → a URL or null. */
export function safeUrl(u) {
  let x; try { x = new URL(String(u)); } catch { return null; }
  return x.protocol === "https:" && !x.username && !x.password && !blockedHost(x.hostname) ? x : null;
}

/**
 * A download within limits: { maxBytes, timeoutMs, maxRedirects } (redirects followed here, each checked). → { bytes, url }
 * or { error }.
 */
export async function fetchLimited(url, { maxBytes, timeoutMs, maxRedirects = ARCHIVE_REDIRECTS, what = "the file", fetchFn = fetch } = {}) {
  let at = safeUrl(url);
  if (!at) return { error: what + " must be an https:// address that isn't loopback, link-local or cloud metadata" };
  const signal = AbortSignal.timeout(timeoutMs);
  try {
    for (let hops = 0; ; hops++) {
      const r = await fetchFn(at.href, { redirect: "manual", signal, headers: { "user-agent": "gofarther-coder" } });
      if (r.status >= 300 && r.status < 400 && r.headers.get("location")) {
        if (hops >= maxRedirects) return { error: what + " was redirected more than " + maxRedirects + " times" };
        const next = safeUrl(new URL(r.headers.get("location"), at.href).href);
        if (!next) return { error: what + " was redirected to an address that isn't https:// or points at a loopback, link-local or cloud-metadata host" };
        at = next;
        continue;
      }
      if (!r.ok) return { error: what + " could not be downloaded (" + r.status + ")" };
      const len = Number(r.headers.get("content-length"));
      if (len > maxBytes) return { error: what + " is over " + Math.round(maxBytes / 1048576) + " MiB" };
      const parts = [];
      let n = 0;
      const reader = r.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        n += value.length;
        if (n > maxBytes) { try { await reader.cancel(); } catch { /* gone */ } return { error: what + " is over " + Math.round(maxBytes / 1048576) + " MiB" }; }
        parts.push(value);
      }
      const bytes = new Uint8Array(n);
      let o = 0;
      for (const p of parts) { bytes.set(p, o); o += p.length; }
      return { bytes, url: at.href };
    }
  } catch (e) {
    return { error: e && (e.name === "TimeoutError" || e.name === "AbortError") ? what + " took longer than " + timeoutMs / 1000 + " seconds" : what + " could not be downloaded" };
  }
}

// ── ZIP ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
/** A zip's directory: [{ name, method, csize, usize, offset }] or { error }. Checked against Claude Code's extraction limits. */
export function zipEntries(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) return { error: "the download is not a zip archive" };
  let count = dv.getUint16(eocd + 10, true), cdOff = dv.getUint32(eocd + 16, true);
  // ZIP64 (2026-11-27): a zip of more than 65,535 entries keeps its real count in the Zip64 end record, found through the
  // locator just before the end record; read only from the 16-bit count, the 100,000-entry limit could never be reached.
  if ((count === 0xffff || cdOff === 0xffffffff) && eocd >= 20 && dv.getUint32(eocd - 20, true) === 0x07064b50) {
    const z = Number(dv.getBigUint64(eocd - 20 + 8, true));
    if (z + 56 > bytes.length || dv.getUint32(z, true) !== 0x06064b50) return { error: "the zip archive's directory is damaged" };
    const n64 = dv.getBigUint64(z + 32, true), off64 = dv.getBigUint64(z + 48, true);
    if (n64 > BigInt(ZIP_ENTRIES_MAX)) return { error: "the archive has more than 100,000 files and folders" };
    count = Number(n64); cdOff = Number(off64);
  }
  if (count > ZIP_ENTRIES_MAX) return { error: "the archive has more than 100,000 files and folders" };
  const out = [];
  let p = cdOff, total = 0;
  const dec = new TextDecoder();
  for (let k = 0; k < count; k++) {
    if (p + 46 > bytes.length || dv.getUint32(p, true) !== 0x02014b50) return { error: "the zip archive's directory is damaged" };
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
    const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), offset = dv.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nl));
    if (usize > ZIP_FILE_MAX || usize === 0xffffffff) return { error: "a file in the archive is over 512 MiB unpacked (" + clip(name, 120) + ")" };
    total += usize;
    if (total > ZIP_TOTAL_MAX) return { error: "the archive unpacks to more than 1 GiB" };
    out.push({ name, method, csize, usize, offset });
    p += 46 + nl + xl + cl;
  }
  if (total > ZIP_RATIO_MAX * bytes.length) return { error: "the archive unpacks to more than 50 times its size" };
  return out;
}
/** One entry's bytes (stored or deflated). */
export async function zipRead(bytes, e) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint32(e.offset, true) !== 0x04034b50) throw new Error("damaged zip entry");
  const start = e.offset + 30 + dv.getUint16(e.offset + 26, true) + dv.getUint16(e.offset + 28, true);
  const data = bytes.subarray(start, start + e.csize);
  if (e.method === 0) return data;
  if (e.method !== 8) throw new Error("unsupported zip compression");
  const s = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

/** The frontmatter fields and body of a Markdown file. */
function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return { fields: {}, body: text };
  const fields = {};
  for (const l of m[1].split(/\r?\n/)) { const f = /^([\w-]+):\s*(.*)$/.exec(l); if (f) fields[f[1]] = f[2].trim().replace(/^["']|["']$/g, ""); }
  return { fields, body: m[2] };
}

/**
 * The frontmatter fields that make loading a skill ask first, as Claude Code's Skill tool does ("Using a skill that sets
 * allowed-tools, disallowed-tools or hooks can bring a permission prompt"): "" when none. 2026-11-24.
 */
export const asksOf = (fields) => ["allowed-tools", "disallowed-tools", "hooks"].filter((k) => fields && Object.prototype.hasOwnProperty.call(fields, k)).join(", ");

/**
 * WHERE A PLUGIN LIVES ON CODER'S MACHINE (2026-11-28, Claude Code's plugins/loading.md "Find plugins on disk": the plugin's
 * files at cache/<marketplace>/<plugin>/<version>/, which ${CLAUDE_PLUGIN_ROOT} points at, and its own lasting folder at
 * data/<plugin-id>/, ${CLAUDE_PLUGIN_DATA}, kept across updates; "<id> is the plugin identifier with every character other
 * than a letter, digit, _ or - replaced by -"). Coder's plugins root is /opt/coder-plugins (container/coder-pluginfiles.mjs
 * keeps the same paths).
 */
export const PLUGIN_HOME = "/opt/coder-plugins";
const seg = (x) => String(x || "").replace(/[^\w.-]/g, "-").replace(/^\.+/, "-").slice(0, 100) || "unknown";
export const pluginRootOf = (market, name, version) => PLUGIN_HOME + "/cache/" + seg(market) + "/" + seg(name) + "/" + seg(version);
export const pluginDataOf = (id) => PLUGIN_HOME + "/data/" + String(id || "").replace(/[^A-Za-z0-9_-]/g, "-");

/**
 * Claude Code's path rules for a component path (plugins-reference "Path rules", loading.md "Paths that escape the plugin
 * directory"): relative to the plugin root, with or without "./"; one that leaves the root, or holds a backslash (on Linux), is
 * refused. → the clean relative path ("" for the root itself) or null.
 */
export function insidePath(p) {
  if (typeof p !== "string" || p.includes("\\") || p.startsWith("/") || /^[a-z]:/i.test(p)) return null;
  const out = [];
  for (const x of p.split("/")) { if (x === "" || x === ".") continue; if (x === "..") return null; out.push(x); }
  return out.join("/");
}
const asList = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);

/** userConfig as kept: { key: { type, title, description, sensitive, required, default, multiple, options } }. */
export function cleanUserConfig(raw) {
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, o] of Object.entries(raw).slice(0, 30)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(k) || !o || typeof o !== "object") continue;
    const type = ["string", "number", "boolean", "directory", "file"].includes(o.type) ? o.type : "string";
    out[k] = { type, title: clip(o.title || k, 80), description: clip(o.description, 300), sensitive: o.sensitive === true, required: o.required === true,
      ...(o.default !== undefined && o.sensitive !== true && ["string", "number", "boolean"].includes(typeof o.default) ? { default: o.default } : {}),
      ...(o.multiple === true ? { multiple: true } : {}),
      ...(Array.isArray(o.options) && type === "string" && o.multiple !== true && o.sensitive !== true ? { options: o.options.filter((x) => typeof x === "string" && x.length >= 1 && x.length <= 64).slice(0, 50) } : {}) };
  }
  return out;
}

/**
 * A PLUGIN FROM A ZIP (2026-11-28: the whole plugin, as Claude Code keeps it). Its folder is `root` (or, left out, the folder
 * holding .claude-plugin/plugin.json, else the zip's own top folder). The zip itself is kept (coder-plugins.mjs), so every
 * file of the plugin reaches Coder's machine: scripts, bin/, and the files beside each SKILL.md. What is read here, as Claude
 * Code's plugins reference ("Standard layout", "Component path forms") says:
 *   - skills: skills/<name>/SKILL.md, plus each folder the manifest's `skills` names (a folder of <name>/SKILL.md folders, or
 *     one holding SKILL.md itself); "adds to the default skills/ scan";
 *   - commands: commands/**.md (a subfolder adds a segment: commands/db/migrate.md is db:migrate), or, when the manifest sets
 *     `commands` (a path, a list of paths, or a map of name → { source | content, description }), only those;
 *   - agents: agents/**.md (subfolders are part of the name: agents/review/security.md is plugin:review:security), or, when
 *     the manifest sets `agents` (files only), only those, named without subfolders;
 *   - hooks: hooks/hooks.json together with the manifest's `hooks` (a path, an object, or a list of either);
 *   - MCP servers: .mcp.json together with the manifest's `mcpServers` (a path, an object, or a list); a later name replaces
 *     an earlier one;
 *   - userConfig, version, defaultEnabled, displayName, homepage.
 * A component path that leaves the plugin folder is left out (Claude Code's "path escapes plugin directory").
 */
export async function pluginFromZip(bytes, { root, name: wantName = "" } = {}) {
  const entries = zipEntries(bytes);
  if (entries.error) return entries;
  const files = entries.filter((e) => !e.name.endsWith("/"));
  let base = typeof root === "string" ? root : null;
  if (base === null) {
    const man = files.filter((e) => /(^|\/)\.claude-plugin\/plugin\.json$/.test(e.name)).sort((a, b) => a.name.length - b.name.length)[0];
    if (man) base = man.name.replace(/\.claude-plugin\/plugin\.json$/, "");
    else { const tops = new Set(files.map((e) => e.name.split("/")[0])); base = tops.size === 1 && files.every((e) => e.name.includes("/")) ? [...tops][0] + "/" : ""; }
  }
  if (base && !base.endsWith("/")) base += "/";
  const all = files.filter((e) => e.name.startsWith(base));
  const under = all.filter((e) => e.usize <= 256 * 1024);
  const text = async (e) => new TextDecoder().decode(await zipRead(bytes, e));
  const find = (rel) => under.find((e) => e.name === base + rel);
  const relOf = (e) => e.name.slice(base.length);
  let manifest = {};
  const mf = find(".claude-plugin/plugin.json");
  if (mf) { try { manifest = JSON.parse(await text(mf)); } catch { return { error: "the plugin's .claude-plugin/plugin.json is not valid JSON" }; } }
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) manifest = {};
  const name = String(manifest.name || wantName || "").trim().toLowerCase();
  if (!NAME_RE.test(name)) return { error: "the plugin has no valid name (its .claude-plugin/plugin.json name)" };
  const skipped = [];
  const plugin = { name, manifestName: name, description: clip(manifest.description, 300), category: clip(manifest.category, 40), skills: [], commands: [], agents: [], connectors: [], files: all.length,
    ...(typeof manifest.version === "string" && manifest.version.trim() ? { manifestVersion: clip(manifest.version.trim(), 64) } : {}),
    ...(typeof manifest.defaultEnabled === "boolean" ? { defaultEnabled: manifest.defaultEnabled } : {}),
    ...(typeof manifest.displayName === "string" && manifest.displayName.trim() ? { displayName: clip(manifest.displayName.trim(), 80) } : {}),
    ...(typeof manifest.homepage === "string" && /^https?:\/\//.test(manifest.homepage) ? { homepage: clip(manifest.homepage, 300) } : {}),
    ...(manifest.author && typeof manifest.author === "object" && manifest.author.name ? { author: clip(manifest.author.name, 100) } : {}) };
  const uc = cleanUserConfig(manifest.userConfig);
  if (Object.keys(uc).length) plugin.userConfig = uc;
  const okName = (n) => /^[a-z0-9][\w:-]{0,127}$/i.test(n);
  const addSkill = async (e, nm, dir) => {
    if (plugin.skills.length >= 50 || plugin.skills.some((s) => s.name === nm)) return;
    const f = frontmatter(await text(e));
    plugin.skills.push({ name: clip(f.fields.name || nm, 64), description: clip(f.fields.description, 250), body: clip(f.body.trim(), 20_000), dir, ...(asksOf(f.fields) ? { asks: asksOf(f.fields) } : {}) });
  };
  const addCommand = async (nm, body, description, extra = {}) => {
    if (plugin.commands.length >= 50 || plugin.commands.some((s) => s.name === nm)) return;
    const f = frontmatter(body);
    plugin.commands.push({ name: clip(nm, 128), description: clip(description || f.fields.description, 250), body: clip(f.body.trim(), 20_000), ...(asksOf(f.fields) ? { asks: asksOf(f.fields) } : {}), ...extra });
  };
  const below = (dir) => under.filter((e) => { const r = relOf(e); return dir === "" ? true : r.startsWith(dir + "/"); });
  // SKILLS: the default skills/ folder, then each folder the manifest adds.
  const skillDirs = ["skills", ...asList(manifest.skills).map((p) => { const q = insidePath(p); if (q === null) skipped.push("skills: " + clip(p, 80)); return q; }).filter((q) => q !== null)];
  for (const d of skillDirs) {
    const own = find((d ? d + "/" : "") + "SKILL.md");
    if (own && d !== "skills") { await addSkill(own, d.split("/").pop() || name, d); continue; }
    for (const e of below(d)) { const r = relOf(e).slice(d ? d.length + 1 : 0); const m = /^([^/]+)\/SKILL\.md$/.exec(r); if (m) await addSkill(e, m[1], (d ? d + "/" : "") + m[1]); }
  }
  // COMMANDS: the manifest's (which replace the default scan), else commands/**.md.
  const cmdName = (rel, dir) => rel.slice(dir ? dir.length + 1 : 0).replace(/\.md$/, "").split("/").join(":");
  if (manifest.commands && typeof manifest.commands === "object" && !Array.isArray(manifest.commands)) {
    for (const [k, v] of Object.entries(manifest.commands).slice(0, 50)) {
      if (!v || typeof v !== "object" || !okName(k)) continue;
      if (typeof v.content === "string" && typeof v.source !== "string") await addCommand(k, v.content, v.description);
      else if (typeof v.source === "string" && typeof v.content !== "string") { const q = insidePath(v.source); const e = q && find(q); if (e) await addCommand(k, await text(e), v.description); else skipped.push("commands: " + clip(v.source, 80)); }
    }
  } else if (manifest.commands !== undefined) {
    for (const p of asList(manifest.commands)) {
      const q = insidePath(p);
      if (q === null) { skipped.push("commands: " + clip(p, 80)); continue; }
      const one = find(q);
      if (one && q.endsWith(".md")) await addCommand(q.split("/").pop().replace(/\.md$/, ""), await text(one));
      else for (const e of below(q)) if (relOf(e).endsWith(".md")) await addCommand(cmdName(relOf(e), q), await text(e));
    }
  } else for (const e of below("commands")) if (relOf(e).endsWith(".md")) await addCommand(cmdName(relOf(e), "commands"), await text(e));
  // AGENTS: the manifest's files (named without subfolders), else agents/**.md (subfolders part of the name).
  if (manifest.agents !== undefined) {
    for (const p of asList(manifest.agents)) { const q = insidePath(p); const e = q && q.endsWith(".md") && find(q); if (e && plugin.agents.length < 30) plugin.agents.push({ file: clip(q.split("/").pop(), 120), text: clip(await text(e), 20_000) }); else skipped.push("agents: " + clip(p, 80)); }
  } else for (const e of below("agents")) {
    const r = relOf(e).slice("agents/".length);
    if (!r.endsWith(".md") || plugin.agents.length >= 30) continue;
    const sub = r.split("/").slice(0, -1).join(":");
    plugin.agents.push({ file: clip(r.split("/").pop(), 120), text: clip(await text(e), 20_000), ...(sub ? { sub: clip(sub, 120) } : {}) });
  }
  // HOOKS: hooks/hooks.json, then the manifest's, merged event by event.
  const hookParts = [];
  const hf = find("hooks/hooks.json");
  if (hf) { try { hookParts.push(JSON.parse(await text(hf))); } catch { skipped.push("hooks/hooks.json"); } }
  for (const h of asList(manifest.hooks)) {
    if (typeof h === "string") { const q = insidePath(h); const e = q && find(q); if (!e) { skipped.push("hooks: " + clip(h, 80)); continue; } if (q === "hooks/hooks.json") continue; try { hookParts.push(JSON.parse(await text(e))); } catch { skipped.push("hooks: " + clip(h, 80)); } }
    else if (h && typeof h === "object") hookParts.push(h);
  }
  const hooks = {};
  for (const part of hookParts) { const m = part && typeof part.hooks === "object" && part.hooks ? part.hooks : part; for (const [ev, groups] of Object.entries(m || {})) if (Array.isArray(groups)) hooks[ev] = [...(hooks[ev] || []), ...groups]; }
  if (Object.keys(hooks).length) plugin.hooks = hooks;
  // MCP SERVERS: .mcp.json, then the manifest's; a later name replaces an earlier one.
  const servers = {};
  const addServers = (m) => { const map = m && typeof m.mcpServers === "object" && m.mcpServers ? m.mcpServers : m; for (const [k, v] of Object.entries(map || {}).slice(0, 20)) if (/^[\w.-]{1,64}$/.test(k) && v && typeof v === "object" && !Array.isArray(v)) servers[k] = JSON.parse(JSON.stringify(v)); };
  const mj = find(".mcp.json");
  if (mj) { try { addServers(JSON.parse(await text(mj))); } catch { skipped.push(".mcp.json"); } }
  for (const m of asList(manifest.mcpServers)) {
    if (typeof m === "string") { const q = insidePath(m); const e = q && q.endsWith(".json") && find(q); if (!e) { skipped.push("mcpServers: " + clip(m, 80)); continue; } try { addServers(JSON.parse(await text(e))); } catch { skipped.push("mcpServers: " + clip(m, 80)); } }
    else if (m && typeof m === "object") addServers(m);
  }
  if (Object.keys(servers).length) plugin.mcpServers = servers;
  plugin.skills = plugin.skills.filter((s) => s.body && /^[a-z0-9][\w-]{0,63}$/i.test(s.name));
  plugin.commands = plugin.commands.filter((s) => s.body && okName(s.name));
  if (skipped.length) plugin.skipped = skipped.slice(0, 20);
  if (!plugin.description) plugin.description = "Plugin " + name;
  return { ok: true, plugin, base };
}

/** The zip's own comment: GitHub's archives carry their commit SHA there. → the 40-hex SHA or "". */
export function zipCommit(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 65535); i--) if (dv.getUint32(i, true) === 0x06054b50) {
    const n = dv.getUint16(i + 20, true);
    const c = new TextDecoder().decode(bytes.subarray(i + 22, i + 22 + n)).trim();
    return /^[0-9a-f]{40}$/.test(c) ? c : "";
  }
  return "";
}

/**
 * THE VERSION CLAUDE CODE COMPUTES (plugins/loading.md "How Claude Code computes the version"): the manifest's `version`, then
 * the marketplace entry's, then from the source: the commit SHA shortened to 12 for github (and a relative path inside a
 * GitHub-hosted marketplace), the archive's SHA-256 shortened to 12 for an archive.
 */
export function computeVersion({ manifestVersion = "", entryVersion = "", commit = "", sha256 = "" } = {}) {
  if (manifestVersion) return manifestVersion;
  if (entryVersion) return entryVersion;
  if (commit) return commit.slice(0, 12);
  if (sha256) return sha256.slice(0, 12);
  return "unknown";
}

// ── MARKETPLACES ──────────────────────────────────────────────────────────────────────────────────────────────────────────
/** What the owner typed, as a marketplace source: { kind: "github", repo, ref } | { kind: "url", url } | { error }. */
export function parseSource(raw) {
  const s = String(raw || "").trim();
  let m = /^([A-Za-z0-9-]{1,39})\/([\w.-]{1,100}?)(?:\.git)?(?:#([\w./-]{1,100}))?$/.exec(s);
  if (m) return { kind: "github", repo: m[1] + "/" + m[2], ref: m[3] || "" };
  m = /^(?:https:\/\/|git@)github\.com[/:]([A-Za-z0-9-]{1,39})\/([\w.-]{1,100}?)(?:\.git)?\/?(?:#([\w./-]{1,100}))?$/.exec(s);
  if (m) return { kind: "github", repo: m[1] + "/" + m[2], ref: m[3] || "" };
  if (/^https:\/\/\S+\.json(\?\S*)?$/.test(s)) return safeUrl(s) ? { kind: "url", url: s } : { error: "the marketplace address must be https:// and not a loopback, link-local or cloud-metadata host" };
  if (/^(https:\/\/|git@|ssh:\/\/)\S+/.test(s)) return { error: "Coder can add a marketplace from a GitHub repository or a marketplace.json URL; it runs on Cloudflare, which cannot run git for other Git hosts" };
  return { error: "give a Git URL (owner/repo or https://github.com/owner/repo) or a marketplace.json URL" };
}
const ghZip = (repo, ref) => "https://codeload.github.com/" + repo + "/zip/" + (ref ? encodeURIComponent(ref).replace(/%2F/g, "/") : "HEAD");
const ghRaw = (repo, ref, path) => "https://raw.githubusercontent.com/" + repo + "/" + (ref || "HEAD") + "/" + path;

/** A marketplace.json read and checked: { name, owner, plugins: [{ name, description, category, source }] } or { error }. */
export function readMarketplace(text) {
  let j; try { j = JSON.parse(text); } catch { return { error: "marketplace.json is not valid JSON" }; }
  if (!j || typeof j !== "object") return { error: "marketplace.json is not an object" };
  const name = String(j.name || "").trim();
  if (!NAME_RE.test(name)) return { error: "marketplace.json needs a name (letters, digits, -, _ and ., at most 64)" };
  if (!Array.isArray(j.plugins)) return { error: "marketplace.json needs a plugins list" };
  const plugins = j.plugins.slice(0, 200).filter((p) => p && NAME_RE.test(String(p.name || "")) && (typeof p.source === "string" || (p.source && typeof p.source === "object"))).map((p) => ({ name: String(p.name).toLowerCase(), description: clip(p.description, 300), category: clip(p.category, 40), source: typeof p.source === "string" ? clip(p.source, 300) : JSON.parse(JSON.stringify(p.source)), ...(typeof p.version === "string" && p.version.trim() ? { version: clip(p.version.trim(), 64) } : {}), ...(typeof p.defaultEnabled === "boolean" ? { defaultEnabled: p.defaultEnabled } : {}), ...(typeof p.homepage === "string" && /^https?:\/\//.test(p.homepage) ? { homepage: clip(p.homepage, 300) } : {}) }));
  return { name: name.toLowerCase(), owner: clip(j.owner && j.owner.name, 100), plugins };
}

/** ANTHROPIC'S MARKETPLACE NAMES (plugins/security.md "Identify Anthropic's marketplaces by name"). */
export const OFFICIAL_NAMES = Object.freeze(["claude-plugins-official", "claude-code-marketplace", "claude-code-plugins", "anthropic-marketplace", "anthropic-plugins", "agent-skills", "anthropic-agent-skills", "life-sciences", "knowledge-work-plugins", "claude-for-legal", "claude-for-financial-services", "financial-services-plugins", "first-party-plugins", "claude-tag-plugins"]);
export const COMMUNITY_NAMES = Object.freeze(["claude-community", "claude-plugins-community", "healthcare"]);
export const tierOf = (name) => (OFFICIAL_NAMES.includes(String(name)) ? "official" : COMMUNITY_NAMES.includes(String(name)) ? "community" : "third-party");
/**
 * AUTO-UPDATE'S DEFAULT (plugins/loading.md "Which marketplaces and plugins auto-update"): on for Anthropic's official
 * marketplaces, off for knowledge-work-plugins and first-party-plugins, and off for every other marketplace.
 */
export const autoUpdateDefault = (name) => tierOf(name) === "official" && name !== "knowledge-work-plugins" && name !== "first-party-plugins";
/** Claude Code's trust warning, word for word (plugins/security.md "Trust warning before you install"). */
export const TRUST_WARNING = "Plugins can run code on your computer, with access to your files and shell. Make sure you trust a plugin before installing, updating, or using it. Anthropic does not control what MCP servers, files, or other software are included in plugins and cannot verify that they will work as intended or that they won't change. See each plugin's homepage for more information.";
/** A marketplace's source as the owner typed it, for a refresh. */
export const sourceText = (src) => (src && src.kind === "github" ? src.repo + (src.ref ? "#" + src.ref : "") : src && src.url ? src.url : "");

/** Adds (or refreshes) a marketplace. → { ok, marketplace } or { error }. */
export async function fetchMarketplace(raw, { fetchFn = fetch } = {}) {
  const src = parseSource(raw);
  if (src.error) return src;
  const url = src.kind === "github" ? ghRaw(src.repo, src.ref, ".claude-plugin/marketplace.json") : src.url;
  // (marketplace.json: 5 MiB and 10 seconds; redirects only to https:// addresses that aren't loopback, link-local or metadata.)
  const got = await fetchLimited(url, { maxBytes: MARKETPLACE_JSON_MAX, timeoutMs: MARKETPLACE_JSON_MS, maxRedirects: ARCHIVE_REDIRECTS, what: "marketplace.json", fetchFn });
  if (got.error) return got;
  const mk = readMarketplace(new TextDecoder().decode(got.bytes));
  if (mk.error) return mk;
  // (Claude Code's untrusted-source check, plugins/security.md: an official or community name from outside
  // github.com/anthropics/ is refused, "Marketplace is registered from an untrusted source".)
  if (tierOf(mk.name) !== "third-party" && !(src.kind === "github" && /^anthropics\//i.test(src.repo))) return { error: "Marketplace is registered from an untrusted source: the name " + mk.name + " is one of Anthropic's, and only github.com/anthropics/ may use it" };
  return { ok: true, marketplace: { ...mk, source: src } };
}

/** The download that holds one marketplace entry's plugin: { url, root?, sha256? } or { error }. */
export function entryDownload(mk, entry) {
  const s = entry.source;
  if (typeof s === "string") {
    if (mk.source.kind !== "github") return { error: "its marketplace entry path does not stay inside the marketplace directory (a marketplace added by URL can't use a relative path)" };
    const rel = s.replace(/^\.\//, "").replace(/\/+$/, "");
    if (rel.split("/").some((x) => x === "..")) return { error: "its marketplace entry path does not stay inside the marketplace directory" };
    return { url: ghZip(mk.source.repo, mk.source.ref), root: rel, top: true };
  }
  if (s.source === "github" && /^[\w-]{1,39}\/[\w.-]{1,100}$/.test(String(s.repo || ""))) return { url: ghZip(s.repo, s.ref || ""), root: String(s.path || "").replace(/^\.?\/+|\/+$/g, ""), top: true };
  if (s.source === "archive" && typeof s.url === "string") return { url: s.url, ...(typeof s.sha256 === "string" ? { sha256: s.sha256.toLowerCase() } : {}) };
  return { error: "its source (" + clip(s.source, 20) + ") is not one Coder can download: a relative path, github or archive" };
}

/**
 * Installs one entry: → { ok, plugin, bytes, base, version } (the plugin to keep, the zip it came in and the plugin's folder in
 * it, and the version Claude Code would compute) or { error }.
 */
export async function downloadPlugin(mk, entry, { fetchFn = fetch } = {}) {
  const d = entryDownload(mk, entry);
  if (d.error) return { error: "Plugin " + entry.name + ": " + d.error };
  const got = await fetchLimited(d.url, { maxBytes: ARCHIVE_MAX, timeoutMs: ARCHIVE_MS, maxRedirects: ARCHIVE_REDIRECTS, what: "the plugin's archive", fetchFn });
  if (got.error) return { error: "Plugin " + entry.name + ": " + got.error };
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", got.bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
  if (d.sha256 && digest !== d.sha256) return { error: "Plugin " + entry.name + ": Plugin archive integrity check failed (the archive does not match its sha256)" };
  let root;
  if (d.top) {
    const entries = zipEntries(got.bytes);
    if (entries.error) return { error: "Plugin " + entry.name + ": " + entries.error };
    const top = (entries[0] && entries[0].name.split("/")[0]) || "";
    root = top + "/" + (d.root ? d.root + "/" : "");
  }
  const r = await pluginFromZip(got.bytes, { ...(root !== undefined ? { root } : {}), name: entry.name });
  if (r.error) return { error: "Plugin " + entry.name + ": " + r.error };
  const version = computeVersion({ manifestVersion: r.plugin.manifestVersion, entryVersion: entry.version, commit: d.top ? zipCommit(got.bytes) : "", sha256: d.top ? "" : digest });
  const defaultEnabled = typeof entry.defaultEnabled === "boolean" ? entry.defaultEnabled : r.plugin.defaultEnabled !== false;
  return { ok: true, bytes: got.bytes, base: r.base, version, plugin: { ...r.plugin, name: entry.name, description: r.plugin.description.startsWith("Plugin ") && entry.description ? entry.description : r.plugin.description, marketplace: mk.name, version, defaultEnabled, ...(entry.homepage && !r.plugin.homepage ? { homepage: entry.homepage } : {}) } };
}
