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

// ── ADMISSION, COMPLETION AND RECOVERY (2026-10-15, Codex's review of `7ca339d1`) ──
//
// THE LEDGER IS WHERE ROOM IS TAKEN. Codex reproduced two starts at once both
// answered 201 under a one-file, 100-byte limit, reserving two files and 120
// bytes: each read the sessions, found room, and wrote its own. Now every
// reservation — an upload, a replacement, a draft moved into a site — is an
// entry in one small record per scope (`media-ledger/<scope>.json`), changed
// only by a conditional write over the etag it was read at, so of two writers
// that read the same record one wins and the other reads again and counts
// the winner. Read in this order — the ledger, then what the scope holds, then
// the write — because a finished upload stores its file BEFORE it gives back
// its reservation: whichever moment a start reads at, it sees the bytes once
// or twice, never not at all. Twice is the safe side, and lasts only between
// those two writes.
//
// A REPLACEMENT RESERVES ITS WHOLE SIZE, and one at a time. While it is being
// sent the old file is still there and still served, and the new parts are
// stored beside it, so a promise to be smaller releases nothing; and a second
// replacement of the same file is refused while one is open, rather than
// letting two race to be the file.
//
// COMPLETION IS RECORDED, AND ASKED AGAIN SAFELY. The upload's own session is
// kept after it finishes, with what it made, and the file carries its upload's
// id in its metadata (`up`). So a second `complete` — the page sending it again
// because the first answer was lost — answers what the first did; one that
// meets an upload R2 has already finished reads the file's `up` and knows it
// is its own; and `status` tells a page that reloaded, or reconnected, what
// became of an upload it had started. A finished upload is never aborted: an
// abort that arrives after it answers what it made. Every session is bound to
// the account that started it (`by`): another account's id is not found.
//
// THE PARTS ARE RECORDED AS THEY LAND (`savePart`), each with the etag R2 gave
// it, so a part whose answer was lost is not sent again and `complete` can be
// asked with what the server already holds.
/**
 * deps (all async, injected so this runs without R2 or a Worker):
 *   gate(scope)                         → {error} | {}         ownership
 *   who                                 → the account id this request is for (a session is bound to it)
 *   used(scope)                         → { files, bytes }     the scope's stored media now
 *   readLedger(scope)                   → { held: { id: entry }, rev, etag }   (etag null: none yet)
 *   writeLedger(scope, { held, rev, w }, etag) → true, or false when another writer changed it first
 *   random()                            → 32 hex
 *   now()                               → ms
 *   create(key, { mime, meta })         → uploadId           R2 createMultipartUpload
 *   uploadPart(key, uploadId, n, bytes) → { etag }
 *   complete(key, uploadId, parts)      → { size }           the object as stored
 *   abort(key, uploadId)                → void
 *   saveSession(scope, s), loadSession(scope, sid), dropSession(scope, sid)
 *   savePart(scope, sid, n, etag), savedParts(scope, sid) → { n: etag }, dropParts(scope, sid)
 *   objectKey(scope, name)              → the R2 key a name lives at in this scope
 *   urlOf(scope, name)                  → its address, or "" (a draft has none)
 *   exists(key)                         → { size, kind, up } | null
 * `limits` are `mediaLimits(env)`.
 */
export const LEDGER_TRIES = 8;

// EVERY WRITE IS A NEW REVISION (2026-10-15, Codex's review of `673e26cb`).
// R2's etag for an ordinary write is the MD5 of its bytes, so a ledger that
// returns to the same reservations — empty, say, after an upload took room,
// finished and gave it back — would carry the etag it had before, and a
// request that read the scope's usage before all that happened could still
// write over it as if nothing had: Codex's reproduction admitted a second
// 60-byte file under a 100-byte, one-file limit. So the record carries a
// revision that only grows, and the id of the write (`w`): no two writes are
// ever the same bytes, an etag read once is never matched again, and a stale
// reading of usage can never be written over a newer ledger.
/**
 * CHANGE THE LEDGER, ATOMICALLY: `change(live, now)` is shown the live entries
 * (expired ones are dropped from what it sees) and answers `{ refuse }` or
 * `{ held }` — the entries to write. Written over the etag it was read at;
 * read again, up to `LEDGER_TRIES` times, when another writer got there first.
 * Answers `{ ok: true }`, `{ refuse }`, or a 503 when it could not get a turn.
 * Expired entries' uploads are aborted once the write that dropped them landed.
 */
