// FILES ATTACHED TO A MESSAGE IN A CODER CHAT (audit M-d-14, "Go Claude Code way", 2026-11-22). Claude Code's cloud sessions
// take files of any kind with a message, not only pictures: its release notes speak of files that fail to upload because
// of "too many pages, a password or a time-out", of uncommon image types that "now attach as regular files", of Claude
// being told when "a message's attachments past the first 20 were left out" or a file "could not be saved because the disk
// was full", and of the session's "uploads folder".
//
// The page sends each file here first (PUT /api/coder/projects/:id/files); it is kept with the chat
// (coder/<uid>/<chat>/attach/<id>, listed in attach.json) and only ever given out to that person, signed in, or to that
// chat's running job, with the job's own pass. With the message, Coder's machine fetches the files and saves them in the
// project's .coder-files folder (never saved to the branch), and Coder is told where. Nothing here is ever deleted: past
// the chat's limits a new file is refused, never an old one dropped (stored data is only deleted on the owner's word).

/** At most: one file (as Gloopy's attachments); files with one message (Claude Code: "past the first 20 were left out"). */
export const ATTACH_FILE_MAX = 25 * 1024 * 1024, ATTACH_PER_MESSAGE = 20;
/** At most this many files, and this much in all, kept with one chat; past either, a new file is refused (none is dropped). */
export const ATTACH_KEPT_MAX = 200, ATTACH_TOTAL_MAX = 1024 * 1024 * 1024;
export const ATTACH_ID = /^a[a-z0-9]{12}$/;

const listKey = (uid, id) => ["coder", uid, id, "attach.json"].join("/");
const fileKey = (uid, id, fid) => ["coder", uid, id, "attach", fid].join("/");

/** A file's name as kept: no folders, no characters that can't be seen, no dot first, at most 120 characters; "" when none is left. */
export function attachName(name) {
  let n = String(name == null ? "" : name).split(/[/\\]/).pop().replace(/[\p{Cc}\p{Cf}]/gu, "").replace(/[<>:"|?*]/g, "_").replace(/\s+/g, " ").trim();
  n = n.replace(/^\.+/, "").trim();
  if (n.length > 120) { const m = /\.([A-Za-z0-9]{1,10})$/.exec(n); const e = m ? "." + m[1] : ""; n = n.slice(0, 120 - e.length).trim() + e; }
  return n;
}

async function getJson(bucket, key, fallback) {
  const o = await bucket.get(key);
  if (!o) return fallback;
  try { return JSON.parse(await o.text()); } catch { return fallback; }
}

/** A chat's attached files: [{ id, name, size, at }], oldest first. */
export async function readAttach(bucket, uid, id) {
  const l = await getJson(bucket, listKey(uid, id), []);
  return (Array.isArray(l) ? l : []).filter((x) => x && ATTACH_ID.test(x.id) && attachName(x.name)).map((x) => ({ id: x.id, name: attachName(x.name), size: Number(x.size) || 0, at: Number(x.at) || 0, ...(x.out === true ? { out: true } : {}) }));
}

/** A FILE KEPT WITH THE CHAT: its name cleaned, its size within ATTACH_FILE_MAX, the chat within its limits. It, or { error }. */
// (`out`: a file Coder sent the owner, Claude Code's SendUserFile, kept the same way: batch 8, MISS-55.)
export async function keepAttach(bucket, uid, id, { name, bytes, out = false }, now = Date.now()) {
  const n = attachName(name);
  if (!n) return { error: "That file has no name that can be kept." };
  const size = bytes ? bytes.byteLength : 0;
  if (!size) return { error: "That file is empty." };
  if (size > ATTACH_FILE_MAX) return { error: "That file is over " + ATTACH_FILE_MAX / 1048576 + " MB." };
  const list = await readAttach(bucket, uid, id);
  if (list.length >= ATTACH_KEPT_MAX || list.reduce((a, x) => a + x.size, 0) + size > ATTACH_TOTAL_MAX) return { error: "This chat already keeps as many attached files as it can. Start a new chat to attach more." };
  const item = { id: "a" + crypto.randomUUID().replace(/-/g, "").slice(0, 12), name: n, size, at: now, ...(out ? { out: true } : {}) };
  await bucket.put(fileKey(uid, id, item.id), bytes, { httpMetadata: { contentType: "application/octet-stream" }, customMetadata: { name: n } });
  await bucket.put(listKey(uid, id), JSON.stringify([...list, item]), { httpMetadata: { contentType: "application/json" } });
  return item;
}

/** One attached file's bytes and record, or null. */
export async function attachOf(bucket, uid, id, fid) {
  if (!ATTACH_ID.test(String(fid || ""))) return null;
  const item = (await readAttach(bucket, uid, id)).find((x) => x.id === fid);
  if (!item) return null;
  const o = await bucket.get(fileKey(uid, id, fid));
  return o ? { item, body: o.body !== undefined ? o.body : await o.arrayBuffer() } : null;
}

/**
 * THE FILES A MESSAGE NAMES (`ids`, as the page sends them): each one this chat keeps, in order, the first
 * ATTACH_PER_MESSAGE; `left` how many past them were left out (Claude Code tells Claude "a message's attachments past the
 * first 20 were left out"). { files, left } or { error } for one the chat does not keep.
 */
export async function attachedFor(bucket, uid, id, ids) {
  const want = (Array.isArray(ids) ? ids : []).filter((x) => typeof x === "string").slice(0, 100);
  if (!want.length) return { files: [], left: 0 };
  const kept = await readAttach(bucket, uid, id);
  const files = [];
  for (const fid of want) {
    const f = kept.find((x) => x.id === fid);
    if (!f) return { error: "One of those files is gone: attach it again." };
    if (!files.some((x) => x.id === f.id)) files.push(f);
  }
  return { files: files.slice(0, ATTACH_PER_MESSAGE), left: Math.max(0, files.length - ATTACH_PER_MESSAGE) };
}

/** What Coder is told when files were left out (Claude Code: "a message's attachments past the first 20 were left out"). */
export const attachLeftNote = (n) => (n > 0 ? n + " more file" + (n === 1 ? " was" : "s were") + " attached to this message and left out: a message takes the first " + ATTACH_PER_MESSAGE + "." : "");
