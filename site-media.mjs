// VIDEO AND AUDIO FOR A PUBLISHED SITE (2026-10-14, the owner's two-area batch).
//
// Owner: *"implement complete owner video/audio upload-to-playback
// infrastructure … Extend the existing upload, storage, serving and
// file-management system so owners can upload supported media, obtain lasting
// site-scoped URLs, and use those assets through Build, Edit and Add-on …
// Validate supported formats from file contents, use correct MIME types,
// support browser playback and seeking with appropriate Range/HEAD responses,
// and use a large-file upload approach that avoids buffering entire videos
// through the Worker. Choose and document practical configurable per-file and
// per-site limits … do not reuse the image limits blindly or promise unlimited
// storage."*
//
// ── THE DESIGN, IN ONE PLACE ────────────────────────────────────────────────
//
// STORAGE. A media file lives where every owner upload lives —
// `uploads/<slug>/<name>`, outside `sites/<slug>/`, so a publish, an edit, a
// retry or a rebuild never touches it — and is served at `/u/<slug>/<name>`,
// on the app's origin and at the root of the site's own address. Its name is
// 32 random hex characters and the extension its bytes decided: a video is
// never hashed whole (that would mean holding it whole), so it is not
// content-addressed, and a replacement keeps the name.
//
// UPLOAD. In parts, never whole. The page asks for a session (`start`), sends
// the file in fixed-size parts (`part`, one request each, `MEDIA_PART_BYTES`)
// and closes it (`complete`); each part is checked for its exact length and
// handed to R2's multipart upload, and only the first part's bytes are read —
// to decide, from the contents, what the file is. Nothing ever holds more than
// one part, the per-request body limit is never approached, and a part that
// fails is sent again on its own. The object appears at its address only when
// the whole file is in: an abandoned or interrupted upload never shows as a
// file, its session expires (`MEDIA_SESSION_MS`), and its parts are aborted.
//
// FORMATS, FROM THE CONTENTS. MP4 (and M4V), WebM and QuickTime MOV video;
// MP3, M4A (AAC in MP4), AAC (ADTS), WAV, Ogg (Vorbis or Opus) and FLAC
// audio. The declared type and name are never believed: the first bytes
// decide, the session's declared kind must agree, and the stored type is the
// one the bytes named. A MOV plays in Safari and, when it holds H.264 video,
// in Chrome and Edge; Firefox may not play it — the panel says so.
//
// LIMITS, CONFIGURABLE AND BOUNDED (`mediaLimits`). Per file: video 250 MB,
// audio 50 MB. Per site: 2 GB and 100 media files, apart from the pictures and
// documents' own 100 MB and 200 files, which are unchanged. Each can be set by
// an environment variable and is clamped to a hard ceiling, so a typo cannot
// promise unlimited storage. R2 stores the bytes; a part is 8 MiB, inside
// every plan's request-size limit.
//
// SERVING. `HEAD` and `GET`, `Accept-Ranges: bytes`, a single byte range
// answered `206` with its `Content-Range` (`416` past the end), an `ETag` and
// `If-None-Match` → `304`. A replaceable file is cached briefly and
// revalidated (`MEDIA_CACHE`), never `immutable`; a picture keeps its own.
//
// BEFORE A SITE EXISTS. The same upload, kept for the account
// (`drafts/<uid>/<name>`, never served), and moved to the new site's library
// when its first build claims the address — checked against the owner and the
// site's limits there, and then removed from the drafts.

/** One part: 8 MiB, above R2's 5 MiB minimum for every part but the last. */
export const MEDIA_PART_BYTES = 8 * 1024 * 1024;
/** How long a started upload may take before it is given up (and its parts aborted). */
export const MEDIA_SESSION_MS = 24 * 60 * 60 * 1000;
/** How long an attachment kept before a site exists is kept. */
export const MEDIA_DRAFT_MS = 7 * 24 * 60 * 60 * 1000;
/** A replaceable file's cache: a short life, revalidated against its ETag. */
export const MEDIA_CACHE = "public, max-age=300, must-revalidate";

