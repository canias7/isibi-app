// THE SITE'S PROJECT FOLDER (2026-10-31, `docs/plans/2026-10-31-code-mirror.md`).
//
// The owner: the Code tab and the site's files in storage must be the same set,
// "no one side having more than another". For a NEW site the whole project the
// build compiles from lives in one folder: `source/<slug>/files/<path>`, one R2
// object per file, and `source/<slug>/files.json`, the list of every path with
// its size and hash. That list IS the project: the Code tab and the Download
// read it and nothing else, the compiler lays it over the template, and the
// site agent reads its files from it.
//
// ONE MODULE FOR BOTH ENDS, dependency-free: the container collects the
// snapshot and applies the overlay (`build-server.mjs`), the Worker stores it,
// reads it and decides which files the next compile must be sent. One
// definition of the path rules and the file kinds, so the two cannot drift.
//
// OLD SITES ARE LEFT AS THEY ARE: a site with no `files.json` keeps today's tab,
// and a site gets one only when its first build ran with this shipped
// (`mirrorWanted`).

/** The manifest: the list of the project's files. */
export const PROJECT_LIST_KEY = (slug) => "source/" + String(slug).toLowerCase() + "/files.json";
/**
 * ONE STORED FILE'S BYTES, BY THEIR HASH (2026-10-31, the owner's fixes 2, 5
 * and the same-path race): the list names each path's sha256 and the bytes
 * live at `source/<slug>/blobs/<sha256>`. A save uploads only hashes the list
 * it started from did not already hold, switches the list in one conditional
 * write, and deletes no longer named blobs only after that. An interrupted
 * save leaves the old list and every object it names untouched, and two saves
 * of one path can never leave a list naming bytes it does not hold.
 */
export const PROJECT_BLOB_KEY = (slug, sha) => "source/" + String(slug).toLowerCase() + "/blobs/" + sha;
export const PROJECT_BLOB_PREFIX = (slug) => "source/" + String(slug).toLowerCase() + "/blobs/";
/** The list's format: v2 is content-addressed and records each starter file's starter version. */
export const PROJECT_LIST_VERSION = 2;

// THE PROJECT'S ROOT FILES, by name: the template's own top level. The
// container's `/app` also holds the build service and its modules, so the root
// is named rather than walked; `src/` and `public/` are walked whole.
export const PROJECT_ROOT_FILES = Object.freeze([
  ".gitignore", ".prettierignore", ".prettierrc", "AGENTS.md", "README.md", "components.json",
  "eslint.config.js", "package-lock.json", "package.json", "tsconfig.json", "tsconfig.kit.json", "vite.config.ts",
]);
export const PROJECT_DIRS = Object.freeze(["src", "public"]);

// THE KIT: 3,254 components under `src/components/`. Only the ones the site's
// code reaches (the container's `siteKitFiles` closure) are part of its project.
export const KIT_DIR = "src/components/";

// WHAT THE BUILD WRITES ITSELF, every build, from the site's settings: the
// brand module, the font imports, the route tree, the stylesheet (the config's
// `css` over the template's base), the marks and the font files. Stored so the
// tab shows what really runs; never laid back over the template, because the
// build writes them again from the settings that are their real source.
const GENERATED = new Set([
  "src/site-brand.ts", "src/fonts.ts", "src/routeTree.gen.ts",
  "public/icon.svg", "public/animated.svg", "public/logo.svg",
]);
const QR_PUBLIC = /^public\/qr(?:-[a-z][a-z0-9]{0,23})?\.svg$/;

const BINARY_EXT = /\.(?:woff2?|ttf|otf|eot|png|jpe?g|gif|webp|avif|ico|pdf|zip)$/i;

export const MAX_PROJECT_FILE_BYTES = 4_000_000;
export const MAX_PROJECT_BYTES = 12_000_000;
export const MAX_PROJECT_FILES = 2_000;

/**
 * A path the project may hold, or "" when it is not one. Relative, inside
 * `src/`, `public/` or one of the named root files, with no empty, `.` or `..`
 * segment, no backslash and no control character: the paths come back from
 * storage into a container's disk and a customer's zip.
 */
