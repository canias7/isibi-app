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

// ------------------------------------------------------------- roles

/**
 * A member's role, as the API will store and compare it.
 *
 * Everyone is `user` until somebody says otherwise, and that "somebody" is only
 * the site owner. Until 2026-07-28 there was no somebody at all: `_users.role`
 * was created, `admin` tables checked it and per-table `writeRoles` compared
 * against it, and **no route in the codebase could ever set it**. Every member
 * on every site was `user` forever, which made an `admin` table writable by
 * nobody and `writeRoles` a rule about a value that could not exist.
 */
export const DEFAULT_ROLE = "user";
export function normalizeRole(role) {
  // A string, not "anything stringifiable" — the same rule `checkPassword`
  // learned. `String(7)` is "7", which passes the shape test below and would
  // make a number a role; `String({})` is "[object Object]", which does not, but
  // relying on that is relying on a coincidence.
  if (typeof role !== "string") return null;
  const r = role.trim().toLowerCase();
  // The same shape the schema parser allows in `writeRoles`, so a role an owner
  // can assign is exactly a role a table can name. Anything else is not a role.
  return /^[a-z0-9_]{1,24}$/.test(r) ? r : null;
}

/**
 * Which roles mean anything on THIS site.
 *
 * `user` and `admin` always, plus whatever the site's own tables named in their
 * `writeRoles`. Bounded by the schema on purpose: an owner inventing a role no
 * table mentions has granted a permission that can never be checked, which reads
 * as "I gave them access" and does nothing at all.
 */
export function rolesForSchema(spec) {
  const out = new Set([DEFAULT_ROLE, "admin"]);
  for (const t of (spec && Array.isArray(spec.tables) ? spec.tables : [])) {
    for (const r of (t && Array.isArray(t.writeRoles) ? t.writeRoles : [])) {
      const n = normalizeRole(r);
      if (n) out.add(n);
    }
  }
  return [...out].sort();
}

/**
 * Must a member have confirmed their address before writing here?
 *
 * `requireVerified` has been parsed and stored in `_meta` since the schema
 * engine was written, enforced by nothing. Wiring it was deliberately left until
 * verification existed, because a gate nobody can pass is not a gate — it is a
 * wall, and a table declaring it would have locked every member out permanently.
 *
 * `canVerify` is why this takes two arguments. It is false on a site with no
 * mailer, where confirming an address is impossible, and there the rule FAILS
 * OPEN. That looks wrong for a security control and is not: without a mailer the
 * guarantee is unobtainable either way, so enforcing buys nothing and costs the
 * site every write. It starts working the day the mailer key ships.
 */
export function needsVerified(def, canVerify) {
  return !!(def && def.requireVerified) && !!canVerify;
}

/**
 * Does this table let a manager see their reports' rows?
 *
 * `user` means private-per-member and `feed` means everyone-sees-everything,
 * with nothing in between — which is the read model an internal tool actually
 * needs ("my team's records"). `teamRead` is that middle, and it was parsed,
 * validated and stored in `_meta` since the schema engine was written with
 * nothing ever reading it. Only meaningful on `user`: `feed` is already shared,
 * and `collect`/`display` have no owner to have a manager.
 */
export function teamReadable(def) {
  return !!(def && def.teamRead) && normalizeAccess(def.access) === "user";
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
 * Does this table publish a projection ANYONE may read?
 *
 * The one read that does not follow from the access level. A `collect` table is
 * write-only and a `user` table is private, but either may declare a
 * `publicView` — a named allow-list of columns — and that projection is served
 * to a stranger. It is what lets a booking form grey out a taken slot without
 * publishing who took it.
 *
 * Lives here, next to the other access questions, because TWO places ask it and
 * they must not disagree: the data path answers 404 when it is absent, and the
 * generator's lint refuses a page that would then have hit that 404. A second
 * copy of this rule in the linter is a copy that drifts, and the drift shows up
 * as a published site whose form is dead.
 */
export function hasPublicView(def) {
  const pv = def && def.publicView;
  return !!(pv && Array.isArray(pv.columns) && pv.columns.length);
}

/**
 * The database object a `publicView` is actually served from.
 *
 * A projection cannot be the table: the table is `collect` or `user`, and RLS
 * gives a stranger no SELECT policy on it at all. So the projection is a real
 * Postgres VIEW beside it, and this is its name.
 *
 * ONE DEFINITION, for the same reason `hasPublicView` is one: three things have
 * to agree on it or the feature is dead in a way nothing catches. The schema
 * engine CREATEs it, the client FETCHes it, and a disagreement is a 403 on a
 * published site — which is exactly what happened while nothing created it at
 * all (measured live 2026-08-04, the home page of a generated barber shop).
 *
 * `@/lib/rows` keeps its own copy of the suffix because it is a separate bundle
 * and cannot import this. A test reads both files and fails if they differ.
 */
export function publicViewName(table) {
  return String(table) + "_public";
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

/**
 * Can a SIGNED-IN MEMBER write to this table?
 *
 * `user` and `feed` — and deliberately NOT `admin`, which is the whole reason
 * this predicate exists rather than reusing `needsMember`.
 *
 * ADMIN IS READ-ONLY AT THE DATABASE and was described everywhere as writable.
 * `grantsFor` gives it `GRANT SELECT` and nothing else, and `policiesFor` writes
 * it a read policy and no other — so no INSERT, UPDATE or DELETE can succeed on
 * it from a published page, by anyone, whatever role they hold. The
 * "SHARED, ROLE-WRITABLE … a write by anyone else returns 403 with code 'role'"
 * wording describes the hand-built data API deleted on 2026-07-30, which checked
 * `writeRoles` in the Worker. PostgREST has never heard of `writeRoles`.
 *
 * The lint used `needsMember` here, which is true for admin — so an admin form
 * passed the lint, compiled, published and then refused its own administrator.
 * Exactly the booking-form failure: advertised at the prompt layer, refused at
 * the data layer.
 *
 * The owner still edits these tables — through their OWN door in Go Farther
 * (`site-owner.mjs`), which authenticates with an Go Farther session and is not
 * subject to the site's RLS. `admin` therefore means "staff can SEE it, the
 * owner maintains it", which is a coherent level and is now what it says.
 */
export function canMemberWrite(access) {
  const a = normalizeAccess(access);
  return a === "user" || a === "feed";
}

/** Why a read is refused, in words a generated page's author can act on. */
export function whyNotReadable(access) {
  const a = normalizeAccess(access);
  if (a === "collect") return "those rows are other visitors' submissions and are never served back";
  if (needsMember(a)) return "those rows need a signed-in member — call useMember() and offer a sign-in";
  return "the API refuses public reads of it";
}

/**
 * A column that holds a picture — a plain TEXT column whose value is a URL like
 * `/u/<slug>/<hash>.jpg`.
 *
 * It is only a naming guess, and that is deliberate: the column is text either
 * way, so a wrong guess costs an upload button that is not offered, never a
 * broken save. It lives here rather than in any one caller because three places
 * ask the same question — the builder's edit form, the page generator, and the
 * route that decides whether a form may accept a visitor's file at all — and
 * that last one is a security decision.
 */
export function isImageColumn(name) {
  return /(^|_)(image|images|img|photo|photos|picture|pic|avatar|logo|cover|thumbnail|thumb|banner|hero)(_|$)|_url$/i
    .test(String(name || ""));
}
