// THE CANARY'S RESTORE MODE — put ONE saved version back on the live site, the
// way the app's Versions panel does, and prove from the site itself that it
// took.
//
// ── WHY IT EXISTS ─────────────────────────────────────────────────────────
//
// The places-left replay (2026-09-22) needs fretwork-1 back on the exact
// version run 17 started from, and the only door to that is
// `POST /api/site/<slug>/versions/restore` — owner-gated, so a session holding
// no Supabase token cannot press it, and the app's panel is a person clicking.
// The canary already signs in as the owner, so the restore rides on it: one
// dispatch restores, waits for the site to answer with the version, and then
// runs the ordinary free inventory so the SOURCE read is of the restored site.
//
// ── WHAT IT WILL NOT DO ───────────────────────────────────────────────────
//
// It posts NOTHING it has not first found in the site's own version list, and
// cannot-tell is a refusal: an unreadable list, an id the list does not carry
// and a version saved without its script all stop before the POST. A route
// that answers `ok` is not the proof either — the site's own `x-site-version`
// header is, because that is what the live script bakes and what a visitor is
// served. And it has no transport of its own: it is HANDED its three readers,
// so the one write it can make is the one the caller bound.
//
// Its own module, like `canary-read-job.mjs` and `canary-watch.mjs`, because
// `edit-canary.mjs` is a script with top-level await that spends money, so a
// test cannot import it to reach a decision.
import { isVersionId } from "../site-versions.mjs";

/**
 * The version id the caller asked for, or a refusal that names itself.
 *
 * THE SHAPE RULE IS THE PLATFORM'S OWN (`isVersionId`), never a second copy
 * here — a copy is the one that drifts. Nothing is repaired: an upper-cased or
 * padded id is not an id the platform mints, and a restore of "roughly that
 * one" is the approximate-timestamp mistake this mode exists to close.
 */
export function readRestoreId(raw) {
  if (typeof raw !== "string") return { ok: false, why: "shape", msg: "the version to restore is not text" };
  const id = raw.trim();
  if (!id) return { ok: false, why: "blank", msg: "no version was named to restore" };
  if (!isVersionId(id)) {
    return { ok: false, why: "shape", msg: `"${id.slice(0, 40)}" is not a version id — 14 digits, a dash, then up to 6 lower-case letters or digits` };
  }
  return { ok: true, id };
}

/** When a version was minted: its first 14 digits are milliseconds since 1970. */
export function mintedAt(id) {
  const ms = Number(String(id || "").slice(0, 14));
  return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : "";
}

/**
 * Restore `id` and wait for the live site to report it.
 *
 * `listVersions()` and `postRestore(id)` answer `{status, json}`; `readLive()`
 * answers the site's `x-site-version` header, or "" when it could not be read.
 * Answers a record, never throws on an answer it did not like, and `ok` is
 * true only when the site ITSELF reports the id.
 */