// ── LIMITS ──────────────────────────────────────────────────────────────────
export const MEDIA_DEFAULTS = Object.freeze({
  videoBytes: 250_000_000,
  audioBytes: 50_000_000,
  siteBytes: 2_000_000_000,
  siteFiles: 100,
  draftFiles: 6,
});
/** Hard ceilings an environment value is clamped to: never unlimited. */
export const MEDIA_CEILINGS = Object.freeze({
  videoBytes: 2_000_000_000,
  audioBytes: 500_000_000,
  siteBytes: 20_000_000_000,
  siteFiles: 1000,
  draftFiles: 20,
});
const LIMIT_ENV = Object.freeze({
  videoBytes: "MEDIA_MAX_VIDEO_BYTES",
  audioBytes: "MEDIA_MAX_AUDIO_BYTES",
  siteBytes: "MEDIA_MAX_SITE_BYTES",
  siteFiles: "MEDIA_MAX_SITE_FILES",
  draftFiles: "MEDIA_MAX_DRAFT_FILES",
});
/**
 * The limits in force: each from its environment variable when that reads as a
 * positive whole number, clamped to its ceiling; otherwise the default. A value
 * that does not read is the default, never zero and never unlimited.
 */
export function mediaLimits(env) {
  const out = {};
  for (const [k, name] of Object.entries(LIMIT_ENV)) {
    const raw = env && env[name] !== undefined ? String(env[name]).trim() : "";
    const n = /^\d{1,15}$/.test(raw) ? Number(raw) : NaN;
    out[k] = Number.isSafeInteger(n) && n > 0 ? Math.min(n, MEDIA_CEILINGS[k]) : MEDIA_DEFAULTS[k];
  }
  return out;
}
export const maxMediaBytes = (limits, kind) => (kind === "video" ? limits.videoBytes : limits.audioBytes);

// ── WHAT THE BYTES ARE ──────────────────────────────────────────────────────
//
// Every format, its extension, its type and its kind — one table, read by the
// sniffer, the serve route, the listings and the model's context alike.
export const MEDIA_FORMATS = Object.freeze({
  mp4: Object.freeze({ kind: "video", mime: "video/mp4", label: "MP4" }),
  webm: Object.freeze({ kind: "video", mime: "video/webm", label: "WebM" }),
  mov: Object.freeze({ kind: "video", mime: "video/quicktime", label: "MOV" }),
  mp3: Object.freeze({ kind: "audio", mime: "audio/mpeg", label: "MP3" }),
  m4a: Object.freeze({ kind: "audio", mime: "audio/mp4", label: "M4A" }),
  aac: Object.freeze({ kind: "audio", mime: "audio/aac", label: "AAC" }),
  wav: Object.freeze({ kind: "audio", mime: "audio/wav", label: "WAV" }),
  ogg: Object.freeze({ kind: "audio", mime: "audio/ogg", label: "Ogg" }),
  flac: Object.freeze({ kind: "audio", mime: "audio/flac", label: "FLAC" }),
});
export const MEDIA_EXTS = Object.freeze(Object.keys(MEDIA_FORMATS));
export const mediaKindOf = (ext) => (Object.hasOwn(MEDIA_FORMATS, ext) ? MEDIA_FORMATS[ext].kind : null);
/** The formats, as the owner reads them. */
export const MEDIA_FORMATS_SAID = "video: MP4, WebM or MOV; audio: MP3, M4A, AAC, WAV, Ogg or FLAC";

const ascii = (b, at, n) => {
  let s = "";
  for (let i = at; i < at + n && i < b.length; i++) s += String.fromCharCode(b[i]);
  return s;
};
const with_ = (ext) => ({ ext, mime: MEDIA_FORMATS[ext].mime, kind: MEDIA_FORMATS[ext].kind });
// The ISO base-media brands a browser plays as MP4 video. A brand not here is
// not guessed at (a 3GP, an HEIF still), so it is refused rather than served
// as something it may not be.
const MP4_BRANDS = new Set(["isom", "iso2", "iso3", "iso4", "iso5", "iso6", "iso8", "iso9", "mp41", "mp42", "avc1", "dash", "mp71", "M4V ", "M4VH", "M4VP", "f4v ", "msnv", "MSNV", "XAVC", "mmp4"]);
const M4A_BRANDS = new Set(["M4A ", "M4B "]);

/**
 * What a media file's leading bytes say it is: `{ ext, mime, kind }`, or null.
 * Needs the first 64 bytes or so; the first part of an upload is far more.
 */
