// What the data API permits, in one place.
//
// These rules are enforced in site-data.mjs and PREDICTED in builder/page-gen.mjs
// — the generator has to know what the API will refuse in order to lint a page
// before anyone loads it. They were written out separately in both files and had
// already drifted: the lint claimed a read of a `feed` or `admin` table returns
// 403, which the API does not do. A lint that reports a defect the API would not
// produce is worse than one that misses it, because every problem it reports
// costs a paid repair pass to "fix" something that was never broken.
//
// Deliberately dependency-free. page-gen.mjs is imported by a test that runs
// without the Worker's node_modules, so it cannot reach site-data.mjs (which
// pulls in the Postgres driver) — a shared leaf module is what lets both sides
// read the same rule instead of restating it.

/** Set by the engine, not the app. Never writable through the API, at any level. */
export const MANAGED_COLUMNS = [
  "id", "created_at", "updated_at", "owner_id", "team_id", "deleted_at",
  "_version", "_fts", "position", "archived_at", "expires_at", "pinned",
  "publish_at",
];

const MANAGED = new Set(MANAGED_COLUMNS);

export function isManagedColumn(name) {
  return MANAGED.has(String(name || "").toLowerCase());
}

/** Every access level the schema engine understands. See site-schema.mjs. */
export const ACCESS_LEVELS = ["collect", "display", "user", "feed", "admin"];

export function normalizeAccess(access) {
  const a = String(access || "").toLowerCase();
  return ACCESS_LEVELS.includes(a) ? a : "collect";
}

/**
 * Does this level need a signed-in MEMBER before anything is served?
 *
 * `user` is private per member, `feed` is shared but member-authored, and
 * `admin` is a shared CMS whose writes are role-gated. All three answer 401 to
 * a visitor with no session — see site-auth.mjs and handleSiteData.
 *
 * This changed on 2026-07-28: before visitor accounts existed, `feed` and
 * `admin` served public reads and refused every write, so only half of each was
 * usable and the generator was told to avoid them.
 */
export function needsMember(access) {
  return ["user", "feed", "admin"].includes(normalizeAccess(access));
}

/**
 * Can an ANONYMOUS visitor READ this table?
 *
 * Only `display`. `collect` is write-only so one visitor can never read back
 * another's submission, and the member levels answer 401 until someone signs in.
 */
export function canReadAccess(access) {
  return normalizeAccess(access) === "display";
}

/**
 * Can an ANONYMOUS visitor WRITE to this table?
 *
 * Only `collect` — a booking form has to work for someone with no account.
 * Everything else needs an identity to own or authorise the row.
 */
export function canWriteAccess(access) {
  return normalizeAccess(access) === "collect";
}

/** Why a read is refused, in words a generated page's author can act on. */
export function whyNotReadable(access) {
  const a = normalizeAccess(access);
  if (a === "collect") return "those rows are other visitors' submissions and are never served back";
  if (needsMember(a)) return "those rows need a signed-in member — call useMember() and offer a sign-in";
  return "the API refuses public reads of it";
}
