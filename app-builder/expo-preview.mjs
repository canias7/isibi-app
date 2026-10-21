// AN APP'S WEB VERSION, FOR THE BUILDER'S PHONES (2026-10-21, phase B of
// docs/plans/2026-10-21-expo-apps.md). The model writes an Expo app's screens;
// this checks them the way a site's pages are checked — they must typecheck —
// and exports the web version the two phones show. No Mac and no Codemagic:
// the installable apps are phase D.

/** What one request may carry. */
export const EXPO_MAX_FILES = 80;
export const EXPO_MAX_BYTES = 2_000_000;
/** A file the app may write: its screens (`app/`), its own code (`lib/`), its own components — never the kit itself. */
const APP_PATH = /^(?!.*\.\.)(?:app|lib|components\/(?!app\/))[A-Za-z0-9_()+\[\].\/-]{0,200}\.(?:tsx|ts)$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
export const THEME_KEYS = ["paper", "card", "ink", "soft", "line", "primary", "onPrimary", "accent", "good"];
/** Where the web version is served from: `/app-preview/<slug>/<token>`. */
const BASE = /^\/app-preview\/[a-z0-9][a-z0-9-]{0,80}\/[a-f0-9]{16,64}$/;

/** A preview request, or `{ error }` naming what is wrong. Never coerces. */
export function readExpoRequest(b) {
  if (!b || typeof b !== "object" || Array.isArray(b)) return { error: "not a preview request" };
  if (typeof b.baseUrl !== "string" || !BASE.test(b.baseUrl)) return { error: "baseUrl must be /app-preview/<slug>/<token>" };
  if (!Array.isArray(b.files) || !b.files.length) return { error: "files must be a list of the app's files" };
  if (b.files.length > EXPO_MAX_FILES) return { error: "too many files" };
  const files = [];
  const seen = new Set();
  let bytes = 0;
  for (const f of b.files) {
    if (!f || typeof f.path !== "string" || typeof f.source !== "string") return { error: "each file needs a path and a source" };
    if (!APP_PATH.test(f.path)) return { error: "not a file an app may write: " + f.path.slice(0, 120) };
    if (seen.has(f.path)) return { error: "the same file twice: " + f.path };
    seen.add(f.path);
    bytes += Buffer.byteLength(f.source, "utf8");
    files.push({ path: f.path, source: f.source });
  }
  if (bytes > EXPO_MAX_BYTES) return { error: "the files are too large" };
  if (!files.some((f) => f.path === "app/(tabs)/_layout.tsx")) return { error: "an app needs its tabs: app/(tabs)/_layout.tsx" };
  let theme = null;
  if (b.theme !== undefined && b.theme !== null) {
    if (typeof b.theme !== "object" || Array.isArray(b.theme)) return { error: "theme must be an object" };
    theme = {};
    for (const k of THEME_KEYS) {
      if (!Object.hasOwn(b.theme, k)) return { error: "theme needs " + k };
      if (typeof b.theme[k] !== "string" || !HEX.test(b.theme[k])) return { error: "theme." + k + " must be a #rrggbb colour" };
      theme[k] = b.theme[k];
    }
    const r = b.theme.radius;
    if (!Number.isInteger(r) || r < 0 || r > 32) return { error: "theme.radius must be a whole number from 0 to 32" };
    theme.radius = r;
  }
  return { baseUrl: b.baseUrl, files, theme };
}

/** Typecheck errors as the model can read them: file, line, message — the first 30. */
export function tscErrors(out) {
  return String(out || "").split("\n").filter((l) => /\.tsx?\(\d+,\d+\): error TS\d+/.test(l)).slice(0, 30);
}

/**
 * Check and export one app. `{ ok: true, files: [{ path, data }], ms }` with the
 * web version as base64, or `{ ok: false, stage, errors }` — `typecheck` with the
 * compiler's own lines, `export` when the bundler refused.
 */
export async function exportExpo(r, { template, exec, fs, tmp }) {
  const { mkdtemp, cp, writeFile, mkdir, rm, symlink, readdir, readFile } = fs;
  const { join, dirname } = await import("node:path");
  const started = Date.now();
  const dir = await mkdtemp(join(tmp, "expo-"));
  try {
    await cp(template, dir, { recursive: true, filter: (s) => !/[\\/](node_modules|dist|\.expo)([\\/]|$)/.test(s.slice(template.length - 1)) });
    await symlink(join(template, "node_modules"), join(dir, "node_modules"));
    // THE STARTER'S OWN TABS GO: the app brings its own, and a leftover screen
    // would be a tab nobody wrote.
    await rm(join(dir, "app/(tabs)"), { recursive: true, force: true });
    if (r.theme) await writeFile(join(dir, "theme.json"), JSON.stringify(r.theme, null, 2));
    for (const f of r.files) {
      await mkdir(dirname(join(dir, f.path)), { recursive: true });
      await writeFile(join(dir, f.path), f.source);
    }
    try {
      await exec("npx", ["tsc", "--noEmit"], { cwd: dir, timeout: 180_000, maxBuffer: 8 * 1024 * 1024 });
    } catch (e) {
      const errors = tscErrors((e && e.stdout) || "");
      return { ok: false, stage: "typecheck", errors: errors.length ? errors : ["the code does not typecheck"] };
    }
    try {
      await exec("npx", ["expo", "export", "-p", "web"], { cwd: dir, timeout: 300_000, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, CI: "1", EXPO_BASE_URL: r.baseUrl } });
    } catch (e) {
      const tail = String((e && (e.stderr || e.stdout)) || "").split("\n").filter(Boolean).slice(-12);
      return { ok: false, stage: "export", errors: tail.length ? tail : ["the app could not be bundled"] };
    }
    const out = [];
    const walk = async (d, rel) => {
      for (const ent of await readdir(d, { withFileTypes: true })) {
        const p = join(d, ent.name), q = rel ? rel + "/" + ent.name : ent.name;
        if (ent.isDirectory()) await walk(p, q);
        else out.push({ path: q, data: (await readFile(p)).toString("base64") });
      }
    };
    await walk(join(dir, "dist"), "");
    return { ok: true, files: out, ms: Date.now() - started };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