export function safeProjectPath(p) {
  if (typeof p !== "string" || !p || p.length > 300) return "";
  if (p.startsWith("/") || p.includes("\\") || /[\u0000-\u001f\u007f]/.test(p)) return "";
  const segs = p.split("/");
  if (segs.some((s) => !s || s === "." || s === "..")) return "";
  if (segs.length === 1) return PROJECT_ROOT_FILES.includes(p) ? p : "";
  return PROJECT_DIRS.includes(segs[0]) ? p : "";
}

/**
 * What a project file is: `page` and `part` (the site's own, under
 * `src/routes/`), `styles` (the stylesheet), `generated` (written by the build
 * from the settings), `kit` (a kit component the site uses) or `starter` (the
 * rest of the template the site is built from).
 */
export function projectFileKind(p) {
  if (p === "src/styles.css") return "styles";
  if (p.startsWith("src/routes/-parts/")) return "part";
  if (p.startsWith("src/routes/")) return "page";
  if (GENERATED.has(p) || p.startsWith("public/fonts/") || QR_PUBLIC.test(p)) return "generated";
  if (p.startsWith(KIT_DIR)) return "kit";
  return "starter";
}

/** Laid over the template before a compile: what the build does not write itself. */
export const overlayable = (p) => {
  const k = projectFileKind(p);
  return k === "starter" || k === "kit";
};

export const isBinaryPath = (p) => BINARY_EXT.test(String(p || ""));

/**
 * THE CONTAINER'S HALF: the project as it is on disk after a successful
 * compile. `kitPaths` is the site's kit closure (only those files under
 * `src/components/` are its own); `pristine` maps a path the overlay replaced
 * to the image's own bytes, so each starter or kit file records its STARTER
 * VERSION (`starter`: the hash of the image's copy, the owner's fix 4) and,
 * when the site's copy differs, the starter's bytes too (`starterBase64`), so
 * the file can always be put back to it. Sorted by path. Answers `{ok:false, why}` past the size caps rather than
 * a partial project.
 */
export function collectProject({ app, fs, path, hash, kitPaths = [], pristine = new Map() }) {
  const kit = new Set((Array.isArray(kitPaths) ? kitPaths : []).map(String));
  const out = [];
  let total = 0;
  const add = (rel) => {
    const p = safeProjectPath(rel);
    if (!p) return null;
    if (p.startsWith(KIT_DIR) && !kit.has(p)) return null;
    let bytes;
    try { bytes = fs.readFileSync(path.join(app, p)); } catch { return null; }
    if (bytes.length > MAX_PROJECT_FILE_BYTES) return "the file " + p + " is over " + MAX_PROJECT_FILE_BYTES + " bytes";
    total += bytes.length;
    if (total > MAX_PROJECT_BYTES) return "the project is over " + MAX_PROJECT_BYTES + " bytes";
    if (out.length >= MAX_PROJECT_FILES) return "the project has over " + MAX_PROJECT_FILES + " files";
    const sha256 = hash(bytes);
    const entry = { path: p, size: bytes.length, sha256, base64: bytes.toString("base64") };
    if (overlayable(p)) {
      const orig = pristine.has(p) ? pristine.get(p) : bytes;
      if (orig) {
        entry.starter = hash(orig);
        entry.starterSize = orig.length;
        if (entry.starter !== sha256) entry.starterBase64 = Buffer.from(orig).toString("base64");
      }
    }
    out.push(entry);
    return null;
  };
  for (const name of PROJECT_ROOT_FILES) {
    try { if (fs.statSync(path.join(app, name)).isFile()) { const why = add(name); if (why) return { ok: false, why }; } } catch { /* absent */ }
  }
  const walk = (rel) => {
    let names = [];
    try { names = fs.readdirSync(path.join(app, rel), { withFileTypes: true }); } catch { return null; }
    for (const e of names) {
      const r = rel + "/" + e.name;
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name === "dist") continue;
        const why = walk(r); if (why) return why;
        continue;
      }
      if (!e.isFile()) continue;
      const why = add(r); if (why) return why;
    }
    return null;
  };
  for (const d of PROJECT_DIRS) { const why = walk(d); if (why) return { ok: false, why }; }
  out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { ok: true, files: out };
}

