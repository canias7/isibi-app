// CODER'S FILE AND WEB TOOLS (owner, 2026-11-05: "you can add all of this").
// Read, Edit, Write, Grep, Glob, WebFetch and WebSearch, like Claude Code's.
//
// They run the same way as Coder's bash commands: as the unprivileged `dev`
// user, in the project's folder, with a bare environment (the agent calls
// `node coder-tools.mjs <base64 JSON>` through the same exec). So a tool can do
// nothing a bash command could not; they are just tidier and safer to use.
// File tools stay inside the project folder.
import { readFile, writeFile, mkdir, realpath, stat } from "node:fs/promises";
import { resolve, dirname, relative, isAbsolute, sep } from "node:path";
import { spawn } from "node:child_process";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export const READ_LINES = 400;
export const OUT_MAX = 30000;
const ROOT = process.cwd();

class ToolError extends Error {}
const fail = (m) => { throw new ToolError(m); };

/** A path inside the project, or an error. Links that lead outside are refused too. */
async function inside(p, { mustExist = false } = {}) {
  if (typeof p !== "string" || !p.trim()) fail("give a path");
  const abs = resolve(ROOT, p);
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

export async function toolRead({ path, offset = 1, limit = READ_LINES }) {
  const { abs, rel } = await inside(path, { mustExist: true });
  if ((await stat(abs)).isDirectory()) fail(rel + " is a folder; use glob to list it");
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
  const files = r.out.trim().split("\n").sort();
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
export function privateAddress(a) {
  const s = String(a).toLowerCase();
  if (s === "::1" || s === "::" || s.startsWith("fe80:") || s.startsWith("fc") || s.startsWith("fd")) return true;
  const v4 = s.startsWith("::ffff:") ? s.slice(7) : s;
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(v4);
  if (!m) return false;
  const [x, y] = [Number(m[1]), Number(m[2])];
  return x === 10 || x === 127 || x === 0 || (x === 169 && y === 254) || (x === 172 && y >= 16 && y <= 31) || (x === 192 && y === 168) || (x === 100 && y >= 64 && y <= 127) || x >= 224;
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

export async function toolWebFetch({ url }, fetchFn = fetch) {
  const r = await get(url, fetchFn);
  const type = r.headers.get("content-type") || "";
  const raw = (await r.text()).slice(0, 2_000_000);
  const text = /html/i.test(type) ? htmlToText(raw) : raw;
  return "HTTP " + r.status + " " + String(r.url || url) + "\n\n" + text.slice(0, OUT_MAX) + (text.length > OUT_MAX ? "\n[cut]" : "");
}

/** A free web search (DuckDuckGo's plain page): titles, addresses and snippets. */
export async function toolWebSearch({ query }, fetchFn = fetch) {
  if (typeof query !== "string" || !query.trim()) fail("give a query");
  const r = await get("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query.trim().slice(0, 300)), fetchFn);
  const html = await r.text();
  const results = [];
  // Each result: its link (class result__a), then its snippet before the next result.
  const starts = [...html.matchAll(/<a[^>]+class="result__a"/g)].map((m) => m.index);
  const parts = starts.map((s, k) => html.slice(s, starts[k + 1] ?? html.length));
  for (const part of parts) {
    if (results.length >= 8) break;
    const a = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(part);
    if (!a) continue;
    let href = a[1].replace(/&amp;/g, "&");
    const q = /[?&]uddg=([^&]+)/.exec(href);
    if (q) href = decodeURIComponent(q[1]);
    if (href.startsWith("//")) href = "https:" + href;
    const sn = /class="result__snippet"[^>]*>([\s\S]*?)<\/(a|div|td)>/.exec(part);
    results.push((results.length + 1) + ". " + htmlToText(a[2]) + "\n   " + href + (sn ? "\n   " + htmlToText(sn[1]).slice(0, 300) : ""));
  }
  if (r.status === 202 || /anomaly|captcha/i.test(html) && !results.length) return "the free search service is refusing searches from this machine right now; try web_fetch on a documentation page you know instead";
  return results.length ? results.join("\n\n") : "no results (the search page may have changed or be busy)";
}

export const TOOLS = { read: toolRead, write: toolWrite, edit: toolEdit, grep: toolGrep, glob: toolGlob, web_fetch: toolWebFetch, web_search: toolWebSearch };

// Run as a command: node coder-tools.mjs <base64 of {"tool": ..., "args": {...}}>
if (process.argv[1] && import.meta.url === "file://" + process.argv[1]) {
  (async () => {
    let req;
    try { req = JSON.parse(Buffer.from(String(process.argv[2] || ""), "base64").toString("utf8")); } catch { req = null; }
    const fn = req && TOOLS[req.tool];
    if (!fn) { process.stdout.write("error: unknown tool"); process.exit(2); }
    try { process.stdout.write(String(await fn(req.args || {}))); process.exit(0); }
    catch (e) { process.stdout.write("error: " + String((e && e.message) || e).slice(0, 600)); process.exit(1); }
  })();
}
