// Row-level security for a site's tables.
//
// Access control has lived in the Worker since the schema engine was written:
// `site-data.mjs` decides whether a caller may read a table and appends
// `owner_id=?` to their query. That works and is tested — and it only works for
// callers that come THROUGH the Worker. Postgres itself will hand any connected
// role every row.
//
// This puts the same rules in the database. The immediate reason is Neon's Data
// API: it serves tables directly over REST as the `anon` and `authenticated`
// roles, so without policies it is either everything or nothing. The better
// reason is that a rule the database enforces cannot be forgotten by a new route.
//
// **These policies are the destination, not a second opinion.** The direction is
// Neon-only (owner's call, 2026-07-30): the Worker's `/api/db` data routes go, and
// the published site talks to Neon's Data API directly, so what is written here
// becomes the ONLY thing standing between a stranger and a booking list.
//
// They land BEFORE that happens, and that ordering is the whole safety property.
// Applying them changes nothing for anyone today — a table's owner bypasses its
// policies and the Worker connects as the owner — so they can be written, reviewed
// and asserted while the tested Worker path is still carrying the traffic. The
// alternative was to delete and replace in one step, where a policy that permits
// one clause too much is discovered by a customer.
//
// Why enabling RLS is safe for everything that exists today: a table's OWNER
// bypasses its policies unless `FORCE ROW LEVEL SECURITY` is set, and the Worker
// connects as the owner. So turning this on changes nothing about the current
// data path — it only decides what a DIFFERENT role would be allowed to see, and
// no such role has been granted anything yet.
//
// Pure string building. Every statement this produces is asserted in
// test/site-rls.test.mjs and applied against a real Postgres in the e2e.

import { hasPublicView, publicViewName, resolveAccess } from "./site-access.mjs";

/**
 * Who the caller is, according to the database.
 *
 * **`pg_session_jwt` is NEON'S OWN extension for exactly this**, and it is on the
 * available list (0.5.0, measured 2026-07-30 by asking
 * `pg_available_extensions` rather than guessing names). It verifies the session
 * JWT inside Postgres and exposes `auth.user_id()`. The first version of this file
 * hand-rolled the same thing out of `current_setting('request.jwt.claims')` —
 * PostgREST's convention, and a guess I flagged as one.
 *
 * Both forms are emitted, chosen by whether the extension actually installed,
 * because the fallback is not dead weight: a project where the extension is
 * unavailable would otherwise get a function that fails to parse, and every policy
 * built on it would fail with it.
 *
 * `true` as the second argument to `current_setting` is missing_ok — without it the
 * fallback RAISES whenever the setting is unset, which is every connection the
 * Worker makes, turning each policy into an error rather than a refusal.
 *
 * Returns UUID either way, because `neon_auth."user".id` is a uuid and so is
 * `owner_id`.
 */
export const SESSION_JWT_EXT = "CREATE EXTENSION IF NOT EXISTS pg_session_jwt;";

// SECURITY DEFINER, and that is what actually makes the native form usable.
// `auth.user_id()` lives in the schema `pg_session_jwt` creates, and the Data
// API's roles cannot reach it — measured 2026-08-05, and the obvious fix (grant
// them USAGE) did not take: the grant raised no error and the privilege stayed
// false, so the schema is not ours to open. Running as the definer sidesteps the
// question entirely.
//
// It is safe BECAUSE OF WHAT IT READS: `auth.user_id()` decodes the session's
// verified JWT, which is connection state, not role state — a database role has
// no JWT, so this cannot hand back the owner's identity. If the claim is
// unreadable it returns NULL, which is the safe direction (nobody sees
// anything). The live assertion that would catch the unsafe direction already
// exists: `member smoke` proves one member cannot read another's rows.
//
// `search_path` is pinned and the call is qualified, or a role able to create a
// schema ahead of it chooses what the definer runs.
//
// The FALLBACK is deliberately left as SECURITY INVOKER: it reads a GUC anyone
// may read, so definer rights would be privilege bought for nothing.
export const APP_USER_FN_NATIVE = `
CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT NULLIF(auth.user_id(), '')::uuid
$$;`;

export const APP_USER_FN_FALLBACK = `
CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::uuid
$$;`;

/** Kept as the default export name so callers do not have to know which won. */
export const APP_USER_FN = APP_USER_FN_FALLBACK;