export async function changeLedger(deps, scope, change) {
  for (let i = 0; i < LEDGER_TRIES; i++) {
    const read = await deps.readLedger(scope);
    const now = deps.now();
    const live = {};
    const expired = [];
    for (const [id, h] of Object.entries((read && read.held) || {})) {
      if (h && typeof h === "object" && h.expires > now) live[id] = h; else if (h) expired.push(h);
    }
    const r = await change(live, now);
    if (r && r.refuse) return r;
    if (r && r.same && !expired.length) return { ok: true };
    const rev = (Number.isSafeInteger(read && read.rev) && read.rev > 0 ? read.rev : 0) + 1;
    if (await deps.writeLedger(scope, { held: r.held, rev, w: deps.random() }, (read && read.etag) || null)) {
      for (const h of expired) {
        if (h.uploadId && h.key) { try { await deps.abort(h.key, h.uploadId); } catch { /* R2's own expiry aborts it */ } }
        if (h.sid) { try { await deps.dropSession(scope, h.sid); } catch { /* left to expire */ } }
      }
      return { ok: true };
    }
  }
  return { refuse: res({ error: "too many uploads are starting at once — try again in a moment", code: "busy" }, 503) };
}

/** What the ledger's live entries hold back: files and bytes. */
const heldTotals = (live) => Object.values(live).reduce((t, h) => ({ files: t.files + (h.files ? 1 : 0), bytes: t.bytes + (Number(h.size) || 0) }), { files: 0, bytes: 0 });

/**
 * TAKE ROOM FOR ONE FILE in a scope: `{ ok: true }` with the entry written, or
 * `{ refuse }` with the limit it would pass. `files` is 1 for a new file, 0
 * for a replacement (which reserves its whole size). The scope's stored media
 * is read inside each try, after the ledger — the order the header explains.
 */
export async function holdMedia(deps, { scope, limits, id, entry, draft = false }) {
  const maxFiles = draft ? limits.draftFiles : limits.siteFiles;
  return changeLedger(deps, scope, async (live) => {
    if (entry.replace && Object.values(live).some((h) => h.replace === entry.replace)) {
      return { refuse: res({ error: "that file is already being replaced — wait for that upload to finish, or cancel it", code: "replacing" }, 409) };
    }
    const usage = await deps.used(scope);
    const held = heldTotals(live);
    const files = usage.files + held.files + (entry.files ? 1 : 0);
    const bytes = usage.bytes + held.bytes + entry.size;
    if (files > maxFiles) {
      return { refuse: res({ error: draft ? "you can keep " + maxFiles + " video and audio files before your site is built — send some first" : "this site has reached its limit of " + maxFiles + " video and audio files — delete some first", code: "full", max: maxFiles }, 409) };
    }
    if (bytes > limits.siteBytes) {
      return { refuse: res({ error: "this site is out of video and audio storage (" + Math.floor(limits.siteBytes / 1e6) + " MB) — delete some first", code: "full", max: limits.siteBytes }, 409) };
    }
    return { held: { ...live, [id]: entry } };
  });
}

/** Give a reservation back. Never throws; a reservation that could not be given back expires with its session. */
export async function releaseMedia(deps, scope, id) {
  try {
    return await changeLedger(deps, scope, async (live) => {
      if (!Object.hasOwn(live, id)) return { same: true, held: live };
      const next = { ...live };
      delete next[id];
      return { held: next };
    });
  } catch { return { ok: false }; }
}

