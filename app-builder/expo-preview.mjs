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
    // A TextEncoder, never Node's byte helper: this reader also runs on the Worker, which lacks it
    // (the first live check crashed there, 2026-10-21).
    bytes += new TextEncoder().encode(f.source).length;
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

/**
 * THE BUNDLER'S OWN COMPLAINT, not its first line (the first live build kept
 * only "Using (experimental) base path…"): the lines that name an error, a file
 * that cannot be found or resolved — the first 20 — or, when none do, the last 12.
 */
export function bundlerErrors(out) {
  const lines = String(out || "").split("\n").map((l) => l.replace(/\x1b\[[0-9;]*m/g, "").trimEnd()).filter(Boolean);
  const named = lines.filter((l) => /error|unable to resolve|cannot find|could not|failed|SyntaxError|TypeError/i.test(l) && !/^Using \(experimental\)/.test(l));
  const pick = named.length ? named.slice(0, 20) : lines.slice(-12);
  return pick.length ? pick.map((l) => l.slice(0, 400)) : ["the app could not be bundled"];
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
      return { ok: false, stage: "export", errors: bundlerErrors((e && (String(e.stderr || "") + "\n" + String(e.stdout || ""))) || "") };
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

// ── THE INSTALLABLE ANDROID APP (2026-10-21, phase D) ───────────────────────
// The same files, checked the same way, made into a real Android app: Expo
// writes the native project (`prebuild`), Gradle builds it against the
// libraries the image warmed up, offline. Signed with the build's debug key for
// now, which installs on any phone; a Play Store key per app comes with store
// publishing.

const APP_ID = /^[a-z][a-z0-9]{0,40}(\.[a-z][a-z0-9]{0,40}){1,4}$/;

/** An Android build request: a preview request's files and theme, plus the app's id and name. */
export function readExpoAndroid(b) {
  const base = readExpoRequest({ ...(b && typeof b === "object" ? b : {}), baseUrl: "/app-preview/build/" + "0".repeat(32) });
  if (base.error) return base;
  if (typeof b.appId !== "string" || !APP_ID.test(b.appId)) return { error: "appId must look like dev.gofarther.shop" };
  if (typeof b.name !== "string" || !b.name.trim() || b.name.length > 60) return { error: "name must be 1 to 60 characters" };
  return { files: base.files, theme: base.theme, appId: b.appId, name: b.name.trim() };
}

/** Build it: `{ ok: true, apk: Buffer, ms }` or `{ ok: false, stage, errors }`. */
export async function buildExpoAndroid(r, { template, exec, fs, tmp }) {
  const { mkdtemp, cp, writeFile, mkdir, rm, symlink, readFile } = fs;
  const { join, dirname } = await import("node:path");
  const started = Date.now();
  const dir = await mkdtemp(join(tmp, "expo-apk-"));
  try {
    await cp(template, dir, { recursive: true, filter: (s) => !/[\\/](node_modules|dist|\.expo|android|ios)([\\/]|$)/.test(s.slice(template.length - 1)) });
    await symlink(join(template, "node_modules"), join(dir, "node_modules"));
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
    const env = { ...process.env, CI: "1", EXPO_APP_NAME: r.name, EXPO_APP_SLUG: r.appId.split(".").pop(), EXPO_ANDROID_PACKAGE: r.appId };
    try {
      await exec("npx", ["expo", "prebuild", "--platform", "android", "--no-install"], { cwd: dir, env, timeout: 300_000, maxBuffer: 16 * 1024 * 1024 });
      await writeFile(join(dir, "android/local.properties"), "sdk.dir=" + (process.env.ANDROID_HOME || "/opt/android-sdk") + "\n");
      await exec("./gradlew", ["assembleRelease", "--offline", "--no-daemon", "-q"], { cwd: join(dir, "android"), env, timeout: 25 * 60_000, maxBuffer: 32 * 1024 * 1024 });
    } catch (e) {
      const tail = String((e && (e.stderr || e.stdout)) || "").split("\n").filter(Boolean).slice(-15);
      return { ok: false, stage: "android", errors: tail.length ? tail : ["the Android app could not be built"] };
    }
    return { ok: true, apk: await readFile(join(dir, "android/app/build/outputs/apk/release/app-release.apk")), ms: Date.now() - started };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
