// CODER'S FILE AND WEB TOOLS (owner, 2026-11-05: "you can add all of this").
// Read, Edit, Write, Grep, Glob and WebFetch, like Claude Code's. (Web search is
// Grok's own, on xAI's side: no free search, owner 2026-11-05.)
//
// They run the same way as Coder's bash commands: as the unprivileged `dev`
// user, in the project's folder, with a bare environment (the agent calls
// `node coder-tools.mjs <base64 JSON>` through the same exec). So a tool can do
// nothing a bash command could not; they are just tidier and safer to use.
// File tools stay inside the project folder.
import { readFile, writeFile, mkdir, realpath, stat, lstat, unlink, open as openFile, mkdtemp, rm, readdir, rename, chmod } from "node:fs/promises";
import { createHash } from "node:crypto";
import { isUtf8 } from "node:buffer";
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
/**
 * WHERE GROK'S COMMANDS ARE (the owner, 2026-11-08: "lets do it the claude code way"; tried in Claude Code: its Read takes a
 * short path from the folder a `cd` left it in, and its Grep and Glob search there and list what they find from there):
 * Coder's machine gives that folder (CODER_CWD) when it is not the project's. A short path then counts from it, and the
 * tools name files by their full paths (grep and glob: from the folder searched, as Claude Code's do). Every path is
 * still kept inside the project by `inside`.
 */
/** A missing file, named, with the folder a short path counts from (as Claude Code's Read says it). */
export const missingFile = (shown) => "no such file: " + shown + ". Note: your current working directory is " + BASE + ".";
const BASE = (() => { const c = process.env.CODER_CWD; return c && isAbsolute(c) && !c.includes("\0") ? resolve(c) : ROOT; })();

class ToolError extends Error {}
const fail = (m) => { throw new ToolError(m); };

/** A path inside the project, or an error. Links that lead outside are refused too. */
/**
 * A SCRATCH FOLDER the file tools may use besides the project (the review, 2026-11-08: read's crop hint pointed at /tmp,
 * which read refused): crops and conversions go there, never into the project, so nothing in it is saved to the branch.
 * Its files are named by their whole path.
 */
export const SCRATCH = "/tmp/coder-scratch";
/** A file read does not give as text (a picture, a PDF, a notebook, a binary kind): not read again after a summary. */
export function notTextKind(p) { const e = extname(String(p || "")).toLowerCase(); return !!(PIC_KINDS[e] || e === ".pdf" || e === ".ipynb" || BINARY_HOW.has(e)); }
/** A NULL BYTE in a path or pattern (Claude Code's errors page: "Read file_path cannot contain null bytes (\0). Remove
 * the null byte and try again."): no file system or search tool takes one. */
const noNul = (s, what) => { if (String(s).includes("\0")) fail(what + " cannot contain null bytes (\\0). Remove the null byte and try again."); };
async function inside(p, { mustExist = false, tool = "" } = {}) {
  if (typeof p !== "string" || !p.trim()) fail("give a path");
  // Named by its tool and argument, as Claude Code's are ("Read file_path cannot contain null bytes …"): write's so far
  // (the owner, 2026-11-09, write's docs pass); the other tools keep "the path" until their turn.
  noNul(p, tool ? tool + " path" : "the path");
  // A short path counts from where Grok's commands are (BASE).
  const abs = resolve(BASE, p);
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
  const home = [ROOT, SCRATCH, ...String(process.env.CODER_EXTRA_ROOTS || "").split(":").filter((x) => x && isAbsolute(x))].find((r) => { const x = relative(r, abs); return !x.startsWith("..") && !isAbsolute(x); }) || ROOT;
  const rel = relative(home, abs);
  if (rel.startsWith("..") || isAbsolute(rel)) fail("that path is outside the project");
  if (rel.split(sep)[0] === ".git") fail("the .git folder is off limits");
  // How the file is named in the tool's answer: from the project's folder, or by its full path when the commands are in
  // another folder (or it is in the scratch folder).
  const shown = home === SCRATCH || BASE !== ROOT ? abs : rel;
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
      // WHERE A SHORT PATH STARTS, said with it (the owner, 2026-11-08: "Ok do those fixes too"; Claude Code's Read,
      // tried side by side: "File does not exist. Note: your current working directory is /home/user/cc-test4."), so a
      // path given from the wrong folder is seen as such.
      if (mustExist) fail(missingFile(shown));
      const up = dirname(probe);
      if (up === probe) break;
      probe = up;
    }
  }
  return { abs, rel: shown };
}

// THE AUDIT (2026-11-05): huge files would fill the memory, and binary ones come out as garbage (and editing corrupts them).
export const READ_MAX_BYTES = 20 * 1024 * 1024;
// EDIT TAKES MUCH BIGGER FILES (edit, tool 3, 2026-11-09: Claude Code's Edit takes files up to about 1 GiB, "Fixed a
// potential out-of-memory crash when the Edit tool was used on very large files (>1 GiB)"; Coder's stopped at 5 MB). One
// JavaScript string holds about 512 MB, so 256 MB is where it stops here.
export const EDIT_MAX_BYTES = 256 * 1024 * 1024;
/** A UTF-16 TEXT FILE starts with a byte-order mark: FF FE (little-endian) or FE FF (big-endian). */
const utf16Of = (b) => (b.length >= 2 && b[0] === 0xff && b[1] === 0xfe ? "le" : b.length >= 2 && b[0] === 0xfe && b[1] === 0xff ? "be" : "");
/**
 * A FILE'S TEXT AS READ SHOWS IT: UTF-8, or UTF-16 when it starts with a byte-order mark (Claude Code 2.1.299: "Fixed
 * Read garbling UTF-16LE files with a byte-order mark"; Windows tools often write them). Bytes that do not decode show
 * as U+FFFD, as in Claude Code ("the character Read shows Claude in place of bytes it can't decode").
 */
export function fileText(buf) {
  const u = utf16Of(buf);
  if (u === "le") return buf.subarray(2).toString("utf16le");
  if (u === "be") { const b = Buffer.from(buf.subarray(2, 2 + ((buf.length - 2) & ~1))); b.swap16(); return b.toString("utf16le") + (buf.length % 2 ? "\ufffd" : ""); }
  return buf.toString("utf8");
}
/**
 * A FOLDER, NOT A FILE (Claude Code's docs: "Read only reads files, not directories. Claude lists directory contents with
 * a shell command such as ls"). Named by its full path, as Claude Code's Read names it ("EISDIR: illegal operation on a
 * directory, read '/home/user'", tried 2026-11-08), so the project's own folder (`.`) is never a blank (the live
 * comparison, 2026-11-08: "error:  is a folder"); with how to see what is in it (the owner: "ur suggestion yes").
 */
