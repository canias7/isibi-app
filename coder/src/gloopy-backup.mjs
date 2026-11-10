// GLOOPY'S COMPUTER, KEPT WHEN IT IS REPLACED (the audit, owner 2026-11-10: "do all of that"; Grok Bot's and dots'
// computers keep their files and stay signed in). Gloopy's computer keeps its work folder and its browser's sign-ins on
// its own disk, but a computer not used for 30 days is removed with its disk, and the backup machine has no kept disk.
// So at the end of each job its service sends a copy here, with that job's own pass: its work folder (packed, at most
// WORK_MAX, without caches and installed packages) and its browser's sign-ins (cookies and each site's local storage,
// sealed as the owner's saved logins are). On a new disk, the service asks for them back before Gloopy starts.
//
// Kept per person: coder/<uid>/gloopy/backup-work.tgz, coder/<uid>/gloopy/backup-browser.json ({ box }).
import { seal, unseal } from "./coder-github.mjs";
import { cookieForSite, originForSite } from "../container/gloopy-check.mjs";

/** The most a packed work folder, and a copy of the sign-ins, may be. */
export const WORK_MAX = 25 * 1024 * 1024, BROWSER_MAX = 4 * 1024 * 1024;
const workKey = (uid) => ["coder", uid, "gloopy", "backup-work.tgz"].join("/");
const browserKey = (uid) => ["coder", uid, "gloopy", "backup-browser.json"].join("/");

/** A copy kept: `part` "work" (the packed folder's bytes) or "browser" (the sign-ins, sealed). Answers { ok } or { error }. */
export async function keepBackup(env, bucket, uid, part, bytes) {
  if (part === "work") {
    if (!bytes || !bytes.byteLength) return { error: "nothing to keep" };
    if (bytes.byteLength > WORK_MAX) return { error: "the work folder is over " + WORK_MAX / 1048576 + " MB packed" };
    await bucket.put(workKey(uid), bytes, { httpMetadata: { contentType: "application/gzip" } });
    return { ok: true, size: bytes.byteLength };
  }
  if (part === "browser") {
    if (!bytes || bytes.byteLength > BROWSER_MAX) return { error: "the sign-ins are over " + BROWSER_MAX / 1048576 + " MB" };
    let st;
    try { st = JSON.parse(new TextDecoder().decode(bytes)); } catch { return { error: "not a copy of the sign-ins" }; }
    if (!st || !Array.isArray(st.cookies) || !Array.isArray(st.origins)) return { error: "not a copy of the sign-ins" };
    await bucket.put(browserKey(uid), JSON.stringify({ at: Date.now(), box: await seal(env, { cookies: st.cookies, origins: st.origins }) }), { httpMetadata: { contentType: "application/json" } });
    return { ok: true, cookies: st.cookies.length };
  }
  return { error: "no such part" };
}

/** A copy back: "work" (the bytes, or null) or "browser" (the sign-ins, or null). */
export async function readBackup(env, bucket, uid, part) {
  // The packed folder as kept (streamed out when it can be: up to WORK_MAX).
  if (part === "work") { const o = await bucket.get(workKey(uid)); return o ? (o.body !== undefined ? o.body : new Uint8Array(await o.arrayBuffer())) : null; }
  if (part === "browser") {
    const o = await bucket.get(browserKey(uid));
    if (!o) return null;
    try { const j = JSON.parse(await o.text()); return await unseal(env, j.box); } catch { return null; }
  }
  return null;
}

/**
 * THE OWNER SIGNED GLOOPY OUT OF A SITE: that site's cookies and its pages' storage leave the kept copy too, so a new
 * computer never signs Gloopy back in. Answers how many cookies went.
 */
export async function forgetSite(env, bucket, uid, site) {
  const st = await readBackup(env, bucket, uid, "browser");
  if (!st) return 0;
  const cookies = (st.cookies || []).filter((c) => !cookieForSite(c && c.domain, site));
  const origins = (st.origins || []).filter((o) => !originForSite(o && o.origin, site));
  const gone = (st.cookies || []).length - cookies.length;
  await bucket.put(browserKey(uid), JSON.stringify({ at: Date.now(), box: await seal(env, { cookies, origins }) }), { httpMetadata: { contentType: "application/json" } });
  return gone;
}
