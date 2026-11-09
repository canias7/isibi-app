// GLOOPY'S FILES, IN AND OUT, KEPT BY CODER'S WORKER (owner, 2026-11-09: "4"; Grok Bot reads what you attach, "images,
// audio, video, PDFs, Office documents, CSV, JSON, YAML, source code, HTML, email files, and notebooks", and the files it
// makes "appear as cards in the conversation"; dots' "Outputs").
//
// IN: the owner attaches a file to a message (the page sends it here first); with that message, Gloopy's machine fetches
// it with the job's own pass and puts it in Gloopy's work folder (files/). OUT: Gloopy hands over a file it made (its
// `files` tool); its machine sends it here with the job's pass; the owner gets a card with Download. Both kinds are kept
// per person (coder/<uid>/gloopy/files/<id>, listed in files.json), the oldest going first past FILES_MAX or
// FILES_TOTAL_MAX, and are only ever given out to the owner (signed in) or to that person's running Gloopy job.

/** At most: one file the owner attaches; one Gloopy sends (as its machine reads them); files kept; all of them together. */
export const FILE_IN_MAX = 25 * 1024 * 1024, FILE_OUT_MAX = 5 * 1024 * 1024, FILES_MAX = 100, FILES_TOTAL_MAX = 300 * 1024 * 1024;
/** At most this many files with one message. */
export const ATTACH_MAX = 10;
export const FILE_ID = /^f[a-z0-9]{12}$/;

/** The kinds of file kept (by their ending, with the type each is served as): documents, data, text and code, pictures, sound and video, and zip files. Never programs. */
export const FILE_TYPES = Object.freeze({
  pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text", ods: "application/vnd.oasis.opendocument.spreadsheet", odp: "application/vnd.oasis.opendocument.presentation",
  rtf: "application/rtf", txt: "text/plain", md: "text/markdown", csv: "text/csv", tsv: "text/tab-separated-values", json: "application/json",
  xml: "application/xml", yaml: "application/yaml", yml: "application/yaml", html: "text/html", htm: "text/html", ics: "text/calendar",
  vcf: "text/vcard", eml: "message/rfc822", ipynb: "application/x-ipynb+json", log: "text/plain", py: "text/plain", js: "text/plain",
  ts: "text/plain", sql: "text/plain", css: "text/plain", sh: "text/plain",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", heic: "image/heic", svg: "image/svg+xml",
  mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", ogg: "audio/ogg", mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm",
  zip: "application/zip",
});

const listKey = (uid) => ["coder", uid, "gloopy", "files.json"].join("/");
const fileKey = (uid, id) => ["coder", uid, "gloopy", "files", id].join("/");

/** A file's ending, small letters ("pdf"), or "". */
export const extOf = (name) => { const m = /\.([A-Za-z0-9]{1,6})$/.exec(String(name || "")); return m ? m[1].toLowerCase() : ""; };

