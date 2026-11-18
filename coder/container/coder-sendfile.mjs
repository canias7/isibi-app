/**
 * CLAUDE CODE'S SendUserFile AS CODER'S send_user_file (the owner, 2026-11-18: "Ok you can start"; Claude Code 2.1.327's tool,
 * read in its program and tried in a Claude Code cloud session that day): a file Coder made reaches the owner as a card in the
 * chat, kept with the chat by Coder's server, to look at there or download.
 *   - offered in Coder's own chats from the start (Claude Code's is not held back in a cloud session: its shouldDefer is off
 *     there), not in a job from GitHub (no one to see it), nor Gloopy's (it has its own files tool);
 *   - read-only, run beside other read-only calls; each file is a read of its path, so the owner's Read rules apply to it, and
 *     a rule on SendUserFile itself, or on one of its inputs;
 *   - its description, inputs, refusals and answers in its words (Coder's name for it where it names itself).
 * This file has what Coder's machine and its server both need, so no Node module here (Coder's Worker loads it too).
 */
import { typeIssue, unknownKeysIssue, valueIssue, tooSmallIssue, inputErrorText } from "./coder-zodtext.mjs";

export const SEND_TOOL = "send_user_file", CC_SEND = "SendUserFile";
/** Its search hint, Claude Code's own (its `searchHint`). */
export const SEND_HINT = "deliver files (screenshots, reports, artifacts) to the user";

/**
 * Its description: 2.1.327's own, the one it gives unless a switch of its own is on (its prompt(): the text naming no
 * notification, which ends "call PushNotification as well", only with tengu_smooth_pelican, off by default; this Claude Code
 * session got this one too): `proactive` reaches the owner's phone, as Coder's push does (src/coder-push.mjs). Coder's name
 * for the tool in its example. (The owner, 2026-11-18: "Match Claude Code".)
 */
export const SEND_DESCRIPTION = "Send files to the user. Use this for any file the user would want to see — a generated diagram, a report, a screenshot, a built artifact — and you want it surfaced, not just mentioned. Send deliverables as they are produced, not batched at the end of the task: a complete draft or a meaningfully updated version of the thing the user asked for is worth sending mid-task, so they can follow progress and redirect early. Do NOT send routine working files — scratch files, debug output, partial fragments, or every incremental save of something you're still actively editing; each call renders a file card in the conversation, and a stream of cards for one file is noise. Re-send a file only when it has meaningfully changed since the last send. Paths can be absolute or relative to the current working directory.\n\nAdd a `caption` when a one-liner of context helps (\"the failing case is row 42\", \"before vs after\"). Skip it if the file speaks for itself.\n\nSet `status` on every call. Use `proactive` when you're initiating — the user is away and you want this to reach their phone (build artifact ready, report generated). Use `normal` when replying to something the user just said.\n\nSet `display` to choose how the file is presented. Use `'render'` when the user should see the content inline in the side panel right now — a chart, a rendered HTML page, a diagram, an image. Use `'attach'` when the file is something they'll save and open elsewhere — source code, a spreadsheet, a document for another app — and an inline preview would just be noise. Leave it unset to let the client decide by file type.\n\nFiles must already exist on the local filesystem — the tool sends files, it doesn't fetch URLs or render content. When unsure of a path, verify with ls first; absolute paths avoid ambiguity about the working directory.\n\nExample: " + SEND_TOOL + "({ files: [\"report.md\"], caption: \"Here's the report.\", status: \"normal\" })";
/** Its inputs, as its schema gives them (2.1.327), and nothing else. */
export const SEND_PROPERTIES = Object.freeze({
  files: { type: "array", items: { type: "string" }, minItems: 1, description: "File paths (absolute or relative to cwd) to send to the user. Always pass an array, even for a single file." },
  caption: { type: "string", description: "Optional short caption for the file(s)." },
  status: { type: "string", enum: ["normal", "proactive"], description: "Use 'proactive' when you're surfacing a file the user hasn't asked for and needs to see now — a generated artifact, a completed report. Use 'normal' when replying to something the user just said." },
  display: { type: "string", enum: ["render", "attach"], description: "How the client should present the file. 'render' opens it inline in the side panel (for HTML, SVG, Mermaid, images, PDFs — anything the user wants to look at now). 'attach' shows a download card only, no inline preview (for deliverables the user will save and open elsewhere). Omit to let the client decide by file type — today that means renderable types render and everything else attaches, same as before this parameter existed." },
});
export const SEND_TOOL_DEF = Object.freeze({ type: "function", function: { name: SEND_TOOL, description: SEND_DESCRIPTION, parameters: { type: "object", properties: SEND_PROPERTIES, required: ["files", "status"], additionalProperties: false } } });