export async function restoreFlow({ id, listVersions, postRestore, readLive, sleep, polls = 40, gapMs = 3000 }) {
  const rec = {
    id, minted: mintedAt(id), ok: false, why: "",
    liveBefore: "", listStatus: 0, versions: [], row: null,
    posted: null, liveAfter: "", reads: 0,
  };
  // THE BEFORE READING IS EVIDENCE, NOT A GATE: an unreadable header must not
  // stop a restore the list and the route can still vouch for — the after
  // reading is what decides, and it has to match.
  rec.liveBefore = String((await readLive()) || "");
  const l = await listVersions();
  rec.listStatus = (l && l.status) || 0;
  const list = l && l.status === 200 && l.json && Array.isArray(l.json.versions) ? l.json.versions : null;
  if (!list) return { ...rec, why: "list-unreadable" };
  rec.versions = list.filter((v) => v && typeof v === "object").map((v) => ({
    id: String(v.id || ""), minted: mintedAt(v.id), label: String(v.label || ""),
    parent: String(v.parent || ""), job: v.job == null ? null : String(v.job),
    layout: String(v.layout || ""), restorable: v.restorable !== false,
  }));
  const at = rec.versions.findIndex((v) => v.id === id);
  if (at < 0) return { ...rec, why: "not-listed" };
  // ROW 1 IS "LIVE NOW" IN THE PANEL, so the row number printed is the one a
  // person holding the panel would count to.
  rec.row = { number: at + 1, ...rec.versions[at] };
  if (!rec.versions[at].restorable) return { ...rec, why: "not-restorable" };
  if (rec.liveBefore === id) return { ...rec, ok: true, why: "already-live", liveAfter: rec.liveBefore };

  const p = await postRestore(id);
  rec.posted = { status: (p && p.status) || 0, body: (p && p.json) || null };
  const b = rec.posted.body;
  if (rec.posted.status !== 200 || !b || b.ok !== true) return { ...rec, why: "refused" };
  if (b.id !== id) return { ...rec, why: "wrong-id" };
  // THE ROUTE PUTS THE FILES BACK BEFORE THE SCRIPT and answers ok either way,
  // saying `worker: false` when the script did not go up — so the page may
  // still be the old one. Its own reason, never folded into "unmoved".
  if (b.worker === false) return { ...rec, why: "script" };

  for (let i = 0; i < polls; i++) {
    const v = String((await readLive()) || "");
    rec.reads = i + 1;
    rec.liveAfter = v;
    if (v === id) return { ...rec, ok: true, why: "restored" };
    if (i + 1 < polls) await sleep(gapMs);
  }
  return { ...rec, why: "live-unmoved" };
}

const WHY = {
  "restored": (r) => `the site now reports ${r.id} itself (read ${r.reads} time${r.reads === 1 ? "" : "s"} after the restore)`,
  "already-live": (r) => `the site already reported ${r.id}, so nothing was posted`,
  "list-unreadable": (r) => `the site's version list could not be read (${r.listStatus}), so nothing was posted — cannot-tell is not a go-ahead`,
  "not-listed": (r) => `${r.id} is not in the site's version list, so nothing was posted`,
  "not-restorable": (r) => `${r.id} was saved without its script, so the platform cannot put it back; nothing was posted`,
  "refused": (r) => `the restore route refused it (${r.posted ? r.posted.status : 0}${r.posted && r.posted.body && r.posted.body.error ? ": " + r.posted.body.error : ""})`,
  "wrong-id": (r) => `the route answered for ${r.posted && r.posted.body ? r.posted.body.id : "?"}, not ${r.id}, so this run does not treat it as done`,
  "script": () => "the route put the files back but could not put the site's script up, so the page may still be the old one",
  "live-unmoved": (r) => `the route answered ok, but the site still reports ${r.liveAfter || "(unreadable)"} after ${r.reads} reads`,
};

/** The account a person reads in the log and in `restore.txt`. */
export function describeRestore(rec, slug) {
  const lines = [`RESTORE — put version ${rec.id} back on ${slug || "the site"}`, ""];
  lines.push(`  minted        ${rec.minted || "(not a version id)"}`);
  lines.push(`  live before   ${rec.liveBefore || "(unreadable)"}`);
  if (rec.versions.length) {
    lines.push(`  versions      ${rec.versions.length} listed, newest first (row 1 is "Live now")`);
    rec.versions.forEach((v, i) => {
      lines.push(`    ${String(i + 1).padStart(2)}  ${v.id}  ${v.minted}  parent ${v.parent || "-"}${v.restorable ? "" : "  NOT RESTORABLE"}  ${JSON.stringify(v.label.slice(0, 60))}`);
    });
    if (rec.row) lines.push(`  asked for     row ${rec.row.number}`);
  } else {
    lines.push(`  versions      unread (${rec.listStatus})`);
  }
  if (rec.posted) lines.push(`  POST          ${rec.posted.status} ${JSON.stringify(rec.posted.body).slice(0, 200)}`);
  if (rec.reads) lines.push(`  live after    ${rec.liveAfter || "(unreadable)"}  (${rec.reads} read${rec.reads === 1 ? "" : "s"})`);
  const say = WHY[rec.why];
  lines.push("", `${rec.ok ? "RESTORED" : "NOT RESTORED"} — ${say ? say(rec) : "unrecognised outcome " + JSON.stringify(rec.why)}`);
  return lines.join("\n");
}
