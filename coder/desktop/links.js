// WHICH LINKS STAY IN THE APP (owner, 2026-11-06: "start making the desktop
// apps"). The app is gofarther.dev in its own window; anything else opens in
// the computer's browser, except the GitHub pages of "Connect GitHub" (they
// must come back to the app, which holds the sign-in).
"use strict";

const HOME = "https://gofarther.dev/";
const APP_HOSTS = new Set(["gofarther.dev", "www.gofarther.dev"]);
// GitHub's sign-in, two-step check, and app-install pages (Connect GitHub).
const GITHUB_INSIDE = [/^\/login(\/|$|\?)/, /^\/session(s)?(\/|$|\?)/, /^\/apps\/[\w.-]+\/installations(\/|$|\?)/, /^\/settings\/installations(\/|$|\?)/, /^\/sessions\/two-factor/];

/** Does this address open inside the app's window? */
function isInsideApp(raw) {
  let u;
  try { u = new URL(String(raw)); } catch { return false; }
  if (u.protocol !== "https:" || u.username || u.password || u.port) return false;
  if (APP_HOSTS.has(u.hostname)) return true;
  if (u.hostname === "github.com") return GITHUB_INSIDE.some((re) => re.test(u.pathname));
  return false;
}

/** May this address be handed to the computer's browser? (web pages and email only) */
function isSafeOutside(raw) {
  try { const u = new URL(String(raw)); return u.protocol === "https:" || u.protocol === "http:" || u.protocol === "mailto:"; } catch { return false; }
}

module.exports = { HOME, isInsideApp, isSafeOutside };