/**
 * THE CONTAINER'S OTHER HALF: lay the stored files over the template. Only
 * starter and kit files (the build writes the rest itself), only safe paths.
 * Answers the image's own bytes for each path replaced (`null` where the image
 * had none), which `restoreOverlay` puts back after the build, so one site's
 * files never reach the next build in a long-lived container.
 */
export function applyOverlay({ app, fs, path, files, chown = null }) {
  const pristine = new Map();
  const refused = [];
  for (const f of Array.isArray(files) ? files : []) {
    const p = f && safeProjectPath(f.path);
    if (!p || !overlayable(p) || typeof f.base64 !== "string") { refused.push(String((f && f.path) || "")); continue; }
    const full = path.join(app, p);
    let bytes;
    try { bytes = Buffer.from(f.base64, "base64"); } catch { refused.push(p); continue; }
    if (!pristine.has(p)) {
      let orig = null;
      try { orig = fs.readFileSync(full); } catch { orig = null; }
      pristine.set(p, orig);
    }
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, bytes);
    if (chown) { try { chown(full); } catch { /* best effort */ } }
  }
  return { pristine, refused };
}

export function restoreOverlay({ app, fs, path, pristine }) {
  for (const [p, orig] of pristine || []) {
    const full = path.join(app, p);
    try {
      if (orig) fs.writeFileSync(full, orig);
      else fs.rmSync(full, { force: true });
    } catch { /* best effort; the next overlay records again */ }
  }
}

// ── THE WORKER'S HALF ────────────────────────────────────────────────────────

/** One manifest entry, held to its shape. */
function cleanEntry(e) {
  if (!e || typeof e !== "object") return null;
  const p = safeProjectPath(e.path);
  if (!p || !Number.isFinite(e.size) || e.size < 0 || typeof e.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(e.sha256)) return null;
  const out = { path: p, size: e.size, sha256: e.sha256 };
  if (typeof e.starter === "string" && /^[0-9a-f]{64}$/.test(e.starter)) {
    out.starter = e.starter;
    if (Number.isFinite(e.starterSize) && e.starterSize >= 0) out.starterSize = e.starterSize;
  }
  return out;
}

/**
 * The manifest, read: `absent` (an old site, or one not built since this
 * shipped), `read` with its files, or `unreadable` (cannot tell: never "none").
 */
export async function readProjectList(bucket, slug) {
  if (!bucket) return { state: "unreadable", files: [] };
  try {
    const o = await bucket.get(PROJECT_LIST_KEY(slug));
    if (!o) return { state: "absent", files: [] };
    const v = JSON.parse(await o.text());
    if (!v || v.v !== PROJECT_LIST_VERSION || !Array.isArray(v.files)) return { state: "unreadable", files: [] };
    const files = v.files.map(cleanEntry);
    if (files.some((f) => !f)) return { state: "unreadable", files: [] };
    return { state: "read", files };
  } catch { return { state: "unreadable", files: [] }; }
}

const b64ToBytes = (s) => {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
};
const bytesToB64 = (u) => {
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
  return btoa(s);
};

/**
 * Store a snapshot the container sent, MERGED onto the latest stored list
 * (2026-10-31, the owner's fix 1). `base` is the list this save's compile
 * started from: a file the snapshot changed or added against it is uploaded
 * and set in the list; a file of `base` the snapshot no longer has is taken
 * out; every other entry of the LATEST list is kept as it is, so two parts
 * saved side by side that added different files both end up listed.
 *
 * `guard()` is asked before every upload and every delete and throws when
 * this save may no longer write (the turn's fence); `putList(merge)` writes
 * the list as a read-modify-write (`merge(latestFiles)` gives the new files)
 * and answers false when it could not. Without them the bucket is used
 * directly. A snapshot that fails its shape, a refused guard or a failed
 * upload writes no list.
 */
