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
  const count = dv.getUint16(eocd + 10, true), cdOff = dv.getUint32(eocd + 16, true);
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
 * A PLUGIN FROM A ZIP: its folder is `root` (or, left out, the folder holding .claude-plugin/plugin.json, else the zip's own
 * top folder). Skills (skills/<name>/SKILL.md), commands (commands/*.md), agents (agents/*.md) and hooks (hooks/hooks.json).
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
  const under = files.filter((e) => e.name.startsWith(base) && e.usize <= 256 * 1024);
  const text = async (e) => new TextDecoder().decode(await zipRead(bytes, e));
  const find = (rel) => under.find((e) => e.name === base + rel);
  let manifest = {};
  const mf = find(".claude-plugin/plugin.json");
  if (mf) { try { manifest = JSON.parse(await text(mf)); } catch { return { error: "the plugin's .claude-plugin/plugin.json is not valid JSON" }; } }
  const name = String(manifest.name || wantName || "").trim().toLowerCase();
  if (!NAME_RE.test(name)) return { error: "the plugin has no valid name (its .claude-plugin/plugin.json name)" };
  const plugin = { name, description: clip(manifest.description, 300), category: clip(manifest.category, 40), skills: [], commands: [], agents: [], connectors: [] };
  for (const e of under) {
    const rel = e.name.slice(base.length);
    let m;
    if ((m = /^skills\/([^/]+)\/SKILL\.md$/.exec(rel)) && plugin.skills.length < 50) {
      const f = frontmatter(await text(e));
      plugin.skills.push({ name: clip(f.fields.name || m[1], 64), description: clip(f.fields.description, 250), body: clip(f.body.trim(), 20_000) });
    } else if ((m = /^commands\/([^/]+)\.md$/.exec(rel)) && plugin.commands.length < 50) {
      const f = frontmatter(await text(e));
      plugin.commands.push({ name: clip(m[1], 64), description: clip(f.fields.description, 250), body: clip(f.body.trim(), 20_000) });
    } else if ((m = /^agents\/([^/]+\.md)$/.exec(rel)) && plugin.agents.length < 30) {
      plugin.agents.push({ file: clip(m[1], 120), text: clip(await text(e), 20_000) });
    } else if (rel === "hooks/hooks.json") {
      try { plugin.hooks = JSON.parse(await text(e)); } catch { /* a bad hooks file is left out */ }
    }
  }
  plugin.skills = plugin.skills.filter((s) => s.body && /^[a-z0-9][\w-]{0,63}$/i.test(s.name));
  plugin.commands = plugin.commands.filter((s) => s.body && /^[a-z0-9][\w-]{0,63}$/i.test(s.name));
  if (!plugin.description) plugin.description = "Plugin " + name;
  return { ok: true, plugin };
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
  const plugins = j.plugins.slice(0, 200).filter((p) => p && NAME_RE.test(String(p.name || "")) && (typeof p.source === "string" || (p.source && typeof p.source === "object"))).map((p) => ({ name: String(p.name).toLowerCase(), description: clip(p.description, 300), category: clip(p.category, 40), source: typeof p.source === "string" ? clip(p.source, 300) : JSON.parse(JSON.stringify(p.source)) }));
  return { name: name.toLowerCase(), owner: clip(j.owner && j.owner.name, 100), plugins };
}

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

/** Installs one entry: → { ok, plugin } (the plugin to keep) or { error }. */
export async function downloadPlugin(mk, entry, { fetchFn = fetch } = {}) {
  const d = entryDownload(mk, entry);
  if (d.error) return { error: "Plugin " + entry.name + ": " + d.error };
  const got = await fetchLimited(d.url, { maxBytes: ARCHIVE_MAX, timeoutMs: ARCHIVE_MS, maxRedirects: ARCHIVE_REDIRECTS, what: "the plugin's archive", fetchFn });
  if (got.error) return { error: "Plugin " + entry.name + ": " + got.error };
  if (d.sha256) {
    const h = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", got.bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
    if (h !== d.sha256) return { error: "Plugin " + entry.name + ": the archive does not match its sha256" };
  }
  let root;
  if (d.top) {
    const entries = zipEntries(got.bytes);
    if (entries.error) return { error: "Plugin " + entry.name + ": " + entries.error };
    const top = (entries[0] && entries[0].name.split("/")[0]) || "";
    root = top + "/" + (d.root ? d.root + "/" : "");
  }
  const r = await pluginFromZip(got.bytes, { ...(root !== undefined ? { root } : {}), name: entry.name });
  if (r.error) return { error: "Plugin " + entry.name + ": " + r.error };
  return { ok: true, plugin: { ...r.plugin, name: entry.name, description: r.plugin.description.startsWith("Plugin ") && entry.description ? entry.description : r.plugin.description, marketplace: mk.name } };
}