export function sniffMedia(b) {
  if (!b || typeof b.length !== "number" || b.length < 12) return null;
  // ISO base media (MP4, M4A, MOV): a box size, then `ftyp`, then the brand.
  if (ascii(b, 4, 4) === "ftyp") {
    const brand = ascii(b, 8, 4);
    if (M4A_BRANDS.has(brand)) return with_("m4a");
    if (brand === "qt  ") return with_("mov");
    if (MP4_BRANDS.has(brand)) return with_("mp4");
    return null;
  }
  // A QuickTime file that opens without `ftyp` (older cameras): a known first atom.
  if (["moov", "mdat", "wide"].includes(ascii(b, 4, 4))) return with_("mov");
  // WebM: the EBML header, and a doc type of "webm" in it. Matroska that says
  // "matroska" is not WebM, and not every browser plays it.
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) {
    return ascii(b, 0, Math.min(b.length, 64)).includes("webm") ? with_("webm") : null;
  }
  if (ascii(b, 0, 4) === "OggS") return with_("ogg");
  if (ascii(b, 0, 4) === "fLaC") return with_("flac");
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WAVE") return with_("wav");
  if (ascii(b, 0, 3) === "ID3") return with_("mp3");
  // A frame sync: eleven set bits. Layer bits 00 is ADTS AAC; anything else MPEG audio.
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) {
    const layer = (b[1] >> 1) & 0x03;
    const version = (b[1] >> 3) & 0x03;
    if (layer === 0 && (b[1] & 0xf6) === 0xf0) return with_("aac");
    if (layer !== 0 && version !== 1) return with_("mp3");
  }
  return null;
}

