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

import { MAX_ATTACHMENTS } from "./site-context.mjs";

const IMAGE_URL = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/;
export const ATTACHED_NAME_MAX = 80;

const nameOf = (a, i) => String((a && a.name) || "").trim().slice(0, ATTACHED_NAME_MAX) || ("attachment " + (i + 1));

/**
 * The attached files, by the names the model is told, in the order its blocks
 * arrive: `{ name, kind }`, `kind` "image", "document" or "text". Read off
 * the same first `MAX_ATTACHMENTS` the model is given, so a name here is a
 * file the model saw.
 */
export function attachedNames(list) {
  const out = [];
  for (const [i, a] of (Array.isArray(list) ? list : []).slice(0, MAX_ATTACHMENTS).entries()) {
    const name = nameOf(a, i);
    if (a && typeof a.text === "string" && a.text.trim()) { out.push({ name, kind: "text" }); continue; }
    const s = typeof a === "string" ? a : (a && typeof a.data === "string" ? a.data : "");
    if (IMAGE_URL.test(s)) out.push({ name, kind: "image", ...(a && a.frameOf ? { still: true } : {}) });
    else if (/^data:application\/pdf;base64,/.test(s)) out.push({ name, kind: "document" });
  }
  return out;
}

/**
 * What the designer is told about the files, so it can name one. Empty when
 * nothing was attached; a leading blank line so the caller appends.
 */
export function attachedFilesNote(named) {
  const list = (Array.isArray(named) ? named : []).filter((f) => f && typeof f.name === "string");
  if (!list.length) return "";
  const kind = (f) => f.kind === "image" ? (f.still ? "a still from a video" : "an image") : f.kind === "document" ? "a PDF" : "a text file";
  return "\n\nTHE FILES THE CUSTOMER ATTACHED, in the order they reach you:\n" +
    list.map((f, i) => "  " + (i + 1) + '. "' + f.name + '" — ' + kind(f)).join("\n") +
    "\nAn attached image is REFERENCE unless the customer asked for that picture to be shown on the site. " +
    "When they did, put it in `images` with `attached` set to its name exactly as written here.";
}

/** The attached images the customer sent, by name: `{ mime, bytes }`. */
export function attachedImageBytes(list) {
  const out = new Map();
  for (const [i, a] of (Array.isArray(list) ? list : []).slice(0, MAX_ATTACHMENTS).entries()) {
    const s = typeof a === "string" ? a : (a && typeof a.data === "string" ? a.data : "");
    const m = s.match(IMAGE_URL);
    if (!m) continue;
    const name = nameOf(a, i);
    if (out.has(name)) continue;
    let bytes;
    try {
      const bin = atob(m[2]);
      bytes = new Uint8Array(bin.length);
      for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
    } catch { continue; }
    out.set(name, { mime: m[1], bytes });
  }
  return out;
}

/**
 * Store each photograph the plan asks to show and point its entry at it.
 *
 * `images` is the look's plan list; `files` is the request's own `images`
 * (the browser's attachments). `store(name, bytes)` stores one file as an
 * owner upload and answers `{ url }` or `{ error }`. Entries without
 * `attached` pass through untouched; an entry already carrying a `src` (one
 * placed by an earlier build) is kept as it is.
 *
 * Returns `{ images, placed: [{ name, url, page }], missing: [{ name, page, reason }] }`.
 */
export async function placeAttachedPhotos(images, files, store) {
  const list = Array.isArray(images) ? images : null;
  if (!list) return { images, placed: [], missing: [] };
  const bytes = attachedImageBytes(files);
  const placed = [], missing = [], out = [];
  const done = new Map();
  for (const e of list) {
    if (!e || typeof e !== "object" || typeof e.attached !== "string" || !e.attached || e.src) { out.push(e); continue; }
    const name = e.attached;
    const file = bytes.get(name);
    if (!file) { missing.push({ name, page: e.page, reason: "no attached image has that name" }); continue; }
    let r = done.get(name);
    if (!r) {
      try { r = await store(name, file.bytes); } catch (err) { r = { error: String((err && err.message) || err).slice(0, 120) }; }
      done.set(name, r);
    }
    if (!r || typeof r.url !== "string" || !r.url) { missing.push({ name, page: e.page, reason: (r && r.error) || "it could not be stored" }); continue; }
    out.push({ ...e, src: r.url });
    placed.push({ name, url: r.url, page: e.page });
  }
  return { images: out, placed, missing };
}

/**
 * The outcome as facts for the reply, without the stored list: which attached
 * photographs were placed and on which page, and which could not be, why.
 * `undefined` when the plan asked for none.
 */
export function ownPhotoFacts(r) {
  const placed = (r && Array.isArray(r.placed) ? r.placed : []).map((p) => ({ name: p.name, page: p.page, url: p.url }));
  const missing = (r && Array.isArray(r.missing) ? r.missing : []).map((m) => ({ name: m.name, page: m.page, reason: m.reason }));
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
