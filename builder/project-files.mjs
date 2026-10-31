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
/** One file of the project. */
export const PROJECT_FILE_KEY = (slug, p) => "source/" + String(slug).toLowerCase() + "/files/" + p;
/** The folder itself, for a listing or a sweep. */
export const PROJECT_PREFIX = (slug) => "source/" + String(slug).toLowerCase() + "/files/";

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
 * to the image's own bytes, so each starter or kit file can say whether it is
 * the image's copy (`image: true`, and then the next compile need not be sent
 * it). Sorted by path. Answers `{ok:false, why}` past the size caps rather than
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
      entry.image = !!orig && hash(orig) === sha256;
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
export function applyOverlay({ app, fs, path, files }) {
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
  if (typeof e.image === "boolean") out.image = e.image;
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
    if (!v || v.v !== 1 || !Array.isArray(v.files)) return { state: "unreadable", files: [] };
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
export async function saveProject(bucket, slug, snapshot, { base = null, guard = null, putList = null } = {}) {
  if (!bucket) return { ok: false, why: "no bucket" };
  if (!snapshot || snapshot.ok !== true || !Array.isArray(snapshot.files) || !snapshot.files.length) return { ok: false, why: (snapshot && snapshot.why) || "no snapshot" };
  const from = base || await readProjectList(bucket, slug);
  if (from.state === "unreadable") return { ok: false, why: "the list this save started from could not be read" };
  const had = new Map((from.state === "read" ? from.files : []).map((f) => [f.path, f.sha256]));
  const set = new Map();
  const puts = [];
  for (const f of snapshot.files) {
    const e = cleanEntry(f);
    if (!e || typeof f.base64 !== "string" || set.has(e.path)) return { ok: false, why: "a file of the snapshot is malformed" };
    set.set(e.path, e);
    if (had.get(e.path) !== e.sha256) puts.push({ e, base64: f.base64 });
  }
  const dropped = new Set([...had.keys()].filter((p) => !set.has(p)));
  const changed = new Map(puts.map(({ e }) => [e.path, e]));
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
    const cur = await readProjectList(bucket, slug);
    if (cur.state === "unreadable") return false;
    await bucket.put(PROJECT_LIST_KEY(slug), JSON.stringify({ v: 1, files: m(cur.files) }), { httpMetadata: { contentType: "application/json" } });
    return true;
  });
  let listed = null;
  try {
    for (const { e, base64 } of puts) {
      if (guard) await guard();
      await bucket.put(PROJECT_FILE_KEY(slug, e.path), b64ToBytes(base64), {
        httpMetadata: { contentType: isBinaryPath(e.path) ? "application/octet-stream" : "text/plain; charset=utf-8" },
        customMetadata: { sha256: e.sha256 },
      });
    }
    let files = null;
    const ok = await writeList((latest) => (files = merge(latest)));
    if (!ok) return { ok: false, why: "the list could not be written" };
    listed = files;
  } catch (err) { return { ok: false, why: "store: " + String((err && err.message) || err).slice(0, 120) }; }
  const named = new Set(listed.map((f) => f.path));
  const gone = [...dropped].filter((p) => !named.has(p));
  for (const p of gone) {
    try { if (guard) await guard(); await bucket.delete(PROJECT_FILE_KEY(slug, p)); } catch { /* an orphan file, never named by the list */ }
  }
  return { ok: true, files: listed.length, uploaded: puts.length, removed: gone.length };
}

/**
 * The files of a list, read: text as `source`, a binary file as `base64`. A
 * file that cannot be read is `missing: true` (said, never dropped).
 */
export async function readProjectFiles(bucket, slug, entries, { concurrency = 16, raw = false } = {}) {
  const list = Array.isArray(entries) ? entries : [];
  const out = new Array(list.length);
  let i = 0;
  const one = async () => {
    for (;;) {
      const at = i++;
      if (at >= list.length) return;
      const e = list[at];
      try {
        const o = await bucket.get(PROJECT_FILE_KEY(slug, e.path));
        if (!o) { out[at] = { ...e, missing: true }; continue; }
        const u = new Uint8Array(await o.arrayBuffer());
        out[at] = raw || isBinaryPath(e.path) ? { ...e, base64: bytesToB64(u) } : { ...e, source: new TextDecoder().decode(u) };
      } catch { out[at] = { ...e, missing: true }; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, list.length) }, one));
  return out;
}

/**
 * What the next compile must be sent: the stored starter and kit files that are
 * NOT the image's own copy. Every file the image already holds byte for byte is
 * left out, so an ordinary site costs no reads here; the build writes the rest
 * itself.
 */
export const overlayEntries = (files) => (Array.isArray(files) ? files : []).filter((f) => f && overlayable(f.path) && f.image !== true);

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
