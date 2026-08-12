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
  // A STRING, not anything stringifiable. `String(["display"])` is `"display"`,
  // so an array reached the allow-list and passed it — a table declared
  // `access: ["display"]` became world-readable. Same coercion bug this codebase
  // already recorded for `normalizeRole` (`String(7)` is `"7"`), on the field
  // that decides who may read a business's customer data.
  if (typeof access !== "string") return "collect";
  const a = access.toLowerCase();
  return ACCESS_LEVELS.includes(a) ? a : "collect";
}

// ------------------------------------------------- read and write, separately

/**
 * THE FIVE LEVELS ARE FIVE POINTS IN A GRID, and the grid is what a site needs.
 *
 * Every table answers two independent questions — who may READ it, who may
 * WRITE it — and the five names fuse them into one word. `display` does not mean
 * "public read"; it means "public read AND no visitor writes". `collect` does
 * not mean "anyone writes"; it means "anyone writes AND nobody reads". They are
 * bundles, not axes, so any combination nobody pre-bundled is not merely missing
 * — it is inexpressible.
 *
 * Measured 2026-08-10: the five cover 5 of the 16 cells, and the empty ones are
 * ordinary. "Anyone reads, members write their own" is a listings site, a job
 * board, public reviews, a directory, a community wall — and a marketplace,
 * which is where this was found: the designer put a member-posted `events` table
 * at `user`, correctly following its own instructions, and produced a site whose
 * every listing was invisible to the visitors it existed for.
 *
 * The names stay, as PRESETS. Every stored schema on every published site is
 * written in them, they read well, and `display` is the right thing to say when
 * that is what you mean. What changes is that they are now defined in terms of
 * the two axes rather than being the only vocabulary there is.
 */
export const READ_LEVELS = ["none", "own", "members", "public"];
export const WRITE_LEVELS = ["none", "own", "members", "anyone"];

export const ACCESS_PRESETS = {
  display: { read: "public", write: "none" },
  collect: { read: "none", write: "anyone" },
  user: { read: "own", write: "own" },
  feed: { read: "members", write: "own" },
  admin: { read: "members", write: "none" },
};

const normalizeRead = (v, fallback) =>
  (typeof v === "string" && READ_LEVELS.includes(v.toLowerCase())) ? v.toLowerCase() : fallback;
const normalizeWrite = (v, fallback) =>
  (typeof v === "string" && WRITE_LEVELS.includes(v.toLowerCase())) ? v.toLowerCase() : fallback;

/**
 * A table's `{read, write}` pair, however it was declared.
 *
 * `read`/`write` win when given; anything missing or unrecognised falls back to
 * the preset named by `access`, and that in turn falls back to `collect` — which
 * is the safe direction, because `collect` reads nothing.
 *
 * ONE COMBINATION IS REFUSED, and it is refused rather than emitted because it
 * cannot mean anything: `read: "own"` with `write: "anyone"`. "Own" needs an
 * identity to be own OF, and an anonymous insert has none — the row would be
 * owned by nobody and readable by nobody, which is `read: "none"` wearing a
 * misleading name. It resolves to exactly that. (The thing somebody asking for
 * it actually wants is a booking the customer can come back to, which is what
 * the claim token does — a signed link to one row, not an access level.)
 */
export function resolveAccess(t) {
  const def = t && typeof t === "object" ? t : {};
  // The `||` cannot fire today and is kept deliberately: `normalizeAccess`
  // always returns one of `ACCESS_LEVELS`, and every one of those has a preset —
  // an agreement between two constants that a sixth level added to one and not
  // the other would break. It fails toward `collect`, which reads nothing.
  // Asserted as that agreement in the tests, since a mutation here is inert.
  const preset = ACCESS_PRESETS[normalizeAccess(def.access)] || ACCESS_PRESETS.collect;
  const read = normalizeRead(def.read, preset.read);
  const write = normalizeWrite(def.write, preset.write);
  if (read === "own" && write === "anyone") return { read: "none", write: "anyone" };
  return { read, write };
}

