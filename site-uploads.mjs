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

const json = (body, status = 200) => ({ status, body });

/** Per file. Big enough for a real photograph, small enough to be a bad DoS. */
export const MAX_UPLOAD_BYTES = 5_000_000;
/** Per site, so one account cannot fill the bucket. */
export const MAX_FILES_PER_SITE = 200;
export const MAX_SITE_BYTES = 100_000_000;

/**
 * What the bytes ACTUALLY are, from their leading bytes — never the declared
 * Content-Type, which the caller writes and can lie about.
 *
 * **SVG is deliberately absent.** `/u/` serves with `content-disposition:
 * inline` from isibi.ai, and an SVG is a document that can carry <script>. That
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

const keyFor = (slug, name) => "uploads/" + String(slug).toLowerCase() + "/" + name;
const urlFor = (slug, name) => "/u/" + String(slug).toLowerCase() + "/" + name;

/**
 * deps:
 *   gate(slug, uid)              → {error} | {}     ownership, shared with site-owner.mjs
 *   hash(bytes)                  → hex
 *   list(slug)                   → [{key, size}]
 *   put(key, bytes, contentType) → void
 *   remove(key)                  → void
 */
export async function handleUpload(deps, { slug, uid, bytes } = {}) {
  const gate = await deps.gate(slug, uid);
  if (gate.error) return gate.error;

  if (!bytes || !bytes.length) return json({ error: "no file" }, 400);
  if (bytes.length > MAX_UPLOAD_BYTES) {
    return json({ error: "that image is too big — keep it under 5 MB", code: "too_big", max: MAX_UPLOAD_BYTES }, 413);
  }

  const kind = sniffImage(bytes);
  // Named types, so the answer is "we take these" rather than "not that".
  if (!kind) return json({ error: "that doesn't look like a PNG, JPEG, WebP or GIF", code: "bad_type" }, 415);

  const name = uploadName(await deps.hash(bytes), kind.ext);
  if (!name) return json({ error: "couldn't store that just now" }, 500);
  const key = keyFor(slug, name);

  const existing = await deps.list(slug);
  // Re-uploading the same picture is the same object. It must not count against
  // the cap, and must not fail when the site is full — the bytes are already
  // there, so refusing would be refusing to do nothing.
  const already = existing.find((o) => o && o.key === key);
  if (already) return json({ ok: true, url: urlFor(slug, name), name, size: bytes.length, mime: kind.mime, dedup: true });

  const used = existing.reduce((n, o) => n + (Number(o && o.size) || 0), 0);
  if (existing.length >= MAX_FILES_PER_SITE) {
    return json({ error: "this site has reached its image limit — delete some first", code: "full", max: MAX_FILES_PER_SITE }, 409);
  }
  if (used + bytes.length > MAX_SITE_BYTES) {
    return json({ error: "this site is out of image storage — delete some first", code: "full", max: MAX_SITE_BYTES }, 409);
  }

  await deps.put(key, bytes, kind.mime);
  return json({ ok: true, url: urlFor(slug, name), name, size: bytes.length, mime: kind.mime }, 201);
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
      return { name, url: urlFor(slug, name), size: Number(o.size) || 0 };
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
  if (!/^[a-f0-9]{1,32}\.(png|jpg|webp|gif)$/.test(String(file || ""))) {
    return json({ error: "no such file" }, 404);
  }
  const objs = await deps.list(slug);
  const key = keyFor(slug, file);
  if (!objs.some((o) => o && o.key === key)) return json({ error: "no such file" }, 404);
  await deps.remove(key);
  return json({ ok: true, name: file });
}
