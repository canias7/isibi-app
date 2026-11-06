// CODER'S FILE AND WEB TOOLS (owner, 2026-11-05: "you can add all of this").
// Read, Edit, Write, Grep, Glob and WebFetch, like Claude Code's. (Web search is
// Grok's own, on xAI's side: no free search, owner 2026-11-05.)
//
// They run the same way as Coder's bash commands: as the unprivileged `dev`
// user, in the project's folder, with a bare environment (the agent calls
// `node coder-tools.mjs <base64 JSON>` through the same exec). So a tool can do
// nothing a bash command could not; they are just tidier and safer to use.
// File tools stay inside the project folder.
import { readFile, writeFile, mkdir, realpath, stat, lstat, unlink, open as openFile } from "node:fs/promises";
import { resolve, dirname, relative, isAbsolute, sep } from "node:path";
import { spawn } from "node:child_process";
import { lookup } from "node:dns/promises";
import { lookup as lookupCb } from "node:dns";
import http from "node:http";
import https from "node:https";
import tls from "node:tls";
import { isIP, BlockList } from "node:net";

export const READ_LINES = 400;
export const OUT_MAX = 30000;
const ROOT = process.cwd();

class ToolError extends Error {}
const fail = (m) => { throw new ToolError(m); };

/** A path inside the project, or an error. Links that lead outside are refused too. */
async function inside(p, { mustExist = false } = {}) {
  if (typeof p !== "string" || !p.trim()) fail("give a path");
  const abs = resolve(ROOT, p);
  // CODER'S OWN MEMORY FILE (owner, 2026-11-06): the one file outside the project
  // the file tools may open, so remembering doesn't show a failed step. Only that
  // exact path, and never through a link.
  const mem = process.env.CODER_MEMORY_FILE;
  if (mem && isAbsolute(mem) && abs === resolve(mem)) {
    let st = null; try { st = await lstat(abs); } catch { /* not made yet */ }
    if (st && !st.isFile()) fail("the memory file is not a plain file");
    if (!st && mustExist) fail("no such file: " + abs);
    return { abs, rel: abs };
  }
  const rel = relative(ROOT, abs);
  if (rel.startsWith("..") || isAbsolute(rel)) fail("that path is outside the project");
  if (rel.split(sep)[0] === ".git") fail("the .git folder is off limits");
  // The deepest part that exists must really be inside (no link out of the project).
  let probe = abs;
  for (;;) {
    try {
      const real = await realpath(probe);
      const rootReal = await realpath(ROOT);
      const r2 = relative(rootReal, real);
      if (r2.startsWith("..") || isAbsolute(r2)) fail("that path leads outside the project");
      break;
    } catch (e) {
      if (e instanceof ToolError) throw e;
      if (mustExist) fail("no such file: " + rel);
      const up = dirname(probe);
      if (up === probe) break;
      probe = up;
    }
  }
  return { abs, rel };
}

// THE AUDIT (2026-11-05): huge files would fill the memory, and binary ones come out as garbage (and editing corrupts them).
export const READ_MAX_BYTES = 20 * 1024 * 1024;
export const EDIT_MAX_BYTES = 5 * 1024 * 1024;
async function plainText(abs, rel, max) {
  const st = await stat(abs);
  if (st.isDirectory()) fail(rel + " is a folder; use glob to list it");
  if (st.size > max) fail(rel + " is " + Math.round(st.size / 1048576) + " MB, too big for this tool; use bash (head, tail, sed -n) for parts of it");
  const fh = await openFile(abs, "r");
  try { const b = Buffer.alloc(Math.min(8192, st.size)); await fh.read(b, 0, b.length, 0); if (b.includes(0)) fail(rel + " is a binary file (not text); use bash to work with it"); } finally { await fh.close(); }
}
export async function toolRead({ path, offset = 1, limit = READ_LINES }) {
  const { abs, rel } = await inside(path, { mustExist: true });
  await plainText(abs, rel, READ_MAX_BYTES);
  const text = await readFile(abs, "utf8");
  const lines = text.split("\n");
  const from = Math.max(1, Number(offset) || 1);
  const n = Math.min(Math.max(1, Number(limit) || READ_LINES), 2000);
  const part = lines.slice(from - 1, from - 1 + n);
  const body = part.map((l, i) => String(from + i).padStart(6) + "\t" + (l.length > 2000 ? l.slice(0, 2000) + "…" : l)).join("\n");
  const more = from - 1 + n < lines.length ? "\n[" + (lines.length - (from - 1 + n)) + " more lines: read again with offset " + (from + n) + "]" : "";
  return (body || "(empty file)") + more;
}

