// THE CUSTOMER'S OWN PHOTOGRAPHS ON A BUILD (2026-10-08, the first-Build
// audit's H6).
//
// A build hands the files the customer attached to the designer and the page
// writer as model input, and until this nothing else: no attached photograph
// was ever stored, so a writer told "use my photo of the shop" had nothing it
// could put in a `src`, and the picture was either dropped or invented.
//
// TWO KINDS OF ATTACHMENT, AND THE MODEL TELLS THEM APART. A sketch, a
// screenshot of a site the customer likes or a menu to copy words from is
// REFERENCE; a photograph they asked to have shown is MATERIAL. Nothing in the
// bytes says which, and a rule on the brief's wording would be a keyword rule,
// so the designer — which has the brief and sees the files — names a file on
// an `images` entry (`attached`) only when the customer wants THAT picture on
// the page. Code then checks the name against what was really attached,
// stores the bytes as an owner upload (content-hashed, the library the
// picture lane and the owner's panel already read) and hands the writer the
// url to place. A reference file is never stored.
//
// AN ENTRY THAT CANNOT BE PLACED IS SAID, never quietly bought instead: a name
// that matches no attached image, or a file the upload store refused, leaves
// the list and comes back in `missing` with the reason, for the reply.

// IDENTITY IS THE ATTACHMENT'S ID, NEVER ITS NAME (2026-10-08, Codex's review
// of `b4300a07`). `attachments()` (site-context.mjs) mints `attachment-<n>`
// for each file it hands the model — its position in the request — and the
// designer is told those ids. A name is shown beside the id for the reader
// and the customer, in full; two uploads with one name, or with a long shared
// prefix, are still two ids, and a reference that cannot be resolved to
// exactly one file is refused by name, never guessed.

import { attachmentId } from "./site-context.mjs";

const IMAGE_URL = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/;

/**
 * What the designer is told about the files, so it can name one by its id.
 * `named` is `attachments(list).named`. Empty when nothing was attached; a
 * leading blank line so the caller appends.
 */