/**
 * THE NATIVE FORM IS UNREACHABLE FROM THE ROLES THAT ACTUALLY CALL IT.
 *
 * `app_user_id()` is SECURITY INVOKER, so it runs as whoever asked — and Neon's
 * Data API runs a request as `authenticated` or `anonymous`, neither of which
 * has USAGE on the `auth` schema the extension creates. Measured live
 * 2026-08-05: every member read and write on a `user`, `feed` or `admin` table
 * answered `42501 permission denied for schema auth`. Not a policy refusing a
 * row — the policy could not be EVALUATED, so the site had no member tier at
 * all.
 *
 * It was invisible from the other side of the same file: `display` reads
 * (`USING (true)`) and `collect` writes (`WITH CHECK (true)`) never call the
 * function, so exactly the levels with no live coverage were the broken ones.
 *
 * What this exposes is `auth.user_id()`, `auth.session()` and `auth.jwt()` —
 * every one of which returns the CALLER'S OWN claims, i.e. what they already
 * presented. ONE STATEMENT PER ROLE, the same discipline as the table grants:
 * `TO anonymous, authenticated` is a single statement, so a role name that ever
 * stops existing takes the other role down with it.
 *
 * Emitted only on the native path — the fallback reads a GUC and needs nothing.
 *
 * **IT IS NOT WHAT FIXED IT, and the reason is worth keeping.** Measured
 * 2026-08-05 against a real project: both statements raised NO error and
 * `has_schema_privilege` still answered false for both roles, so `auth` is
 * Neon's to open and not ours. `app_user_id()` is SECURITY DEFINER for that
 * reason. These stay because they cost one statement, they are the documented
 * mechanism, and a deployment where the schema IS ours needs nothing else — but
 * nothing depends on them, and the engine now REPORTS whether they took rather
 * than assuming.
 */
export const SESSION_JWT_GRANTS = [
  "GRANT USAGE ON SCHEMA auth TO anonymous;",
  "GRANT USAGE ON SCHEMA auth TO authenticated;",
];

/**
 * Which team the caller is in.
 *
 * SECURITY DEFINER rather than a grant, and the asymmetry with the schema above
 * is the point: `auth.user_id()` hands back what the caller already presented,
 * while `neon_auth.member` is every member of every organization on the site.
 * Granting SELECT on it to satisfy one policy clause would let any signed-in
 * member read the whole membership table.
 *
 * It takes NO ARGUMENTS and derives from `app_user_id()`, so it can only ever
 * answer for the caller — there is no id to pass and therefore nobody else's
 * team to ask about.
 *
 * `search_path` is pinned and every name is schema-qualified, because a
 * SECURITY DEFINER function that resolves names through the caller's
 * `search_path` is the classic escalation: a role able to create a schema ahead
 * of it chooses what the definer runs.
 */
export const APP_TEAM_FN = `
CREATE OR REPLACE FUNCTION app_team_id() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog AS $$
  SELECT m."organizationId"::text FROM neon_auth.member m
  WHERE m."userId" = public.app_user_id()
  ORDER BY m."createdAt" ASC NULLS LAST LIMIT 1
$$;`;

/** Every policy this module creates is named with this prefix, so they can be replaced idempotently. */
export const POLICY_PREFIX = "isibi_";