export async function toolWrite({ path, content }) {
  const { abs, rel } = await inside(path);
  if (typeof content !== "string") fail("give the file's content");
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, content);
  return "wrote " + rel + " (" + content.split("\n").length + " lines)";
}

export async function toolEdit({ path, old_string, new_string, replace_all = false }) {
  const { abs, rel } = await inside(path, { mustExist: true });
  if (typeof old_string !== "string" || !old_string) fail("give old_string: the exact text to replace");
  if (typeof new_string !== "string") fail("give new_string");
  if (old_string === new_string) fail("old_string and new_string are the same");
  await plainText(abs, rel, EDIT_MAX_BYTES);
  const text = await readFile(abs, "utf8");
  const count = text.split(old_string).length - 1;
  if (count === 0) fail("old_string was not found in " + rel + ". Read the file and copy the text exactly, spaces included.");
  if (count > 1 && !replace_all) fail("old_string appears " + count + " times in " + rel + ". Add more lines around it so it is unique, or set replace_all.");
  const out = replace_all ? text.split(old_string).join(new_string) : text.replace(old_string, () => new_string);
  await writeFile(abs, out);
  return "edited " + rel + " (" + (replace_all ? count : 1) + " place" + ((replace_all ? count : 1) > 1 ? "s" : "") + ")";
}