/** A file's name as kept: no folders, no characters that can't be seen, at most 120; "" when it can't be kept (no known ending). */
export function cleanName(name) {
  let n = String(name == null ? "" : name).split(/[/\\]/).pop().replace(/[\p{Cc}\p{Cf}]/gu, "").replace(/[<>:"|?*]/g, "_").replace(/\s+/g, " ").trim();
  n = n.replace(/^\.+/, "");
  if (n.length > 120) { const e = extOf(n); n = n.slice(0, 119 - e.length).trim() + "." + e; }
  return n && FILE_TYPES[extOf(n)] ? n : "";
}

async function getJson(bucket, key, fallback) {
  const o = await bucket.get(key);
  if (!o) return fallback;
  try { return JSON.parse(await o.text()); } catch { return fallback; }
}

/** A person's files: [{ id, name, size, type, dir: "in" | "out", at }], newest first. */
export async function readFiles(bucket, uid) {
  const l = await getJson(bucket, listKey(uid), []);
  return (Array.isArray(l) ? l : []).filter((x) => x && FILE_ID.test(x.id) && cleanName(x.name) && (x.dir === "in" || x.dir === "out")).map((x) => ({ id: x.id, name: cleanName(x.name), size: Number(x.size) || 0, type: FILE_TYPES[extOf(x.name)], dir: x.dir, at: Number(x.at) || 0 })).slice(0, FILES_MAX);
}
const writeFiles = (bucket, uid, list) => bucket.put(listKey(uid), JSON.stringify(list), { httpMetadata: { contentType: "application/json" } });

/**
 * A FILE KEPT (the owner's attachment, "in", or one Gloopy sent, "out"): its name checked, its size within its limit;
 * the oldest go past FILES_MAX or FILES_TOTAL_MAX. Answers it, or { error } in the owner's words.
 */
export async function keepFile(bucket, uid, { name, bytes, dir }, now = Date.now()) {
  const n = cleanName(name);
  if (!n) return { error: "That kind of file can't be attached: documents, spreadsheets, slides, PDFs, text and data files, pictures, sound, video and zip files can." };
  const size = bytes ? bytes.byteLength : 0;
  const max = dir === "out" ? FILE_OUT_MAX : FILE_IN_MAX;
  if (!size) return { error: "That file is empty." };
  if (size > max) return { error: "That file is over " + max / 1048576 + " MB." };
  const item = { id: "f" + crypto.randomUUID().replace(/-/g, "").slice(0, 12), name: n, size, type: FILE_TYPES[extOf(n)], dir: dir === "out" ? "out" : "in", at: now };
  await bucket.put(fileKey(uid, item.id), bytes, { httpMetadata: { contentType: item.type }, customMetadata: { name: n } });
  let list = [item, ...(await readFiles(bucket, uid))];
  const drop = [];
  while (list.length > FILES_MAX || list.reduce((a, x) => a + x.size, 0) > FILES_TOTAL_MAX) drop.push(list.pop());
  for (const x of drop) if (x.id !== item.id && typeof bucket.delete === "function") await bucket.delete(fileKey(uid, x.id));
  await writeFiles(bucket, uid, list);
  return list.some((x) => x.id === item.id) ? item : { error: "That file is too big to keep." };
}

/** A file taken away. */
export async function removeFile(bucket, uid, id) {
  const list = await readFiles(bucket, uid);
  if (!list.some((x) => x.id === id)) return false;
  await writeFiles(bucket, uid, list.filter((x) => x.id !== id));
  if (typeof bucket.delete === "function") await bucket.delete(fileKey(uid, id));
  return true;
}

/** One file's bytes and record, or null. */
export async function fileOf(bucket, uid, id) {
  if (!FILE_ID.test(String(id || ""))) return null;
  const item = (await readFiles(bucket, uid)).find((x) => x.id === id);
  if (!item) return null;
  const o = await bucket.get(fileKey(uid, id));
  return o ? { item, body: o.body !== undefined ? o.body : await o.arrayBuffer() } : null;
}

/** The list as Gloopy is told of it with each message (the most recent 30). */
export const filesForTurn = (list) => list.slice(0, 30).map((x) => ({ id: x.id, name: x.name, size: x.size, dir: x.dir, at: x.at }));

/**
 * A FILE, DOWNLOADED (by the owner, signed in): always saved, never opened in the page, as its own name. Answers a
 * Response.
 */
export function fileDownload(item, body) {
  const ascii = item.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return new Response(body, { status: 200, headers: { "content-type": "application/octet-stream", "content-disposition": "attachment; filename=\"" + ascii + "\"; filename*=UTF-8''" + encodeURIComponent(item.name), "x-content-type-options": "nosniff", "content-security-policy": "sandbox; default-src 'none'", "cache-control": "private, no-store" } });
}

/** A file's size in words: "1.2 MB", "40 KB". */
export const sizeWords = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