export async function handleMediaStart(deps, { scope, limits, name, size, type, replace, meta, draft = false } = {}) {
  const gate = await deps.gate(scope);
  if (gate && gate.error) return gate.error;
  const kind = declaredMediaKind(name, type);
  if (!kind) return res({ error: "that doesn't look like a video or audio file — " + MEDIA_FORMATS_SAID, code: "bad_type" }, 415);
  if (!Number.isSafeInteger(size) || size <= 0) return res({ error: "the file's size was not sent", code: "no_size" }, 400);
  const cap = maxMediaBytes(limits, kind);
  if (size > cap) {
    // A LIMIT UNDER A MEGABYTE IS SAID IN KILOBYTES (2026-10-16): "under 0 MB"
    // was the answer for a configured limit below one.
    const under = cap >= 1e6 ? Math.floor(cap / 1e6) + " MB" : Math.max(1, Math.floor(cap / 1e3)) + " KB";
    return res({ error: "that " + kind + " is too big — keep it under " + under, code: "too_big", max: cap }, 413);
  }
  let target = null;
  if (replace !== undefined && replace !== null && replace !== "") {
    if (draft) return res({ error: "no such file", code: "no_file" }, 404);
    if (!isMediaName(replace)) return res({ error: "no such file", code: "no_file" }, 404);
    const have = await deps.exists(deps.objectKey(scope, replace));
    if (!have) return res({ error: "no such file", code: "no_file" }, 404);
    if (have.kind !== kind) return res({ error: "a " + have.kind + " file can only be replaced with another " + have.kind + " file", code: "kind_mismatch" }, 409);
    // THE GENERATION IT REPLACES (2026-10-15): its close is allowed only over this one.
    const a = await deps.readAsset(scope, replace);
    if (a && a.rec && a.rec.state === "deleted") return res({ error: "no such file", code: "no_file" }, 404);
    target = { name: replace, size: Number(have.size) || 0, gen: a && a.rec && Number.isSafeInteger(a.rec.gen) ? a.rec.gen : 0 };
  }
  // THE EXTENSION IS DECIDED BY THE BYTES: until the first part arrives the
  // object's key carries the declared one; a first part that names another
  // format of the same kind is refused, never renamed.
  const declaredExt = String(name || "").toLowerCase().split(".").pop();
  const ext = Object.hasOwn(MEDIA_FORMATS, declaredExt) && MEDIA_FORMATS[declaredExt].kind === kind ? declaredExt
    : declaredExt === "m4v" ? "mp4" : declaredExt === "opus" || declaredExt === "oga" ? "ogg" : null;
  if (!ext) return res({ error: "that doesn't look like a video or audio file — " + MEDIA_FORMATS_SAID, code: "bad_type" }, 415);
  if (target && target.name.split(".").pop() !== ext) {
    return res({ error: "a replacement must be the same format as the file it replaces (" + MEDIA_FORMATS[target.name.split(".").pop()].label + ")", code: "format_mismatch" }, 409);
  }
  const sid = deps.random();
  const fileName = target ? target.name : mediaName(deps.random(), ext);
  if (!fileName || !HEX32.test(String(sid || ""))) return res({ error: "couldn't start that upload just now" }, 500);
  const now = deps.now();
  const expires = now + MEDIA_SESSION_MS;
  const key = deps.objectKey(scope, fileName);
  // ROOM FIRST, then the upload: a start that is refused has made nothing.
  const held = await holdMedia(deps, { scope, limits, draft, id: sid, entry: { sid, size, files: target ? 0 : 1, expires, key, ...(target ? { replace: target.name } : {}) } });
  if (held.refuse) return held.refuse;
  const m = readMediaMeta(meta);
  let uploadId;
  try {
    uploadId = await deps.create(key, { mime: MEDIA_FORMATS[ext].mime, meta: { ...mediaMetadata({ name, meta: m, kind }), up: sid } });
  } catch {
    await releaseMedia(deps, scope, sid);
    return res({ error: "couldn't start that upload just now — try again", code: "start_failed" }, 502);
  }
  const session = {
    sid, scope, key, name: fileName, display: clean(name, 120), ext, kind, size, parts: partsFor(size), uploadId,
    created: now, expires, state: "open", ...(deps.who ? { by: String(deps.who) } : {}), ...(target ? { replace: target.name, replacing: target.size, baseGen: target.gen } : {}), meta: m,
  };
  try { await deps.saveSession(scope, session); } catch {
    try { await deps.abort(key, uploadId); } catch { /* expires */ }
    await releaseMedia(deps, scope, sid);
    return res({ error: "couldn't start that upload just now — try again", code: "start_failed" }, 502);
  }
  // The upload's id travels to the ledger entry, so an expired one is aborted.
  await changeLedger(deps, scope, async (live) => (Object.hasOwn(live, sid) ? { held: { ...live, [sid]: { ...live[sid], uploadId } } } : { same: true, held: live })).catch(() => {});
  return res({ ok: true, session: sid, name: fileName, partBytes: MEDIA_PART_BYTES, parts: session.parts, kind }, 201);
}

/** The session, if it is this scope's, this account's, and not expired — open or finished. */
async function liveSession(deps, scope, sid) {
  if (!HEX32.test(String(sid || ""))) return null;
  const s = await deps.loadSession(scope, sid);
  if (!s || s.scope !== scope || s.sid !== sid) return null;
  if (s.by && deps.who && String(deps.who) !== s.by) return null;
  if (!(s.expires > deps.now())) return null;
  return s;
}

/** What a finished upload made, as its completion answered it. */
const finishedBody = (s, extra = {}) => ({ ok: true, ...s.file, ...extra });

// ── ONE FILE'S MUTATIONS, IN ONE PLACE (2026-10-15, Codex's review of `aef027fd`) ──
//
// Codex reproduced the gap the last round left: a replacement read the old
// object, a delete landed just after, and R2's multipart close then answered
// 200 and wrote the deleted file back. A second existence check only moves
// that gap. So a delete and a replacement's close now go through the same
// durable record for the file (`media-assets/<scope>/<name>.json`), changed
// only by a conditional write over the etag it was read at — with a growing
// revision and the write's own id, as the ledger, so it never comes back to an
// old etag:
//   - `live`, generation G: the file as it stands;
//   - `committing`, generation G, with a CLAIM (the replacement's session, its
//     upload and when it claimed): a replacement is closing R2's upload;
//   - `deleted`, generation G+1: the owner deleted it.
// A REPLACEMENT records the generation it started from (`baseGen`). To close,
// it first CLAIMS the record — only while it is `live` at that same generation
// — and only then asks R2 to close; after R2 has, it makes the record `live`
// at G+1 with its own upload id. Deleted meanwhile: it is given up (410) and
// nothing is closed. A newer generation meanwhile: given up (409). A DELETE
// writes `deleted` first and removes the object after; while a claim is held
// it is refused (409, `replacing`, try again) rather than racing the close.
// So whichever reaches the record first wins, and the other is told so; a
// stale upload can neither bring a deleted file back nor write over a newer
// generation.
//
// A CLAIM WHOSE HOLDER WAS INTERRUPTED is recovered by the next request that
// meets it after `MEDIA_CLAIM_MS`: the claimed upload is ABORTED first — so a
// close still in flight cannot land afterwards — and then the object says
// which way it went: carrying the claim's upload id, the replacement landed
// and the record moves to G+1 (its session is recorded as done); otherwise it
// did not, the record stays at G, and the session is given up with its room
// released. A file with no record yet (every file before this change, and a
// new file never replaced) is read as `live` at generation 0 from its object.
export const MEDIA_CLAIM_MS = 15 * 60 * 1000;
export const ASSET_TRIES = 8;