const q = (name) => '"' + String(name).replace(/"/g, '""') + '"';

/**
 * The policies for one table.
 *
 * Returns a list of statements. Ordering matters only in that the DROPs come
 * first: `CREATE POLICY` has no `IF NOT EXISTS`, and a revise re-runs all of this,
 * so each policy is dropped and recreated rather than left to fail. Dropping is
 * `IF EXISTS`, which makes the first run and every later one identical.
 *
 * The access levels are the same five the Worker enforces, and each maps to a
 * different SHAPE of policy rather than a different filter:
 *
 *   display — anyone reads, nobody writes. A menu, a price list.
 *   collect — anyone writes, NOBODY reads. A booking form. The absence of a
 *             SELECT policy is what makes it write-only: with RLS on, no policy
 *             means no rows, so this is enforced by omission and cannot be
 *             weakened by adding a filter to the wrong clause.
 *   user    — a signed-in member reads and writes their OWN rows, or their team's
 *             when the table is team-shared.
 *   feed    — any signed-in member reads everything; each writes their own.
 *   admin   — any signed-in member reads; writes are left to the Worker, because
 *             the roles a table names in `writeRoles` are ours and not something
 *             the database has been told about.
 */
export function policiesFor(t) {
  // NOTHING HERE READS `t.access`, and the absence is the point. Every decision
  // below composes from `resolveAccess(t)` — the pair — because `access` is a
  // SHORTHAND that `normalizeSchema` also STAMPS onto any table that declared a
  // read/write pair instead, so the raw field names a preset the designer never
  // wrote. Five separate readers have made that mistake (the lint's write gate,
  // the digest's PAID line, the seeder, the owner-write member gate,
  // `acceptsVisitorUploads`), and this function held a `const access` binding of
  // exactly that shape, declared and never used, until 2026-08-16. It was inert;
  // it was also a loaded gun in the one function that decides who may read a
  // customer's data. With nothing to reach for, the mistake cannot be made here.
  const tn = q(t.name);
  const p = (suffix) => q(POLICY_PREFIX + t.name + "_" + suffix);
  const out = [`ALTER TABLE ${tn} ENABLE ROW LEVEL SECURITY;`];

  // Named so a site built before this, or one whose access level CHANGED on a
  // revise, does not keep a policy from its previous shape. A display table that
  // became `user` would otherwise still be readable by everyone.
  for (const s of ["read", "insert", "update", "delete"]) {
    out.push(`DROP POLICY IF EXISTS ${p(s)} ON ${tn};`);
  }

  // A RETIRED TABLE GETS NO POLICY AT ALL, and this function ignored `retired`
  // entirely while `grantsFor` honoured it — two halves of one answer that
  // disagreed. So removing a booking form dropped its policy shapes and then
  // RE-CREATED `FOR INSERT WITH CHECK (true)` on the way out: with the stale
  // grant that nothing revoked, the removed form kept accepting submissions from
  // anyone. The drops above still run, which is what makes retiring take effect;
  // returning here is what stops it being undone two lines later.
  if (t && t.retired) return out;

  // A PAYABLE TABLE GETS NO WRITE POLICY EITHER, for the same reason its grants
  // were hoisted: the only way an order may exist is through /checkout, which
  // inserts on the OWNER's connection and bypasses RLS, so a write policy here
  // grants nothing the platform needs and is one mistake away from mattering.
  // Reads are untouched — a customer must still see what they are buying.
  const payable = !!(t && t.payment);

  // A soft-deleted row is gone as far as any reader is concerned. Applied in the
  // policy as well as in the Worker's query, or the Data API would serve rows the
  // site itself treats as deleted.
  // WHAT COUNTS AS A LIVE ROW, enforced where it cannot be forgotten.
  //
  // `trash` has always filtered here. `expires` and `scheduled` did NOT, and
  // their own comments in the schema engine claim they do — "reads hide rows
  // past it", "hidden until this time". That filtering lived in the Worker's own
  // read path, which was deleted when the data layer moved to Neon: the columns
  // stayed and the WHERE that used them did not. So an expiring offer never
  // expired and a scheduled post was public the moment it was written.
  //
  // IN THE POLICY RATHER THAN IN THE PAGE, deliberately, and this is the
  // `safe-image` argument applied to data: a rule the generator must remember on
  // every list of every page is one it will eventually forget, and forgetting
  // means a shop advertising last month's price. A policy cannot be forgotten,
  // it applies to the owner's dashboard and the public API alike, and it is one
  // clause instead of a sentence in the prompt.
  //
  // COMPARED AS TEXT, which is correct here rather than lucky: these columns are
  // TEXT holding `YYYY-MM-DD HH24:MI:SS` UTC, a zero-padded format whose
  // lexicographic order IS its chronological order. `NOW_UTC` is the same
  // expression the engine's own defaults use, so a row written and a row read
  // are measured on one clock.
  const NOW_UTC = "to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS')";
  const live =
    (t && t.trash ? ` AND ${tn}."deleted_at" IS NULL` : "") +
    // NULL means "never expires" / "already live", so both are written to admit
    // it explicitly. Left implicit, `expires_at > now` is NULL for an unset
    // column, which is not true — and every row without one would vanish.
    (t && t.expires ? ` AND (${tn}."expires_at" IS NULL OR ${tn}."expires_at" > ${NOW_UTC})` : "") +
    (t && t.scheduled ? ` AND (${tn}."publish_at" IS NULL OR ${tn}."publish_at" <= ${NOW_UTC})` : "");
  const signedIn = "app_user_id() IS NOT NULL";
  // The team widening, and the null case is the one that matters: a member in no
  // organization must fall back to their own rows. `team_id = app_...` would be
  // null = null, which is NULL and therefore not true — correct here by accident,
  // so it is written explicitly instead of relied on.
  const mine = `${tn}."owner_id" = app_user_id()`;
  // COMPARED AS TEXT, both sides. `team_id` is a uuid column and Better Auth's
  // `organizationId` is whatever Neon's managed deployment made it — and
  // `uuid = text` is not an operator Postgres has, so a type guess here is a
  // policy that fails to create rather than one that refuses a row. Casting the
  // uuid to text is always lossless and always defined; the reverse is not.
  // TEAM WIDENING keys on the PROPERTY — rows are owned per member — rather
  // than on the name `user`, or the same table declared as a pair would lose it.
  const ours = (t && t.teamScope && resolveAccess(t).read === "own")
    ? `(${mine} OR (${tn}."team_id" IS NOT NULL AND ${tn}."team_id"::text = app_team_id()))`
    : `(${mine})`;

  // COMPOSED FROM THE PAIR, not switched on the five names. The five are still
  // exactly what they were — asserted byte-for-byte against the previous
  // implementation, which is the only reason a change to the security layer of
  // every published site is safe to make in one go. What is new is that the
  // cells BETWEEN them can now be reached at all.
  const { read, write } = resolveAccess(t);

  // READ. `none` emits NOTHING, and that omission is the protection rather than
  // a rule that could be written wrong: with row-level security on, a table with
  // no SELECT policy returns no rows to anybody, and no filter in the wrong
  // clause can weaken it. That is what makes `collect` write-only, and it now
  // holds for every pair whose read is `none` rather than for one named level.
  if (read === "public") out.push(`CREATE POLICY ${p("read")} ON ${tn} FOR SELECT USING (true${live});`);
  else if (read === "members") out.push(`CREATE POLICY ${p("read")} ON ${tn} FOR SELECT USING (${signedIn}${live});`);
  else if (read === "own") out.push(`CREATE POLICY ${p("read")} ON ${tn} FOR SELECT USING (${ours}${live});`);

  // WRITE. `anyone` gets INSERT AND NOTHING ELSE, deliberately: an anonymous
  // visitor may leave a row and may never reach one again — not their own, since
  // there is nothing to prove it is theirs, and certainly not anybody else's.
  // That is `collect` today and it stays true of every pair that writes `anyone`.
  if (payable) {
    // nothing: no INSERT, no UPDATE, no DELETE policy on a table whose rows may
    // only be created by the checkout route.
  } else if (write === "anyone") {
    out.push(`CREATE POLICY ${p("insert")} ON ${tn} FOR INSERT WITH CHECK (true);`);
  } else if (write === "own") {
    // WITH CHECK on the NEW row, so a member cannot insert a row owned by somebody
    // else. USING on the existing row for an update, so they cannot reach one.
    out.push(`CREATE POLICY ${p("insert")} ON ${tn} FOR INSERT WITH CHECK (${mine});`);
    out.push(`CREATE POLICY ${p("update")} ON ${tn} FOR UPDATE USING (${ours}) WITH CHECK (${ours});`);
    out.push(`CREATE POLICY ${p("delete")} ON ${tn} FOR DELETE USING (${ours});`);
  } else if (write === "members") {
    out.push(`CREATE POLICY ${p("insert")} ON ${tn} FOR INSERT WITH CHECK (${signedIn});`);
    out.push(`CREATE POLICY ${p("update")} ON ${tn} FOR UPDATE USING (${signedIn}) WITH CHECK (${signedIn});`);
    out.push(`CREATE POLICY ${p("delete")} ON ${tn} FOR DELETE USING (${signedIn});`);
  }
  // `write: "none"` emits nothing at all — `display` and `admin`. Content is the
  // owner's and is changed through their own door, which is not subject to RLS.
  return out;
}

/**
 * Whether anything outside the Worker may reach these tables at all.
 *
 * Policies decide what a role MAY see; a GRANT decides whether it can ask. Both
 * are needed, and they are deliberately separate calls: enabling RLS and writing
 * policies changes nothing for anyone, while granting is the step that makes a
 * table reachable over Neon's Data API.
 *
 * `anonymous`, NOT `anon`. Neon's Data API runs a request as `authenticated` or
 * as `anonymous`, and **there is no role called `anon`** — that is Supabase's
 * name for it. Postgres refuses a GRANT naming a role that does not exist, and
 * the apply loop logs the failure and carries on, so every grant on every table
 * had been failing silently since the Data API landed. Measured 2026-08-04.
 *
 * ONE STATEMENT PER ROLE, which is the half that made it total rather than
 * partial: `TO anon, authenticated` is a single statement, so the bad name took
 * `authenticated` down with it and even a signed-in member got nothing. Split,
 * a future bad name costs one role instead of both.
 */
export const DATA_API_ROLES = { anon: "anonymous", user: "authenticated" };

export function grantsFor(t) {
  // A RETIRED TABLE GETS NO GRANTS AT ALL, which is how a site removes a
  // feature without destroying what it collected.
  //
  // The schema engine is ADDITIVE — every statement is `ADD COLUMN IF NOT
  // EXISTS` / `CREATE TABLE IF NOT EXISTS`, and there is no `DROP` anywhere in
  // it. So "remove the booking page" used to take the page away and leave the
  // table publicly writable forever: a form nobody can see, still accepting
  // submissions from anyone who knows the endpoint.
  //
  // WITHOUT A DROP, DELIBERATELY. A `collect` table holds real customers'
  // bookings and enquiries, and a model reading "remove the booking page" must
  // never be one step from deleting them. Withdrawing the grants makes the
  // table unreachable from the web while the rows stay exactly where they are —
  // the owner can still read and export them, and a later revise can bring the
  // feature back by simply not retiring it. Reversible in both directions.
  // REVOKE FIRST, THEN GRANT — grants were additive-only and nothing ever took
  // one back.
  //
  // Omission protects a table Postgres grants to nobody, which is true on the
  // FIRST build and false on every one after it: a GRANT persists, so not
  // re-issuing one removes nothing. That is the same trap already recorded for
  // `internal` FUNCTIONS, where Postgres grants EXECUTE to PUBLIC and three
  // correct layers were undone by a default — here the default is fine and the
  // LIFECYCLE is what breaks it.
  //
  // What it cost: `retired` returns no grants below, and that was described as
  // withdrawing the table from the web. It withdrew nothing — a removed booking
  // form kept its earlier INSERT grant and kept taking submissions. Same for a
  // table tightened from `display` to `members`, or one that becomes payable
  // after being built without a price.
  //
  // Emitted for EVERY table including a retired one, which is what makes the
  // withdrawal real, and before the grants so a re-issued privilege is not taken
  // straight back off. The apply loop runs these in order.
  const revoke = [
    `REVOKE ALL ON ${q(t.name)} FROM ${DATA_API_ROLES.anon};`,
    `REVOKE ALL ON ${q(t.name)} FROM ${DATA_API_ROLES.user};`,
  ];
  if (t && t.retired) return revoke;
  const { read, write } = resolveAccess(t);
  const tn = q(t.name);
  const { anon, user } = DATA_API_ROLES;
  const out = [...revoke];

  // WHO MAY ASK TO READ. `none` grants nothing, which is the other half of the
  // write-only guarantee: no policy AND no grant.
  if (read === "public") out.push(`GRANT SELECT ON ${tn} TO ${anon};`, `GRANT SELECT ON ${tn} TO ${user};`);
  else if (read === "members" || read === "own") out.push(`GRANT SELECT ON ${tn} TO ${user};`);

  // WHO MAY ASK TO WRITE.
  //
  // A PAYABLE TABLE GETS NO PUBLIC INSERT AT ALL, and this is the whole
  // security model rather than an optimisation.
  //
  // An order carries payment_status. Leave the table publicly insertable and
  // anyone can POST /data/orders with payment_status "paid" and a total they
  // chose — goods marked sold with no money behind them. Column-level grants
  // could carve the payment columns out, but then the row still exists at a
  // price nobody computed, and every future column has to remember to opt out.
  //
  // With no grant, the ONLY way an order can exist is POST /api/db/<slug>/checkout,
  // which prices the basket from the site's own rows and inserts through the
  // owner's connection. The hole closes by construction rather than by
  // validation somebody has to keep getting right. Keyed on the WRITE axis now,
  // so a payable table is protected however its access was spelled.
  // A PAYABLE TABLE GETS NO WRITE GRANT ON ANY PAIR, and this check had to come
  // OUT of the `anyone` branch to be true.
  //
  // It sat inside it, so the protection held for `collect` — the shape payments
  // were built on — and for nothing else. Measured across all 16 cells: a
  // payable table declared `write:"own"` or `write:"members"` was emitting
  // `GRANT INSERT, UPDATE, DELETE … TO authenticated`, so any signed-in member
  // could insert an order with `payment_status:"paid"` at a price they chose, or
  // flip their own pending order to paid. Eight of the sixteen. The comment
  // above claims the hole "closes by construction"; it closed for one preset.
  //
  // The read grant is deliberately left standing: a customer must still be able
  // to SEE what they are buying. It is the write that must only ever happen
  // through /checkout, which prices the basket from the site's own rows and
  // inserts on the owner's connection.
  if (t && t.payment) return out;
  if (write === "anyone") {
    out.push(`GRANT INSERT ON ${tn} TO ${anon};`, `GRANT INSERT ON ${tn} TO ${user};`);
  } else if (write === "own" || write === "members") {
    // ONE STATEMENT FOR THE MEMBER, matching what `user` and `feed` have always
    // emitted: they may ask for all four verbs and the POLICIES decide which
    // rows. But it must NOT swallow the anonymous read granted above — an
    // earlier draft returned here and dropped it, which silently broke the one
    // cell this whole change exists for: "anyone reads, members write their
    // own" published a listings table the public still could not read. Caught by
    // printing the new cells rather than by trusting the composition.
    // THE VERBS FOLLOW THE READ AXIS TOO. `user` and `feed` both read, so both
    // keep the four-verb statement they have always emitted. A pair that writes
    // per-member and reads NOTHING gets no SELECT: the policy would never return
    // a row anyway, so the grant buys nothing — and a privilege with no purpose
    // is one that stops being harmless the day somebody adds a policy by mistake.
    const verbs = read === "none" ? "INSERT, UPDATE, DELETE" : "SELECT, INSERT, UPDATE, DELETE";
    const forMember = `GRANT ${verbs} ON ${tn} TO ${user};`;
    return read === "public" ? [`GRANT SELECT ON ${tn} TO ${anon};`, forMember] : [forMember];
  }
  return out;
}

// ── The public projection ────────────────────────────────────────────────────
//
// `publicView` was declarable, told to the DESIGNER as the way to grey out taken
// slots, told to the GENERATOR as `usePublicRows: YES`, and refused by the lint
// when absent — and NOTHING EVER CREATED IT. It appeared in site-schema.mjs only
// in the parser and the `_meta` copy: no DDL, no grant, no object in the database.
//
// So the model did exactly what four layers told it to and the published page
// answered 403. Measured live 2026-08-04: a generated barber shop asked for
// today's bookings on its own home page and was refused by its own database.
// That is the parsed-but-inert pattern this repo keeps rediscovering, made worse
// by being advertised as working.
//
// It has to be a real VIEW. The table underneath is `collect` or `user`, so a
// stranger has no SELECT policy on it — by design, and that IS the feature:
// publish WHEN somebody booked, never WHO.

const CMP = { eq: "=", ne: "<>", lt: "<", lte: "<=", gt: ">", gte: ">=" };

/** A single-quoted SQL literal. NUL is refused — Postgres cannot store it in text. */
function lit(v) {
  const s = String(v);
  // The NUL is written as an ESCAPE, never as the raw byte. Three files in
  // this repo once held literal control characters, which made `grep` treat
  // them as binary and skip them entirely — so every source-reading guard
  // silently stopped covering them while looking exactly like a file with
  // nothing to report. My first draft of this very line put one straight back.
  if (s.indexOf("\u0000") >= 0) return null;
  return "'" + s.replace(/'/g, "''") + "'";
}

/** Escape LIKE metacharacters, so a `%` in a value matches a literal `%`. */
const likeSafe = (v) => String(v).replace(/[\\%_]/g, (m) => "\\" + m);

/**
 * One `col:op:value` predicate as SQL, or null if it cannot be compiled.
 *
 * NULL IS NOT "no filter" — see the caller. A predicate that silently vanishes
 * WIDENS what the view publishes, and that is the one direction which must never
 * happen quietly: `status:ne:cancelled` dropped is a view that also publishes
 * the cancellations.
 */
export function publicViewPredicate(w, known) {
  const m = /^([a-z_][a-z0-9_]{0,40}):([a-z]+):([\s\S]{0,80})$/i.exec(String(w == null ? "" : w));
  if (!m) return null;
  const col = m[1].toLowerCase(), op = m[2].toLowerCase(), raw = m[3];
  if (known && !known.has(col)) return null;
  const c = q(col);
  if (op === "isnull") return `${c} IS NULL`;
  if (op === "notnull") return `${c} IS NOT NULL`;
  if (CMP[op]) { const v = lit(raw); return v && `${c} ${CMP[op]} ${v}`; }
  if (op === "contains" || op === "startswith" || op === "endswith") {
    const e = likeSafe(raw);
    const v = lit(op === "contains" ? `%${e}%` : op === "startswith" ? `${e}%` : `%${e}`);
    return v && `${c} LIKE ${v}`;
  }
  if (op === "in" || op === "nin") {
    const parts = raw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 24).map(lit);
    if (!parts.length || parts.some((p) => !p)) return null;
    return `${c} ${op === "in" ? "IN" : "NOT IN"} (${parts.join(", ")})`;
  }
  if (op === "between") {
    const i = raw.indexOf(",");
    if (i < 0) return null;
    const a = lit(raw.slice(0, i).trim()), b = lit(raw.slice(i + 1).trim());
    return (a && b) ? `${c} BETWEEN ${a} AND ${b}` : null;
  }
  return null;
}

/**
 * The statements that make a table's `publicView` real, or unmake it.
 *
 * `columns` is what the table ACTUALLY has after its DDL ran, not what the spec
 * asked for — a projection naming a column nothing created is a view that fails
 * to compile, which is the 403 again wearing a different cause.
 *
 * THE DROP ALWAYS RUNS, even for a table with no publicView. A revise that
 * removed one would otherwise leave the old view standing and still published —
 * the same reasoning that drops every policy shape before creating any.
 *
 * ALL OR NOTHING. If a declared column is missing, or a filter will not compile,
 * the view is not created at all. Publishing a subset of the columns is a
 * smaller answer; publishing without one of the filters is a WRONG one, and it
 * fails outward — more rows, to more strangers, silently.
 *
 * `security_invoker = false` is stated rather than left to the default, and it
 * is the whole mechanism: the view runs as its owner, who bypasses the table's
 * RLS, so a stranger reads the projection while still unable to read the table.
 * `security_barrier = true` stops a crafted predicate seeing rows the WHERE
 * excluded.
 *
 * The declared `limit` is deliberately NOT compiled in. A LIMIT inside a view
 * applies BEFORE the caller's filter, so `?appointment_date=eq.2026-08-04`
 * against a 500-row view would silently miss bookings — a wrong answer rather
 * than a smaller one. Callers pass their own limit and the Data API caps the rest.
 */
export function publicViewSql(t, columns, tableNames) {
  const name = String((t && t.name) || "");
  // Both of these come from site-access.mjs rather than being restated here. The
  // first draft inlined `Array.isArray(pv.columns) && pv.columns.length` and the
  // one-question guard caught it immediately — which is the guard doing exactly
  // its job on the very change that proves why it exists: two copies of "does
  // this table publish a projection" drift into a lint that passes a page whose
  // every read the database then refuses.
  const view = publicViewName(name);
  const out = [`DROP VIEW IF EXISTS ${q(view)};`];

  const pv = t && t.publicView;
  if (!hasPublicView(t)) return out;
  // A declared table already owning that name: the CREATE would fail anyway, and
  // refusing here beats a caught SQL error nobody reads.
  if (tableNames && tableNames.has(view)) return out;

  const known = new Set((columns || []).map((c) => String(c).toLowerCase()));
  const cols = pv.columns.map((c) => String(c).toLowerCase());
  if (!cols.every((c) => known.has(c))) return out;

  const where = [];
  for (const w of (pv.where || [])) {
    const sql = publicViewPredicate(w, known);
    if (!sql) return out;
    where.push(sql);
  }

  const { anon, user } = DATA_API_ROLES;
  out.push(
    `CREATE VIEW ${q(view)} WITH (security_invoker = false, security_barrier = true) AS ` +
    `SELECT ${cols.map(q).join(", ")} FROM ${q(name)}` +
    (where.length ? ` WHERE ${where.join(" AND ")}` : "") + ";",
  );
  out.push(`GRANT SELECT ON ${q(view)} TO ${anon};`);
  out.push(`GRANT SELECT ON ${q(view)} TO ${user};`);
  return out;
}

// ── A declared database function ─────────────────────────────────────────────
//
// Returned as STATEMENTS rather than executed, for the same reason `publicViewSql`
// is: the DDL is then testable without a database, and the assertions can be about
// what is emitted instead of about whether a source file mentions a phrase. Four
// mutants survived a regex-based version of this check — one of them matched the
// words "SECURITY DEFINER" inside a COMMENT explaining why it is needed.
//
// `SECURITY DEFINER` is the point of the whole feature: a `collect` table has no
// read policy, so only a function running as its owner can hand one row back to
// the person who submitted it. That is a far narrower hole than a read policy,
// because it returns exactly what the body selects and nothing else.
//
// `$isibi$` and not `$$`: the body is written by a model, and a `$$` inside it
// would end the literal early and turn the remainder into top-level syntax.
export function functionSql(f) {
  const args = (f.args || []).map((a) => q(a.name) + " " + a.type).join(", ");
  const argTypes = (f.args || []).map((a) => a.type).join(", ");
  const ret = String(f.returns).startsWith("setof ")
    ? "SETOF " + q(String(f.returns).slice(6))
    : String(f.returns).toUpperCase();
  const out = [
    "CREATE OR REPLACE FUNCTION " + q(f.name) + "(" + args + ") RETURNS " + ret +
    " LANGUAGE " + (f.language === "plpgsql" ? "plpgsql" : "sql") +
    (f.definer === false ? "" : " SECURITY DEFINER") +
    " AS $isibi$ " + f.body + " $isibi$",
  ];
  // POSTGRES GRANTS EXECUTE ON A NEW FUNCTION TO `PUBLIC` BY DEFAULT, so the
  // REVOKE is not tidiness — it is the only thing that makes `internal` mean
  // anything at all. Withholding our GRANT withholds nothing: the privilege is
  // already there, held by a role every other role belongs to.
  //
  // Measured 2026-08-07 by `neon e2e` against a real database: an `internal`
  // function reported `{anon:true, auth:true}` for EXECUTE. That is a live read
  // of a write-only table — a confirmation builder takes a row id and returns
  // somebody's name, message and email address, every model function is SECURITY
  // DEFINER so it runs as the owner and bypasses RLS, and ids are sequential.
  // Anyone who could reach the Data API could have walked the whole collect
  // table by counting. The claim-token design exists precisely to stop that.
  //
  // This is the third layer of the same lesson: `internal` was declarable, the
  // normaliser kept it, and `functionSql` skipped the GRANT — three correct
  // layers over a default that undid all of them. Only Postgres could say so,
  // which is why the assertion lives in the e2e and not only in a unit test.
  //
  // AND THE ANALOGY THAT CAUSED IT, stated so nobody re-derives it: the design
  // was copied from `_secrets`, which is safe by simply never passing through
  // `grantsFor`. That works for a TABLE, which Postgres grants to nobody by
  // default. It does NOT transfer to a FUNCTION, which Postgres grants to
  // PUBLIC. Omission protects one and not the other; only the table half of
  // that pair was ever true.
  out.push("REVOKE ALL ON FUNCTION " + q(f.name) + "(" + argTypes + ") FROM PUBLIC");

  // Now the grant means what it says, in both directions. Without EXECUTE a
  // public function exists and the Data API answers 404 — the publicView
  // failure, one object over. An internal one is called by the Worker on the
  // owner's connection, which bypasses grants entirely, so it loses nothing.
  if (!f.internal) {
    for (const role of [DATA_API_ROLES.anon, DATA_API_ROLES.user]) {
      out.push("GRANT EXECUTE ON FUNCTION " + q(f.name) + "(" + argTypes + ") TO " + role);
    }
  }
  return out;
}