/** The kind a name or a declared type says, before any byte is read: `video`, `audio` or null. */
export function declaredMediaKind(name, type) {
  const ext = String(name || "").toLowerCase().split(".").pop();
  if (Object.hasOwn(MEDIA_FORMATS, ext)) return MEDIA_FORMATS[ext].kind;
  if (ext === "m4v") return "video";
  if (ext === "opus" || ext === "oga") return "audio";
  const t = String(type || "").toLowerCase();
  if (/^video\//.test(t)) return "video";
  if (/^audio\//.test(t)) return "audio";
  return null;
}

// ── NAMES AND KEYS ──────────────────────────────────────────────────────────
const HEX32 = /^[a-f0-9]{32}$/;
/** A new media file's name: 32 random hex characters and the extension the bytes decide later. */
export function mediaName(randomHex, ext) {
  const hex = String(randomHex || "").toLowerCase();
  return HEX32.test(hex) && Object.hasOwn(MEDIA_FORMATS, ext) ? hex + "." + ext : null;
}
export const MEDIA_NAME = new RegExp("^[a-f0-9]{32}\\.(" + MEDIA_EXTS.join("|") + ")$");
export const isMediaName = (name) => MEDIA_NAME.test(String(name || ""));
export const draftKey = (uid, name) => "drafts/" + String(uid) + "/" + name;
export const sessionKey = (scope, sid) => "media-sessions/" + scope + "/" + sid + ".json";
/** Which owner a session belongs to: a site (`site:<slug>`) or an account before its site exists (`draft:<uid>`). */
export const siteScope = (slug) => "site-" + String(slug).toLowerCase();
export const draftScope = (uid) => "draft-" + String(uid).replace(/[^A-Za-z0-9-]/g, "").slice(0, 64);

// ── RANGES ──────────────────────────────────────────────────────────────────
/**
 * One byte range, read from a `Range` header against a file of `size` bytes:
 * `{ offset, length }`, `null` for none (answer the whole file — also for
 * several ranges, which this does not split), or `"unsatisfiable"` (416).
 */
export function parseRange(header, size) {
  if (typeof header !== "string" || !header.trim()) return null;
  const m = /^\s*bytes\s*=\s*(\d*)\s*-\s*(\d*)\s*$/i.exec(header);
  if (!m) return null;
  if (!Number.isSafeInteger(size) || size < 0) return null;
  const [, a, z] = m;
  if (a === "" && z === "") return null;
  if (a === "") {
    const n = Number(z);
    if (!(n > 0)) return "unsatisfiable";
    const len = Math.min(n, size);
    return size === 0 ? "unsatisfiable" : { offset: size - len, length: len };
  }
  const start = Number(a);
  if (!Number.isSafeInteger(start) || start >= size) return "unsatisfiable";
  const end = z === "" ? size - 1 : Math.min(Number(z), size - 1);
  if (!Number.isSafeInteger(end) || end < start) return "unsatisfiable";
  return { offset: start, length: end - start + 1 };
}

/**
 * THE HEADERS A STORED FILE IS SERVED WITH, for a whole answer or one range:
 * its type, its length, `Accept-Ranges`, its ETag, and — for a range —
 * `Content-Range`. `cache` is the file's own policy.
 */
export function mediaHeaders({ mime, size, etag, range = null, cache = MEDIA_CACHE, disposition = "inline" }) {
  const h = {
    "content-type": mime,
    "accept-ranges": "bytes",
    "cache-control": cache,
    "content-disposition": disposition,
    "x-content-type-options": "nosniff",
  };
  if (etag) h.etag = etag;
  if (range && typeof range === "object") {
    h["content-range"] = "bytes " + range.offset + "-" + (range.offset + range.length - 1) + "/" + size;
    h["content-length"] = String(range.length);
  } else if (Number.isSafeInteger(size)) h["content-length"] = String(size);
  return h;
}

/** Whether an `If-None-Match` names this ETag (weak or strong, or `*`). */
export function etagMatches(header, etag) {
  if (typeof header !== "string" || !etag) return false;
  const bare = (t) => t.trim().replace(/^W\//, "");
  return header.split(",").some((t) => t.trim() === "*" || bare(t) === bare(etag));
}

// ── THE UPLOAD, IN PARTS ────────────────────────────────────────────────────
const res = (body, status = 200) => ({ status, body });
const clean = (v, n) => String(v == null ? "" : v).replace(/[\p{Cc}\p{Cf}]+/gu, " ").replace(/\s+/g, " ").trim().slice(0, n);
const num = (v, max) => (typeof v === "number" && Number.isFinite(v) && v > 0 && v <= max ? v : undefined);
const intOf = (v, max) => (Number.isInteger(v) && v > 0 && v <= max ? v : undefined);

/** What the owner's browser said about a file (it read it, we did not): kept as metadata, said as theirs. */
export function readMediaMeta(m) {
  const o = m && typeof m === "object" && !Array.isArray(m) ? m : {};
  const out = {};
  const d = num(o.duration, 60 * 60 * 24);
  if (d) out.duration = Math.round(d * 10) / 10;
  const w = intOf(o.width, 16384);
  const h = intOf(o.height, 16384);
  if (w && h) { out.width = w; out.height = h; }
  return out;
}

/** The R2 custom metadata a media file is stored with (all ASCII). */
export function mediaMetadata({ name = "", meta = {}, kind }) {
  const out = { media: kind };
  const display = clean(name, 120);
  if (display) out.dl = encodeURIComponent(display);
  if (meta.duration) out.dur = String(meta.duration);
  if (meta.width && meta.height) { out.w = String(meta.width); out.h = String(meta.height); }
  return out;
}
/** That metadata read back, strictly. */
export function readStoredMeta(cm) {
  const o = cm && typeof cm === "object" ? cm : {};
  const out = {};
  const d = Number(o.dur);
  if (Number.isFinite(d) && d > 0) out.duration = d;
  const w = Number(o.w), h = Number(o.h);
  if (Number.isInteger(w) && Number.isInteger(h) && w > 0 && h > 0) { out.width = w; out.height = h; }
  return out;
}

/** How many parts a file of `size` is sent in, and how long part `n` must be. */
export const partsFor = (size) => Math.max(1, Math.ceil(size / MEDIA_PART_BYTES));
export const partLength = (size, n) => (n < partsFor(size) ? MEDIA_PART_BYTES : size - (partsFor(size) - 1) * MEDIA_PART_BYTES);

/**
 * deps (all async, injected so this runs without R2 or a Worker):
 *   gate(scope)                         → {error} | {}         ownership
 *   used(scope)                         → { files, bytes, names }  the scope's media now, and the names it holds
 *   sessions(scope)                     → [session]          live sessions (their sizes are reserved)
 *   random()                            → 32 hex
 *   now()                               → ms
 *   create(key, { mime, meta })         → uploadId           R2 createMultipartUpload
 *   uploadPart(key, uploadId, n, bytes) → { etag }
 *   complete(key, uploadId, parts)      → { size }           the object as stored
 *   abort(key, uploadId)                → void
 *   saveSession(scope, s), loadSession(scope, sid), dropSession(scope, sid)
 *   objectKey(scope, name)              → the R2 key a name lives at in this scope
 *   urlOf(scope, name)                  → its address, or "" (a draft has none)
 *   exists(key)                         → { size, kind } | null   for a replacement
 * `limits` are `mediaLimits(env)`.
 */
export async function handleMediaStart(deps, { scope, limits, name, size, type, replace, meta, draft = false } = {}) {
  const gate = await deps.gate(scope);
  if (gate && gate.error) return gate.error;
  const kind = declaredMediaKind(name, type);
  if (!kind) return res({ error: "that doesn't look like a video or audio file — " + MEDIA_FORMATS_SAID, code: "bad_type" }, 415);
  if (!Number.isSafeInteger(size) || size <= 0) return res({ error: "the file's size was not sent", code: "no_size" }, 400);
  const cap = maxMediaBytes(limits, kind);
  if (size > cap) {
    return res({ error: "that " + kind + " is too big — keep it under " + Math.floor(cap / 1e6) + " MB", code: "too_big", max: cap }, 413);
  }
  let target = null;
  if (replace !== undefined && replace !== null && replace !== "") {
    if (draft) return res({ error: "no such file", code: "no_file" }, 404);
    if (!isMediaName(replace)) return res({ error: "no such file", code: "no_file" }, 404);
    const have = await deps.exists(deps.objectKey(scope, replace));
    if (!have) return res({ error: "no such file", code: "no_file" }, 404);
    if (have.kind !== kind) return res({ error: "a " + have.kind + " file can only be replaced with another " + have.kind + " file", code: "kind_mismatch" }, 409);
    target = { name: replace, size: Number(have.size) || 0 };
  }
  const now = deps.now();
  const live = (await deps.sessions(scope)).filter((s) => s && s.expires > now && (!target || s.replace !== target.name));
  const usage = await deps.used(scope);
  const files = usage.files + live.filter((s) => !s.replace).length + (target ? 0 : 1);
  const bytes = usage.bytes + live.reduce((n, s) => n + (Number(s.size) || 0) - (Number(s.replacing) || 0), 0) + size - (target ? target.size : 0);
  const maxFiles = draft ? limits.draftFiles : limits.siteFiles;
  if (files > maxFiles) {
    return res({ error: draft ? "you can keep " + maxFiles + " video and audio files before your site is built — send some first" : "this site has reached its limit of " + maxFiles + " video and audio files — delete some first", code: "full", max: maxFiles }, 409);
  }
  if (bytes > limits.siteBytes) {
    return res({ error: "this site is out of video and audio storage (" + Math.floor(limits.siteBytes / 1e6) + " MB) — delete some first", code: "full", max: limits.siteBytes }, 409);
  }
  const sid = deps.random();
  // THE EXTENSION IS DECIDED BY THE BYTES: until the first part arrives the
  // object's key carries the declared one; a first part that names another
  // format of the same kind is refused, never renamed.
  const declaredExt = String(name || "").toLowerCase().split(".").pop();
  const ext = Object.hasOwn(MEDIA_FORMATS, declaredExt) && MEDIA_FORMATS[declaredExt].kind === kind ? declaredExt
    : declaredExt === "m4v" ? "mp4" : declaredExt === "opus" || declaredExt === "oga" ? "ogg" : null;
  if (!ext) return res({ error: "that doesn't look like a video or audio file — " + MEDIA_FORMATS_SAID, code: "bad_type" }, 415);
  const fileName = target ? target.name : mediaName(deps.random(), ext);
  if (!fileName) return res({ error: "couldn't start that upload just now" }, 500);
  if (target && fileName.split(".").pop() !== ext) {
    return res({ error: "a replacement must be the same format as the file it replaces (" + MEDIA_FORMATS[fileName.split(".").pop()].label + ")", code: "format_mismatch" }, 409);
  }
  const m = readMediaMeta(meta);
  const key = deps.objectKey(scope, fileName);
  const uploadId = await deps.create(key, { mime: MEDIA_FORMATS[ext].mime, meta: mediaMetadata({ name, meta: m, kind }) });
  const session = {
    sid, scope, key, name: fileName, display: clean(name, 120), ext, kind, size, parts: partsFor(size), uploadId,
    created: now, expires: now + MEDIA_SESSION_MS, ...(target ? { replace: target.name, replacing: target.size } : {}), meta: m,
  };
  await deps.saveSession(scope, session);
  return res({ ok: true, session: sid, name: fileName, partBytes: MEDIA_PART_BYTES, parts: session.parts, kind }, 201);
}

async function liveSession(deps, scope, sid) {
  if (!HEX32.test(String(sid || ""))) return null;
  const s = await deps.loadSession(scope, sid);
  if (!s || s.scope !== scope || s.sid !== sid) return null;
  if (!(s.expires > deps.now())) return null;
  return s;
}

/** One part. The first is read for what the file is; every part's length is exact. */
export async function handleMediaPart(deps, { scope, sid, n, bytes } = {}) {
  const gate = await deps.gate(scope);
  if (gate && gate.error) return gate.error;
  const s = await liveSession(deps, scope, sid);
  if (!s) return res({ error: "that upload has expired or was cancelled — start it again", code: "no_session" }, 404);
  if (!Number.isInteger(n) || n < 1 || n > s.parts) return res({ error: "no such part", code: "bad_part" }, 400);
  const want = partLength(s.size, n);
  if (!bytes || bytes.length !== want) return res({ error: "that part arrived incomplete — send it again", code: "bad_length", expected: want }, 400);
  if (n === 1) {
    const what = sniffMedia(bytes);
    if (!what || what.kind !== s.kind) {
      await abortQuietly(deps, s);
      return res({ error: "that doesn't look like a video or audio file — " + MEDIA_FORMATS_SAID, code: "bad_type" }, 415);
    }
    if (what.ext !== s.ext) {
      await abortQuietly(deps, s);
      return res({ error: "that file's contents are " + MEDIA_FORMATS[what.ext].label + ", not ." + s.ext + " — rename it ." + what.ext + " and upload it again", code: "format_mismatch", is: what.ext }, 415);
    }
  }
  const up = await deps.uploadPart(s.key, s.uploadId, n, bytes);
  return res({ ok: true, n, etag: up && up.etag });
}

async function abortQuietly(deps, s) {
  try { await deps.abort(s.key, s.uploadId); } catch { /* the session's expiry aborts it */ }
  try { await deps.dropSession(s.scope, s.sid); } catch { /* expires on its own */ }
}

/** Closes the upload: every part, exactly once, in order. The file appears only now. */
export async function handleMediaComplete(deps, { scope, sid, parts } = {}) {
  const gate = await deps.gate(scope);
  if (gate && gate.error) return gate.error;
  const s = await liveSession(deps, scope, sid);
  if (!s) return res({ error: "that upload has expired or was cancelled — start it again", code: "no_session" }, 404);
  const list = Array.isArray(parts) ? parts : [];
  const ok = list.length === s.parts && list.every((p, i) => p && p.n === i + 1 && typeof p.etag === "string" && p.etag && p.etag.length <= 200);
  if (!ok) return res({ error: "some of that file's parts are missing — send them and finish again", code: "parts_missing", parts: s.parts }, 400);
  let done;
  try {
    done = await deps.complete(s.key, s.uploadId, list.map((p) => ({ partNumber: p.n, etag: p.etag })));
  } catch {
    return res({ error: "couldn't finish that upload — send it again", code: "complete_failed" }, 502);
  }
  await deps.dropSession(scope, sid);
  const size = done && Number.isSafeInteger(done.size) ? done.size : s.size;
  const url = deps.urlOf(scope, s.name);
  return res({
    ok: true, name: s.name, ...(url ? { url } : {}), kind: s.kind, mime: MEDIA_FORMATS[s.ext].mime, size,
    ...(s.display ? { download: s.display } : {}), ...s.meta, ...(s.replace ? { replaced: true } : {}),
  }, s.replace ? 200 : 201);
}

/** Gives an upload up: its parts are aborted and nothing appears. */
export async function handleMediaAbort(deps, { scope, sid } = {}) {
  const gate = await deps.gate(scope);
  if (gate && gate.error) return gate.error;
  const s = await liveSession(deps, scope, sid);
  if (!s) return res({ ok: true, gone: true });
  await abortQuietly(deps, s);
  return res({ ok: true });
}

// ── WHAT A PAGE USES ────────────────────────────────────────────────────────
/**
 * The pages that address a file: every stored page whose source names its
 * address (`/u/<slug>/<name>`) or its bare name. For deleting a file a page
 * plays, which is said before it is done.
 */
export function pagesUsing(pages, slug, name) {
  const url = "/u/" + String(slug).toLowerCase() + "/" + name;
  return (Array.isArray(pages) ? pages : [])
    .filter((p) => p && typeof p.source === "string" && (p.source.includes(url) || p.source.includes(name)))
    .map((p) => String(p.path || ""));
}

/** A library file as a model is told it: address, kind, type, size, what the browser reported — never contents. */
export function mediaForModel(f) {
  return {
    url: f.url, name: f.download || f.name, kind: f.kind, mime: f.mime, size: f.size,
    ...(f.duration ? { duration: f.duration } : {}), ...(f.width ? { width: f.width, height: f.height } : {}),
  };
}

/** The block every writer is shown: the owner's own video and audio, by address, and what is not known about them. */
export function mediaBlock(files, { heading = "THE OWNER'S VIDEO AND AUDIO FILES" } = {}) {
  const list = (Array.isArray(files) ? files : []).filter((f) => f && (f.kind === "video" || f.kind === "audio") && typeof f.url === "string").slice(0, 40);
  if (!list.length) return "";
  const line = (f) => {
    const bits = [MEDIA_FORMATS[String(f.url).split(".").pop()] ? MEDIA_FORMATS[String(f.url).split(".").pop()].label + " " + f.kind : f.kind];
    if (f.size) bits.push(f.size >= 1e6 ? (f.size / 1e6).toFixed(1).replace(/\.0$/, "") + " MB" : Math.max(1, Math.round(f.size / 1000)) + " KB");
    if (f.duration) bits.push(Math.floor(f.duration / 60) + ":" + String(Math.round(f.duration % 60)).padStart(2, "0") + " long");
    if (f.width && f.height) bits.push(f.width + "×" + f.height);
    return "- " + (f.name ? JSON.stringify(String(f.name)) + ": " : "") + f.url + " (" + bits.join(", ") + ")";
  };
  return heading + " — uploaded by the owner and hosted on the site. Play one with an HTML <video> or <audio> " +
    "element whose src is the address exactly as written (add `controls`; for video add `playsInline` and " +
    "`preload=\"metadata\"`). Nobody has watched or listened to these files: you know only the name, the type, the " +
    "size and, where given, the length and frame size the owner's browser reported — never say what is in one.\n" +
    list.map(line).join("\n");
}

/** What the designer is told about files kept before the site existed: names and kinds, no addresses yet. */
export function mediaDesignNote(files) {
  const list = (Array.isArray(files) ? files : []).filter((f) => f && (f.kind === "video" || f.kind === "audio"));
  if (!list.length) return "";
  return "\n\nTHE OWNER'S VIDEO AND AUDIO FILES, which go into the site's own library with it (the pages are given " +
    "each file's address; nobody has watched or listened to them, so plan from the names alone):\n" +
    list.map((f) => "  - " + JSON.stringify(String(f.download || f.name)) + ", " + f.kind +
      (f.duration ? ", " + Math.floor(f.duration / 60) + ":" + String(Math.round(f.duration % 60)).padStart(2, "0") + " long" : "")).join("\n");
}

/** The build's sentence about them, from what really happened: placed, or not, and why. */
export function mediaSentence({ placed = [], missing = [] } = {}) {
  const name = (f) => JSON.stringify(String(f.name || f.download || "a file"));
  const out = [];
  if (placed.length) {
    out.push((placed.length === 1 ? "Your " + placed[0].kind + " " + name(placed[0]) + " is" : "Your " + placed.length + " video and audio files are") +
      " in your site's file library now, and the pages were given " + (placed.length === 1 ? "its" : "their") + " address.");
  }
  if (missing.length) {
    out.push("I couldn't add " + missing.map((m) => JSON.stringify(String(m.name || "a file")) + " (" + (m.why || "it could not be moved") + ")").join(", ") + " to your site's library.");
  }
  return out.join(" ");
}