const folderError = (abs) => abs + " is a folder, not a file: list what is in it with glob, or a command such as ls";
async function plainText(abs, rel, max, tooBig = "use bash (head, tail, sed -n) for parts of it", { utf16 = false } = {}) {
  const st = await stat(abs);
  if (st.isDirectory()) fail(folderError(abs));
  if (st.size > max) fail(rel + " is " + Math.round(st.size / 1048576) + " MB, too big for this tool; " + tooBig);
  const fh = await openFile(abs, "r");
  try { const b = Buffer.alloc(Math.min(8192, st.size)); await fh.read(b, 0, b.length, 0); if (b.includes(0) && !(utf16 && utf16Of(b))) fail(rel + " is a binary file (not text): see what it is with `file " + shq(rel) + "`, then use a command or a script that reads that kind of file"); } finally { await fh.close(); }
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
/**
 * A picture's longest side once shown (a bigger one is made smaller first; then smaller still should it not fit).
 * 2000 like Claude Code's (the owner, 2026-11-08: "Yea fix those 4"; tried side by side: a 6000×4000 picture was
 * "displayed at 2000x1333"); 1600 before.
 */
export const PIC_SIDES = [2000, 1600, 1200, 800];

/** Runs a program (no shell) with `input` on its stdin: { code, out (Buffer), err }; code -2 when it is not installed. */
function runProg(cmd, args, { input = null, timeoutMs = 40_000, max = 30 * 1024 * 1024 } = {}) {
  return new Promise((done) => {
    let p;
    // Never in the project's folder (the review, 2026-11-08: a read must not run the repository's code, as Python did
    // with a pypdf.py of the repo's): every path given to these programs is whole.
    try { p = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"], cwd: tmpdir() }); } catch { return done({ code: -2, out: Buffer.alloc(0), err: "" }); }
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
      const r = await runProg("convert", [kind + ":-" + first, "-auto-orient", "-colorspace", "sRGB", "-resize", side + "x" + side + ">", "-strip", ...(to === "jpeg" ? ["-background", "white", "-flatten", "-quality", "85"] : []), to + ":-"], { input: buf });
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
const withPics = (text, pictures, extra = {}) => (pictures.length ? PICS_MARK + JSON.stringify({ text, pictures: pictures.map((p) => ({ type: p.type, data: p.data })), ...extra }) : text);
/**
 * A SMALL COPY OF A PICTURE FOR THE CHAT (the owner, 2026-11-08: "Fix those 3"; Claude Code shows the picture its Read
 * opened in the chat): a JPEG at most THUMB_SIDE on its longest side, as a data URL, or "" when it cannot be made small.
 */
export const THUMB_SIDE = 320, THUMB_MAX = 60_000;
/**
 * THE SMALL COPIES OF A PDF'S PAGES OR A NOTEBOOK'S CHARTS (the owner, 2026-11-08: "Do this pls": they did not show
 * under their step, as a picture read's does): at most STEP_THUMBS, the first ones, as the chat shows them.
 */
export const STEP_THUMBS = 4;
async function thumbsOf(pictures) {
  const out = [];
  for (const p of pictures.slice(0, STEP_THUMBS)) { const t = await thumbOf(Buffer.from(p.data, "base64"), p.type === "image/png" ? "png" : "jpeg"); if (t) out.push(t); }
  return out;
}
async function thumbOf(buf, kind) {
  const r = await runProg("convert", [kind + ":-" + (kind === "gif" || kind === "tiff" ? "[0]" : ""), "-auto-orient", "-colorspace", "sRGB", "-thumbnail", THUMB_SIDE + "x" + THUMB_SIDE + ">", "-strip", "-background", "white", "-flatten", "-quality", "70", "jpeg:-"], { input: buf, timeoutMs: 20_000, max: THUMB_MAX });
  const u = r.code === 0 && r.out.length ? "data:image/jpeg;base64," + r.out.toString("base64") : "";
  return u.length <= THUMB_MAX ? u : "";
}
async function fileSize(abs, rel, max) {
  const st = await stat(abs);
  if (st.isDirectory()) fail(folderError(abs));
  if (st.size > max) fail(rel + " is " + Math.round(st.size / 1048576) + " MB, too big for this tool");
  return st.size;
}

async function readPicture(abs, rel, kind) {
  const st = await stat(abs);
  if (st.isDirectory()) fail(folderError(abs));
  if (st.size > PIC_MAX_BYTES) fail(rel + " is " + Math.round(st.size / 1048576) + " MB, over the 128 MB a picture may be: make a smaller copy with bash (e.g. convert, or crop the part you need) and read that");
  const size = st.size;
  const buf = await readFile(abs);
  const p = await asPicture(buf, kind, PIC_ONE_MAX);
  if (p.why) fail(rel + " cannot be shown: " + p.why);
  // A BIG PICTURE IS SHOWN SMALLER, and Coder is told so (Claude Code's docs: "Claude may see a downscaled version of a
  // large screenshot. If Claude misses fine pixel-level detail in a large image, ask it to crop the region you care
  // about, such as with ImageMagick via Bash, and then read the crop"): its real size, how to map a place on it back to
  // the real picture (Claude Code's own note, tried side by side: "Multiply coordinates by 3.00 to map to original
  // image"), and how to crop.
  let real = picSize(buf);
  if (!real) {
    const id = await runProg("identify", ["-format", "%w %h\n", kind + ":-" + (kind === "gif" || kind === "tiff" ? "[0]" : "")], { input: buf, timeoutMs: 20_000, max: 4096 });
    const m = /^(\d+) (\d+)/.exec(String(id.out || ""));
    if (id.code === 0 && m) real = { w: Number(m[1]), h: Number(m[2]) };
  }
  const shown = p.w && p.h ? p.w + "×" + p.h : "";
  const smaller = real && p.w && p.h && Math.max(real.w, real.h) > Math.max(p.w, p.h);
  const thumb = await thumbOf(buf, kind);
  return withPics("Picture: " + rel + " (" + (smaller ? real.w + "×" + real.h : shown ? shown : "") + (smaller || shown ? ", " : "") + kind.toUpperCase() + ", " + kb(size) + "), shown to you as a picture after these results" +
    (smaller ? ", made smaller (" + shown + "; multiply coordinates by " + (Math.max(real.w, real.h) / Math.max(p.w, p.h)).toFixed(2) + " to map them to the real picture): for fine detail, crop the part you need with ImageMagick into the scratch folder (e.g. mkdir -p " + SCRATCH + " && convert " + shq(rel) + " -crop 800x600+0+0 " + SCRATCH + "/part.png) and read the crop." : "."), [p], thumb ? { thumb } : {});
}

/** "3", "2-7" (or "2–7") within 1..total: [from, to], or null. */
function pageRange(s, total) {
  const m = /^\s*(\d{1,5})\s*(?:[-–]\s*(\d{1,5})\s*)?$/.exec(String(s));
  if (!m) return null;
  const a = Number(m[1]), b = m[2] ? Number(m[2]) : a;
  return a >= 1 && b >= a && b <= total ? [a, b] : null;
}

/**
 * THE PAGES A PDF REALLY HAS (Claude Code 2.1.317: "Fixed a PDF's own metadata being able to make Read and @-mentions
 * under-count its pages"): poppler goes by the count the file states, so a PDF that says 3 pages but has 12 showed 3.
 * pypdf (on Coder's machine) counts the pages themselves; when the two differ, a copy with the true count is written
 * (as dev, in the read's own temporary folder) and read instead. Prints the true count, or nothing when it cannot tell.
 */
const PDF_PAGES_PY = [
  "import sys",
  "try:",
  "  import pypdf",
  "  r = pypdf.PdfReader(sys.argv[1])",
  "  if r.is_encrypted: sys.exit(0)",
  "  n = len(r.pages)",
  "  if n > 0 and n != int(sys.argv[2]):",
  "    w = pypdf.PdfWriter()",
  "    for p in r.pages: w.add_page(p)",
  "    with open(sys.argv[3], 'wb') as f: w.write(f)",
  "  print(n)",
  "except Exception:",
  "  pass",
].join("\n");

async function readPdf(abs, rel, pages) {
  await fileSize(abs, rel, READ_MAX_BYTES);
  const info = await runProg("pdfinfo", [abs]);
  if (info.code === -2) fail("this machine has no PDF reader (poppler); use bash");
  if (/incorrect password|encrypted/i.test(info.err || "")) fail(rel + " is password protected; it cannot be read without its password");
  let total = info.code === 0 ? Number((/^Pages:\s+(\d+)/m.exec(info.out.toString("utf8")) || [])[1]) || 0 : 0;
  const dir = await mkdtemp(join(tmpdir(), "coder-pdf-"));
  try {
    // A page count that is wrong (too low: pages hidden; too high: poppler gives up) is mended from the pages themselves.
    let src = abs, stated = 0;
    const fixed = join(dir, "true.pdf");
    const c = await runProg("python3", ["-I", "-c", PDF_PAGES_PY, abs, String(total), fixed], { timeoutMs: 30_000, max: 1024 });
    const real = Number(String(c.out || "").trim());
    if (Number.isInteger(real) && real > 0 && real !== total && (await stat(fixed).then((x) => x.size > 0, () => false))) { stated = total; total = real; src = fixed; }
    if (!total) fail(rel + " is not a valid PDF; it could not be opened" + (info.err ? " (" + info.err + ")" : "") + ". If it should be one, try its text with bash (pdftotext)");
    const says = src === abs ? "" : stated ? " (the file says " + stated + ", but it has " + total + ")" : " (its page count was broken: read from a mended copy)";
    const asked = String(pages == null ? "" : pages).trim();
    if (!asked && total > PDF_PAGES_FREE) fail(rel + " has " + total + " pages" + says + ": give pages, e.g. \"1-5\" (at most " + PDF_PAGES_MAX + " at a time)");
    const range = asked ? pageRange(asked, total) : [1, total];
    if (!range) fail("pages must be one page or a range like \"1-5\", within the PDF's " + total + " page" + (total === 1 ? "" : "s"));
    if (range[1] - range[0] + 1 > PDF_PAGES_MAX) fail("at most " + PDF_PAGES_MAX + " pages at a time: ask for fewer (e.g. \"" + range[0] + "-" + (range[0] + PDF_PAGES_MAX - 1) + "\")");
    const t = await runProg("pdftotext", ["-f", String(range[0]), "-l", String(range[1]), "-layout", "-enc", "UTF-8", src, "-"]);
    if (t.code !== 0) fail(rel + "'s text could not be read" + (t.err ? " (" + t.err + ")" : ""));
    const texts = t.out.toString("utf8").split("\f");
    const parts = [rel + ": PDF, " + total + " page" + (total === 1 ? "" : "s") + says + (asked ? ", pages " + range[0] + "-" + range[1] : "") + "; each page is also shown to you as a picture after these results, in order"];
    const pictures = []; let budget = PICS_BUDGET;
    for (let n = range[0]; n <= range[1]; n++) {
      const text = String(texts[n - range[0]] || "").replace(/[ \t]+$/gm, "").trim();
      // EVERY PAGE AS A PICTURE TOO (the owner, 2026-11-08: "Yes fix that too"), like Claude Code's Read, whose page
      // reads "render pages with pdftoppm": a chart or a layout on a page with text is seen as well, and its text is
      // kept. The pages share the read's room for pictures fairly, so all of them fit (smaller when there are many).
      const share = Math.min(PIC_ONE_MAX, Math.floor(budget / (range[1] - n + 1)));
      const r = await runProg("pdftoppm", ["-f", String(n), "-l", String(n), "-scale-to", "1400", "-png", "-singlefile", src, join(dir, "p")]);
      const p = r.code === 0 ? await asPicture(await readFile(join(dir, "p.png")).catch(() => Buffer.alloc(0)), "png", share) : { why: "it could not be drawn" };
      if (p.why) { parts.push("--- Page " + n + " (not shown as a picture: " + p.why + (text ? "" : "; no text") + ") ---" + (text ? "\n" + text : "")); continue; }
      pictures.push(p); budget -= p.data.length;
      parts.push("--- Page " + n + " (picture " + pictures.length + (text ? "" : "; no text") + ") ---" + (text ? "\n" + text : ""));
    }
    let text = parts.join("\n\n");
    if (text.length > READ_TEXT_MAX) text = text.slice(0, READ_TEXT_MAX) + "\n[cut: the rest of these pages did not fit; read fewer pages at a time]";
    const thumbs = await thumbsOf(pictures);
    return withPics(text, pictures, thumbs.length ? { thumbs } : {});
  } finally { await rm(dir, { recursive: true, force: true }).catch(() => {}); }
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
  const thumbs = await thumbsOf(pictures);
  return withPics(text, pictures, thumbs.length ? { thumbs } : {});
}

/**
 * FILES READ REFUSES BY THEIR KIND (Claude Code's docs: "Read refuses a file whose extension it treats as binary, such as
 * .xlsx, .parquet, .heic, or .zip. … the error suggests … a shell command or script that reads the format"), each with a
 * way to read it. Any other file is refused as binary when its start holds a NUL byte (plainText).
 */
const BINARY_KINDS = [
  [["zip", "jar", "war", "whl", "apk", "ipa", "nupkg", "epub"], "list it with `unzip -l FILE`, or print one file in it with `unzip -p FILE path/inside`"],
  [["tar", "gz", "tgz", "bz2", "xz", "zst", "7z", "rar"], "list it with `tar -tf FILE` (`7z l FILE` for 7z and rar), or print a compressed text file with `zcat` or `xzcat`"],
  [["xlsx", "xlsm", "xls", "ods"], "read it with a script, e.g. python3 with openpyxl or pandas (pip install them if they are missing)"],
  [["docx", "doc", "odt", "pptx", "ppt", "odp"], "read its text with a script, e.g. python3 with python-docx or python-pptx (for a .docx, `unzip -p FILE word/document.xml` also works)"],
  [["parquet", "avro", "orc", "feather", "arrow"], "read it with a script, e.g. python3 with pandas and pyarrow, or duckdb"],
  [["heic", "heif", "avif", "psd"], "make a PNG of it in the scratch folder with a command (ImageMagick: `mkdir -p /tmp/coder-scratch && convert FILE /tmp/coder-scratch/out.png`; for HEIC also heif-convert), then read the PNG"],
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
    const nbBuf = await readFile(abs);
    const nb = await readNotebook(nbBuf.toString("utf8"), rel);
    // Read, so write may replace it now (as Claude Code's Write, once a notebook is read), and a change to it is told.
    if (nb !== null) { await remember(abs, nbBuf); return nb; }
  }
  await plainText(abs, rel, READ_MAX_BYTES, undefined, { utf16: true });
  const buf = await readFile(abs);
  const text = fileText(buf);
  const oldText = !utf16Of(buf) && !isUtf8(buf) ? "\n" + NOT_UTF8_NOTE : "";
  await remember(abs, buf, { whole: false });
  if (!text.length) { await clearStart(abs); return rel + " exists, but it is empty."; }
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
  // WHOLE LINES, NEVER CUT (the owner, 2026-11-08: "Yea fix those 4"; Claude Code 2.1.319, tried side by side: a
  // 20,000-character line came back whole). Coder cut every line at 2,000 characters before, so the rest of a long line
  // (minified code, a long paragraph) was never seen.
  const rowOf = (i) => String(i + 1).padStart(6) + "\t" + lines[i];
  // A LINE TOO BIG FOR ONE READ BY ITSELF (Claude Code leaves it for a read of its own, "showing lines 1-1 of 4 … Call
  // Read with offset=2 limit=1", and that read is over its limit too): a whole read stops before it, and a read that
  // starts at it says so, with the ways to see it.
  const tooLong = (i) => "line " + (i + 1) + " of " + rel + " is " + kb(Buffer.byteLength(lines[i])) + " by itself, more than one read takes (about " + Math.round(cap / 1000) + ",000 characters): " + (large ? "" : "set allow_large to read it whole, or ") + "show a part of it with bash, e.g. sed -n " + (i + 1) + "p " + shq(rel) + " | cut -c1-50000";
  // How many lines from index `start` fit in one usual read: the limit to suggest next (exact, as lines differ).
  const fitting = (start) => { let u = 0, k = 0; for (let i = start; i < total && k < READ_LINES_MAX; i++) { const r = rowOf(i).length + 1; if (k && u + r > READ_CHARS) break; u += r; k++; } return k; };
  const rows = [];
  let used = 0;
  for (let i = from - 1; i < end; i++) {
    const row = rowOf(i);
    if (rows.length && used + row.length + 1 > cap) break; // whole lines only, never a cut in the middle
    if (!rows.length && row.length + 1 > cap) fail(tooLong(i));
    rows.push(row);
    used += row.length + 1;
  }
  const last = from - 1 + rows.length;
  // A part that was asked for and does not fit is refused, as in Claude Code; a whole-file read gets its first part.
  if (asked && last < end) fail("lines " + from + "-" + end + " of " + rel + " come to more than about " + Math.round(cap / 1000) + ",000 characters: ask for fewer lines (limit), search with grep" + (large ? "" : ", or set allow_large when you truly need them all at once"));
  const body = rows.join("\n");
  if (asked && (from > 1 || last < total)) await markPart(abs);
  if (last >= total) { if (!asked) await clearStart(abs); return body + oldText; }
  const next = "offset " + (last + 1) + " and limit " + fitting(last);
  if (!asked) await markPartial(abs); // write will not replace it until the rest is read
  return body + (asked
    ? "\n[lines " + from + "-" + last + " of " + total + "; read more with " + next + "]"
    : "\n[PARTIAL view: lines " + from + "-" + last + " of " + total + " (about " + kb(Buffer.byteLength(lines.slice(from - 1, last).join("\n")) + 1) + " of " + kb(size) + "). Read more with " + next + ". " + PARTIAL_HINT + "]") + oldText;
}
/**
 * WHAT A PARTIAL VIEW ADDS (the owner, 2026-11-08: "ok yes"; Claude Code's own note, tried in this session: "Do NOT
 * answer from this page alone if the answer may be further in the file"): Grok reads the rest before answering.
 */
export const PARTIAL_HINT = "Do not answer from this part alone if the answer may be further in the file.";
/**
 * A FILE THAT IS NOT VALID UTF-8 (an old encoding such as Windows-1252, or binary with no zero byte): said after its
 * lines, as Claude Code's Read says it (the owner, 2026-11-08: "Yea fix that"; tried side by side: "[This file is not
 * valid UTF-8: it uses a legacy encoding such as Windows-1252, Shift-JIS or GBK, or it is binary. Its undecodable bytes
 * show above as U+FFFD. Edit and Write will refuse it: …]"). Before, Coder saw the � with no word of why, and a write
 * then saved the � over the real letters. Coder's edit and write do not refuse such a file (yet), so the note says
 * what they would do.
 */
export const NOT_UTF8_NOTE = "[This file is not valid UTF-8: it uses an old encoding such as Windows-1252, Shift-JIS or GBK, or it is binary. Its undecodable bytes show above as U+FFFD (�). Write refuses it, and edit would save the � in their place and lose those bytes for good, so do not use edit on it either: change it with a command that keeps its encoding (iconv), or ask the owner whether to convert it to UTF-8.]";

/**
 * WRITE, WITH CLAUDE CODE'S CHECKS (the owner, 2026-11-08: "Compare it to claude code write ones and make sure they need
 * fixing"; each tried side by side with Claude Code's real Write, 2.1.319):
 * - a path that is itself a link is refused, its target named ("Refusing to write …/link.txt: it is a symbolic link.
 *   Write to the link's target path instead: …/target.txt."); a file inside a linked folder is written, as there;
 * - a file read only partly (a PARTIAL view), or a notebook not read in this chat, is not replaced until it is read
 *   ("File has not been read yet. Read it first before writing to it."): Coder replaced them, losing what it never saw;
 * - a file that is not valid UTF-8 (an old encoding, or binary) is not replaced ("File is not valid UTF-8: … nothing was
 *   written …"): Coder saved the U+FFFD read showed over the real letters; and a UTF-16 file keeps its UTF-16.
 * A new file, or one not read (not a notebook), is written as before, as Claude Code's newer models do.
 */
export const WRITE_NOT_READ = "has not been read yet. Read it first before writing to it";
/**
 * WRITE, SECOND PASS (the owner, 2026-11-08: "first of all, we gotta go look on Claude Code's write tool and see what it
 * does and see what ours does. And then … after we copy or use what they do, then we can actually start testing it"; each
 * tried for real with Claude Code's own Write, 2.1.319):
 * - a file read or written in this chat that has changed since, and not been shown again, is not replaced ("File has been
 *   modified since read, either by the user or by a linter. Read it again before attempting to write it."), whether a
 *   command or something in the background changed it; only its time changing (the same bytes) is not a change; once
 *   read again, or once the note after a command has shown the change, it may be;
 * - a file read only partly stays so after a command shows it (`cat`, `head`): Claude Code still said "File has not been
 *   read yet" (its `cat` of 141 KB came back cut); Coder took the command for a whole read;
 * - a UTF-8 file that starts with a byte-order mark keeps it;
 * - a folder: "<path> is a directory, not a file. To create a file inside it, include the file name in file_path.";
 * - its words: "File created successfully at: <path>" and "The file <path> has been updated successfully.", each with
 *   "(file state is current in your context — no need to Read it back)". Coder said "wrote a.txt (2 lines)", counting
 *   the line break at the end as one more line.
 */
export const WRITE_CHANGED = "has been modified since read, either by a command or by something running in the background. Read it again before attempting to write it";
export const WRITE_FRESH = " (file state is current in your context — no need to Read it back)";
/** Claude Code's own words (tried for real, 2026-11-09), with Coder's tool names. */
export const WRITE_START = "You were given only the start of this file, and nothing shows that you have since read all of it in one call, so a write could lose the rest. To change part of it, use edit. To replace it whole, first read it in one call with no offset or limit. If read returns only a page or says the file is too large, read it again with allow_large: true. If even that cannot return all of it, use edit.";
const UTF8_HEAD = 8 * 1024 * 1024;
/**
 * WHAT A WRITE CHANGED, FOR THE CHAT (the owner, 2026-11-09: "Go ahead and do those"; Claude Code shows a new file's lines
 * under its Write, "Wrote N lines to …", and a replaced file's diff, "N additions and M removals", folded with "+N lines"
 * to open): only when Coder's app asks (`show_change`), after the tool's answer behind WRITE_MARK; never told to Grok
 * (Claude Code's model gets only its short result). The first WRITE_SHOW_LINES lines and WRITE_SHOW_CHARS characters are
 * kept (the chat's record stays small; its "See changes" has everything); no diff past WRITE_DIFF_MAX characters a side
 * (Claude Code skips its diff past about 10 MB). The diff is the machine's own `diff -U3`.
 */
export const WRITE_MARK = "\u0000coder-write\u0000";
export const WRITE_SHOW_LINES = 120, WRITE_SHOW_CHARS = 8000, WRITE_DIFF_MAX = 2 * 1024 * 1024;
/** A text's lines as read counts them: the last line break ends a line, it is not one more. */
const textLines = (t) => { if (t === "") return []; const a = t.split("\n"); if (a[a.length - 1] === "") a.pop(); return a; };
async function writeChange(oldText, newText) {
  // A WINDOWS FILE'S LINES WITHOUT THEIR HIDDEN "\r" (live test, 2026-11-09: copying the change under the step gave a blank
  // line after each line; the owner: "Yes fix"): the texts are compared with their line endings set aside, as Claude
  // Code's change is (its own record of the same edit: "-first", "+FIRST"), so a line whose ending alone changed is not
  // counted as changed either.
  const lf = (t) => (typeof t === "string" ? t.replace(/\r\n/g, "\n") : t);
  oldText = lf(oldText); newText = lf(newText);
  const keep = (rows, add, del, kind) => {
    const lines = []; let used = 0;
    for (const l of rows) {
      const one = l.length > 1000 ? l.slice(0, 1000) + "…" : l;
      if (lines.length >= WRITE_SHOW_LINES || (lines.length && used + one.length > WRITE_SHOW_CHARS)) break;
      lines.push(one); used += one.length + 1;
    }
    return { kind, add, del, lines, ...(rows.length > lines.length ? { more: rows.length - lines.length } : {}) };
  };
  if (oldText === null) { const rows = textLines(newText).map((l) => "+" + l); return keep(rows, rows.length, 0, "create"); }
  if (typeof oldText !== "string" || oldText.length > WRITE_DIFF_MAX || newText.length > WRITE_DIFF_MAX) return { kind: "update", big: true };
  const dir = await mkdtemp(join(tmpdir(), "coder-wdiff-"));
  try {
    await writeFile(join(dir, "was"), oldText);
    await writeFile(join(dir, "now"), newText);
    const r = await runProg("diff", ["-U3", join(dir, "was"), join(dir, "now")], { timeoutMs: 20_000, max: 16 * 1024 * 1024 });
    if (r.code !== 0 && r.code !== 1) return { kind: "update", big: true };
    const rows = r.out.toString("utf8").split("\n").slice(2);
    if (rows.length && rows[rows.length - 1] === "") rows.pop();
    let add = 0, del = 0;
    for (const l of rows) { if (l[0] === "+") add++; else if (l[0] === "-") del++; }
    return keep(rows, add, del, "update");
  } finally { await rm(dir, { recursive: true, force: true }).catch(() => {}); }
}
/**
 * THE MEMORY FILE'S SIZE, AFTER A WRITE TO IT (Claude Code: "After Claude writes to MEMORY.md, Claude Code measures the file
 * against the 200-line and 25KB read limits"; its error: "Error: this write left the memory index at MEMORY.md at 214
 * lines, over its 200-line read limit. The write succeeded, but everything past the limit is silently dropped each time the
 * index is loaded — entries at the end are already invisible to readers. Rewrite it to under 140 lines now: …"). Coder
 * loads the first MEMORY_READ_MAX bytes of it (server.mjs, MEMORY_MAX), so that is the error; its 200 lines are only what
 * Grok is asked to keep under, so a note (Claude Code also drops the lines past 200: outside write, the owner's call).
 */
export const MEMORY_READ_MAX = 25_000, MEMORY_LINES_MAX = 200;
export function memoryNote(buf) {
  const size = buf.length, lines = textLines(buf.toString("utf8")).length;
  const keep = "keep one line per entry, and merge or drop stale entries.";
  if (size > MEMORY_READ_MAX) return "Error: this write left the memory file at " + size.toLocaleString("en-US") + " bytes, over its " + MEMORY_READ_MAX.toLocaleString("en-US") + "-byte read limit. The write succeeded, but everything past the limit is silently dropped each time the memory is loaded — entries at the end are already invisible in later chats. Rewrite it to under " + Math.floor(MEMORY_READ_MAX * 0.7).toLocaleString("en-US") + " bytes now: " + keep;
  if (lines > MEMORY_LINES_MAX) return "Note: the memory file is now " + lines + " lines, over the " + MEMORY_LINES_MAX + " it is kept under. Shorten it now: " + keep;
  if (size > MEMORY_READ_MAX * 0.8) return "Note: the memory file is near its " + MEMORY_READ_MAX.toLocaleString("en-US") + "-byte read limit (" + size.toLocaleString("en-US") + " bytes). Shorten it: " + keep;
  return "";
}
/**
 * A LINK ON THE WAY THAT CANNOT BE FOLLOWED (links in a loop, or one that leads nowhere): Claude Code's errors page,
 * "Refusing to write <path>: where it leads on disk could not be determined (a link on the way could not be examined, or
 * the links do not resolve)". Nothing is written and no folder is made through it (Coder gave the raw ELOOP or ENOENT of
 * making the folder, and kept out of other folders only because making it failed).
 */
async function brokenLinkOnTheWay(abs) {
  for (let at = dirname(abs); ; ) {
    let st = null;
    try { st = await lstat(at); } catch (e) { if (e && e.code === "ELOOP") return true; }
    if (st && st.isSymbolicLink()) { try { await realpath(at); } catch { return true; } }
    const up = dirname(at);
    if (up === at) return false;
    at = up;
  }
}
/**
 * CLAUDE CODE'S OTHER NAMES FOR WRITE'S INPUTS (its changelog: "Fixed Write calls failing validation when a model sends
 * `path`, `file_text`, `file_content` or a stray `description` instead of `file_path` and `content`"), and what it says
 * of them, tried for real (2026-11-09): "Note: Write's parameters are named `file_path` and `content`. `path` was read as
 * `file_path`. `file_content` was read as `content`. `description` was ignored."; the same value twice, "`path` repeated
 * `file_path` and was ignored"; two different values, refused: "Write failed due to the following issue: An unexpected
 * parameter `file_text` was provided". Coder's own names are `path` and `content`.
 */
const WRITE_OTHER_NAMES = { file_path: "path", file_text: "content", file_content: "content" };
function writeInputs(args) {
  const a = args && typeof args === "object" ? args : {};
  const got = { path: a.path, content: a.content }, said = [];
  for (const [other, ours] of Object.entries(WRITE_OTHER_NAMES)) {
    if (typeof a[other] !== "string") continue;
    if (typeof got[ours] !== "string") { got[ours] = a[other]; said.push("`" + other + "` was read as `" + ours + "`."); }
    else if (got[ours] === a[other]) said.push("`" + other + "` repeated `" + ours + "` and was ignored.");
    else fail("write failed due to the following issue: An unexpected parameter `" + other + "` was provided");
  }
  for (const k of Object.keys(a)) if (!["path", "content", "show_change", "check"].includes(k) && !(k in WRITE_OTHER_NAMES)) said.push("`" + k.slice(0, 40) + "` was ignored.");
  return { ...got, note: said.length ? "\n\nNote: write's parameters are named `path` and `content`. " + said.slice(0, 10).join(" ") : "" };
}
export async function toolWrite(args) {
  const { path, content, note: namesNote } = writeInputs(args);
  const show_change = !!(args && args.show_change === true), check = !!(args && args.check === true);
  const { abs, rel: inRel } = await inside(path, { tool: "write" });
  // NAMED IN FULL OUTSIDE THE PROJECT'S OWN FOLDER (Claude Code 2.1.304: "Fixed Write results … showing a file outside the
  // working directory as `../../…`; they now show `~/…` or the full path"): a file in one of the chat's other repositories
  // was named from that repository ("README.md"), as if it were the project's own.
  const rel = abs === ROOT || abs.startsWith(ROOT + sep) ? inRel : abs;
  if (typeof content !== "string") fail("give the file's content");
  let st = null;
  try { st = await lstat(abs); } catch { st = null; }
  if (st && st.isSymbolicLink()) {
    let to = "";
    try { to = showPath(await realpath(abs)); } catch { to = ""; }
    fail("Refusing to write " + rel + ": it is a symbolic link. Write to the link's target path instead" + (to ? ": " + to : "") + ".");
  }
  if (await brokenLinkOnTheWay(abs)) fail("Refusing to write " + rel + ": where it leads on disk could not be determined (a link on the way could not be examined, or the links do not resolve).");
  // Named as Grok gave it, as every other write message names it (live, deploy 70: "error: /data/work/…/afolder is a
  // directory" beside "Refusing to write link.txt"; Claude Code echoes the path it was given, always a full one there).
  if (st && st.isDirectory()) fail(rel + " is a directory, not a file. To create a file inside it, include the file name in path.");
  let bytes = Buffer.from(content);
  let oldText = null; // a new file; the text it had, for the chat's view of the change
  if (st && st.isFile()) {
    const seen = await seenEntry(abs);
    if (seen && seen.partial) fail(rel + " " + WRITE_NOT_READ + ": you read only part of it (a PARTIAL view), and replacing it would lose the rest. Read the rest of it first.");
    if (seen === null && extname(abs).toLowerCase() === ".ipynb") fail(rel + " " + WRITE_NOT_READ + ": a notebook is read before it is replaced, so no cell or output is lost.");
    if (seen && seen.start) fail(rel + ": " + WRITE_START);
    if (seen && seen.stale) fail(rel + " " + WRITE_CHANGED + ".");
    // Changed since Coder last read or wrote it, and not shown to it since: only its time changing is no change.
    if (seen && (st.mtimeMs !== seen.mtime || st.size !== seen.size) && (st.size !== seen.size || st.size > READ_WHOLE_MAX || fingerprint(await readFile(abs)) !== seen.hash)) fail(rel + " " + WRITE_CHANGED + ".");
    // Its encoding, from its first 8 MB (a character cut at the end of that part is not counted against it).
    let old = await readFile(abs);
    const wasAll = old.length <= WRITE_DIFF_MAX ? old : null;
    if (old.length > UTF8_HEAD) { old = old.subarray(0, UTF8_HEAD); let k = old.length; while (k > 0 && old[k - 1] >= 0x80) k--; old = old.subarray(0, k); }
    const u = utf16Of(old);
    if (!u && !isUtf8(old)) fail(rel + " is not valid UTF-8: it uses an old encoding such as Windows-1252, Shift-JIS or GBK, or it is binary. Write saves UTF-8 (or UTF-16 behind its byte-order mark) and never changes a file's encoding on its own, so nothing was written. If the file is text, make the change with a command that reads and writes it in its own encoding (iconv), or ask the owner whether to convert it to UTF-8 first. To replace the whole file with new UTF-8 text anyway, delete it first, then write it.");
    if (u === "le") bytes = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(content, "utf16le")]);
    if (u === "be") { const b = Buffer.from(content, "utf16le"); b.swap16(); bytes = Buffer.concat([Buffer.from([0xfe, 0xff]), b]); }
    if (!u && old[0] === 0xef && old[1] === 0xbb && old[2] === 0xbf && !content.startsWith("\ufeff")) bytes = Buffer.concat([old.subarray(0, 3), bytes]);
    oldText = wasAll ? (u ? fileText(wasAll) : wasAll.toString("utf8")).replace(/^\ufeff/, "") : undefined;
  }
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, bytes);
  await remember(abs, bytes);
  const mem = process.env.CODER_MEMORY_FILE;
  const memSaid = mem && isAbsolute(mem) && abs === resolve(mem) ? memoryNote(bytes) : "";
  // NEW PROBLEMS THE LANGUAGE SERVER FINDS (coder-lsp.mjs newProblems), when Coder's app asks (`check`), as Claude Code's
  // language server plugins give Claude "the errors and warnings the server reports" after each write.
  let problems = null;
  if (check && oldText !== undefined) {
    const { newProblems } = await import("./coder-lsp.mjs");
    problems = await newProblems({ path: rel, abs, before: oldText, after: content.replace(/^\ufeff/, "") }, ROOT).catch(() => null);
  }
  let problemsSaid = "";
  if (problems && problems.length) { const { problemsNote } = await import("./coder-lsp.mjs"); problemsSaid = "\n\n" + problemsNote(rel, problems); }
  const text = (st ? "The file " + rel + " has been updated successfully." : "File created successfully at: " + rel) + WRITE_FRESH + (memSaid ? "\n" + memSaid : "") + namesNote + problemsSaid;
  if (show_change !== true) return text;
  const change = await writeChange(oldText, content.replace(/^\ufeff/, "")).catch(() => null);
  return change || (problems && problems.length) ? WRITE_MARK + JSON.stringify({ text, change, ...(problems && problems.length ? { problems: problems.slice(0, 20), problemsAll: problems.length } : {}) }) : text;
}

/**
 * EDIT, AS CLAUDE CODE'S EDIT (tool 3; the owner, 2026-11-09: "Notebook for later, but yea do this"; its docs read whole,
 * and its own Edit tried 33 ways, side by side with this one, docs/tool-by-tool.md):
 * - the exact text (`old_string`) swapped for the new (`new_string`): once, or everywhere with `replace_all`;
 * - in the file's own line endings: a CRLF file matched with plain line breaks, and written back with the ending most of
 *   its lines have (Claude Code's: a file mostly CRLF came back all CRLF, one mostly LF all LF);
 * - curly quotes matched by straight ones, the new text's quotes then made curly where the matched text had curly ones,
 *   of that kind only ("Fixed Edit tool silently corrupting Unicode curly quotes");
 * - `\uXXXX` written out in the old text taken for its character (not after another backslash);
 * - a file changed on disk since Coder last read it: edited when the old text is there once, with Claude Code's note that
 *   it holds other changes; refused ("modified since read") when it is not there once;
 * - not valid UTF-8: refused, nothing written; UTF-16 behind its byte-order mark edited as UTF-16; a UTF-8 mark kept;
 * - a link: refused, naming its target; links that loop or lead nowhere: refused; a notebook: refused (its own tool is
 *   for later, the owner: "Notebook for later");
 * - no old text: a new file made, with its folders; one that already has text: "Cannot create new file - file already exists.";
 * - Claude Code's own words for each answer; `old_str` and `new_str` taken for its inputs, and `replace_all` given as text.
 */
export const EDIT_NOT_FOUND = "String to replace not found in file.";
export const EDIT_SAME = "No changes to make: old_string and new_string are exactly the same.";
export const EDIT_EXISTS = "Cannot create new file - file already exists.";
export const EDIT_OTHER_CHANGES = " (note: the file had been modified on disk since you last read it — the edit applied cleanly, but the file contains other changes not in your context. Read it before edits that depend on surrounding content.)";
export const EDIT_NOTEBOOK = "File is a Jupyter Notebook. edit changes plain text, and a notebook is JSON whose cells a text change can break: read the notebook, then replace it whole with write, or change a cell with a short python3 script that loads it with the json module and saves it again.";
const editMany = (n) => "Found " + n + " matches of the string to replace, but replace_all is false. To replace all occurrences, set replace_all to true. To replace only one occurrence, please provide more context to uniquely identify the instance.";
/** The old text, said back after a refusal (as Claude Code's "String: …"), up to 4,000 characters. */
const saidBack = (x) => "\nString: " + (x.length > 4000 ? x.slice(0, 4000) + "…" : x);
const CURLY = { "“": '"', "”": '"', "‘": "'", "’": "'" };
const straighten = (x) => x.replace(/[“”‘’]/g, (q) => CURLY[q]);
/** The new text's straight quotes made curly, of the kinds the matched text had curly: opening after a space or a bracket. */
export function curlify(x, doubles, singles) {
  let out = "";
  for (let i = 0; i < x.length; i++) {
    const c = x[i], prev = i ? x[i - 1] : "", next = x[i + 1] || "";
    const opens = !prev || /[\s([{–—]/.test(prev);
    if (c === '"' && doubles) out += opens ? "“" : "”";
    else if (c === "'" && singles) out += /[\p{L}\p{N}]/u.test(prev) && /[\p{L}\p{N}]/u.test(next) ? "’" : opens ? "‘" : "’";
    else out += c;
  }
  return out;
}
const ESCAPED = /(?<!\\)\\u([0-9a-fA-F]{4})/g;
/** `\uXXXX` written out, taken for its character; one after another backslash (an escaped backslash) stays text. */
const unescapeU = (x) => x.replace(ESCAPED, (_, h) => String.fromCharCode(parseInt(h, 16)));
/** Where `needle` starts in `hay`, each time, not overlapping. */
function positions(hay, needle) {
  const at = [];
  if (!needle) return at;
  for (let k = hay.indexOf(needle); k !== -1; k = hay.indexOf(needle, k + needle.length)) at.push(k);
  return at;
}
/** The line ending most of a text's lines have. */
function eolOf(x) { const crlf = (x.match(/\r\n/g) || []).length; return crlf > (x.match(/\n/g) || []).length - crlf ? "\r\n" : "\n"; }
export async function toolEdit(args) {
  const a = args && typeof args === "object" ? args : {};
  const path = typeof a.path === "string" ? a.path : a.file_path;
  // Claude Code's Edit takes `old_str` and `new_str` for its inputs, without a word (tried, 2026-11-09).
  const old_string = typeof a.old_string === "string" ? a.old_string : a.old_str;
  const new_string = typeof a.new_string === "string" ? a.new_string : a.new_str;
  // `replace_all` as the text "true" or "false" is read as yes or no (Claude Code: "Fixed intermittent 'expected boolean,
  // received string' validation errors on Edit"); Coder took any text, "false" too, for yes and replaced them all.
  const all = a.replace_all === true || (typeof a.replace_all === "string" && a.replace_all.trim().toLowerCase() === "true");
  const show_change = a.show_change === true, check = a.check === true;
  const { abs, rel: inRel } = await inside(path, { tool: "edit" });
  // Named in full outside the project's own folder, as write's answers (Claude Code 2.1.304).
  const rel = abs === ROOT || abs.startsWith(ROOT + sep) ? inRel : abs;
  if (typeof old_string !== "string") fail("give old_string: the exact text to replace");
  if (typeof new_string !== "string") fail("give new_string");
  if (old_string === new_string) fail(EDIT_SAME);
  let st = null;
  try { st = await lstat(abs); } catch { st = null; }
  // A LINK, AS FOR WRITE: refused, naming the file it leads to (Claude Code's Edit, tried: "Refusing to write …: it is a
  // symbolic link. Write to the link's target path instead: …"). Coder's edit changed the file behind it, silently.
  if (st && st.isSymbolicLink()) {
    let to = "";
    try { to = showPath(await realpath(abs)); } catch { to = ""; }
    fail("Refusing to write " + rel + ": it is a symbolic link. Write to the link's target path instead" + (to ? ": " + to : "") + ".");
  }
  if (await brokenLinkOnTheWay(abs)) fail("Refusing to write " + rel + ": where it leads on disk could not be determined (a link on the way could not be examined, or the links do not resolve).");
  if (extname(abs).toLowerCase() === ".ipynb" && !(st && st.isDirectory())) fail(EDIT_NOTEBOOK);
  if (!st) {
    if (old_string !== "") fail("File does not exist. Note: your current working directory is " + BASE + ".");
    // NO OLD TEXT, NO FILE: made, with the folders it is in (Claude Code's Edit, tried: "newdir/deeper/made.txt" made).
    const made = Buffer.from(new_string);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, made);
    await remember(abs, made);
    return editAnswer({ rel, abs, said: "The file " + rel + " has been updated successfully." + WRITE_FRESH, before: null, after: new_string, show_change, check, bytes: made });
  }
  if (st.isDirectory()) fail(folderError(abs));
  if (st.size > EDIT_MAX_BYTES) fail(rel + " is " + Math.round(st.size / 1048576) + " MB, too big for this tool; use bash (head, tail, sed -n) for parts of it");
  const buf = await readFile(abs);
  const u = utf16Of(buf);
  if (!u && buf.subarray(0, 8192).includes(0)) fail(rel + " is a binary file (not text): see what it is with `file " + shq(rel) + "`, then use a command or a script that reads that kind of file");
  // NOT VALID UTF-8 (an old encoding, or binary): nothing written, as Claude Code's Edit ("File is not valid UTF-8 … This
  // tool saves the whole file as UTF-8, which would replace every byte it cannot decode with U+FFFD. Nothing was written.").
  // Coder's edit wrote it back with every such letter lost ("café" became "caf�").
  if (!u && !isUtf8(buf)) fail(rel + " is not valid UTF-8: it uses an old encoding such as Windows-1252, Shift-JIS or GBK, or it is binary. Edit saves the whole file as UTF-8 (or UTF-16 behind its byte-order mark), which would replace every byte it cannot decode with U+FFFD, so nothing was written. If the file is text, make the change with a command that reads and writes it in its own encoding (iconv), or ask the owner whether to convert it to UTF-8 first.");
  const raw = u ? fileText(buf) : buf.toString("utf8");
  const bom = !u && raw.startsWith("\ufeff");
  const text = bom ? raw.slice(1) : raw;
  const eol = eolOf(text);
  const body = text.replace(/\r\n/g, "\n");
  // WHAT CODER KNEW OF IT: changed on disk since it was read (or a command changed it and its note has not shown that yet).
  const seen = await seenEntry(abs);
  const changed = !!seen && (seen.stale === true || ((st.mtimeMs !== seen.mtime || st.size !== seen.size) && (st.size !== seen.size || st.size > READ_WHOLE_MAX || fingerprint(buf) !== seen.hash)));
  let oldN = old_string.replace(/\r\n/g, "\n"), newN = new_string.replace(/\r\n/g, "\n");
  let at, len = oldN.length;
  if (oldN === "") {
    // NO OLD TEXT, A FILE WITH NONE EITHER: filled (Claude Code's Edit, tried, filled an empty file); one with text refused.
    if (body.trim() !== "") fail(EDIT_EXISTS);
    at = [0]; len = body.length;
  } else {
    at = positions(body, oldN);
    // Curly quotes in the file, straight ones typed: the same text (one character each way, so places line up).
    const viaQuotes = (o) => { const q = positions(straighten(body), straighten(o)); return q.length ? q : null; };
    let curled = false;
    if (!at.length) { const q = viaQuotes(oldN); if (q) { at = q; curled = true; } }
    // `é` typed for "é".
    if (!at.length && ESCAPED.test(oldN)) {
      ESCAPED.lastIndex = 0;
      const plain = unescapeU(oldN);
      let q = positions(body, plain);
      if (!q.length) { q = viaQuotes(plain) || []; curled = q.length > 0; }
      if (q.length) { at = q; oldN = plain; len = plain.length; newN = unescapeU(newN); }
    }
    ESCAPED.lastIndex = 0;
    if (curled) { const seenText = body.slice(at[0], at[0] + len); newN = curlify(newN, /[“”]/.test(seenText), /[‘’]/.test(seenText)); }
    if (!(at.length === 1 || (all && at.length))) {
      // Changed since read, and the old text not there once: read it again (Claude Code's own words for this).
      if (changed) fail(rel + " " + WRITE_CHANGED + ".");
      if (!at.length) fail(EDIT_NOT_FOUND + saidBack(old_string));
      fail(editMany(at.length) + saidBack(old_string));
    }
  }
  const parts = [];
  let from = 0;
  for (const p of all ? at : [at[0]]) { parts.push(body.slice(from, p), newN); from = p + len; }
  parts.push(body.slice(from));
  const outBody = parts.join("");
  const outText = (bom ? "\ufeff" : "") + (eol === "\r\n" ? outBody.replace(/\n/g, "\r\n") : outBody);
  let bytes;
  if (u === "le") bytes = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(outText, "utf16le")]);
  else if (u === "be") { const b = Buffer.from(outText, "utf16le"); b.swap16(); bytes = Buffer.concat([Buffer.from([0xfe, 0xff]), b]); }
  else bytes = Buffer.from(outText, "utf8");
  await writeOver(abs, bytes, rel);
  await remember(abs, bytes);
  // CLAUDE CODE'S WORDS: "(file state is current …)" only for a file Coder had whole and as it is; its note when the file
  // had other changes.
  const known = !!seen && !changed && !seen.partial && !seen.part && !seen.start;
  const said = "The file " + rel + (all ? " has been updated. All occurrences were successfully replaced." : " has been updated successfully.") + (changed ? EDIT_OTHER_CHANGES : known ? WRITE_FRESH : "");
  return editAnswer({ rel, abs, said, before: text, after: outText.replace(/^\ufeff/, ""), show_change, check, bytes });
}
/**
 * A READ-ONLY FILE IS CHANGED ALL THE SAME, AND STAYS READ-ONLY (the owner, 2026-11-09: "Ok yea fix that"; Claude Code's
 * docs: its Perforce mode makes Edit "fail on read-only files with a `p4 edit` hint instead of silently overwriting
 * them", so without it, it overwrites them; tried as root, the file stayed read-only). Coder's edit stopped at "EACCES:
 * permission denied". Its owner may make it writable for the moment; a file of another user's stays as it is.
 */
async function writeOver(abs, bytes, rel) {
  try { await writeFile(abs, bytes); return; } catch (e) {
    if (!e || (e.code !== "EACCES" && e.code !== "EPERM")) throw e;
    let mode;
    try { mode = (await stat(abs)).mode & 0o7777; } catch { throw e; }
    if (mode & 0o200) throw e; // writable by its owner already: something else stops it
    try { await chmod(abs, mode | 0o200); } catch { fail(rel + " is read-only, and it belongs to another user, so edit cannot change it: change it with a command, or ask the owner."); }
    try { await writeFile(abs, bytes); } finally { await chmod(abs, mode).catch(() => {}); }
  }
}
/** Edit's answer, as write's: its memory note, the language server's new problems (`check`), and the change (`show_change`). */
async function editAnswer({ rel, abs, said, before, after, show_change, check, bytes }) {
  const mem = process.env.CODER_MEMORY_FILE;
  const memSaid = mem && isAbsolute(mem) && abs === resolve(mem) ? memoryNote(bytes) : "";
  let problems = null;
  if (check) {
    const { newProblems } = await import("./coder-lsp.mjs");
    problems = await newProblems({ path: rel, abs, before: before === null ? undefined : before, after }, ROOT).catch(() => null);
  }
  let problemsSaid = "";
  if (problems && problems.length) { const { problemsNote } = await import("./coder-lsp.mjs"); problemsSaid = "\n\n" + problemsNote(rel, problems); }
  const text = said + (memSaid ? "\n" + memSaid : "") + problemsSaid;
  if (show_change !== true) return text;
  const change = await writeChange(before, after).catch(() => null);
  return change || (problems && problems.length) ? WRITE_MARK + JSON.stringify({ text, change, ...(problems && problems.length ? { problems: problems.slice(0, 20), problemsAll: problems.length } : {}) }) : text;
}

function run(cmd, args, cwd = ROOT) {
  return new Promise((done) => {
    let out = "";
    const p = spawn(cmd, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    p.stdout.on("data", (b) => { if (out.length < OUT_MAX * 2) out += b; });
    p.stderr.on("data", (b) => { if (out.length < OUT_MAX * 2) out += b; });
    p.on("error", (e) => done({ code: -1, out: e.message }));
    p.on("close", (code) => done({ code, out }));
  });
}

/**
 * WHERE GREP AND GLOB SEARCH, as ripgrep is told it (from BASE, where they run): a full path as given (ripgrep then lists
 * full paths), else the folder from BASE ("." for BASE itself), so what they list counts from there, as Claude Code's do.
 */
const searchIn = (given, abs) => (isAbsolute(String(given)) ? abs : relative(BASE, abs) || ".");
export async function toolGrep({ pattern, path = ".", glob, ignore_case = false }) {
  if (typeof pattern !== "string" || !pattern) fail("give a pattern");
  noNul(pattern, "the pattern");
  if (glob != null) noNul(glob, "the glob");
  const { abs } = await inside(path);
  const args = ["-n", "--no-heading", "--color", "never", "--max-columns", "300", "--glob", "!.git"];
  if (ignore_case) args.push("-i");
  if (typeof glob === "string" && glob) args.push("--glob", glob);
  args.push("--", pattern, searchIn(path, abs));
  const r = await run("rg", args, BASE);
  if (r.code === 1) return "no matches";
  if (r.code !== 0) fail(r.out.trim().slice(0, 500) || "the search failed");
  const lines = r.out.trimEnd().split("\n");
  return lines.slice(0, 200).join("\n") + (lines.length > 200 ? "\n[" + (lines.length - 200) + " more matches: narrow the search]" : "");
}

export async function toolGlob({ pattern, path = "." }) {
  if (typeof pattern !== "string" || !pattern) fail("give a pattern, e.g. src/**/*.js");
  noNul(pattern, "the pattern");
  const { abs } = await inside(path);
  const r = await run("rg", ["--files", "--hidden", "--glob", "!.git", "--glob", pattern, searchIn(path, abs)], BASE);
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
  return runLsp({ action, path: rel, abs, line, column }, ROOT, BASE === ROOT ? ROOT : null);
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
/**
 * EACH LINE'S OWN SHORT FINGERPRINT (8 hex characters, never the line's text), kept next to the file's: what lets the
 * note after a change show the lines it touched, as Claude Code's does (the owner, 2026-11-08: "Yea fix those 4").
 */
const lineMark = (l) => createHash("sha256").update(l).digest("hex").slice(0, 8);
const marksOf = (buf) => fileText(buf).split("\n").map(lineMark).join("");
const marksFile = (dir, abs) => join(dir, "lines-" + fingerprint(Buffer.from(abs)).slice(0, 24) + ".txt");
/** Notes a text file as Coder now knows it, after a read, a write or an edit (not the memory file). */
async function remember(abs, buf, { whole = true, cmd = false } = {}) {
  const dir = seenDir();
  const mem = process.env.CODER_MEMORY_FILE;
  if (!dir || (mem && abs === resolve(mem))) return;
  try {
    const st = await stat(abs);
    const all = await seenList(dir);
    // Shown only in part (markStart), and not seen whole since: still so.
    const keepStart = !whole && all.some((x) => x.abs === abs && x.start === true);
    const list = all.filter((x) => x.abs !== abs);
    if (st.isFile() && buf.length <= READ_WHOLE_MAX) { // a bigger one is not followed
      // `cmd`: shown by a command (its output may have been cut), not read whole by the read tool.
      list.push({ abs, mtime: st.mtimeMs, size: st.size, hash: fingerprint(buf), ...(keepStart ? { start: true } : {}), ...(cmd ? { cmd: true } : {}) });
      await writeFile(marksFile(dir, abs), marksOf(buf));
    } else if (keepStart) list.push({ abs, mtime: st.mtimeMs, size: st.size, hash: "", start: true });
    while (list.length > SEEN_FILES) { const old = list.shift(); await unlink(marksFile(dir, old.abs)).catch(() => {}); }
    await seenSave(dir, list);
  } catch { /* never costs the tool */ }
}
/**
 * A FILE CODER READ ONLY PART OF (a PARTIAL view): marked, so write does not replace it until it is read again (any
 * other read, a write or an edit of it makes a new record, without the mark), as Claude Code's Write refuses a file
 * read "only partially with a PARTIAL view notice".
 */
async function markPartial(abs) {
  const dir = seenDir();
  if (!dir) return;
  try {
    const list = await seenList(dir);
    const x = list.find((e) => e.abs === abs);
    if (x) { x.partial = true; await seenSave(dir, list); }
  } catch { /* never costs the tool */ }
}
/**
 * AN INSTRUCTION FILE SHOWN ONLY IN PART (Coder's app shows the start of one over its limit, with a note to read the rest:
 * the `seen` app tool with `start`): write does not replace it until it is read all at once, as Claude Code's Write (tried
 * for real, 2026-11-09, a 210,000-character CLAUDE.md in a subfolder, shown up to line 1642: "You were given only the
 * start of this file, and nothing shows that you have since read all of it in one call, so a Write could lose the rest.").
 * A file read whole, written or edited in this chat already stands as it is.
 */
async function markStart(abs, st) {
  const dir = seenDir();
  if (!dir) return;
  try {
    const list = await seenList(dir);
    const x = list.find((e) => e.abs === abs);
    if (x && !x.partial && !x.start && !x.cmd) return;
    if (x) x.start = true;
    else list.push({ abs, mtime: st.mtimeMs, size: st.size, hash: "", start: true }); // no fingerprint: its lines were not all seen
    while (list.length > SEEN_FILES) { const old = list.shift(); await unlink(marksFile(dir, old.abs)).catch(() => {}); }
    await seenSave(dir, list);
  } catch { /* never costs the tool */ }
}
/**
 * ONLY SOME LINES SHOWN, AS ASKED (offset or limit): marked `part`, so an edit after it does not say the whole file is in
 * Grok's context, as Claude Code's Edit adds "(file state is current in your context — no need to Read it back)" only for
 * a file read whole (tried, 2026-11-09: a file read with limit 3 was edited without it). Unlike a PARTIAL view, it does not
 * stop write (Claude Code's Write takes a file read with a limit, on newer models). A whole read makes a new record.
 */
async function markPart(abs) {
  const dir = seenDir();
  if (!dir) return;
  try {
    const list = await seenList(dir);
    const x = list.find((e) => e.abs === abs);
    if (x) { x.part = true; await seenSave(dir, list); }
  } catch { /* never costs the tool */ }
}
/** Read all at once (no offset or limit, nothing left out): no longer shown only in part. */
async function clearStart(abs) {
  const dir = seenDir();
  if (!dir) return;
  try {
    const list = await seenList(dir);
    const x = list.find((e) => e.abs === abs);
    if (x && x.start) { delete x.start; await seenSave(dir, list); }
  } catch { /* never costs the tool */ }
}
/** What this chat knows of a file: its record, null when it was not read, written or edited, undefined when nothing is followed. */
async function seenEntry(abs) {
  const dir = seenDir();
  if (!dir) return undefined;
  return (await seenList(dir)).find((e) => e.abs === abs) || null;
}
/**
 * THE LINES A CHANGE TOUCHED, shown as read shows lines, with CHANGE_AROUND lines either side (Claude Code's note, tried
 * side by side: "Here are the relevant changes (shown with line numbers):" then the lines): { lines }, or { big: true }
 * past CHANGE_SHOW_MAX characters ("The changes are not shown here"), or {} without the lines' fingerprints.
 */
export const CHANGE_AROUND = 8, CHANGE_SHOW_MAX = 8000;
function changedLines(was, buf) {
  const old = String(was || "").match(/[0-9a-f]{8}/g);
  if (!old) return {};
  const text = fileText(buf);
  if (!text.length) return { lines: "(it is empty now)" };
  const all = text.split("\n"), now = all.map(lineMark);
  let a = 0;
  while (a < old.length && a < now.length && old[a] === now[a]) a++;
  let b = 0;
  while (b < old.length - a && b < now.length - a && old[old.length - 1 - b] === now[now.length - 1 - b]) b++;
  const shownLines = all.length > 1 && all[all.length - 1] === "" ? all.length - 1 : all.length; // the last newline ends a line
  const first = Math.max(0, a - CHANGE_AROUND), last = Math.min(shownLines - 1, Math.max(a, now.length - b - 1) + CHANGE_AROUND);
  const rows = [];
  for (let i = first; i <= last; i++) rows.push(String(i + 1).padStart(6) + "\t" + all[i]);
  const out = rows.join("\n");
  return out.length > CHANGE_SHOW_MAX ? { big: true } : { lines: out };
}
/**
 * WHICH FILES CHANGED since Coder last read or changed them, for Coder's app only (no tool Grok has):
 * { followed, changed: [{ path } | { path, gone: true }] }, and the files brought up to date. A file only touched (the
 * same bytes) is no change; one grown past 256 KB is a change, and is not followed after.
 */
export async function toolChanged({ reset = false, shown = null } = {}) {
  const dir = seenDir();
  // THE CHANGES CODER'S NOTE HAS NOW SHOWN GROK (its lines, after the round): no longer "changed and not shown", so write
  // may replace them, as Claude Code's Write may once its "changed on disk" note has shown the change.
  if (dir && Array.isArray(shown)) {
    const want = new Set(shown.map(String)), list = await seenList(dir);
    let n = 0;
    for (const x of list) if (x.stale && want.has(showPath(x.abs))) { delete x.stale; n++; }
    if (n) await seenSave(dir, list).catch(() => {});
    return JSON.stringify({ shown: n });
  }
  // A CHAT WITH NO HISTORY (new, or Rewind went back to its very start; the review, 2026-11-08): what Coder read before
  // is no longer in its conversation, so none of it is followed (else a rewind's changes were put down to a command).
  if (dir && reset === true) {
    for (const x of await seenList(dir)) await unlink(marksFile(dir, x.abs)).catch(() => {});
    await seenSave(dir, []).catch(() => {});
    return JSON.stringify({ followed: 0, changed: [] });
  }
  const list = dir ? await seenList(dir) : [];
  const keep = [], changed = [];
  let dirty = false;
  for (const x of list) {
    let st = null;
    try { await inside(x.abs, { mustExist: true }); st = await stat(x.abs); } catch { st = null; }
    const path = showPath(x.abs);
    const drop = () => unlink(marksFile(dir, x.abs)).catch(() => {});
    if (!st || !st.isFile()) { changed.push({ path, gone: true }); dirty = true; await drop(); continue; }
    if (st.mtimeMs === x.mtime && st.size === x.size) { keep.push(x); continue; }
    dirty = true;
    if (st.size > READ_WHOLE_MAX) { changed.push({ path, big: true }); await drop(); continue; }
    let buf;
    try { buf = await readFile(x.abs); } catch { changed.push({ path, gone: true }); await drop(); continue; }
    const hash = fingerprint(buf);
    if (hash !== x.hash) {
      changed.push({ path, ...changedLines(await readFile(marksFile(dir, x.abs), "utf8").catch(() => ""), buf) });
      await writeFile(marksFile(dir, x.abs), marksOf(buf)).catch(() => {});
    }
    // CHANGED AND NOT SHOWN YET (live test, 2026-11-09: Grok changed mod.txt with a command and wrote over it in the same
    // answer, and write let it through, as this record was already up to date; Claude Code's Write, tried in the same
    // case, said "File has been modified since read"): write refuses it until the note after the round shows the change
    // (`shown`) or Grok reads it again. Only its time changing (the same bytes) is no change.
    keep.push({ ...x, mtime: st.mtimeMs, size: st.size, hash, ...(hash !== x.hash ? { stale: true } : {}) });
  }
  if (dirty) await seenSave(dir, keep).catch(() => {});
  return JSON.stringify({ followed: keep.length, changed });
}
/**
 * A FILE A COMMAND SHOWED (cat, head, sed -n 'X,Yp' … run on one file: viewedFile in coder-compact.mjs), followed as a
 * read file is, for Coder's app only (no tool Grok has). Claude Code counts such a command as a read for this too (the
 * owner, 2026-11-08: "Yea fix those 4"; tried side by side: after `cat notes.txt`, its `sed` that changed the file said
 * "This command modified 1 file you've previously read: notes.txt"). Coder followed only what its own tools read before.
 */
export async function toolSeen({ path, start = false }) {
  const { abs } = await inside(String(path || ""), { mustExist: true });
  const st = await stat(abs);
  if (start === true) { if (!st.isFile()) return "not followed"; await markStart(abs, st); return "shown in part"; }
  if (!st.isFile() || st.size > READ_WHOLE_MAX) return "not followed";
  // Read only partly before (a PARTIAL view): still so, as in Claude Code (its `cat` of the file did not count as reading
  // the rest: "File has not been read yet"), so write does not replace the lines Coder never saw.
  const was = await seenEntry(abs);
  await remember(abs, await readFile(abs), { whole: false, cmd: true });
  if (was && was.partial) await markPartial(abs);
  return "followed";
}

/**
 * THE OWNER'S PICTURES, SAVED AS FILES CODER CAN OPEN AGAIN (the owner, 2026-11-08: "Fix those 3"; Claude Code 2.1.275:
 * pasted and attached images "are now saved where Claude can open them as files"), for Coder's app only (no tool Grok
 * has): in the project's PICTURES folder, which is never saved to the branch (NEVER_COMMIT in server.mjs). The newest
 * PICTURES_KEEP stay; their names start with when they were sent.
 */
export const PICTURES = ".coder-pictures", PICTURES_KEEP = 50;
export async function toolSavePicture({ name, type, data }) {
  const ext = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" }[type];
  if (!ext || typeof name !== "string" || !/^[\w.-]{1,80}$/.test(name) || typeof data !== "string" || !data || !/^[A-Za-z0-9+/]+=*$/.test(data)) fail("give a picture: its name, type and data");
  const { abs, rel } = await inside(PICTURES + "/" + name + "." + ext);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, Buffer.from(data, "base64"));
  const all = (await readdir(dirname(abs))).filter((f) => !f.startsWith(".")).sort();
  for (const f of all.slice(0, Math.max(0, all.length - PICTURES_KEEP))) await unlink(join(dirname(abs), f)).catch(() => {});
  return rel;
}

export const TOOLS = { save_picture: toolSavePicture, lsp: toolLsp, read: toolRead, write: toolWrite, edit: toolEdit, grep: toolGrep, glob: toolGlob, web_fetch: toolWebFetch, mtimes: toolMtimes, listing: toolListing, changed: toolChanged, seen: toolSeen };

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