function run(cmd, args) {
  return new Promise((done) => {
    let out = "";
    const p = spawn(cmd, args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    p.stdout.on("data", (b) => { if (out.length < OUT_MAX * 2) out += b; });
    p.stderr.on("data", (b) => { if (out.length < OUT_MAX * 2) out += b; });
    p.on("error", (e) => done({ code: -1, out: e.message }));
    p.on("close", (code) => done({ code, out }));
  });
}

export async function toolGrep({ pattern, path = ".", glob, ignore_case = false }) {
  if (typeof pattern !== "string" || !pattern) fail("give a pattern");
  const { rel } = await inside(path);
  const args = ["-n", "--no-heading", "--color", "never", "--max-columns", "300", "--glob", "!.git"];
  if (ignore_case) args.push("-i");
  if (typeof glob === "string" && glob) args.push("--glob", glob);
  args.push("--", pattern, rel || ".");
  const r = await run("rg", args);
  if (r.code === 1) return "no matches";
  if (r.code !== 0) fail(r.out.trim().slice(0, 500) || "the search failed");
  const lines = r.out.trimEnd().split("\n");
  return lines.slice(0, 200).join("\n") + (lines.length > 200 ? "\n[" + (lines.length - 200) + " more matches: narrow the search]" : "");
}

export async function toolGlob({ pattern, path = "." }) {
  if (typeof pattern !== "string" || !pattern) fail("give a pattern, e.g. src/**/*.js");
  const { rel } = await inside(path);
  const r = await run("rg", ["--files", "--hidden", "--glob", "!.git", "--glob", pattern, rel || "."]);
  if (r.code === 1 || !r.out.trim()) return "no files match " + pattern;
  if (r.code !== 0) fail(r.out.trim().slice(0, 500));
  const files = r.out.trim().split("\n").filter((f) => !/(^|\/)\.git(\/|$)/.test(f)).sort();
  return files.slice(0, 300).join("\n") + (files.length > 300 ? "\n[" + (files.length - 300) + " more]" : "");
}

/** Public web addresses only: never this machine or a private network. */
export async function publicUrl(u) {
  let url;
  try { url = new URL(String(u)); } catch { fail("that is not a web address"); }
  if (url.protocol !== "https:" && url.protocol !== "http:") fail("only http and https addresses");
  if (url.username || url.password) fail("no passwords in addresses");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addrs = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => fail("could not find " + host))).map((a) => a.address);
  for (const a of addrs) if (privateAddress(a)) fail("that address is on a private network");
  return url;
}
// THE AUDIT (2026-11-05): every private, local and special range, in all its
// written forms (IPv4-mapped IPv6 like ::ffff:7f00:1, NAT64, 6to4, site-local…).
const BLOCK4 = new BlockList(), BLOCK6 = new BlockList();
for (const [a, n] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 3]]) BLOCK4.addSubnet(a, n, "ipv4");
for (const [a, n] of [["::", 128], ["::1", 128], ["::", 96], ["::ffff:0:0", 96], ["64:ff9b::", 96], ["64:ff9b:1::", 48], ["100::", 64], ["2001::", 32], ["2001:db8::", 32], ["2002::", 16], ["fc00::", 7], ["fe80::", 10], ["fec0::", 10], ["ff00::", 8]]) BLOCK6.addSubnet(a, n, "ipv6");
export function privateAddress(a) {
  const s = String(a).toLowerCase().replace(/^\[|\]$/g, "");
  const v = isIP(s);
  if (!v) return true; // not an address we understand: refuse
  if (v === 4) return BLOCK4.check(s, "ipv4");
  // An IPv4 address written inside IPv6 (::ffff:a.b.c.d or ::ffff:7f00:1) is checked as IPv4 too.
  const m = /^::ffff:(?:(\d+\.\d+\.\d+\.\d+)|([0-9a-f]{1,4}):([0-9a-f]{1,4}))$/.exec(s);
  if (m) { const v4 = m[1] || [parseInt(m[2], 16) >> 8, parseInt(m[2], 16) & 255, parseInt(m[3], 16) >> 8, parseInt(m[3], 16) & 255].join("."); if (BLOCK4.check(v4, "ipv4")) return true; }
  return BLOCK6.check(s, "ipv6");
}
/** A DNS lookup that refuses private addresses AT CONNECT TIME (no swap between checking and fetching). */
export function safeLookup(hostname, opts, cb) {
  lookupCb(hostname, { ...(typeof opts === "object" ? opts : {}), all: true }, (err, list) => {
    if (err) return cb(err);
    const ok = (list || []).filter((x) => !privateAddress(x.address));
    if (!ok.length || ok.length !== list.length) return cb(Object.assign(new Error("that address is on a private network"), { code: "EPRIVATE" }));
    if (opts && opts.all) return cb(null, ok);
    cb(null, ok[0].address, ok[0].family);
  });
}
/** fetch-like GET through http/https with safeLookup: `{ status, url, headers: { get }, text() }`. */
/** WITH THE REPO'S NETWORK LIST ON, web_fetch goes through Coder's proxy (the only way out), which checks the list. */
function viaProxy(url) {
  const p = process.env.CODER_NET_LIMITED === "1" && (process.env.HTTPS_PROXY || "");
  if (!p) return null;
  const px = new URL(p);
  if (url.protocol === "http:") return { host: px.hostname, port: px.port, path: url.href, headers: { host: url.host } };
  return { createConnection: (_o, cb) => {
    const c = http.request({ host: px.hostname, port: px.port, method: "CONNECT", path: url.hostname + ":" + (url.port || 443) });
    c.on("connect", (res, sock) => {
      if (res.statusCode !== 200) { sock.destroy(); return cb(new ToolError(res.statusCode === 403 ? "blocked by this repo's network list: " + url.hostname + " (ask the owner with propose_env, allow_host)" : "the proxy refused " + url.hostname)); }
      cb(null, tls.connect({ socket: sock, servername: url.hostname }));
    });
    c.on("error", (e) => cb(e));
    c.end();
  } };
}
export function pinnedFetch(u, { headers = {} } = {}) {
  const url = new URL(String(u));
  const mod = url.protocol === "https:" ? https : http;
  const px = viaProxy(url);
  return new Promise((done, no) => {
    const req = (px && px.path ? http.request({ ...px, method: "GET", headers: { ...headers, ...px.headers }, timeout: 20000 }, onRes) : mod.request(url, { method: "GET", headers, timeout: 20000, ...(px ? px : { lookup: safeLookup }) }, onRes));
    function onRes(res) {
      const chunks = []; let size = 0;
      res.on("data", (c) => { size += c.length; if (size <= 2_000_000) chunks.push(c); else res.destroy(); });
      res.on("end", () => done({ status: res.statusCode, url: url.href, headers: { get: (k) => { const v = res.headers[String(k).toLowerCase()]; return Array.isArray(v) ? v[0] : v ?? null; } }, text: async () => Buffer.concat(chunks).toString("utf8") }));
      res.on("error", no);
    }
    req.on("timeout", () => req.destroy(new Error("the page took too long")));
    req.on("error", (e) => no(e.code === "EPRIVATE" ? new ToolError("that address is on a private network") : e));
    req.end();
  });
}

