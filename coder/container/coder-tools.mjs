// CODER'S FILE AND WEB TOOLS (owner, 2026-11-05: "you can add all of this").
// Read, Edit, Write, Grep, Glob and WebFetch, like Claude Code's. (Web search is
// Grok's own, on xAI's side: no free search, owner 2026-11-05.)
//
// They run the same way as Coder's bash commands: as the unprivileged `dev`
// user, in the project's folder, with a bare environment (the agent calls
// `node coder-tools.mjs <base64 JSON>` through the same exec). So a tool can do
// nothing a bash command could not; they are just tidier and safer to use.
// File tools stay inside the project folder.
import { readFile, writeFile, mkdir, realpath, stat, lstat, unlink, open as openFile, mkdtemp, rm, readdir, rename } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, dirname, relative, isAbsolute, sep, extname, join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import { lookup } from "node:dns/promises";
import { lookup as lookupCb } from "node:dns";
import http from "node:http";
import https from "node:https";
import tls from "node:tls";
import { isIP, BlockList } from "node:net";

// HOW MUCH ONE READ GIVES (tool-by-tool comparison with Claude Code, 2026-11-08: Coder's read gave 400 lines and
// its answer was then cut to 12,000 characters, the middle dropped, so the middle of a long file could be missed;
// Claude Code's Read gives "at most 25,000 tokens" a call): about 100,000 characters of whole lines, so the whole
// file when it fits; a longer one comes in parts, read on with offset (limit asks for fewer lines).
export const READ_CHARS = 100_000;
export const READ_LINES_MAX = 100_000;
// ALL OF CLAUDE CODE'S READ RULES (its tools reference, read again 2026-11-08 at the owner's word "double check it
// against claude code docs"): a whole-file read over 256 KB is refused (read a part, or grep); a part asked for with
// offset/limit that does not fit is refused too; allow_large reads the whole file, or a long range, in one call,
// "sized against the room left" (Coder's agent says how much: max_chars, at most READ_LARGE_CHARS); pictures up to
// 128 MB (they are made smaller anyway); notebooks up to 100 MB, and an error when their cells come to over 256 KB.
export const READ_WHOLE_MAX = 256 * 1024;
export const READ_LARGE_CHARS = 400_000;
export const PIC_MAX_BYTES = 128 * 1024 * 1024;
export const NOTEBOOK_MAX_BYTES = 100 * 1024 * 1024;
export const NOTEBOOK_CELLS_MAX = 256 * 1024;
export const OUT_MAX = 30000;
export const WEB_MAX = 100_000;
const ROOT = process.cwd();

class ToolError extends Error {}
const fail = (m) => { throw new ToolError(m); };

/** A path inside the project, or an error. Links that lead outside are refused too. */
/** A NULL BYTE in a path or pattern (Claude Code's errors page: "Read file_path cannot contain null bytes (\0). Remove
 * the null byte and try again."): no file system or search tool takes one. */
