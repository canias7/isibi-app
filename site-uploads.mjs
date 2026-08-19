// Pictures for a published site.
//
// `/u/<slug>/<file>` has served uploads from R2 since the D1 era — public,
// immutable-cached, `nosniff` — and **nothing has ever written one**. The read
// half survived the 2026-07-27 runtime deletion and the write half did not, so
// no site the builder produces can have a photo: a café's menu, a barber's
// gallery, a shop's products are all text.
//
// Storage lives at `uploads/<slug>/`, deliberately NOT under `sites/<slug>/`,
// which `deleteSitePrefix` wipes on every publish. A revise must not delete the
// owner's photographs.
//
// Injected like the rest, so every decision here runs without R2 or a Worker.

import { isImageColumn, canWriteAccess, canMemberWrite } from "./site-access.mjs";

const json = (body, status = 200) => ({ status, body });

/** Per file. Big enough for a real photograph, small enough to be a bad DoS. */
export const MAX_UPLOAD_BYTES = 5_000_000;
/**
 * A DOCUMENT GETS MORE ROOM THAN A PHOTOGRAPH, because they are not the same
 * object. A 5 MB cap is generous for a picture and mean for a scanned brochure
 * or a council's annual return — the things this exists for. Still bounded by
 * `MAX_SITE_BYTES`, so an owner can hold a few and not the whole bucket.
 */
export const MAX_DOC_BYTES = 10_000_000;

/** What the per-file cap is, given what the bytes turned out to be. */
export function maxBytesFor(kind) {
  return kind && kind.kind === "doc" ? MAX_DOC_BYTES : MAX_UPLOAD_BYTES;
}
/** Per site, so one account cannot fill the bucket. */
export const MAX_FILES_PER_SITE = 200;
export const MAX_SITE_BYTES = 100_000_000;

/**
 * What the bytes ACTUALLY are, from their leading bytes — never the declared
 * Content-Type, which the caller writes and can lie about.
 *
 * **SVG is deliberately absent.** `/u/` serves with `content-disposition:
 * inline` from gofarther.dev, and an SVG is a document that can carry <script>. That
 * is stored XSS on the platform's own origin, and `nosniff` does not help
 * because the type would be honestly declared as image/svg+xml. There is no
 * safe way to serve visitor-supplied SVG from this origin without a separate
 * domain, so it is refused rather than half-mitigated.
 */
export function sniffImage(b) {
  if (!b || typeof b.length !== "number") return null;
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: "image/png", ext: "png" };
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { mime: "image/webp", ext: "webp" };
  if (b.length > 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 &&
      (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61) return { mime: "image/gif", ext: "gif" };
  return null;
}

/**
 * THE ZIP FAMILY: THE BYTES DECIDE THE FAMILY AND THE NAME PICKS THE MEMBER.
 *
 * `.xlsx`, `.docx` and `.pptx` ARE zip archives — Office Open XML is a zip of
 * XML parts — so no magic number can tell them from each other or from a plain
 * `.zip` without unpacking the archive and reading `[Content_Types].xml`, which
 * may be deflated. So within this one family the declared extension chooses,
 * and an extension we do not recognise degrades to `.zip`.
 *
 * THAT GIVES UP NOTHING, and the reason is worth stating rather than assuming:
 * every member here is the same bytes, is served `attachment` (never rendered),
 * and is inert to the browser. The extension can only pick among types that are
 * already equivalent from a security point of view, so a lie about it buys an
 * attacker a differently-named download and nothing else.
 *
 * THE MACRO-ENABLED FORMS ARE DELIBERATELY ABSENT. `.xlsm`/`.docm` are the ones
 * that carry executable macros; they are zips too, so they still upload, and
 * they come back down named `.zip`. That is the safe direction — somebody who
 * genuinely wants one renames it — and it means we never hand a visitor a file
 * their own operating system is right to warn them about.
 */