export function htmlToText(html) {
  return String(html)
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|pre)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n\s*/g, "\n\n").trim();
}

async function get(url, fetchFn) {
  let u = await publicUrl(url);
  for (let hop = 0; hop < 5; hop++) {
    const r = await fetchFn(u, { redirect: "manual", headers: { "user-agent": "Coder (gofarther.dev)", accept: "text/html,text/plain,application/json;q=0.9,*/*;q=0.5" }, signal: AbortSignal.timeout(20000) });
    if (r.status >= 300 && r.status < 400 && r.headers.get("location")) { u = await publicUrl(new URL(r.headers.get("location"), u)); continue; }
    return r;
  }
  fail("too many redirects");
}

export async function toolWebFetch({ url }, fetchFn = pinnedFetch) {
  const r = await get(url, fetchFn);
  const type = r.headers.get("content-type") || "";
  const raw = (await r.text()).slice(0, 2_000_000);
  const text = /html/i.test(type) ? htmlToText(raw) : raw;
  return "HTTP " + r.status + " " + String(r.url || url) + "\n\n" + text.slice(0, OUT_MAX) + (text.length > OUT_MAX ? "\n[cut]" : "");
}

export async function toolLsp({ action, path, line, column }) {
  const { abs, rel } = await inside(path, { mustExist: true });
  const { runLsp } = await import("./coder-lsp.mjs");
  return runLsp({ action, path: rel, abs, line, column }, ROOT);
}

export const TOOLS = { lsp: toolLsp, read: toolRead, write: toolWrite, edit: toolEdit, grep: toolGrep, glob: toolGlob, web_fetch: toolWebFetch };

// Run as a command: node coder-tools.mjs <base64 of {"tool": ..., "args": {...}}>
if (process.argv[1] && import.meta.url === "file://" + process.argv[1]) {
  (async () => {
    let req;
    const arg = String(process.argv[2] || "");
    try {
      if (arg.startsWith("@")) { const f = arg.slice(1); req = JSON.parse(await readFile(f, "utf8")); await unlink(f).catch(() => {}); }
      else req = JSON.parse(Buffer.from(arg, "base64").toString("utf8"));
    } catch { req = null; }
    const fn = req && TOOLS[req.tool];
    if (!fn) { process.stdout.write("error: unknown tool"); process.exit(2); }
    try { process.stdout.write(String(await fn(req.args || {}))); process.exit(0); }
    catch (e) { process.stdout.write("error: " + String((e && e.message) || e).slice(0, 600)); process.exit(1); }
  })();
}