const noNul = (s, what) => { if (String(s).includes("\0")) fail(what + " cannot contain null bytes (\\0). Remove the null byte and try again."); };
async function inside(p, { mustExist = false } = {}) {
  if (typeof p !== "string" || !p.trim()) fail("give a path");
  noNul(p, "the path");
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
  // THE CHAT'S OTHER REPOSITORIES (2026-11-06, like Claude Code's several repos
  // in one session): their folders, next to this one, count as inside too.
  const home = [ROOT, ...String(process.env.CODER_EXTRA_ROOTS || "").split(":").filter((x) => x && isAbsolute(x))].find((r) => { const x = relative(r, abs); return !x.startsWith("..") && !isAbsolute(x); }) || ROOT;
  const rel = relative(home, abs);
  if (rel.startsWith("..") || isAbsolute(rel)) fail("that path is outside the project");
  if (rel.split(sep)[0] === ".git") fail("the .git folder is off limits");
  // The deepest part that exists must really be inside (no link out of the project).
  let probe = abs;
  for (;;) {
    try {
      const real = await realpath(probe);
      const rootReal = await realpath(home);
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
async function plainText(abs, rel, max, tooBig = "use bash (head, tail, sed -n) for parts of it") {
  const st = await stat(abs);
  if (st.isDirectory()) fail(rel + " is a folder, not a file: list what is in it with glob, or a command such as ls");
  if (st.size > max) fail(rel + " is " + Math.round(st.size / 1048576) + " MB, too big for this tool; " + tooBig);
  const fh = await openFile(abs, "r");
  try { const b = Buffer.alloc(Math.min(8192, st.size)); await fh.read(b, 0, b.length, 0); if (b.includes(0)) fail(rel + " is a binary file (not text): see what it is with `file " + shq(rel) + "`, then use a command or a script that reads that kind of file"); } finally { await fh.close(); }
}
// ── PICTURES, PDFs AND NOTEBOOKS (owner item 1, 2026-11-07), like Claude Code's Read (its docs: it
// "reads images (PNG, JPG, …) and presents them visually", "reads PDFs via the pages parameter (max 20
// pages per request; required for PDFs over 10 pages)" and "reads Jupyter notebooks (.ipynb) as cells
// with outputs"). Grok takes JPG and PNG pictures (xAI's docs, read 2026-11-07), so any other kind is
// made a PNG first, and a big one smaller. A tool answers in text, so its pictures follow a mark that
// the agent takes them from (coder-agent.mjs), to show Grok beside the answer. A text file's answer
// never starts with the mark: each of its lines starts with its number.
export const PICS_MARK = "\u0000coder-pictures\u0000";
/** All of one read's pictures, as base64: the machine passes on at most 1 MB of a command's output. */
// What one read's pictures may come to (base64): up to 20 PDF pages, each as a picture, under what Coder's machine
// passes on for a file tool's answer (TOOL_OUTPUT_MAX, 8 MB, in server.mjs).
export const PICS_BUDGET = 6_000_000;
/** One picture at most (base64), as before: a job keeps up to 24, and a request to Grok through Coder's server is at most 30 MB. */
export const PIC_ONE_MAX = 900_000;
/** A PDF's pages: at most this many at a time, and `pages` is needed past PDF_PAGES_FREE (as Claude Code's Read). */
export const PDF_PAGES_MAX = 20, PDF_PAGES_FREE = 10;
/** The text of a PDF's pages, or a notebook's cells, in one read. */
export const READ_TEXT_MAX = READ_CHARS;
/** The picture kinds read shows, by the file's ending (ImageMagick is told which: it never guesses from the contents). */
export const PIC_KINDS = { ".png": "png", ".jpg": "jpeg", ".jpeg": "jpeg", ".gif": "gif", ".webp": "webp", ".bmp": "bmp", ".tif": "tiff", ".tiff": "tiff" };
/** A picture's longest side once shown (a bigger one is made smaller first; then smaller still should it not fit). */
export const PIC_SIDES = [1600, 1200, 800];

/** Runs a program (no shell) with `input` on its stdin: { code, out (Buffer), err }; code -2 when it is not installed. */
function runProg(cmd, args, { input = null, timeoutMs = 40_000, max = 30 * 1024 * 1024 } = {}) {
  return new Promise((done) => {
    let p;
    try { p = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] }); } catch { return done({ code: -2, out: Buffer.alloc(0), err: "" }); }
    const out = [], err = []; let size = 0, over = false;
    const timer = setTimeout(() => { try { p.kill("SIGKILL"); } catch { /* gone */ } }, timeoutMs);
    p.stdout.on("data", (b) => { size += b.length; if (size > max) { over = true; try { p.kill("SIGKILL"); } catch { /* gone */ } } else out.push(b); });
    p.stderr.on("data", (b) => { if (err.length < 20) err.push(b); });
    p.on("error", (e) => { clearTimeout(timer); done({ code: e && e.code === "ENOENT" ? -2 : -1, out: Buffer.alloc(0), err: String((e && e.message) || e) }); });
    p.on("close", (code) => { clearTimeout(timer); done({ code: over ? -1 : code, out: Buffer.concat(out), err: Buffer.concat(err).toString("utf8").replace(/\s+/g, " ").trim().slice(0, 300) }); });
    p.stdin.on("error", () => { /* it stopped reading */ });
    p.stdin.end(input || undefined);
  });
}

