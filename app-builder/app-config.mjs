// What one app build is asked for, read strictly (2026-10-20). Shared by the
// container's server and the Worker's route, and tested on its own.
//
// TWO MODES:
//  · "live" (the default): the app opens the customer's published address, so
//    everything the site does — its data, its forms, its orders — works as it
//    does in a browser, and an edit to the site reaches the app with no new
//    build. It needs a connection.
//  · "bundled": the site's own files go inside the app, so its pages open
//    offline. Calls a site makes back to its server do not work there.

export const APP_MODES = ["live", "bundled"];
/** Every file a bundled app carries, together. */
export const BUNDLE_MAX_BYTES = 60_000_000;
export const BUNDLE_MAX_FILES = 2000;

/** An Android application id from a site's slug: `dev.gofarther.<slug>`, letters and digits only in each part. */
export function appIdFor(slug) {
  const part = String(slug || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!part) return null;
  return "dev.gofarther." + (/^[a-z]/.test(part) ? part : "s" + part);
}

const SAFE_PATH = /^(?!.*\.\.)(?!\/)[A-Za-z0-9._\/-]{1,300}$/;

/** A build request, or `{ error }` naming what is wrong. */
export function readBuild(b) {
  if (!b || typeof b !== "object" || Array.isArray(b)) return { error: "not a build request" };
  const mode = b.mode === undefined ? "live" : b.mode;
  if (!APP_MODES.includes(mode)) return { error: "mode must be live or bundled" };
  if (typeof b.appId !== "string" || !/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$/.test(b.appId) || b.appId.length > 120) return { error: "bad app id" };
  if (typeof b.name !== "string" || !b.name.trim() || b.name.length > 60) return { error: "bad app name" };
  let url = "";
  try { url = new URL(String(b.url || "")).href; } catch { return { error: "bad site address" }; }
  if (!url.startsWith("https://")) return { error: "the site address must be https" };
  const out = { mode, appId: b.appId, name: b.name.trim(), url, files: [] };
  if (mode === "bundled") {
    if (!Array.isArray(b.files) || !b.files.length || b.files.length > BUNDLE_MAX_FILES) return { error: "a bundled app needs its files" };
    let bytes = 0;
    for (const f of b.files) {
      if (!f || typeof f.path !== "string" || !SAFE_PATH.test(f.path) || typeof f.data !== "string") return { error: "bad file" };
      bytes += Math.floor(f.data.length * 3 / 4);
      if (bytes > BUNDLE_MAX_BYTES) return { error: "the site's files are too large for an app" };
      out.files.push({ path: f.path, data: f.data });
    }
    if (!out.files.some((f) => f.path === "index.html")) return { error: "a bundled app needs index.html" };
  }
  return out;
}

/** The Capacitor config for one build: a live app opens the site's address. */
export function capacitorConfig(r) {
  const cfg = { appId: r.appId, appName: r.name, webDir: "www" };
  if (r.mode === "live") cfg.server = { url: r.url, cleartext: false };
  return cfg;
}

const xmlText = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "\\'").replace(/"/g, '\\"');
/**
 * THE APP'S OWN NAME AND ID, written into the Android project. `cap sync`
 * copies the config into the app's assets but leaves the native project as it
 * was made, so without this every app would install as the template
 * ("Go Farther app", `dev.gofarther.app`) — found by the first live build.
 * The code's own package (`namespace`) stays; the id stores and phones use is
 * `applicationId`.
 */
export function nativeNames(gradle, strings, r) {
  const g = String(gradle).replace(/applicationId\s+"[^"]*"/, 'applicationId "' + r.appId + '"');
  const x = String(strings)
    .replace(/(<string name="app_name">)[^<]*(<\/string>)/, "$1" + xmlText(r.name) + "$2")
    .replace(/(<string name="title_activity_main">)[^<]*(<\/string>)/, "$1" + xmlText(r.name) + "$2")
    .replace(/(<string name="package_name">)[^<]*(<\/string>)/, "$1" + r.appId + "$2")
    .replace(/(<string name="custom_url_scheme">)[^<]*(<\/string>)/, "$1" + r.appId + "$2");
  return { gradle: g, strings: x };
}