export function attachedFilesNote(named) {
  const list = (Array.isArray(named) ? named : []).filter((f) => f && typeof f.id === "string");
  if (!list.length) return "";
  const kind = (f) => f.kind === "image" ? (f.still ? "a still from a video" : "an image") : f.kind === "document" ? "a PDF" : "a text file";
  return "\n\nTHE FILES THE CUSTOMER ATTACHED, in the order they reach you, each with its id:\n" +
    list.map((f) => "  " + f.id + ' — "' + String(f.name || "").replace(/"/g, "'") + '", ' + kind(f)).join("\n") +
    "\nAn attached image is REFERENCE unless the customer asked for that picture to be shown on the site. " +
    "When they did, put it in `images` with `attached` set to its id exactly as written here (for example " + list[0].id + "), never its file name.";
}

/**
 * The attached images by id: `{ id, name, mime, bytes }`, for exactly the
 * images `named` lists (what the model was given), read from the request's
 * own list at the index each id records.
 */
export function attachedImageBytes(list, named) {
  const items = Array.isArray(list) ? list : [];
  const out = new Map();
  for (const f of Array.isArray(named) ? named : []) {
    if (!f || f.kind !== "image" || !Number.isInteger(f.index) || f.id !== attachmentId(f.index)) continue;
    const a = items[f.index];
    const s = typeof a === "string" ? a : (a && typeof a.data === "string" ? a.data : "");
    const m = s.match(IMAGE_URL);
    if (!m) continue;
    let bytes;
    try {
      const bin = atob(m[2]);
      bytes = new Uint8Array(bin.length);
      for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
    } catch { continue; }
    out.set(f.id, { id: f.id, name: f.name, mime: m[1], bytes });
  }
  return out;
}

/**
 * Which attached file an `images` entry means, or why it means none: an id
 * the model was given; otherwise a name that exactly one given file has. A
 * name two files share, a name no file has, a prefix — refused, by reason.
 */
export function resolveAttached(ref, named) {
  const files = (Array.isArray(named) ? named : []).filter((f) => f && typeof f.id === "string");
  const r = typeof ref === "string" ? ref.trim() : "";
  if (!r) return { ok: false, reason: "no attachment was named" };
  const byId = files.find((f) => f.id === r);
  if (byId) return { ok: true, file: byId };
  const byName = files.filter((f) => f.name === r);
  if (byName.length === 1) return { ok: true, file: byName[0] };
  if (byName.length > 1) return { ok: false, reason: "more than one attached file has that name" };
  return { ok: false, reason: "no attached file has that id" };
}

/**
 * Store each photograph the plan asks to show and point its entry at it.
 *
 * `images` is the look's plan list; `files` the request's own `images`;
 * `named` what `attachments()` gave the model. `store(name, bytes)` stores
 * one file as an owner upload and answers `{ url }` or `{ error }`. An entry
 * that is placed keeps the file's ID in `attached` (never a name), so a
 * resumed or later build reads the same file. Entries without `attached`, and
 * one already carrying a `src`, pass through untouched.
 *
 * Returns `{ images, placed: [{ id, name, url, page }], missing: [{ ref, name, page, reason }] }`.
 */
export async function placeAttachedPhotos(images, files, store, { named = [] } = {}) {
  const list = Array.isArray(images) ? images : null;
  if (!list) return { images, placed: [], missing: [] };
  const bytes = attachedImageBytes(files, named);
  const placed = [], missing = [], out = [];
  const done = new Map();
  for (const e of list) {
    if (!e || typeof e !== "object" || typeof e.attached !== "string" || !e.attached || e.src) { out.push(e); continue; }
    const which = resolveAttached(e.attached, named);
    if (!which.ok) { missing.push({ ref: e.attached, name: e.attached, page: e.page, reason: which.reason }); continue; }
    const file = bytes.get(which.file.id);
    if (!file) { missing.push({ ref: e.attached, name: which.file.name, page: e.page, reason: "that attachment is not an image" }); continue; }
    let r = done.get(file.id);
    if (!r) {
      try { r = await store(file.name, file.bytes); } catch (err) { r = { error: String((err && err.message) || err).slice(0, 120) }; }
      done.set(file.id, r);
    }
    if (!r || typeof r.url !== "string" || !r.url) { missing.push({ ref: file.id, name: file.name, page: e.page, reason: (r && r.error) || "it could not be stored" }); continue; }
    out.push({ ...e, attached: file.id, src: r.url });
    placed.push({ id: file.id, name: file.name, url: r.url, page: e.page });
  }
  return { images: out, placed, missing };
}

/**
 * The outcome as facts for the reply, without the stored list: which attached
 * photographs were placed and on which page, and which could not be, why.
 * `undefined` when the plan asked for none.
 */
export function ownPhotoFacts(r) {
  const placed = (r && Array.isArray(r.placed) ? r.placed : []).map((p) => ({ id: p.id, name: p.name, page: p.page, url: p.url }));
  const missing = (r && Array.isArray(r.missing) ? r.missing : []).map((m) => ({ ref: m.ref, name: m.name, page: m.page, reason: m.reason }));
  return placed.length || missing.length ? { placed, missing } : undefined;
}

/** The same, as a sentence beside the build's other context notes. */
export function ownPhotoSentence(facts, { state = "stopped" } = {}) {
  const published = state === "published";
  if (!facts) return "";
  const bits = [];
  // WHAT HAPPENED, NOT WHAT WAS PLANNED: stored is certain once `placed` names
  // it; ON THE SITE only when the build published. A build that stopped after
  // storing the picture says it is kept for the next attempt.
  const one = facts.placed.length === 1;
  const list = facts.placed.map((p) => p.name + " (for " + p.page + ")").join(", ");
  if (facts.placed.length) {
    bits.push(published
      // STORED IS CERTAIN; WHERE IT SITS IS THE PAGE WRITER'S, and this
      // reply cannot see the pages, so it says what was done and no more.
      ? "Your " + (one ? "photo " : "photos ") + list + " " + (one ? "is" : "are") + " stored with the site exactly as you sent " + (one ? "it" : "them") + ", and the pages were written with " + (one ? "it" : "them") + " to place."
      : state === "pending"
        ? "I saved your " + (one ? "photo " : "photos ") + list + " with the site for the pages being written now."
        : "I saved your " + (one ? "photo " : "photos ") + list + " with the site, so " + (one ? "it's" : "they're") + " ready for the next build — the site itself didn't finish this time.");
  }
  for (const m of facts.missing) bits.push("I couldn't put " + m.name + " on " + m.page + ": " + m.reason + ".");
  return bits.join(" ");
}