export async function saveProject(bucket, slug, snapshot, { base = null, guard = null, putList = null, concurrency = 8 } = {}) {
  if (!bucket) return { ok: false, why: "no bucket" };
  if (!snapshot || snapshot.ok !== true || !Array.isArray(snapshot.files) || !snapshot.files.length) return { ok: false, why: (snapshot && snapshot.why) || "no snapshot" };
  const from = base || await readProjectList(bucket, slug);
  if (from.state === "unreadable") return { ok: false, why: "the list this save started from could not be read" };
  const baseFiles = from.state === "read" ? from.files : [];
  const had = new Map(baseFiles.map((f) => [f.path, f.sha256]));
  const heldShas = new Set(baseFiles.flatMap((f) => [f.sha256, f.starter].filter(Boolean)));
  const set = new Map();
  const changed = new Set();
  const blobs = new Map();
  for (const f of snapshot.files) {
    const e = cleanEntry(f);
    if (!e || typeof f.base64 !== "string" || set.has(e.path)) return { ok: false, why: "a file of the snapshot is malformed" };
    if (e.starter && e.starter !== e.sha256 && typeof f.starterBase64 !== "string") return { ok: false, why: "a changed starter file came without its starter copy" };
    set.set(e.path, e);
    if (had.get(e.path) !== e.sha256) changed.add(e.path);
    // ONLY BYTES THE LIST DID NOT ALREADY HOLD GO UP (fix 5): one per hash.
    if (!heldShas.has(e.sha256)) blobs.set(e.sha256, f.base64);
    if (e.starter && e.starter !== e.sha256 && !heldShas.has(e.starter)) blobs.set(e.starter, f.starterBase64);
  }
  const dropped = new Set([...had.keys()].filter((p) => !set.has(p)));
  const merge = (latest) => {
    const out = new Map();
    for (const f of Array.isArray(latest) ? latest : []) if (!dropped.has(f.path)) out.set(f.path, f);
    // A file this save changed wins; one it left as it was keeps the latest
    // entry (another part may have changed it since); one the latest list
    // lacks but this save holds unchanged is added back from the snapshot.
    for (const [p, e] of set) if (changed.has(p) || !out.has(p)) out.set(p, e);
    return [...out.values()].sort((x, y) => (x.path < y.path ? -1 : x.path > y.path ? 1 : 0));
  };
  const writeList = putList || (async (m) => {
    const o = await bucket.get(PROJECT_LIST_KEY(slug));
    let latest = [];
    if (o) { const cur = await readProjectList({ get: async () => o }, slug); if (cur.state !== "read") return false; latest = cur.files; }
    const put = await bucket.put(PROJECT_LIST_KEY(slug), JSON.stringify({ v: PROJECT_LIST_VERSION, files: m(latest) }), {
      httpMetadata: { contentType: "application/json" }, onlyIf: o && o.etag ? { etagMatches: o.etag } : { etagDoesNotMatch: "*" } });
    return !!put;
  });
  let listed = null;
  try {
    const todo = [...blobs.entries()];
    let i = 0;
    const one = async () => {
      for (;;) {
        const at = i++;
        if (at >= todo.length) return;
        const [sha, b64] = todo[at];
        if (guard) await guard();
        await bucket.put(PROJECT_BLOB_KEY(slug, sha), b64ToBytes(b64), { httpMetadata: { contentType: "application/octet-stream" }, customMetadata: { sha256: sha } });
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) }, one));
    if (guard) await guard();
    let files = null;
    const ok = await writeList((latest) => (files = merge(latest)));
    if (!ok) return { ok: false, why: "the list could not be written" };
    listed = files;
  } catch (err) { return { ok: false, why: "store: " + String((err && err.message) || err).slice(0, 120) }; }
  // AFTER THE SWITCH, AND AGAINST THE LIST AS IT NOW STANDS: a blob the base
  // named that no current entry names (as its bytes or its starter) goes.
  let removed = 0;
  try {
    const now = await readProjectList(bucket, slug);
    if (now.state === "read") {
      const named = new Set(now.files.flatMap((f) => [f.sha256, f.starter].filter(Boolean)));
      for (const sha of heldShas) {
        if (named.has(sha)) continue;
        try { if (guard) await guard(); await bucket.delete(PROJECT_BLOB_KEY(slug, sha)); removed++; } catch { /* an orphan blob, never named */ }
      }
    }
  } catch { /* cleanup is best effort; the list is already right */ }
  return { ok: true, files: listed.length, uploaded: blobs.size, removed };
}