// ── ITS INPUT ────────────────────────────────────────────────────────────────
const obj = (a) => (a && typeof a === "object" && !Array.isArray(a) ? a : {});
/**
 * send_user_file's input as its schema takes it: `files` one path or a list of at least one (a single path given as a string is
 * taken as a list of one, as Claude Code's takes it), `caption` a string, `status` "normal" or "proactive", `display` "render"
 * or "attach", nothing else. → { args } (files a list), or { error } in its words.
 */
export function checkSendInput(args) {
  const a = { ...obj(args) }, issues = [];
  if (typeof a.files === "string") a.files = [a.files];
  if (!Array.isArray(a.files)) issues.push(typeIssue("array", a.files, ["files"]));
  else {
    a.files.forEach((f, i) => { if (typeof f !== "string") issues.push(typeIssue("string", f, ["files", i])); });
    if (!a.files.length) issues.push(tooSmallIssue("array", 1, ["files"]));
  }
  if (a.caption !== undefined && typeof a.caption !== "string") issues.push(typeIssue("string", a.caption, ["caption"]));
  // (Left out too: its enum's own issue, "Invalid option", as Claude Code gives it; tried.)
  if (!["normal", "proactive"].includes(a.status)) issues.push(valueIssue(["normal", "proactive"], ["status"]));
  if (a.display !== undefined && !["render", "attach"].includes(a.display)) issues.push(valueIssue(["render", "attach"], ["display"]));
  const unknown = Object.keys(a).filter((k) => !["files", "caption", "status", "display"].includes(k));
  if (unknown.length) issues.push(unknownKeysIssue(unknown));
  return issues.length ? { error: inputErrorText(SEND_TOOL, issues) } : { args: a };
}