const ZIP_MEMBERS = {
  zip: "application/zip",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

/**
 * What an OWNER may upload: a picture, or a document to hand out.
 *
 * `download-card` has been in the generator's shortlist since the kit was
 * written and the corpus reaches for it 24 times — a parish council's annual
 * return, a franchise prospectus, a food hygiene certificate, a photographer's
 * press pack. **Every one of those was refused by the only route that could
 * store it**, because both upload gates sniffed images and nothing else. So the
 * platform put a download button in front of the model and had nowhere for the
 * file to go: the component was reachable and the bytes were not.
 *
 * PDF IS THE FEATURE, measured rather than assumed — 21 of the corpus's 24
 * named files are `.pdf`. The zip family is the tail and is here because the
 * next two (`.xlsx`, `.docx`) are what a business hands out when it is not a
 * PDF, and refusing them means a limit somebody hits on their first afternoon.
 *
 * SVG IS STILL REFUSED, for the reason in `sniffImage` above: it is a document
 * that can carry <script>, and `attachment` would not save us — an owner can
 * link the raw URL from their own page, at which point the browser is rendering
 * it inline on this origin whatever we sent.
 */
export function sniffUpload(b, name) {
  const img = sniffImage(b);
  if (img) return { ...img, kind: "image" };
  if (!b || typeof b.length !== "number") return null;
  // %PDF-
  if (b.length > 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) {
    return { mime: "application/pdf", ext: "pdf", kind: "doc" };
  }
  // PK\x03\x04 — the local file header every zip starts with. The empty-archive
  // and spanned-archive signatures (PK\x05\x06, PK\x07\x08) are deliberately not
  // accepted: an archive with nothing in it is not a download.
  if (b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) {
    const declared = String(name || "").toLowerCase().split(".").pop();
    const ext = Object.hasOwn(ZIP_MEMBERS, declared) ? declared : "zip";
    return { mime: ZIP_MEMBERS[ext], ext, kind: "doc" };
  }
  return null;
}

/** Every extension either sniffer can mint, so one list decides what `/u/` may address. */
export const UPLOAD_EXTS = ["png", "jpg", "webp", "gif", "pdf", ...Object.keys(ZIP_MEMBERS)];

/**
 * What a browser should DO with the bytes, decided from the type that was
 * STORED — which is what the leading bytes said, and the one thing about a file
 * the caller cannot lie about.
 *
 * A picture is `inline`, exactly as it has always been: an `<img>` pointing at
 * an attachment renders nothing. A document is `attachment`, which is both what
 * a download button means and the thing that stops a PDF being rendered by the
 * browser's own viewer on this origin.
 *
 * BOTH FILENAME FORMS, or a business whose language is not written in Latin
 * letters gets a download called `a1b2c3d4….pdf`. The bare `filename=` is
 * ASCII-only by the spec, so it carries the stripped fallback; `filename*=` is
 * percent-encoded UTF-8 and carries the real one. `encodeURIComponent` escapes
 * the quote and every control character, so that half cannot inject a header
 * whatever was uploaded — and the plain half is built from an allow-list, so
 * neither can.
 */
export function dispositionFor(mime, filename) {
  const isDoc = typeof mime === "string" && (mime === "application/pdf" || Object.values(ZIP_MEMBERS).includes(mime));
  if (!isDoc) return "inline";
  // Cleaned again even though `downloadNameFor` already cleaned it, because this
  // reads a value out of storage rather than out of that function: an object
  // written before this existed, or by anything else, has to be safe here too.
  const raw = String(filename || "").trim();
  if (!raw) return "attachment";
  const ascii = raw.replace(/[^A-Za-z0-9 ._-]+/g, "").replace(/\s+/g, " ").trim();
  const head = ascii ? 'attachment; filename="' + ascii + '"' : "attachment";
  // The starred form is only worth sending when it says something the plain one
  // could not — otherwise it is a second copy of the same string for every
  // ordinary English filename.
  return ascii === raw ? head : head + "; filename*=UTF-8''" + encodeURIComponent(raw);
}

/**
 * The name a download arrives under. NOT the stored name — that is the content
 * hash and stays exactly as it was, because everything the hash buys (no
 * traversal, free dedup, an honest `immutable`) depends on it.
 *
 * THE EXTENSION IS OURS, NEVER THEIRS. A file called `invoice.exe` whose bytes
 * are a PDF comes back down as `invoice.pdf`: the stem is the owner's, the
 * suffix is what the bytes actually are, so the two can never disagree.
 */
export function downloadNameFor(original, ext) {
  // INVISIBLES FIRST. This ends up in a header and in a browser's own save
  // dialog, and `\p{Cf}` is where the bidi overrides live — the character that
  // makes `holiday<RLO>fdp.exe` DISPLAY as `holidayexe.pdf`, which is the oldest
  // filename spoof there is and is invisible in every log.
  const clean = String(original || "").replace(/[\p{Cc}\p{Cf}]+/gu, " ");
  // THE BASENAME, the way a browser does it: `a/b/c.pdf` is `c.pdf` and
  // `../../etc/passwd` is `passwd`. Collapsing separators to spaces instead
  // keeps every directory in the name, which is both ugly and a `..` away from
  // being a path again.
  const base = clean.split(/[\\/]/).filter((part) => part.trim()).pop() || "";
  const stem = base
    // Never the LEADING dot: `.hidden` is a file called `.hidden` with no
    // extension, and treating that dot as one leaves nothing at all.
    .replace(/(?!^)\.[^.]*$/, "")
    .replace(/\s+/g, " ")
    .slice(0, 60)
    // A leading dot is a hidden file on every unix-ish machine, and a trailing
    // dot or space is a name Windows silently rewrites.
    .replace(/^[.\s]+|[.\s]+$/g, "");
  return stem ? stem + "." + ext : null;
}

/**
 * The metadata key the download name is stored under, and the encoding it is
 * stored in.
 *
 * PERCENT-ENCODED, because R2 custom metadata rides in object metadata that is
 * ASCII by convention, and a Greek or Japanese filename is exactly the case
 * `downloadNameFor` keeps rather than strips. Encoding here means the stored
 * value is always ASCII and the string that comes back is byte-for-byte the one
 * that went in.
 *
 * ONE PLACE KNOWS IT, deliberately. The upload route writes this and the serve
 * route reads it, ~6,000 lines apart, and a contract shared between two call
 * sites with no function in the middle is the shape this repo has recorded a
 * dozen times: the two halves drift and the failure is a filename nobody can
 * explain.
 */
export const DOWNLOAD_NAME_KEY = "dl";
export const storeDownloadName = (name) => (name ? encodeURIComponent(name) : null);
export function readDownloadName(v) {
  // A value we cannot decode is one we did not write. `dispositionFor` would
  // strip it safely either way, but the honest answer is that we do not know
  // what this is, and a hash-named download beats a mangled one.
  if (!v || typeof v !== "string") return "";
  try { return decodeURIComponent(v); } catch { return ""; }
}

/**
 * The stored name is a hash of the CONTENT, not anything the caller sent.
 *
 * Three things fall out of that and all of them matter. A caller cannot choose
 * a path, so traversal and overwriting another site's file are closed by
 * construction rather than by escaping. Re-uploading the same picture is free
 * and idempotent instead of a second copy. And `/u/` serving `immutable` is
 * actually TRUE — the name *is* the bytes, so a cached copy can never be stale.
 */
export function uploadName(hashHex, ext) {
  const hex = String(hashHex || "").replace(/[^a-f0-9]/gi, "").slice(0, 32).toLowerCase();
  // Null rather than a short name. `handleUploadDelete` only accepts names of
  // the shape minted here, so a degenerate one — reachable only by wiring `hash`
  // to something that is not hex — would create an object nothing could ever
  // address again. Permanent garbage in the bucket from our own bug.
  return hex.length === 32 ? hex + "." + ext : null;
}

// Exported, because the build's own photograph generator stores files in the
// same place and a SECOND copy of these two lines is a picture written where
// `/u/` does not look for it — a 404 nothing in the pipeline would catch, since
// the bundle compiles perfectly around a dead URL.
export const uploadKey = (slug, name) => "uploads/" + String(slug).toLowerCase() + "/" + name;
export const uploadUrl = (slug, name) => "/u/" + String(slug).toLowerCase() + "/" + name;
/**
 * The inverse of `uploadKey` — the file's own name out of a stored object key.
 *
 * HERE BECAUSE `uploadKey` IS HERE. The layout of that key is this module's, so
 * a caller splitting it by hand is a second place that knows it, and the two
 * drift the first time the prefix changes.
 */
export const uploadFileName = (key) => String(key || "").split("/").pop() || "";
const keyFor = uploadKey;
const urlFor = uploadUrl;

/**
 * deps:
 *   gate(slug, uid)              → {error} | {}     ownership, shared with site-owner.mjs
 *   hash(bytes)                  → hex
 *   list(slug)                   → [{key, size}]
 *   put(key, bytes, contentType, meta?) → void
 *   remove(key)                  → void
 */
export async function handleUpload(deps, { slug, uid, bytes, filename } = {}) {
  const gate = await deps.gate(slug, uid);
  if (gate.error) return gate.error;

  if (!bytes || !bytes.length) return json({ error: "no file" }, 400);

  // THE SNIFF COMES BEFORE THE SIZE CHECK, because what the bytes are is what
  // decides which cap applies — a 7 MB brochure is fine and a 7 MB photograph is
  // not. The outer bound is still enforced ahead of this by the route, on
  // content-length, so nothing unbounded is ever buffered to get here.
  const kind = sniffUpload(bytes, filename);
  // Named types, so the answer is "we take these" rather than "not that".
  if (!kind) {
    return json({ error: "that doesn't look like a picture (PNG, JPEG, WebP, GIF) or a document (PDF, ZIP, Word, Excel)", code: "bad_type" }, 415);
  }

  const cap = maxBytesFor(kind);
  if (bytes.length > cap) {
    return json({
      error: kind.kind === "doc"
        ? "that file is too big — keep it under 10 MB"
        : "that image is too big — keep it under 5 MB",
      code: "too_big", max: cap,
    }, 413);
  }

  const name = uploadName(await deps.hash(bytes), kind.ext);
  if (!name) return json({ error: "couldn't store that just now" }, 500);
  const key = keyFor(slug, name);

  const existing = await deps.list(slug);
  // Re-uploading the same picture is the same object. It must not count against
  // the cap, and must not fail when the site is full — the bytes are already
  // there, so refusing would be refusing to do nothing.
  const already = existing.find((o) => o && o.key === key);
  // A re-upload keeps the name the FIRST one was stored under. The key is the
  // content hash, so these really are the same file, and rewriting the metadata
  // would rename a download that pages already link to by that name.
  if (already) {
    return json({ ok: true, url: urlFor(slug, name), name, size: bytes.length, mime: kind.mime, kind: kind.kind, download: readDownloadName(already.download) || undefined, dedup: true });
  }

  const used = existing.reduce((n, o) => n + (Number(o && o.size) || 0), 0);
  if (existing.length >= MAX_FILES_PER_SITE) {
    return json({ error: "this site has reached its image limit — delete some first", code: "full", max: MAX_FILES_PER_SITE }, 409);
  }
  if (used + bytes.length > MAX_SITE_BYTES) {
    return json({ error: "this site is out of image storage — delete some first", code: "full", max: MAX_SITE_BYTES }, 409);
  }

  const download = downloadNameFor(filename, kind.ext);
  const stored = storeDownloadName(download);
  await deps.put(key, bytes, kind.mime, stored ? { [DOWNLOAD_NAME_KEY]: stored } : undefined);
  return json({ ok: true, url: urlFor(slug, name), name, size: bytes.length, mime: kind.mime, kind: kind.kind, download: download || undefined }, 201);
}

/** What the site has, so the owner can pick one or clear space. */
export async function handleUploadList(deps, { slug, uid } = {}) {
  const gate = await deps.gate(slug, uid);
  if (gate.error) return gate.error;
  const objs = await deps.list(slug);
  const prefix = "uploads/" + String(slug).toLowerCase() + "/";
  const files = objs
    .filter((o) => o && typeof o.key === "string" && o.key.startsWith(prefix))
    .map((o) => {
      const name = o.key.slice(prefix.length);
      const ext = name.split(".").pop();
      // Which of the two a file is, said out loud rather than left to the panel
      // to guess from an extension. The panel shows a thumbnail for one and a
      // filename for the other, and a wrong guess there is a broken image.
      const kind = ext === "pdf" || Object.hasOwn(ZIP_MEMBERS, ext) ? "doc" : "image";
      const download = readDownloadName(o.download);
      return { name, url: urlFor(slug, name), size: Number(o.size) || 0, kind, ...(download ? { download } : {}) };
    });
  return json({
    files,
    used: files.reduce((n, f) => n + f.size, 0),
    max: MAX_SITE_BYTES,
    count: files.length,
    maxCount: MAX_FILES_PER_SITE,
  });
}

export async function handleUploadDelete(deps, { slug, uid, file } = {}) {
  const gate = await deps.gate(slug, uid);
  if (gate.error) return gate.error;
  // The name is checked against the shape we MINT, not merely sanitised: this
  // reaches an R2 key, and a name from a caller must never be able to address
  // anything outside this site's prefix.
  // DERIVED FROM THE SNIFFERS, never a second list: a name this route refuses is
  // a file the owner can upload and can never remove, and the two lists drifting
  // apart is exactly how that happens.
  if (!new RegExp("^[a-f0-9]{1,32}\\.(" + UPLOAD_EXTS.join("|") + ")$").test(String(file || ""))) {
    return json({ error: "no such file" }, 404);
  }
  const objs = await deps.list(slug);
  const key = keyFor(slug, file);
  if (!objs.some((o) => o && o.key === key)) return json({ error: "no such file" }, 404);
  await deps.remove(key);
  return json({ ok: true, name: file });
}


// ─────────────────────────────────────────────────── uploads from a VISITOR
//
// A different thing entirely from the owner's, and treated as such. This one is
// unauthenticated by design — a customer attaching a photo to a booking has no
// account — which makes it a public endpoint that accepts arbitrary bytes and
// serves them back from gofarther.dev. Everything above still applies (bytes decide
// the type, no SVG, we name the file); these are the additional limits that
// exist only because the caller is a stranger.

/** Smaller than the owner's: a phone photo, not a print master. */
export const MAX_VISITOR_UPLOAD_BYTES = 2_000_000;
/**
 * A visitor allowance INSIDE the site's budget, so a flood can never crowd the
 * owner out of their own storage. They can exhaust this and the owner's own
 * pictures are untouched.
 */
export const MAX_VISITOR_FILES = 50;
export const MAX_VISITOR_BYTES = 25_000_000;

/**
 * May this site accept a file for this table at all?
 *
 * Both halves matter. The table must be one a visitor can WRITE — there is no
 * reason to accept a picture for a table they cannot submit to — and it must
 * DECLARE somewhere to put it. A barber shop whose booking form is six text
 * fields has no image column, so it accepts nothing, which is the answer for
 * the large majority of sites.
 *
 * This is what keeps the endpoint from being open image hosting for anyone who
 * knows a slug.
 *
 * IT ASKED THE PRESET NAME, WHICH IS THE PAIR BUG — the fourth reader to have
 * it, after the lint's write gate, the digest's PAID line and the response's
 * `schema` field. `normalizeSchema` STAMPS `access: "collect"` on any table that
 * did not name one of the five presets, and `design_schema` tells the model to
 * leave `access` out when it declares a `read`/`write` pair instead — so a table
 * declared as a pair arrived here wearing a name nobody wrote, and the answer
 * was whatever that stamp happened to be. Both directions were wrong: a
 * pair-declared table with no writes at all read as `collect` and accepted
 * files, and one declared `{read:"public", write:"own"}` — a members' gallery,
 * exactly the shape this feature is for — was refused.
 *
 * `site-access.mjs` answers the access question and this file does not re-derive
 * it: the two named predicates between them are "write is not `none`", which is
 * precisely the set the preset list was reaching for.
 */
export function acceptsVisitorUploads(def) {
  if (!def) return false;
  if (!canWriteAccess(def) && !canMemberWrite(def)) return false;
  return (Array.isArray(def.columns) ? def.columns : [])
    .map((c) => String(typeof c === "string" ? c : (c && c.name) || ""))
    .some(isImageColumn);
}

/**
 * deps: as handleUpload, minus `gate`, plus
 *   tableFor(slug, table) → def | null      resolved from the site's own schema
 *   throttle(key)         → {ok, retryAfter}
 */
export async function handleVisitorUpload(deps, { slug, table, bytes, ip } = {}) {
  const def = await deps.tableFor(slug, table);
  if (!def) return json({ error: "no such table" }, 404);
  if (!acceptsVisitorUploads(def)) {
    return json({ error: "this form doesn't take files", code: "no_uploads" }, 403);
  }

  // Throttled before anything is read or hashed: a flood must cost us as close
  // to nothing as possible, and this is the endpoint a stranger can call.
  const t = await deps.throttle(`vu:${String(slug).toLowerCase()}:${ip || "unknown"}`);
  if (!t || !t.ok) {
    return json({ error: "too many uploads — wait a moment", code: "rate_limit", retryAfter: (t && t.retryAfter) || 60 }, 429);
  }

  if (!bytes || !bytes.length) return json({ error: "no file" }, 400);
  if (bytes.length > MAX_VISITOR_UPLOAD_BYTES) {
    return json({ error: "that image is too big — keep it under 2 MB", code: "too_big", max: MAX_VISITOR_UPLOAD_BYTES }, 413);
  }

  const kind = sniffImage(bytes);
  if (!kind) return json({ error: "that doesn't look like a PNG, JPEG, WebP or GIF", code: "bad_type" }, 415);

  const name = uploadName(await deps.hash(bytes), kind.ext);
  if (!name) return json({ error: "couldn't store that just now" }, 500);
  const key = keyFor(slug, name);

  const existing = await deps.list(slug);
  const already = existing.find((o) => o && o.key === key);
  if (already) return json({ ok: true, url: urlFor(slug, name), name, size: bytes.length, mime: kind.mime, dedup: true });

  // Only what visitors have added counts against the visitor allowance. The
  // owner's own pictures are not the stranger's budget to spend.
  const mine = existing.filter((o) => o && o.visitor);
  const used = mine.reduce((n, o) => n + (Number(o.size) || 0), 0);
  if (mine.length >= MAX_VISITOR_FILES || used + bytes.length > MAX_VISITOR_BYTES) {
    return json({ error: "this form can't take more files right now", code: "full" }, 409);
  }

  // Marked, so the owner's listing can tell them apart, the allowance above can
  // be counted, and a sweep could one day drop unreferenced ones.
  await deps.put(key, bytes, kind.mime, { visitor: "1" });
  return json({ ok: true, url: urlFor(slug, name), name, size: bytes.length, mime: kind.mime }, 201);
}