/** The file's record as it stands: `{ rec, etag }`, a missing record read from the object (`live` 0, or `absent`). */
async function readAssetNow(deps, scope, name) {
  const got = await deps.readAsset(scope, name);
  if (got && got.rec) return got;
  const h = await deps.exists(deps.objectKey(scope, name));
  return { rec: h ? { gen: 0, state: "live", up: h.up || "" } : { gen: 0, state: "absent" }, etag: null };
}

/**
 * CHANGE ONE FILE'S RECORD, ATOMICALLY: `change(rec)` answers `{ refuse }`,
 * `{ same: true }` (nothing to write), or `{ rec, again? }` — written over the
 * etag it was read at, and read again when another writer got there first
 * (`again` reads again after writing, for a recovery). Answers `{ ok, rec }`,
 * `{ refuse }`, or a 503 when it could not get a turn.
 */
export async function changeAsset(deps, scope, name, change) {
  for (let i = 0; i < ASSET_TRIES; i++) {
    const read = await readAssetNow(deps, scope, name);
    const r = await change(read.rec);
    if (r && r.refuse) return r;
    if (r && r.same) return { ok: true, rec: read.rec };
    const rev = (Number.isSafeInteger(read.rec && read.rec.rev) ? read.rec.rev : 0) + 1;
    const next = { ...r.rec, rev, w: deps.random() };
    if (await deps.writeAsset(scope, name, next, read.etag)) {
      if (r.again) continue;
      return { ok: true, rec: next };
    }
  }
  return { refuse: res({ error: "that file is being changed by another request — try again in a moment", code: "busy", retry: true }, 503) };
}

/**
 * A CLAIM WHOSE HOLDER WENT AWAY, settled: its upload aborted first, then the
 * object read. Answers the record to write.
 */
//
// STOPPING THE OLD UPLOAD MUST BE PROVEN, NOT ASSUMED (2026-10-15, Codex's
// review of `69462730`). An abort that throws because storage or the network
// failed proves nothing: the holder's close may still be in flight and land
// later. Codex reproduced it — two failed aborts were swallowed, the delete
// answered 200, and the paused close then answered 200, recreated the object
// and recorded its receipt done while the record said deleted. So a claim is
// settled only on a PROVEN outcome:
//   - the object carries the claim's upload id: it landed (whatever the abort
//     said — a close happens once);
//   - the abort succeeded, or R2 said the upload no longer exists
//     (`NoSuchUpload`): it was stopped and cannot land;
// and otherwise the claim is KEPT and the request is refused as unconfirmed
// (503, try again), with nothing released, nothing deleted and no new
// generation, until storage answers.
/** An abort's failure that proves the upload is gone (R2's NoSuchUpload, code 10024), as opposed to one that proves nothing. */
export function uploadGone(e) {
  const t = String((e && (e.code || "")) + " " + (e && e.message || "") + " " + (e && e.name || ""));
  return /NoSuchUpload|\b10024\b/.test(t);
}
async function recoverClaim(deps, scope, name, rec) {
  const c = rec.claim || {};
  let stopped = !(c.key && c.uploadId);
  if (!stopped) {
    try { await deps.abort(c.key, c.uploadId); stopped = true; } catch (e) { stopped = uploadGone(e); }
  }
  let h = null;
  try { h = await deps.exists(deps.objectKey(scope, name)); } catch { return { unknown: true }; }
  const s = c.sid ? await deps.loadSession(scope, c.sid).catch(() => null) : null;
  if (h && h.up === c.sid) {
    // IT LANDED: the replacement is the file, at the next generation.
    if (s && s.state !== "done") await recordDone(deps, scope, s, Number(h.size) || s.size).catch(() => {});
    return { gen: rec.gen + 1, state: "live", up: c.sid, at: deps.now() };
  }
  // NOT LANDED, AND NOT PROVEN STOPPED: the claim stays; nothing is settled.
  if (!stopped) return { unconfirmed: true };
  // IT DID NOT, AND CANNOT: the file is as it was, and the replacement is given up.
  if (s && s.state !== "done") await abortQuietly(deps, s);
  else if (c.sid) await releaseMedia(deps, scope, c.sid);
  return { gen: rec.gen, state: "live", up: rec.up || "", at: deps.now() };
}
const claimStale = (deps, rec) => !(rec.claim && rec.claim.at + MEDIA_CLAIM_MS > deps.now());
/** An earlier replacement that could not be shown to have stopped: nothing is changed, try again. */
const unconfirmedClaim = () => res({ error: "an earlier replacement of that file could not be confirmed as stopped — nothing was changed; try again in a moment", code: "unconfirmed", retry: true }, 503);