// ── ITS REFUSALS OF A FILE (2.1.327's validateInput, before any hook; tried, 2026-11-18) ───────────────────────────────
/** Control characters and the two line separators, which its words write as entities (its X). */
const UNSEEN = /[\x00-\x1f\x7f-\x9f\u2028\u2029]/g;
/** A path as its answer shows a file's path and id (its Yc): control characters written as entities. */
export const visiblePath = (p) => String(p ?? "").replace(UNSEEN, (c) => "&#" + c.charCodeAt(0) + ";");
/** A path as its refusals show one, and a failure's words (its Hp): `<` and `>` too (tried: a zero-width space stays as it is). */
export const shownPath = (p) => visiblePath(String(p ?? "").replaceAll("<", "&lt;").replaceAll(">", "&gt;"));
/** A path quoted as its bad-name refusal quotes one (its _Se): in JSON's quotes, anything but plain ASCII (and `<`, `>`) as \uXXXX, at most 300 characters, the start cut to "..." past that (tried). */
const quoted = (t) => JSON.stringify(t).replace(/[^\x20-\x7e]|[<>]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
export function quotedPath(t) {
  const whole = quoted(String(t ?? ""));
  if (whole.length <= 300) return whole;
  const chars = [...String(t)];
  let r = chars.length, n = 5;
  while (r > 0) { n += quoted(chars[r - 1]).length - 2; if (n > 300) break; r--; }
  return quoted("..." + chars.slice(r).join(""));
}
export const looksUrl = (p) => "Attachment \"" + shownPath(p) + "\" looks like a URL, not a local file path. This tool can only send files that exist on the local filesystem — download or write the content to a local file first, then pass that path.";
export const uncPath = (p) => "Attachment \"" + shownPath(p) + "\" is a UNC network path, which is not supported.";
export const networkMount = (p) => "Attachment \"" + shownPath(p) + "\" is under /net, /Network, /.vol, /.file, /.nofollow or /.resolve, which could trigger a network mount, so it is not supported. Copy the file to an ordinary local path and pass that path instead.";
export const deviceFile = (p) => "Attachment \"" + shownPath(p) + "\" is a device or process file, which this tool does not send.";
export const procLink = (p) => "Attachment \"" + shownPath(p) + "\" is a path through a /proc or /dev link that this tool does not follow; give the file's own path.";
export const badName = (p) => "Cannot send " + quotedPath(p) + ": its name contains a line break, another control character or a character that changes text direction. If a file is really named so, copy or rename it to a name without such characters and send that; otherwise correct the path.";
/** Coder's name for Claude Code's permissions.blockReadsOutsideWorkingDirectories (its file tools' read block's, coder-agent.mjs). */
export const READ_BLOCK_SETTING = "CODER_BLOCK_READS_OUTSIDE_WORKING_DIRECTORIES";
/** Outside the working directories while reads outside them are blocked (its words, naming Coder's setting). */
export const outsideBlocked = (p, setting) => "Attachment \"" + shownPath(p) + "\" is outside the working directories; reads outside them are blocked (" + setting + ").";
export const notRegular = (p) => "Attachment \"" + shownPath(p) + "\" is not a regular file.";
export const missingFile = (p, cwd, guess = "") => "Attachment \"" + shownPath(p) + "\" does not exist. Current working directory: " + shownPath(cwd) + "." + (guess && shownPath(guess) === guess ? " Did you mean \"" + guess + "\"?" : "");
export const notAccessible = (p, code) => "Attachment \"" + shownPath(p) + "\" is not accessible (" + code + ").";
/** A path that looks like a URL (its rAs's test). */
export const URL_LIKE = /^[a-z][a-z0-9+.-]+:\/\//i;
/** A UNC path (its Ir: two slashes or backslashes first). */
export const UNC_LIKE = /^[\\/]{2}/;
/** A file name with a line break, another control character or one that changes text direction (its IVn: control characters, the two line separators and the direction marks U+202A to U+202E and U+2066 to U+2069). */
export const BAD_NAME = /[\p{Cc}\u2028\u2029\u202a-\u202e\u2066-\u2069]/u;
/** Under a folder that could start a network mount (its pk). */
export const NETWORK_MOUNT = /^\/(?:net|Network|\.vol|\.file|\.nofollow|\.resolve)(?:\/|$)/;

// ── WHAT IT SENDS ────────────────────────────────────────────────────────────
/** A sent file's type by its ending, as Claude Code's (its sRe); undefined for any other. */
export const SEND_TYPES = Object.freeze({ ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml", ".bmp": "image/bmp", ".ico": "image/x-icon", ".heic": "image/heic", ".heif": "image/heif", ".avif": "image/avif", ".tif": "image/tiff", ".tiff": "image/tiff", ".mp4": "video/mp4", ".m4v": "video/x-m4v", ".mov": "video/quicktime", ".webm": "video/webm", ".avi": "video/x-msvideo", ".mkv": "video/x-matroska", ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".wav": "audio/wav", ".ogg": "audio/ogg", ".aac": "audio/aac", ".flac": "audio/flac", ".pdf": "application/pdf", ".txt": "text/plain", ".log": "text/plain", ".md": "text/markdown", ".json": "application/json", ".csv": "text/csv", ".html": "text/html", ".htm": "text/html", ".xml": "application/xml", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation", ".zip": "application/zip" });
const endingOf = (name) => { const m = /(\.[^./\\]*)$/.exec(String(name || "")); return m ? m[1].toLowerCase() : ""; };
export const sendTypeOf = (name) => SEND_TYPES[endingOf(name)];
/** A picture by its name (its Rln). */
export const isImageName = (name) => /\.(png|jpe?g|gif|webp)$/i.test(String(name || ""));
/**
 * The most one sent file may be: Claude Code 2.1.327's own limit, 500 MiB (its KXn; its service may name a lower one, "never
 * under 30 MiB", its n6r), and Coder's server's. A file up to SEND_INLINE_MAX goes in one request, read whole; a bigger one is
 * read from disk in SEND_PART_SIZE parts, as the AI's user, and kept by Coder's server in parts (R2 multipart), as Claude Code's
 * "large files now stream from disk instead of being read into memory". (The machine's tool output holds at most 8 MiB:
 * server.mjs TOOL_OUTPUT_MAX, so a part's base64 must fit in it.) The owner, 2026-11-18: "Match Claude Code".
 */
export const SEND_FILE_MAX = 524_288_000;
export const SEND_INLINE_MAX = 4 * 1048576, SEND_PART_SIZE = 5 * 1048576;
export const mib = (n) => (Number(n) / 1048576).toFixed(1) + " MiB";
export const limitWords = (n) => { const m = n / 1048576; return (Number.isInteger(m) ? m : m.toFixed(1)) + " MiB"; };
/**
 * ITS WORDS FOR A FILE NOT DELIVERED (2.1.327's upload, read in its program): one over the limit, as its server's refusal is
 * worded (its X: "40.0 MiB exceeds the 30 MiB upload limit", with the remedy its words add for "file_too_large"); a server's
 * refusal ("upload failed: server returned 503"); the network's ("upload failed: network error (timeout of 35000ms
 * exceeded)", or the connection closed); an answer it can't read.
 */
export const tooBigToSend = (size, max = SEND_FILE_MAX) => mib(size) + " exceeds the " + limitWords(max) + " upload limit";
/** Its server's refusal of one too big (HTTP 413, "file_too_large"): its words, and the remedy its words add for that code. */
export const serverTooBig = (size, max = SEND_FILE_MAX) => tooBigToSend(size, max) + " — send a smaller or compressed copy";
/** Its server's refusal past the account's allowance (its "file_limit_exceeded", HTTP 429): its cause and remedy, not to retry. */
export const allowanceUsed = (status = 429) => serverReturned(status) + " — this account has uploaded as many files as it is allowed for now (a count of files, not a size); sending again, even a smaller file, will fail the same way until the allowance resets, so tell the user instead of retrying";
/** Reading the file while it is sent (its UploadSourceError): it got shorter, or could not be read. */
export const SHORTER = "upload failed: the file became shorter while it was being uploaded";
export const couldNotRead = (why) => "upload failed: could not read file (" + why + ")";
export const serverReturned = (status) => "upload failed: server returned " + status;
export const networkError = (why) => "upload failed: network error (" + why + ")";
export const CONNECTION_CLOSED = "upload failed: the connection closed before the server answered";
export const UNEXPECTED_ANSWER = "upload failed: unexpected server response";
// ── ITS COPIES OF A PICTURE FOR THE CHAT (2.1.327: its preview copy, Xr, and its scaled copy, nt; not with display "attach") ──
/** A picture its apps can't show, made a PNG or JPEG copy that the chat gets in its place (its Xe). */
export const PREVIEW_COPY = Object.freeze({ ".bmp": "png", ".tif": "png", ".tiff": "png", ".heic": "jpeg", ".heif": "jpeg", ".avif": "jpeg" });
/** A picture its server takes, scaled down when wider or taller than IMAGE_SIDE_MAX (its Me and yae), up to IMAGE_PIXELS_MAX pixels (its ke). */
export const SCALE_TYPES = Object.freeze(new Set(["image/png", "image/jpeg", "image/webp"]));
export const IMAGE_SIDE_MAX = 8000, IMAGE_PIXELS_MAX = 40_000_000;
/** The most a picture may be for a copy to be made, and a copy itself (its L, 30 MiB); its JPEG copy's quality (its xr). */
export const COPY_MAX = 31_457_280, COPY_JPEG_QUALITY = 90;
/** A copy's name: the file's own, its ending the copy's ("photo.heic" → "photo.jpg"). */
export const copyName = (path, format) => String(path).split("/").pop().replace(/\.[^.]*$/, "") + "." + (format === "jpeg" ? "jpg" : "png");
/** A delivered file the chat got as a preview copy (its nAs): a PNG or JPEG in place of a file of another type. */
export const isPreviewCopy = (x) => !!x && x.file_uuid !== undefined && (x.media_type === "image/png" || x.media_type === "image/jpeg") && x.media_type !== sendTypeOf(x.path);
/** What Coder is told of a preview copy (its words, in the delivered list). */
export const previewCopyText = (x) => "The chat got a " + (x.media_type === "image/jpeg" ? "JPEG" : "PNG") + " copy of " + x.path + ", named " + copyName(x.path, x.media_type === "image/jpeg" ? "jpeg" : "png") + (x.isImage ? "" : ", which the chat shows as a plain file, not a picture") + "; the file at that path is unchanged.";
/** What Coder is told of scaled copies (its WRr), after the delivered list. */
export function scaledText(list) {
  const n = list.length;
  if (!n) return "";
  return n + " " + (n === 1 ? "image was sent to the chat as a scaled-down copy" : "images were sent to the chat as scaled-down copies") + ", because the server accepts images at most " + IMAGE_SIDE_MAX + " pixels wide or tall:\n" + list.map((x) => "  " + x.path + ": sent at " + x.scaled.width + "×" + x.scaled.height + " pixels; the original (" + x.scaled.original_width + "×" + x.scaled.original_height + ") is unchanged on disk").join("\n") + "\nTell the user they are seeing " + (n === 1 ? "a scaled-down copy" : "scaled-down copies") + "; if they need " + (n === 1 ? "the full-size original" : "a full-size original") + ", offer to send it inside a .zip.";
}

/**
 * THE FILES THAT OPEN IN THE SIDE PANEL BY THEMSELVES with `display` left out: its own list of what renders, "HTML, SVG, Mermaid,
 * images, PDFs" ("today that means renderable types render and everything else attaches").
 */
export const RENDERED_KINDS = /\.(png|jpe?g|gif|webp|svg|html?|pdf|mmd|mermaid)$/i;
/** What the side panel can show, opened by the owner or with `display` "render": those, plain text, and videos. */
export const VIEWABLE = /\.(png|jpe?g|gif|webp|svg|html?|pdf|mmd|mermaid|txt|log|md|csv|json|xml|mp4|webm|mov|m4v)$/i;
/** Whether a file opens in the side panel right away: `display` "render" (one the panel can show) or "attach", else by its kind. */
export const renders = (name, display) => (display === "attach" ? false : display === "render" ? VIEWABLE.test(String(name || "")) : RENDERED_KINDS.test(String(name || "")));

/** Failures that may pass, for its "ask again in a few minutes" (its De): a server's 429, 5xx or the proxies' 52x (its ze); the network's, but for a bad address or a certificate. */
const PASSING = new Set([429, 500, 502, 503, 504, 507, 520, 521, 522, 523, 524, 529]);
const SERVER_RETURNED = /^upload failed: server returned (\d+)$/;
const NETWORK_LIKE = /^upload failed: (?:network error \(|the connection closed before the server answered$|the server did not answer within \d|the transfer stalled \()/;
const NOT_PASSING = /\bInvalid URL\b|certificate/i;
export const mayPass = (why) => { const w = String(why || ""); if (w.includes(" — this account has uploaded as many files as it is allowed")) return false; return PASSING.has(Number((SERVER_RETURNED.exec(w) || [])[1])) || (NETWORK_LIKE.test(w) && !NOT_PASSING.test(w)); };
const plural = (n, one, many) => (n === 1 ? one : many);
/**
 * WHAT CODER IS TOLD (its mapToolResultToToolResultBlockParam, for the chat's own viewers): the files delivered, each with
 * its id ("file_uuid"); those that could not be, with their size and why, and what to tell the owner; for a failure that may
 * pass, that they can ask again in a few minutes.
 */
export function sentText(data) {
  // (Paths and ids with control characters as entities, failures' words with `<` and `>` too: its Yc and Hp.)
  const list = (data && Array.isArray(data.attachments) ? data.attachments : []).map((x) => ({ ...x, path: visiblePath(x.path), ...(x.file_uuid !== undefined ? { file_uuid: visiblePath(x.file_uuid) } : {}), ...(x.upload_error !== undefined ? { upload_error: shownPath(x.upload_error) } : {}) }));
  const ok = list.filter((x) => x.upload_error === undefined), bad = list.filter((x) => x.upload_error !== undefined), out = [];
  if (ok.length) out.push([ok.length + " " + plural(ok.length, "file", "files") + " delivered to user.", ...ok.map((x) => "  " + x.path + " → file_uuid: " + x.file_uuid), ...ok.filter(isPreviewCopy).map(previewCopyText)].join("\n"));
  const scaled = scaledText(ok.filter((x) => x.scaled && typeof x.scaled === "object"));
  if (scaled) out.push(scaled);
  if (bad.length) {
    const passing = bad.filter((x) => mayPass(x.upload_error));
    let tail = "";
    if (passing.length) {
      const also = "also tell the user they can ask you to send " + plural(passing.length, "it", "them") + " again in a few minutes.";
      tail = passing.length === bad.length ? " The " + plural(passing.length, "failure", "failures") + " may be temporary, so " + also : " For " + new Intl.ListFormat("en", { type: "conjunction" }).format(passing.map((x) => x.path)) + ", whose " + plural(passing.length, "failure", "failures") + " may be temporary, " + also;
    }
    out.push(bad.length + " " + plural(bad.length, "file", "files") + " could NOT be delivered to the user:\n" + bad.map((x) => "  " + x.path + " (" + mib(x.size) + "): " + x.upload_error).join("\n") + "\nTell the user the " + plural(bad.length, "file was", "files were") + " not delivered and why." + tail);
  }
  return out.join("\n");
}