const sha256Hex = async (u) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", u))].map((b) => b.toString(16).padStart(2, "0")).join("");

/**
 * The files of a list, read from their blobs with bounded concurrency: text
 * as `source`, a binary file as `base64`. Each read is tried twice, and its
 * bytes must hash to the list's sha256; a file that still cannot be read is
 * `missing: true` (said, never dropped). `at: "starter"` reads each entry's
 * starter copy instead.
 */
export async function readProjectFiles(bucket, slug, entries, { concurrency = 16, raw = false } = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const out = new Array(list.length);
  let i = 0;
  const fetchOnce = async (sha) => {
    const o = await bucket.get(PROJECT_BLOB_KEY(slug, sha));
    if (!o) return null;
    const u = new Uint8Array(await o.arrayBuffer());
    return (await sha256Hex(u)) === sha ? u : null;
  };
  const one = async () => {
    for (;;) {
      const at = i++;
      if (at >= list.length) return;
      const e = list[at];
      let u = null;
      for (let t = 0; t < 2 && !u; t++) { try { u = await fetchOnce(e.sha256); } catch { u = null; } }
      if (!u) { out[at] = { ...e, missing: true }; continue; }
      out[at] = raw || isBinaryPath(e.path) ? { ...e, base64: bytesToB64(u) } : { ...e, source: new TextDecoder().decode(u) };
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, one));
  return out;
}

/**
 * What the next compile must be sent: the stored starter and kit files the
 * SITE CHANGED (their bytes differ from the starter version they came from).
 * A file the site never changed is not sent, so the image's own copy (a newer
 * starter fix included: the owner's fix 4) is what compiles, and the next save
 * records it. An ordinary site costs no reads here.
 */
export const overlayEntries = (files) => (Array.isArray(files) ? files : []).filter((f) => f && overlayable(f.path) && !(typeof f.starter === "string" && f.starter === f.sha256));

/**
 * The stored files a FAILED compile names (the owner's fix 3): of the files
 * laid over the template, those whose path appears in the compiler's words.
 */
export function projectSuspects(overlay, text) {
  const t = String(text || "");
  if (!t) return [];
  return (Array.isArray(overlay) ? overlay : []).map((f) => f && f.path).filter((p) => p && (t.includes(p) || t.includes(p.replace(/^src\//, ""))));
}

/**
 * Put one stored starter or kit file back to its starter copy (the owner's fix
 * 3): the list entry takes the starter's hash, whose bytes every save keeps.
 * Answers the new list's files, or `{ok:false, why}`.
 */
export function restoreStarterEntry(files, p) {
  const list = Array.isArray(files) ? files : [];
  const e = list.find((f) => f.path === p);
  if (!e) return { ok: false, why: "the project has no file " + p };
  if (!overlayable(p)) return { ok: false, why: p + " is not a starter file: it is the site's own, or written by the build" };
  if (typeof e.starter !== "string") return { ok: false, why: p + " has no starter copy to go back to" };
  if (e.starter === e.sha256) return { ok: false, why: p + " is already the starter copy" };
  return { ok: true, files: list.map((f) => (f.path === p ? { ...f, sha256: f.starter, size: Number.isFinite(f.starterSize) ? f.starterSize : f.size } : f)) };
}

/**
 * Whether this save mirrors the site's project: a site that already has a list
 * does; a FIRST build (nothing stored for the site yet) starts one; every other
 * site (an old one) is left as it is. `unreadable` is cannot-tell, and a save
 * then neither starts nor skips anything it cannot see: it does not mirror.
 */
export function mirrorWanted(listState, { firstBuild = false } = {}) {
  if (listState === "read") return true;
  if (listState === "absent") return firstBuild === true;
  return false;
}