/**
 * DELETE A FILE, through its record (2026-10-15): `deleted` is written first,
 * then the object is removed, so a replacement that has not yet claimed can
 * never close over it; while a replacement holds a fresh claim the delete is
 * refused, to be sent again. Deleting again is answered as done. Answers
 * `{ ok: true }`, `{ ok: true, already: true }`, 404, 409 `replacing`, or 503.
 */
export async function handleMediaDelete(deps, { scope, name } = {}) {
  if (!isMediaName(name)) return res({ error: "no such file", code: "no_file" }, 404);
  let already = false;
  const r = await changeAsset(deps, scope, name, async (rec) => {
    if (rec.state === "absent") return { refuse: res({ error: "no such file", code: "no_file" }, 404) };
    if (rec.state === "deleted") { already = true; return { same: true }; }
    if (rec.state === "committing") {
      if (!claimStale(deps, rec)) return { refuse: res({ error: "that file is being replaced right now — try deleting it again in a moment", code: "replacing", retry: true }, 409) };
      const back = await recoverClaim(deps, scope, name, rec);
      if (back.unknown) return { refuse: notNow({ now: "unknown" }) };
      if (back.unconfirmed) return { refuse: unconfirmedClaim() };
      return { rec: back, again: true };
    }
    return { rec: { gen: rec.gen + 1, state: "deleted", up: rec.up || "", at: deps.now() } };
  });
  if (r.refuse) return r.refuse;
  // THE OBJECT GOES AFTER THE RECORD SAYS DELETED; a delete sent again finishes it.
  try { await deps.deleteObject(deps.objectKey(scope, name)); } catch { return res({ error: "couldn't remove that file just now — delete it again", code: "delete_failed", retry: true }, 502); }
  return res({ ok: true, ...(already ? { already: true } : {}) });
}

/** A session recorded as done with the file it made. */
async function recordDone(deps, scope, s, size) {
  const url = deps.urlOf(scope, s.name);
  const file = {
    name: s.name, ...(url ? { url } : {}), kind: s.kind, mime: MEDIA_FORMATS[s.ext].mime, size,
    ...(s.display ? { download: s.display } : {}), ...s.meta, ...(s.replace ? { replaced: true } : {}),
  };
  // RECORDED BEFORE THE ROOM IS GIVEN BACK: the file is counted from now on.
  try { await deps.saveSession(scope, { ...s, state: "done", file, finished: deps.now(), expires: deps.now() + MEDIA_SESSION_MS }); } catch { /* `up` on the file still answers a second ask */ }
  await releaseMedia(deps, scope, s.sid);
  try { await deps.dropParts(scope, s.sid); } catch { /* expires on its own */ }
  return file;
}

// ── A RECEIPT IS HISTORY; THE FILE IS NOW (2026-10-15, Codex's review of `673e26cb`) ──
//
// A finished session says an upload COMPLETED. It does not say the file is
// still there, or that its address still holds the bytes it made: the owner
// may have deleted it, a replacement may have written newer bytes at the same
// address, or a build may have moved a draft into its new site. So every
// answer that would hand a finished upload's file back — a repeated
// `complete`, `status`, an abort after the finish — first reads the object as
// it is NOW (`whereNow`): here and still this upload's (`up` is its id), gone,
// holding another upload's bytes, or unreadable. Only the first is answered
// with the file. Gone and replaced are said as such (`removed`, `replaced`),
// with no file, so a page never reuses a missing file or takes a replacement's
// bytes for the original; unreadable is said as unreadable (503), never as
// either. Nothing here writes: a repeated `complete` never closes an upload
// again, so it cannot bring a deleted file back or write over a newer one.
async function whereNow(deps, s) {
  let h;
  try {
    // DELETED BY ITS RECORD is gone, even while a crashed delete left the object.
    const a = deps.readAsset ? await deps.readAsset(s.scope, s.name) : null;
    if (a && a.rec && a.rec.state === "deleted") return { now: "missing" };
    h = await deps.exists(s.key);
  } catch { return { now: "unknown" }; }
  if (!h) return { now: "missing" };
  return h.up === s.sid ? { now: "here", size: Number(h.size) || s.size } : { now: "other" };
}
/** The answer for a finished upload whose file is not (or cannot be shown to be) the one it made. */
function notNow(where) {
  if (where.now === "missing") return res({ error: "that file was uploaded, but it has since been deleted or moved", code: "removed", finished: true }, 410);
  if (where.now === "other") return res({ error: "that file was uploaded, but its address now holds a newer replacement", code: "replaced", finished: true }, 409);
  return res({ error: "couldn't check that file just now — try again in a moment", code: "unreadable", retry: true }, 503);
}