/** A PNG's or JPEG's width and height, from its first bytes (null for anything else). */
export function picSize(b) {
  if (!Buffer.isBuffer(b) || b.length < 24) return null;
  if (b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  for (let i = 2; i + 9 < b.length; ) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    if ((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf)) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

/**
 * A PICTURE AS GROK TAKES IT: { type, data (base64), w, h, bytes } within `budget` base64 characters, or { why }.
 * Through ImageMagick, from stdin with its kind named (never a file name it could read more into); without
 * ImageMagick, a PNG or JPEG as it is when it fits.
 */
export async function asPicture(buf, kind, budget = PICS_BUDGET) {
  const done = (type, b) => ({ type, data: b.toString("base64"), ...(picSize(b) || {}), bytes: b.length });
  const first = kind === "gif" || kind === "tiff" ? "[0]" : "";
  for (const side of PIC_SIDES) {
    for (const to of kind === "jpeg" ? ["jpeg"] : ["png", "jpeg"]) {
      const r = await runProg("convert", [kind + ":-" + first, "-auto-orient", "-resize", side + "x" + side + ">", "-strip", ...(to === "jpeg" ? ["-background", "white", "-flatten", "-quality", "85"] : []), to + ":-"], { input: buf });
      if (r.code === -2) {
        if ((kind === "png" || kind === "jpeg") && Math.ceil(buf.length / 3) * 4 <= budget) return done("image/" + kind, buf);
        return { why: kind === "png" || kind === "jpeg" ? "it is too big to show without ImageMagick" : "this machine cannot turn a " + kind.toUpperCase() + " into a PNG (no ImageMagick)" };
      }
      if (r.code !== 0 || !r.out.length) return { why: "it could not be opened as a picture" + (r.err ? " (" + r.err + ")" : "") };
      if (Math.ceil(r.out.length / 3) * 4 <= budget) return done("image/" + to, r.out);
    }
  }
  return { why: "it is too big to show, even made smaller" };
}

const kb = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
const withPics = (text, pictures) => (pictures.length ? PICS_MARK + JSON.stringify({ text, pictures: pictures.map((p) => ({ type: p.type, data: p.data })) }) : text);
async function fileSize(abs, rel, max) {
  const st = await stat(abs);
  if (st.isDirectory()) fail(rel + " is a folder, not a file: list what is in it with glob, or a command such as ls");
  if (st.size > max) fail(rel + " is " + Math.round(st.size / 1048576) + " MB, too big for this tool");
  return st.size;
}

async function readPicture(abs, rel, kind) {
  const st = await stat(abs);
  if (st.isDirectory()) fail(rel + " is a folder, not a file: list what is in it with glob, or a command such as ls");
  if (st.size > PIC_MAX_BYTES) fail(rel + " is " + Math.round(st.size / 1048576) + " MB, over the 128 MB a picture may be: make a smaller copy with bash (e.g. convert, or crop the part you need) and read that");
  const size = st.size;
  const buf = await readFile(abs);
  const p = await asPicture(buf, kind, PIC_ONE_MAX);
  if (p.why) fail(rel + " cannot be shown: " + p.why);
  // A BIG PICTURE IS SHOWN SMALLER, and Coder is told so (Claude Code's docs: "Claude may see a downscaled version of a
  // large screenshot. If Claude misses fine pixel-level detail in a large image, ask it to crop the region you care
  // about, such as with ImageMagick via Bash, and then read the crop"): its real size, and how to crop.
  const real = picSize(buf);
  const shown = p.w && p.h ? p.w + "×" + p.h : "";
  const smaller = real && p.w && p.h && Math.max(real.w, real.h) > Math.max(p.w, p.h);
  return withPics("Picture: " + rel + " (" + (smaller ? real.w + "×" + real.h : shown ? shown : "") + (smaller || shown ? ", " : "") + kind.toUpperCase() + ", " + kb(size) + "), shown to you as a picture after these results" +
    (smaller ? ", made smaller (" + shown + "): for fine detail, crop the part you need with ImageMagick (e.g. convert " + shq(rel) + " -crop 800x600+0+0 /tmp/part.png) and read the crop." : "."), [p]);
}

/** "3", "2-7" (or "2–7") within 1..total: [from, to], or null. */
function pageRange(s, total) {
  const m = /^\s*(\d{1,5})\s*(?:[-–]\s*(\d{1,5})\s*)?$/.exec(String(s));
  if (!m) return null;
  const a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
  return a >= 1 && b >= a && b <= total ? [a, b] : null;
}

async function readPdf(abs, rel, pages) {
  await fileSize(abs, rel, READ_MAX_BYTES);
  const info = await runProg("pdfinfo", [abs]);
  if (info.code === -2) fail("this machine has no PDF reader (poppler); use bash");
  const total = Number((/^Pages:\s+(\d+)/m.exec(info.out.toString("utf8")) || [])[1]) || 0;
  if (/incorrect password|encrypted/i.test(info.err || "")) fail(rel + " is password protected; it cannot be read without its password");
  if (info.code !== 0 || !total) fail(rel + " is not a valid PDF; it could not be opened" + (info.err ? " (" + info.err + ")" : "") + ". If it should be one, try its text with bash (pdftotext)");
  const asked = String(pages == null ? "" : pages).trim();
  if (!asked && total > PDF_PAGES_FREE) fail(rel + " has " + total + " pages: give pages, e.g. \"1-5\" (at most " + PDF_PAGES_MAX + " at a time)");
  const range = asked ? pageRange(asked, total) : [1, total];
  if (!range) fail("pages must be one page or a range like \"1-5\", within the PDF's " + total + " page" + (total === 1 ? "" : "s"));
  if (range[1] - range[0] + 1 > PDF_PAGES_MAX) fail("at most " + PDF_PAGES_MAX + " pages at a time: ask for fewer (e.g. \"" + range[0] + "-" + (range[0] + PDF_PAGES_MAX - 1) + "\")");
  const t = await runProg("pdftotext", ["-f", String(range[0]), "-l", String(range[1]), "-layout", "-enc", "UTF-8", abs, "-"]);
  if (t.code !== 0) fail(rel + "'s text could not be read" + (t.err ? " (" + t.err + ")" : ""));
  const texts = t.out.toString("utf8").split("\f");
  const parts = [rel + ": PDF, " + total + " page" + (total === 1 ? "" : "s") + (asked ? ", pages " + range[0] + "-" + range[1] : "") + "; each page is also shown to you as a picture after these results, in order"];
  const pictures = []; let budget = PICS_BUDGET; let dir = null;
  try {
    for (let n = range[0]; n <= range[1]; n++) {
      const text = String(texts[n - range[0]] || "").replace(/[ \t]+$/gm, "").trim();
      // EVERY PAGE AS A PICTURE TOO (the owner, 2026-11-08: "Yes fix that too"), like Claude Code's Read, whose page
      // reads "render pages with pdftoppm": a chart or a layout on a page with text is seen as well, and its text is
      // kept. The pages share the read's room for pictures fairly, so all of them fit (smaller when there are many).
      if (!dir) dir = await mkdtemp(join(tmpdir(), "coder-pdf-"));
      const share = Math.min(PIC_ONE_MAX, Math.floor(budget / (range[1] - n + 1)));
      const r = await runProg("pdftoppm", ["-f", String(n), "-l", String(n), "-scale-to", "1400", "-png", "-singlefile", abs, join(dir, "p")]);
      const p = r.code === 0 ? await asPicture(await readFile(join(dir, "p.png")).catch(() => Buffer.alloc(0)), "png", share) : { why: "it could not be drawn" };
      if (p.why) { parts.push("--- Page " + n + " (not shown as a picture: " + p.why + (text ? "" : "; no text") + ") ---" + (text ? "\n" + text : "")); continue; }
      pictures.push(p); budget -= p.data.length;
      parts.push("--- Page " + n + " (picture " + pictures.length + (text ? "" : "; no text") + ") ---" + (text ? "\n" + text : ""));
    }
  } finally { if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {}); }
  let text = parts.join("\n\n");
  if (text.length > READ_TEXT_MAX) text = text.slice(0, READ_TEXT_MAX) + "\n[cut: the rest of these pages did not fit; read fewer pages at a time]";
  return withPics(text, pictures);
}

/** A JUPYTER NOTEBOOK as its cells with their outputs (pictures in them shown); null when it is not one. */
async function readNotebook(raw, rel) {
  let nb = null;
  try { nb = JSON.parse(raw); } catch { return null; }
  if (!nb || !Array.isArray(nb.cells)) return null;
  const str = (x) => (Array.isArray(x) ? x.join("") : x == null ? "" : String(x));
  const plain = (x) => str(x).replace(/\u001b\[[0-9;]*[A-Za-z]/g, "");
  const parts = [rel + ": Jupyter notebook, " + nb.cells.length + " cell" + (nb.cells.length === 1 ? "" : "s")];
  const pictures = []; let budget = PICS_BUDGET;
  for (const [i, c] of nb.cells.entries()) {
    if (!c || typeof c !== "object") continue;
    parts.push("--- Cell " + (i + 1) + " (" + String(c.cell_type || "code") + (Number.isInteger(c.execution_count) ? ", run " + c.execution_count : "") + (typeof c.id === "string" && c.id ? ", id " + c.id.slice(0, 40) : "") + ") ---\n" + str(c.source));
    for (const o of Array.isArray(c.outputs) ? c.outputs : []) {
      if (!o || typeof o !== "object") continue;
      if (o.output_type === "stream") { parts.push("[" + String(o.name || "stdout") + "]\n" + plain(o.text)); continue; }
      if (o.output_type === "error") { parts.push("[error] " + String(o.ename || "") + ": " + String(o.evalue || "") + "\n" + plain(Array.isArray(o.traceback) ? o.traceback.join("\n") : "")); continue; }
      const d = o.data && typeof o.data === "object" ? o.data : {};
      const img = d["image/png"] ? ["png", d["image/png"]] : d["image/jpeg"] ? ["jpeg", d["image/jpeg"]] : null;
      if (img) {
        const p = budget > 0 ? await asPicture(Buffer.from(str(img[1]).replace(/\s+/g, ""), "base64"), img[0], Math.min(PIC_ONE_MAX, budget)) : { why: "too many pictures for one read" };
        if (p.why) parts.push("[picture output, not shown: " + p.why + "]");
        else { pictures.push(p); budget -= p.data.length; parts.push("[picture output: shown to you as picture " + pictures.length + " after these results]"); }
        continue;
      }
      if (d["text/plain"] != null) parts.push("[output]\n" + plain(d["text/plain"]));
      else if (d["text/html"] != null) parts.push("[html output]\n" + str(d["text/html"]).slice(0, 2000));
    }
  }
  const text = parts.join("\n\n");
  if (Buffer.byteLength(text) > NOTEBOOK_CELLS_MAX || text.length > READ_CHARS) fail(rel + "'s cells come to " + kb(Buffer.byteLength(text)) + ", more than one read takes: read some of its cells with bash, e.g. jq '.cells[0:10]' " + rel);
  return withPics(text, pictures);
}

/**
 * FILES READ REFUSES BY THEIR KIND (Claude Code's docs: "Read refuses a file whose extension it treats as binary, such as
 * .xlsx, .parquet, .heic, or .zip. … the error suggests … a shell command or script that reads the format"), each with a
 * way to read it. Any other file is refused as binary when its start holds a NUL byte (plainText).
 */
const BINARY_KINDS = [
  [["zip", "jar", "war", "whl", "apk", "ipa", "nupkg"], "list it with `unzip -l FILE`, or print one file in it with `unzip -p FILE path/inside`"],
  [["tar", "gz", "tgz", "bz2", "xz", "zst", "7z", "rar"], "list it with `tar -tf FILE` (`7z l FILE` for 7z and rar), or print a compressed text file with `zcat` or `xzcat`"],
  [["xlsx", "xlsm", "xls", "ods"], "read it with a script, e.g. python3 with openpyxl or pandas (pip install them if they are missing)"],
  [["docx", "doc", "odt", "pptx", "ppt", "odp"], "read its text with a script, e.g. python3 with python-docx or python-pptx (for a .docx, `unzip -p FILE word/document.xml` also works)"],
  [["parquet", "avro", "orc", "feather", "arrow"], "read it with a script, e.g. python3 with pandas and pyarrow, or duckdb"],
  [["heic", "heif", "avif", "psd"], "make a PNG of it with a command (ImageMagick: `convert FILE /tmp/out.png`; for HEIC also heif-convert), then read the PNG"],
  [["sqlite", "sqlite3"], "open it with `sqlite3 FILE .tables`, then query it"],
  [["mp3", "m4a", "wav", "flac", "ogg", "aac", "mp4", "mov", "avi", "mkv", "webm"], "look at it with `ffprobe FILE`; for a video, take a frame as a picture with ffmpeg and read that"],
  [["exe", "dll", "so", "dylib", "o", "a", "class", "pyc", "wasm", "iso", "dmg"], "see what it is with `file FILE`, or its text parts with `strings FILE | head -n 50`"],
  [["ttf", "otf", "woff", "woff2", "eot"], "it is a font: see what it is with `file FILE`"],
];
const BINARY_HOW = new Map(BINARY_KINDS.flatMap(([exts, how]) => exts.map((e) => ["." + e, how])));
/** A path in single quotes, for a command shown to Coder. */
const shq = (p) => "'" + String(p).replace(/'/g, "'\\''") + "'";

export async function toolRead({ path, offset, limit, pages = "", allow_large = false, max_chars }) {
  const { abs, rel } = await inside(path, { mustExist: true });
  // A PIPE OR A DEVICE is refused, as Claude Code's Read does ("is a pipe or a device"): reading one could wait forever.
  const kind = await stat(abs);
  if (!kind.isFile() && !kind.isDirectory()) fail(rel + " is a pipe or a device, not a file; it cannot be read");
  const ext = extname(abs).toLowerCase();
  if (PIC_KINDS[ext]) return readPicture(abs, rel, PIC_KINDS[ext]);
  if (ext === ".pdf") return readPdf(abs, rel, pages);
  if (kind.isFile() && BINARY_HOW.has(ext)) fail(rel + " is a binary file (" + ext.slice(1).toUpperCase() + "), not text, so read does not open it: " + BINARY_HOW.get(ext).replace(/FILE/g, shq(rel)));
  if (ext === ".ipynb") {
    await plainText(abs, rel, NOTEBOOK_MAX_BYTES, "read some of its cells with bash, e.g. jq '.cells[0:10]' " + rel);
    const nb = await readNotebook(await readFile(abs, "utf8"), rel);
    if (nb !== null) return nb;
  }
  await plainText(abs, rel, READ_MAX_BYTES);
  const buf = await readFile(abs);
  const text = buf.toString("utf8");
  await remember(abs, buf);
  if (!text.length) return rel + " exists, but it is empty.";
  const lines = text.split("\n");
  if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop(); // the last newline ends a line; it is not one
  const total = lines.length;
  const asked = (offset !== undefined && offset !== null && offset !== "") || Number(limit) > 0;
  const from = Math.max(1, Math.floor(Number(offset) || 1));
  if (from > total) return rel + " has " + total + " line" + (total === 1 ? "" : "s") + ": offset " + from + " is past its end.";
  const large = allow_large === true;
  const cap = large ? Math.min(Math.max(Math.floor(Number(max_chars) || 0), READ_CHARS), READ_LARGE_CHARS) : READ_CHARS;
  const size = Buffer.byteLength(text);
  if (!asked && !large && size > READ_WHOLE_MAX) fail(rel + " is " + kb(size) + ", over the 256 KB a whole read takes: read a part with offset and limit, search it with grep, or set allow_large when you truly need all of it at once");
  const want = Number(limit) > 0 ? Math.min(Math.floor(Number(limit)), READ_LINES_MAX) : READ_LINES_MAX;
  const end = Math.min(total, from - 1 + want);
  const rowOf = (i) => String(i + 1).padStart(6) + "\t" + (lines[i].length > 2000 ? lines[i].slice(0, 2000) + "…" : lines[i]);
  // How many lines from index `start` fit in one usual read: the limit to suggest next (exact, as lines differ).
  const fitting = (start) => { let u = 0, k = 0; for (let i = start; i < total && k < READ_LINES_MAX; i++) { const r = rowOf(i).length + 1; if (k && u + r > READ_CHARS) break; u += r; k++; } return k; };
  const rows = [];
  let used = 0;
  for (let i = from - 1; i < end; i++) {
    const row = rowOf(i);
    if (rows.length && used + row.length + 1 > cap) break; // whole lines only, never a cut in the middle
    rows.push(row);
    used += row.length + 1;
  }
  const last = from - 1 + rows.length;
  // A part that was asked for and does not fit is refused, as in Claude Code; a whole-file read gets its first part.
  if (asked && last < end) fail("lines " + from + "-" + end + " of " + rel + " come to more than about " + Math.round(cap / 1000) + ",000 characters: ask for fewer lines (limit), search with grep" + (large ? "" : ", or set allow_large when you truly need them all at once"));
  const body = rows.join("\n");
  if (last >= total) return body;
  const next = "offset " + (last + 1) + " and limit " + fitting(last);
  return body + (asked
    ? "\n[lines " + from + "-" + last + " of " + total + "; read more with " + next + "]"
    : "\n[PARTIAL view: lines " + from + "-" + last + " of " + total + " (about " + kb(Buffer.byteLength(lines.slice(from - 1, last).join("\n")) + 1) + " of " + kb(size) + "). Read more with " + next + "]");
}

export async function toolWrite({ path, content }) {
  const { abs, rel } = await inside(path);
  if (typeof content !== "string") fail("give the file's content");
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, content);
  await remember(abs, Buffer.from(content));
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
  await remember(abs, Buffer.from(out));
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
  noNul(pattern, "the pattern");
  if (glob != null) noNul(glob, "the glob");
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
  noNul(pattern, "the pattern");
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
  // Up to 100,000 characters, like Claude Code's WebFetch: a separate reader reads it, not Coder (2026-11-06).
  return "HTTP " + r.status + " " + String(r.url || url) + "\n\n" + text.slice(0, WEB_MAX) + (text.length > WEB_MAX ? "\n[cut]" : "");
}

export async function toolLsp({ action, path, line, column }) {
  const { abs, rel } = await inside(path, { mustExist: true });
  const { runLsp } = await import("./coder-lsp.mjs");
  return runLsp({ action, path: rel, abs, line, column }, ROOT);
}

/**
 * WHEN THE FILES CODER WORKED ON LAST CHANGED, for Coder's app only (no tool Grok has; RUN_TOOLS in coder-agent.mjs
 * lists those): after a long job is summarized, the most recently changed ones are read again, like Claude Code.
 */
export async function toolMtimes({ paths }) {
  const out = [];
  for (const p of (Array.isArray(paths) ? paths : []).slice(0, 50)) {
    try { const { abs } = await inside(String(p), { mustExist: true }); const st = await stat(abs); if (st.isFile()) out.push({ path: showPath(abs), mtime: st.mtimeMs }); } catch { /* gone, or not the project's */ }
  }
  return JSON.stringify(out);
}

/**
 * WHAT IS IN A FOLDER, for Coder's app only (no tool Grok has): an @-mentioned folder comes into the owner's message
 * as its listing (Claude Code's docs: "Directory references show file listings, not contents"). Its folders end in /.
 */
export const LISTING_MAX = 300;
export async function toolListing({ path }) {
  const { abs, rel } = await inside(String(path || ""), { mustExist: true });
  if (!(await stat(abs)).isDirectory()) fail(rel + " is not a folder");
  const all = (await readdir(abs, { withFileTypes: true })).filter((d) => d.name !== ".git").map((d) => d.name + (d.isDirectory() ? "/" : "")).sort();
  if (!all.length) return "(an empty folder)";
  return all.slice(0, LISTING_MAX).join("\n") + (all.length > LISTING_MAX ? "\n[" + (all.length - LISTING_MAX) + " more]" : "");
}

/**
 * A NOTE WHEN A COMMAND CHANGES A FILE CODER READ (the owner, 2026-11-08: "Yes do that too"; Claude Code's docs,
 * "Context Claude Code adds on its own": "A note when a file Claude read earlier changes on disk"). What Claude Code
 * really does, as the owner's two tests in Claude Code showed: a command that changed a file Claude had read says so in
 * its result ("This command modified 1 file you've previously read … Call Read before editing", seen in Claude Code's
 * own session), and a file changed any other way (by a command in the background, or between messages) gets no note.
 * So for each text file Coder reads, writes or edits (up to 256 KB), the file tools keep its time, size and a
 * fingerprint of its bytes in CODER_SEEN_DIR (a folder Coder's app makes for each chat, outside the project; it lasts
 * between messages), at most SEEN_FILES of them, the oldest let go first. The `changed` tool says which changed since.
 */
export const SEEN_FILES = 100;
const seenDir = () => { const d = String(process.env.CODER_SEEN_DIR || ""); return d && isAbsolute(d) ? d : ""; };
const fingerprint = (buf) => createHash("sha256").update(buf).digest("hex");
async function seenList(dir) {
  try { const j = JSON.parse(await readFile(join(dir, "index.json"), "utf8")); return Array.isArray(j) ? j.filter((x) => x && typeof x.abs === "string" && isAbsolute(x.abs) && typeof x.hash === "string") : []; } catch { return []; }
}
async function seenSave(dir, list) { const tmp = join(dir, "index.json." + process.pid + ".tmp"); await writeFile(tmp, JSON.stringify(list)); await rename(tmp, join(dir, "index.json")); }
/** A file's path as the tools take it: from the project's folder, or whole for one of the chat's other repositories. */
function showPath(abs) { const r = relative(ROOT, abs); return r && !r.startsWith("..") && !isAbsolute(r) ? r : abs; }
/** Notes a text file as Coder now knows it, after a read, a write or an edit (not the memory file). */
async function remember(abs, buf) {
  const dir = seenDir();
  const mem = process.env.CODER_MEMORY_FILE;
  if (!dir || (mem && abs === resolve(mem))) return;
  try {
    const st = await stat(abs);
    const list = (await seenList(dir)).filter((x) => x.abs !== abs);
    if (st.isFile() && buf.length <= READ_WHOLE_MAX) list.push({ abs, mtime: st.mtimeMs, size: st.size, hash: fingerprint(buf) }); // a bigger one is not followed
    while (list.length > SEEN_FILES) list.shift();
    await seenSave(dir, list);
  } catch { /* never costs the tool */ }
}
/**
 * WHICH FILES CHANGED since Coder last read or changed them, for Coder's app only (no tool Grok has):
 * { followed, changed: [{ path } | { path, gone: true }] }, and the files brought up to date. A file only touched (the
 * same bytes) is no change; one grown past 256 KB is a change, and is not followed after.
 */
export async function toolChanged({ reset = false } = {}) {
  const dir = seenDir();
  // A CHAT WITH NO HISTORY (new, or Rewind went back to its very start; the review, 2026-11-08): what Coder read before
  // is no longer in its conversation, so none of it is followed (else a rewind's changes were put down to a command).
  if (dir && reset === true) { await seenSave(dir, []).catch(() => {}); return JSON.stringify({ followed: 0, changed: [] }); }
  const list = dir ? await seenList(dir) : [];
  const keep = [], changed = [];
  let dirty = false;
  for (const x of list) {
    let st = null;
    try { await inside(x.abs, { mustExist: true }); st = await stat(x.abs); } catch { st = null; }
    const path = showPath(x.abs);
    if (!st || !st.isFile()) { changed.push({ path, gone: true }); dirty = true; continue; }
    if (st.mtimeMs === x.mtime && st.size === x.size) { keep.push(x); continue; }
    dirty = true;
    if (st.size > READ_WHOLE_MAX) { changed.push({ path }); continue; }
    let hash;
    try { hash = fingerprint(await readFile(x.abs)); } catch { changed.push({ path, gone: true }); continue; }
    if (hash !== x.hash) changed.push({ path });
    keep.push({ ...x, mtime: st.mtimeMs, size: st.size, hash });
  }
  if (dirty) await seenSave(dir, keep).catch(() => {});
  return JSON.stringify({ followed: keep.length, changed });
}

export const TOOLS = { lsp: toolLsp, read: toolRead, write: toolWrite, edit: toolEdit, grep: toolGrep, glob: toolGlob, web_fetch: toolWebFetch, mtimes: toolMtimes, listing: toolListing, changed: toolChanged };

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
    // Exits once all of it is written: a pipe takes a big answer (a picture) in parts, and exiting at once cut it off.
    const say = (text, code) => process.stdout.write(text, () => process.exit(code));
    if (!fn) return say("error: unknown tool", 2);
    let text;
    try { text = String(await fn(req.args || {})); }
    catch (e) { return say("error: " + String((e && e.message) || e).slice(0, 600), 1); }
    say(text, 0);
  })();
}