/** The preset name for a pair, when there is one — for wording, never for logic. */
export function accessNameFor(pair) {
  const p = pair || {};
  for (const [name, v] of Object.entries(ACCESS_PRESETS)) {
    if (v.read === p.read && v.write === p.write) return name;
  }
  return null;
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
/**
 * THESE PREDICATES ANSWER ON THE PAIR, NOT ON THE PRESET NAME.
 *
 * Every one of them took an access STRING and ran it through `normalizeAccess`,
 * which collapses anything it does not recognise to "collect". A table declared
 * with `read`/`write` has no `access`, so all five answered as though it were
 * write-only — and `lintPages` refused a perfectly correct marketplace page with
 * `lists "listings", which is access "undefined" — reading it returns 403`, on
 * the exact cell the pair axes were added for, in a message printing the literal
 * word "undefined" to the customer.
 *
 * POLYMORPHIC ON PURPOSE: a string still works, so every existing caller is
 * unchanged, and passing the TABLE is what makes a pair answerable. The five
 * presets resolve to the pairs they have always meant, which is asserted rather
 * than assumed — the same safety argument the pair axes shipped with.
 */
const pairOf = (x) => resolveAccess(typeof x === "string" ? { access: x } : (x || {}));

export function needsMember(access) {
  const { read, write } = pairOf(access);
  return read === "own" || read === "members" || write === "own" || write === "members";
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
  return pairOf(access).read === "public";
}

/**
 * Can an ANONYMOUS visitor WRITE to this table?
 *
 * Only `collect` — a booking form has to work for someone with no account.
 * Everything else needs an identity to own or authorise the row.
 */
export function canWriteAccess(access) {
  return pairOf(access).write === "anyone";
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
  const w = pairOf(access).write;
  return w === "own" || w === "members";
}

/** Why a read is refused, in words a generated page's author can act on. */
export function whyNotReadable(access) {
  const { read } = pairOf(access);
  if (read === "none") return "those rows are other visitors' submissions and are never served back";
  if (needsMember(access)) return "those rows need a signed-in member — call useMember() and offer a sign-in";
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

/**
 * HOW TO NAME THIS TABLE'S ACCESS TO A HUMAN.
 *
 * The lint's messages printed `t.access` directly, which is `undefined` on a
 * pair-declared table — so a customer was told their page "is access
 * \"undefined\"". A preset keeps its familiar name; a pair says what it is.
 */
export function accessLabel(t) {
  if (typeof t === "string") return normalizeAccess(t);
  // NAMED BY WHAT IT RESOLVES TO, never by the `access` field as written — and
  // reading that field first was still wrong after this function was added to
  // fix exactly this class. `normalizeSchema` STAMPS `access: "collect"` on any
  // table that did not declare a recognised preset, so a pair-declared display
  // table reaches every downstream reader carrying a level nobody wrote, and
  // trusting it printed "collect" for a table that is public-read. Resolving
  // first cannot do that: a preset keeps its familiar name, a pair-declared
  // table that happens to BE a preset gets that preset's name (it is the same
  // thing spelled differently), and a cell with no shorthand says what it is.
  const pair = resolveAccess(t);
  return accessNameFor(pair) || ("read " + pair.read + " / write " + pair.write);
}

/**
 * Does READING this table need a signed-in member?
 *
 * NOT the same question as `needsMember`, and conflating them is wrong in both
 * directions on a pair. The marketplace cell — read "public", write "own" —
 * involves members (they write their own listings) while its READ is open to
 * anyone, so asking the broad question made the lint demand `useMember()` before
 * a page could list rows the whole public can see. The five presets never
 * separated the two because in all five the read and the write agree about
 * needing an identity; a pair is exactly where they stop agreeing.
 */
export function readNeedsMember(t) {
  const r = pairOf(t).read;
  return r === "own" || r === "members";
}

/**
 * A publicly-writable table that reserves a moment in time, with nothing
 * stopping two people reserving the same one.
 *
 * WHY THIS EXISTS. On 2026-07-28 the engine's four booking constraints were
 * fully implemented, tested, and undeclarable — so two customers booked the
 * same 14:00 on a real generated barber shop and both were accepted. Making
 * them declarable fixed availability, not USE: nothing checks that a table
 * shaped like a booking came back carrying one. That is the same failure as
 * `seed`, which is a required field the designer skipped on two consecutive
 * builds this week. This makes the omission SAY something instead of showing
 * up as a double booking weeks later.
 *
 * DELIBERATELY NARROW, because a check that cries wolf is worse than no check —
 * this repo has recorded that a rule wrong on a third of its hits teaches the
 * model away from something correct. Three conditions must all hold:
 *
 *   1. the public can write to it — a `write: "none"` table is the owner's own
 *      and cannot be double-booked by a stranger, and it is also the shape the
 *      capacity pattern uses (writes go through a function instead), so firing
 *      there would punish the better answer.
 *   2. it names BOTH a day-ish and a time-ish column, or one slot-ish column.
 *      A contact form with a `preferred_date` and nothing else is not a booking.
 *   3. no `noOverlap`, and no `unique` that actually COVERS one of those
 *      columns. A `unique` on `email` is a real constraint about something
 *      else, and reading it as protection is how this check would pass while
 *      the slot stays open.
 *
 * Returns the table names, never a sentence — the caller decides how to say it.
 */
const DAYISH = /^(.*_)?(date|day|on|when)(_.*)?$/;
const TIMEISH = /^(.*_)?(time|hour|starts?|start_at|from)(_.*)?$/;
const SLOTISH = /^(.*_)?(slot|appointment|booking_at|starts_at|scheduled_at)(_.*)?$/;

export function unguardedBookings(spec) {
  const tables = (spec && Array.isArray(spec.tables)) ? spec.tables : [];
  const out = [];
  for (const t of tables) {
    if (!t || !t.name) continue;
    if (resolveAccess(t).write === "none") continue;

    const cols = (Array.isArray(t.columns) ? t.columns : [])
      .map((c) => String((c && c.name) || c || "").toLowerCase())
      .filter(Boolean);
    const timeCols = cols.filter((c) => DAYISH.test(c) || TIMEISH.test(c) || SLOTISH.test(c));
    const shaped = cols.some((c) => SLOTISH.test(c)) ||
      (cols.some((c) => DAYISH.test(c)) && cols.some((c) => TIMEISH.test(c)));
    if (!shaped) continue;

    if (t.noOverlap) continue;
    // The unique must COVER a time column. Anything else is a constraint about
    // a different question and leaves the slot exactly as open as before.
    const guarded = (Array.isArray(t.unique) ? t.unique : []).some((u) =>
      (Array.isArray(u && u.columns) ? u.columns : [])
        .some((c) => timeCols.includes(String(c).toLowerCase())));
    if (!guarded) out.push(t.name);
  }
  return out;
}