/** One part. The first is read for what the file is; every part's length is exact. */
export async function handleMediaPart(deps, { scope, sid, n, bytes } = {}) {
  const gate = await deps.gate(scope);
  if (gate && gate.error) return gate.error;
  const s = await liveSession(deps, scope, sid);
  if (!s) return res({ error: "that upload has expired or was cancelled — start it again", code: "no_session" }, 404);
  if (s.state === "done") return res({ error: "that upload has already finished", code: "done" }, 409);
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
  const etag = up && typeof up.etag === "string" ? up.etag : "";
  if (etag) { try { await deps.savePart(scope, sid, n, etag); } catch { /* the page holds it too */ } }
  return res({ ok: true, n, etag });
}

async function abortQuietly(deps, s) {
  try { await deps.abort(s.key, s.uploadId); } catch { /* the session's expiry aborts it */ }
  try { await deps.dropSession(s.scope, s.sid); } catch { /* expires on its own */ }
  try { await deps.dropParts(s.scope, s.sid); } catch { /* expires on its own */ }
  await releaseMedia(deps, s.scope, s.sid);
}

/** Every part's etag, 1…parts: what the server recorded, else what the page sent. `null` when one is missing. */
function partList(s, saved, sent) {
  const fromPage = new Map();
  for (const p of Array.isArray(sent) ? sent : []) {
    if (p && Number.isInteger(p.n) && p.n >= 1 && p.n <= s.parts && typeof p.etag === "string" && p.etag && p.etag.length <= 200) fromPage.set(p.n, p.etag);
  }
  const out = [];
  const missing = [];
  const unrecorded = [];
  for (let n = 1; n <= s.parts; n++) {
    const own = saved && typeof saved[n] === "string" && saved[n];
    const e = own || fromPage.get(n);
    if (e) out.push({ partNumber: n, etag: e }); else missing.push(n);
    if (e && !own) unrecorded.push(n);
  }
  return { list: out, missing, unrecorded };
}

/**
 * CLOSES THE UPLOAD, and may be asked again. The file appears only now; what
 * it made is kept with the session, so a repeated `complete` answers the
 * same, and one that finds the upload already finished by R2 — the first
 * answer lost on the way back — reads the file's own `up` and answers it too.
 */
export async function handleMediaComplete(deps, { scope, sid, parts } = {}) {
  const gate = await deps.gate(scope);
  if (gate && gate.error) return gate.error;
  const s = await liveSession(deps, scope, sid);
  if (!s) return res({ error: "that upload has expired or was cancelled — start it again", code: "no_session" }, 404);
  if (s.state === "done") {
    const where = await whereNow(deps, s);
    return where.now === "here" ? res(finishedBody(s, { again: true }), 200) : notNow(where);
  }
  // A REPLACEMENT CLAIMS ITS FILE'S RECORD BEFORE R2 IS ASKED TO CLOSE
  // (2026-10-15): only over the generation it started from, and never over a
  // delete. Deleted or newer meanwhile, it is given up and nothing is closed.
  if (s.replace) {
    let gone = null;
    let claim;
    try {
      claim = await changeAsset(deps, scope, s.name, async (rec) => {
        if (rec.state === "committing" && rec.claim && rec.claim.sid === sid) return { same: true };
        if (rec.state === "deleted" || rec.state === "absent") { gone = "removed"; return { refuse: true }; }
        if (rec.state === "committing") {
          if (!claimStale(deps, rec)) return { refuse: res({ error: "that file is being replaced by another upload — try again in a moment", code: "replacing", retry: true }, 409) };
          const back = await recoverClaim(deps, scope, s.name, rec);
          if (back.unknown) return { refuse: notNow({ now: "unknown" }) };
          if (back.unconfirmed) return { refuse: unconfirmedClaim() };
          return { rec: back, again: true };
        }
        const base = Number.isSafeInteger(s.baseGen) ? s.baseGen : 0;
        if (rec.gen !== base) { gone = "replaced"; return { refuse: true }; }
        return { rec: { gen: rec.gen, state: "committing", up: rec.up || "", claim: { sid, at: deps.now(), key: s.key, uploadId: s.uploadId } } };
      });
    } catch { return notNow({ now: "unknown" }); }
    if (gone) {
      await abortQuietly(deps, s);
      return gone === "removed"
        ? res({ error: "the file this was replacing has been deleted — upload it as a new file instead", code: "removed" }, 410)
        : res({ error: "a newer version of that file was saved while this one was being sent — nothing was changed", code: "replaced" }, 409);
    }
    if (claim.refuse) return claim.refuse;
    // CLAIMED, BUT A CLAIM SETTLED WHILE THIS WAITED may have been our own: a
    // session given up by a recovery is no longer there to close.
    const still = await liveSession(deps, scope, sid);
    if (!still) return res({ error: "that upload was given up while it waited — send the file again", code: "no_session" }, 404);
    if (still.state === "done") return res(finishedBody(still, { again: true }), 200);
  }
  let saved = {};
  try { saved = (await deps.savedParts(scope, sid)) || {}; } catch { saved = {}; }
  const { list, missing, unrecorded } = partList(s, saved, parts);
  let done = null;
  if (missing.length) {
    // NOTHING TO CLOSE WITH — unless R2 already closed it (a lost answer).
    const own = await ownFile(deps, s);
    if (!own) return res({ error: "some of that file's parts are missing — send them and finish again", code: "parts_missing", parts: s.parts, missing: missing.slice(0, 50) }, 400);
    done = own;
  } else {
    try {
      const c = await deps.complete(s.key, s.uploadId, list);
      done = { size: c && Number.isSafeInteger(c.size) ? c.size : s.size };
    } catch {
      done = await ownFile(deps, s);
      // A PART ONLY THE PAGE VOUCHED FOR is the likelier cause: asked for again
      // by number, rather than the whole upload called failed.
      if (!done && unrecorded.length) return res({ error: "some of that file's parts need sending again", code: "parts_missing", parts: s.parts, missing: unrecorded.slice(0, 50) }, 400);
      // A REPLACEMENT WHOSE CLAIM WAS SETTLED BY ANOTHER REQUEST while it was
      // closing (its upload aborted by a recovery): said as what the record
      // now is, never as a close to try again.
      if (!done && s.replace) {
        const a = await deps.readAsset(scope, s.name).catch(() => null);
        const rec = a && a.rec;
        if (rec && !(rec.state === "committing" && rec.claim && rec.claim.sid === sid)) {
          const gone = await liveSession(deps, scope, sid);
          if (gone && gone.state !== "done") await abortQuietly(deps, gone);
          return rec.state === "deleted"
            ? res({ error: "the file this was replacing has been deleted — upload it as a new file instead", code: "removed" }, 410)
            : res({ error: "this replacement was given up while it waited — nothing was changed; send the file again", code: "replaced" }, 409);
        }
      }
      if (!done) return res({ error: "couldn't finish that upload — try finishing it again", code: "complete_failed", retry: true }, 502);
    }
  }
  // CLOSED: the replacement's record moves to the next generation, its own.
  if (s.replace) {
    await changeAsset(deps, scope, s.name, async (rec) => {
      if (rec.state === "committing" && rec.claim && rec.claim.sid === sid) return { rec: { gen: rec.gen + 1, state: "live", up: sid, at: deps.now() } };
      return { same: true };
    }).catch(() => {});
  }
  const file = await recordDone(deps, scope, s, done.size);
  return res({ ok: true, ...file }, s.replace ? 200 : 201);
}

/** The file at the session's key, when it is the one this upload made (`up`). */
async function ownFile(deps, s) {
  try {
    const h = await deps.exists(s.key);
    return h && h.up === s.sid ? { size: Number(h.size) || s.size } : null;
  } catch { return null; }
}

/**
 * WHAT BECAME OF AN UPLOAD, for a page that lost an answer, reconnected or
 * reloaded: `done` with the file, `open` with the parts the server holds (so
 * only the rest is sent), or 404 when it expired, was cancelled, or is not
 * this account's.
 */
export async function handleMediaStatus(deps, { scope, sid } = {}) {
  const gate = await deps.gate(scope);
  if (gate && gate.error) return gate.error;
  const s = await liveSession(deps, scope, sid);
  if (!s) return res({ error: "that upload has expired or was cancelled", code: "no_session" }, 404);
  if (s.state === "done") {
    const where = await whereNow(deps, s);
    if (where.now === "here") return res({ ok: true, state: "done", file: s.file });
    if (where.now === "unknown") return notNow(where);
    // FINISHED ONCE, NOT AVAILABLE NOW: said, with no file to reuse.
    return res({ ok: true, state: where.now === "missing" ? "removed" : "replaced", finished: true });
  }
  const where = await whereNow(deps, s);
  if (where.now === "unknown") return notNow(where);
  if (where.now === "here") {
    // FINISHED BY R2, RECORD NOT YET WRITTEN: finish the record now.
    return handleMediaComplete(deps, { scope, sid, parts: [] }).then((r) => (r.status < 300 ? res({ ok: true, state: "done", file: stripOk(r.body) }) : r));
  }
  let saved = {};
  try { saved = (await deps.savedParts(scope, sid)) || {}; } catch { saved = {}; }
  const have = Object.keys(saved).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= s.parts).sort((a, b) => a - b);
  return res({ ok: true, state: "open", name: s.name, kind: s.kind, size: s.size, parts: s.parts, partBytes: MEDIA_PART_BYTES, have, etags: have.map((n) => saved[n]) });
}
const stripOk = (b) => { const { ok, again, ...rest } = b || {}; return rest; };

/** Gives an upload up: its parts are aborted and nothing appears. One already finished is kept, and said. */
export async function handleMediaAbort(deps, { scope, sid } = {}) {
  const gate = await deps.gate(scope);
  if (gate && gate.error) return gate.error;
  const s = await liveSession(deps, scope, sid);
  if (!s) return res({ ok: true, gone: true });
  if (s.state === "done") {
    const where = await whereNow(deps, s);
    return where.now === "here" ? res({ ok: true, done: true, file: s.file }) : res({ ok: true, finished: true, gone: where.now !== "unknown" });
  }
  if (await ownFile(deps, s)) {
    const r = await handleMediaComplete(deps, { scope, sid, parts: [] });
    return r.status < 300 ? res({ ok: true, done: true, file: stripOk(r.body) }) : r;
  }
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
  const all = Array.isArray(files) ? files : [];
  const list = all.filter((f) => f && (f.kind === "video" || f.kind === "audio") && typeof f.url === "string").slice(0, 40);
  // WHAT BECAME OF THE FILES THIS BUILD'S REQUEST BROUGHT (2026-10-15, Codex's
  // review of `7ca339d1`): given to the writer as facts, so the reply it writes
  // in `notes` says it in its own words — never a fixed sentence of ours.
  // `moved` marks a file moved in from the owner's drafts for this request; an
  // entry `{ kind: "missing", name, why }` one that could not be.
  const moved = list.filter((f) => f.moved === true);
  const missing = all.filter((f) => f && f.kind === "missing" && typeof f.name === "string").slice(0, 20);
  if (!list.length && !missing.length) return "";
  const line = (f) => {
    const bits = [MEDIA_FORMATS[String(f.url).split(".").pop()] ? MEDIA_FORMATS[String(f.url).split(".").pop()].label + " " + f.kind : f.kind];
    if (f.size) bits.push(f.size >= 1e6 ? (f.size / 1e6).toFixed(1).replace(/\.0$/, "") + " MB" : Math.max(1, Math.round(f.size / 1000)) + " KB");
    if (f.duration) bits.push(Math.floor(f.duration / 60) + ":" + String(Math.round(f.duration % 60)).padStart(2, "0") + " long");
    if (f.width && f.height) bits.push(f.width + "×" + f.height);
    return "- " + (f.name ? JSON.stringify(String(f.name)) + ": " : "") + f.url + " (" + bits.join(", ") + ")";
  };
  const said = (f) => JSON.stringify(String(f.download || f.name || "a file"));
  const out = [];
  if (list.length) {
    out.push(heading + " — uploaded by the owner and hosted on the site. Play one with an HTML <video> or <audio> " +
      "element whose src is the address exactly as written (add `controls`; for video add `playsInline` and " +
      "`preload=\"metadata\"`). Nobody has watched or listened to these files: you know only the name, the type, the " +
      "size and, where given, the length and frame size the owner's browser reported — never say what is in one.\n" +
      list.map(line).join("\n"));
  }
  if (moved.length) {
    out.push("FILES THE OWNER ATTACHED TO THIS REQUEST, moved into the site's file library for it: " + moved.map(said).join(", ") +
      ". Use each where the request asks for it. In `notes`, tell the owner in your own words where each one is played, " +
      "or that it is in the file library if no page plays it.");
  }
  if (missing.length) {
    out.push("FILES THE OWNER ATTACHED THAT COULD NOT BE ADDED to the site: " +
      missing.map((m) => JSON.stringify(String(m.name)) + " (" + String(m.why || "it could not be moved").slice(0, 120) + ")").join(", ") +
      ". There is no address for them: never reference them on a page. In `notes`, say plainly that they were not added and why.");
  }
  return out.join("\n\n");
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

/**
 * THE FIXED LINE THAT STAYS (2026-10-15): only what went wrong, as a
 * technical fact — a file the request named that could not be moved in, and
 * why. Where the files went, and what plays them, is the page writer's own
 * reply (`mediaBlock` gives it the facts); a line of ours saying it was the
 * ordinary narration this replaced. Empty when nothing went wrong.
 */
export function mediaErrorNote({ missing = [] } = {}) {
  const list = (Array.isArray(missing) ? missing : []).filter((m) => m && typeof m === "object");
  if (!list.length) return "";
  return "Not added to your site's file library: " +
    list.map((m) => JSON.stringify(String(m.name || "a file")) + " (" + (m.why || "it could not be moved") + ")").join(", ") + ".";
}
