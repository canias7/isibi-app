// The site owner reading their own data.
//
// The oldest gap in the builder: a booking form writes to a `collect` table, and
// `collect` is write-only BY DESIGN — one visitor must never read back another's
// submission. Which meant nobody could, including the person the bookings were
// for. A barber shop took appointments it could not see.
//
// This is a different door from /api/db. That one is the published site's public
// API, where the caller is a visitor with no isibi account. This one is the
// owner's, authenticated by their isibi session, and it can read anything in
// their own site because it is their data.
//
// Injected like the rest, so the decisions run without Supabase, Neon or a
// Worker — see test/site-owner.test.mjs.

import { isManagedColumn, normalizeRole, rolesForSchema } from "./site-access.mjs";
import { normalizeTeamId } from "./site-teams.mjs";
import { constraintError } from "./site-errors.mjs";

const json = (body, status = 200) => ({ status, body });

const MAX_LIMIT = 200;
const MAX_BODY_KEYS = 60;

const declaredTables = (spec) => (spec && Array.isArray(spec.tables) ? spec.tables : []);

const tableFor = (spec, name) => declaredTables(spec)
  .find((t) => t && String(t.name).toLowerCase() === String(name || "").toLowerCase()) || null;

const columnNames = (def) => (Array.isArray(def.columns) ? def.columns : [])
  .map((c) => String(typeof c === "string" ? c : (c && c.name) || ""))
  .filter(Boolean);

// Ids are bound parameters, so this is not about injection — it is about a
// non-integer reaching Postgres as a type error and surfacing as a 500 when the
// honest answer is "no such row".
function rowIdOf(raw) {
  const n = parseInt(raw, 10);
  return (Number.isSafeInteger(n) && n > 0 && String(n) === String(raw).trim()) ? n : null;
}

// Which columns the owner may set. Declared and not managed — the same rule the
// visitor path uses, for the same reason: the engine owns id/created_at/owner_id
// /_fts, and letting anyone set them by hand desynchronises the row from its
// own indexes.
function pickWritable(def, body) {
  const allowed = new Set(columnNames(def).filter((c) => !isManagedColumn(c)).map((c) => c.toLowerCase()));
  const cols = [], vals = [];
  for (const k of Object.keys(body || {}).slice(0, MAX_BODY_KEYS)) {
    if (!allowed.has(String(k).toLowerCase())) continue;
    let v = body[k];
    if (v && typeof v === "object") v = JSON.stringify(v); // json/array columns store as text
    cols.push(k);
    vals.push(v === undefined ? null : v);
  }
  return { cols, vals };
}

/**
 * The gate every owner route shares: a session, an ownership record, and a live
 * database. Returns {error} to hand straight back, or {db}.
 *
 * Ownership fails CLOSED. "I cannot tell who owns this" must never become
 * "anyone may read it" — the build route made exactly that mistake with a bare
 * `catch {}` and one Supabase timeout handed a site to a stranger.
 *
 * 404 rather than 403 for a site that is not yours: the slug space is public and
 * guessable, so a 403 confirms which names are taken, and by extension which
 * businesses are customers.
 *
 * One copy, because three routes with three hand-written copies of this is how
 * they drift apart — and the one that drifts is a cross-account read.
 */
export async function assertOwner(deps, slug, uid) {
  if (!uid) return { error: json({ error: "sign in" }, 401) };
  let owner;
  try { owner = await deps.ownerOf(slug); }
  catch { return { error: json({ error: "couldn't check that site just now — try again in a moment" }, 503) }; }
  if (!owner || owner !== uid) return { error: json({ error: "no such site" }, 404) };
  return {};
}

async function openSite(deps, slug, uid) {
  const gate = await assertOwner(deps, slug, uid);
  if (gate.error) return gate;
  // Analytics does not need this — its numbers live in Supabase, not the site's
  // own database — which is why the gate is separable from the connection.
  const db = await deps.dbFor(slug);
  if (!db) return { error: json({ error: "no such site" }, 404) };
  return { db };
}

/**
 * deps:
 *   ownerOf(slug)           → uid | null      who owns this site (throws if unknown)
 *   dbFor(slug)             → conn | null
 *   loadSchema(conn)        → { tables }
 *   query(conn, sql, args)  → rows
 */
export async function handleOwnerData(deps, { slug, table, uid, params = {} } = {}) {
  const open = await openSite(deps, slug, uid);
  if (open.error) return open.error;
  const db = open.db;

  const spec = await deps.loadSchema(db);
  const def = tableFor(spec, table);
  // Only tables the site actually declared. The name reaches SQL, so this is
  // also what keeps it an allow-list rather than an identifier from a stranger.
  if (!def) return json({ error: "no such table" }, 404);

  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(params.limit, 10) || 50));
  const offset = Math.max(0, parseInt(params.offset, 10) || 0);
  const cols = columnNames(def);

  // Newest first: these are submissions, and the useful one is the latest.
  const asked = String(params.order || "id");
  const order = cols.includes(asked) || asked === "id" ? asked : "id";
  const dir = String(params.dir || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";

  const rows = await deps.query(db, `SELECT * FROM ${deps.ident(def.name)} ORDER BY ${deps.ident(order)} ${dir} LIMIT ? OFFSET ?`, [limit, offset]);
  // `_fts` is the search index, not data — the same strip the public read does.
  for (const r of rows) if (r && r._fts !== undefined) delete r._fts;
  return json({ rows, limit, offset, access: def.access });
}

/** Which tables an owner can read, and how many rows are waiting in each. */
export async function handleOwnerTables(deps, { slug, uid } = {}) {
  const open = await openSite(deps, slug, uid);
  if (open.error) return open.error;
  const db = open.db;
  const spec = await deps.loadSchema(db);
  const tables = [];
  for (const t of declaredTables(spec)) {
    if (!t || !t.name) continue;
    let count = null;
    // A missing table is not a failure of the whole listing — a schema row can
    // outlive its table if an apply half-succeeded, and the owner still wants
    // to see everything else.
    try {
      const r = await deps.query(db, `SELECT count(*)::int AS n FROM ${deps.ident(t.name)}`);
      count = (r[0] && r[0].n) ?? null;
    } catch { count = null; }
    // Columns come along because the caller builds an edit form from them, and
    // asking per table would be a round trip each. Names only — the engine's
    // managed ones are filtered out, since a form field for `id` or `_fts` is a
    // field whose value is silently dropped on save.
    tables.push({
      name: t.name, access: t.access, rows: count,
      columns: columnNames(t).filter((c) => !isManagedColumn(c)),
    });
  }
  return json({ tables });
}

/**
 * The owner CHANGING their own site's data.
 *
 * The gap this closes is the one GENERATOR.md still lists under "not available
 * yet": nothing can write to a `display` table after the build — not a visitor,
 * not the owner, there was no route — so a café could not correct a price
 * without rebuilding the whole site. That is also the entire reason build-time
 * seeding had to exist.
 *
 * deps: as handleOwnerData, plus
 *   exec(conn, sql, args) → {changes}
 */
export async function handleOwnerWrite(deps, { slug, table, uid, method, rowId, body = {} } = {}) {
  const open = await openSite(deps, slug, uid);
  if (open.error) return open.error;
  const db = open.db;

  const spec = await deps.loadSchema(db);
  const def = tableFor(spec, table);
  // Only tables the site declared. This is what keeps the name an allow-list
  // rather than an identifier from the caller — and it is also what puts
  // `_users` out of reach, so no password hash is ever writable through here.
  if (!def) return json({ error: "no such table" }, 404);

  const access = String(def.access || "collect").toLowerCase();
  const tn = deps.ident(def.name);

  // A constraint firing here is the owner being told something true — "price is
  // required", "that time is taken" — not a server fault. Reported as a 500 it
  // reads as "the site is broken" and they retry the identical request. Measured
  // live 2026-07-28: adding a row with a required column left out answered 500.
  try {
    return await runWrite(deps, { db, def, access, tn, method, rowId, body });
  } catch (e) {
    const known = constraintError(e);
    if (known) return json(known.body, known.status);
    console.error("owner write error:", slug, def.name, String((e && (e.message || e.detail)) || "").slice(0, 200));
    return json({ error: "that didn't work" }, 500);
  }
}

async function runWrite(deps, { db, def, access, tn, method, rowId, body }) {
  if (method === "POST") {
    // A `user`/`feed` row belongs to a MEMBER, and the owner is not one — their
    // isibi account has no id in this database's `_users`. A row created here
    // would carry owner_id NULL: invisible to every `user` read (which scopes to
    // the caller's own id) and unattributable in a feed. Refused rather than
    // silently creating an orphan.
    if (access === "user" || access === "feed") {
      return json({ error: "rows here belong to a member of your site, so they can only be added by one", access, code: "member_table" }, 409);
    }
    const { cols, vals } = pickWritable(def, body);
    if (!cols.length) return json({ error: "nothing to write" }, 400);
    const rows = await deps.query(
      db,
      "INSERT INTO " + tn + " (" + cols.map(deps.ident).join(",") + ") VALUES (" +
        cols.map(() => "?").join(",") + ") RETURNING *",
      vals,
    );
    return json({ row: stripFts(rows[0]) }, 201);
  }

  const id = rowIdOf(rowId);
  if (!id) return json({ error: "no row id" }, 400);

  if (method === "PATCH") {
    const { cols, vals } = pickWritable(def, body);
    if (!cols.length) return json({ error: "nothing to update" }, 400);
    // No owner scoping, unlike the visitor path. This door is already gated on
    // owning the whole site, and every row in it is the owner's to correct —
    // including a member's, which is moderation rather than impersonation.
    const r = await deps.exec(db, "UPDATE " + tn + " SET " + cols.map((c) => deps.ident(c) + "=?").join(",") + " WHERE id=?", vals.concat([id]));
    if (!r.changes) return json({ error: "no such row" }, 404);
    const rows = await deps.query(db, "SELECT * FROM " + tn + " WHERE id=?", [id]);
    return json({ row: stripFts(rows[0]) });
  }

  if (method === "DELETE") {
    // A table declaring `trash` soft-deletes, same as the visitor path, so an
    // accidental delete stays recoverable.
    const r = def.trash
      ? await deps.exec(db, "UPDATE " + tn + ' SET "deleted_at"=' + deps.nowSql() + ' WHERE id=? AND "deleted_at" IS NULL', [id])
      : await deps.exec(db, "DELETE FROM " + tn + " WHERE id=?", [id]);
    if (!r.changes) return json({ error: "no such row" }, 404);
    return json({ ok: true, id, soft: !!def.trash });
  }

  return json({ error: "method not allowed" }, 405);
}

/**
 * The site's members, for the owner.
 *
 * `_users` is deliberately NOT a declared table, so it is unreachable through
 * every other route here. This is the one place that names it, and it names its
 * columns explicitly: `pass_hash` must never leave the database, and a
 * `SELECT *` a year from now would ship it the moment someone added a column.
 */
const MEMBER_COLUMNS = ["id", "email", "role", "verified", "created_at", "last_login_at", "manager_id", "blocked", "team_id"];

export async function handleOwnerMembers(deps, { slug, uid, method = "GET", memberId, body = {}, params = {} } = {}) {
  const open = await openSite(deps, slug, uid);
  if (open.error) return open.error;
  const db = open.db;

  // Promoting a member, and saying who they report to.
  //
  // The only way a role is ever granted. Before this, `_users.role` existed,
  // `admin` tables compared against it and `writeRoles` named values for it —
  // and nothing could write it, so every member on every site was `user`
  // forever and an `admin` table was writable by nobody.
  if (method === "PATCH") {
    const id = rowIdOf(memberId);
    if (!id) return json({ error: "no member id" }, 400);

    const sets = [], vals = [];
    if (body.role !== undefined) {
      const role = normalizeRole(body.role);
      // Allow-listed against the site's OWN schema: a role no table names is a
      // permission that can never be checked, which reads as "I granted access"
      // and does precisely nothing.
      const allowed = rolesForSchema(await deps.loadSchema(db));
      if (!role || !allowed.includes(role)) {
        return json({ error: "role must be one of: " + allowed.join(", "), code: "role" }, 400);
      }
      sets.push(deps.ident("role") + "=?"); vals.push(role);
    }
    if (body.blocked !== undefined) {
      // Suspension, which is what an owner actually wants when a member behaves
      // badly. Before this the only option was DELETE — irreversible, and it
      // leaves their rows behind pointing at nobody. A boolean, not anything
      // truthy: `blocked: "false"` is a string and would suspend them.
      if (typeof body.blocked !== "boolean") return json({ error: "blocked must be true or false" }, 400);
      sets.push(deps.ident("blocked") + "=?"); vals.push(body.blocked ? 1 : 0);
    }
    if (body.manager_id !== undefined) {
      // null clears it. Anything else must be a real member of THIS site.
      if (body.manager_id === null || body.manager_id === "") {
        sets.push(deps.ident("manager_id") + "=NULL");
      } else {
        const mid = rowIdOf(body.manager_id);
        if (!mid) return json({ error: "manager_id must be a member id" }, 400);
        // Self-management would make `teamRead` return the member's own rows
        // twice and, worse, reads as a hierarchy that isn't one.
        if (mid === id) return json({ error: "a member cannot manage themselves", code: "self" }, 400);
        const exists = await deps.query(db, "SELECT id FROM _users WHERE id=?", [mid]);
        if (!exists[0]) return json({ error: "no such member" }, 404);
        sets.push(deps.ident("manager_id") + "=?"); vals.push(mid);
      }
    }
    if (body.team_id !== undefined) {
      // The only way a member is ever put into a team, which is what makes
      // `teamScope` reachable at all — it has been parsed, and its `team_id`
      // column stamped onto tables, since the schema engine was written, with
      // nothing able to populate it.
      //
      // `null` CLEARS it and is a real thing an owner does. `normalizeTeamId`
      // answers `undefined` for anything that is neither, so a typo cannot
      // silently take somebody out of their team.
      const tid = normalizeTeamId(body.team_id);
      if (tid === undefined) return json({ error: "team_id must be a team id, or null to clear it" }, 400);
      if (tid === null) {
        sets.push(deps.ident("team_id") + "=NULL");
      } else {
        const exists = await deps.query(db, "SELECT id FROM _teams WHERE id=?", [tid]);
        if (!exists[0]) return json({ error: "no such team" }, 404);
        sets.push(deps.ident("team_id") + "=?"); vals.push(tid);
      }
    }
    if (!sets.length) return json({ error: "nothing to change" }, 400);

    const r = await deps.exec(db, "UPDATE _users SET " + sets.join(",") + " WHERE id=?", vals.concat([id]));
    if (!r.changes) return json({ error: "no such member" }, 404);
    const rows = await deps.query(db, "SELECT " + MEMBER_COLUMNS.map(deps.ident).join(",") + " FROM _users WHERE id=?", [id]);
    // What the OWNER did, which is the half of the log a member can neither
    // cause nor see, and the half that answers "who gave them that role".
    // Written AFTER the change lands, so the log never claims something that
    // did not happen, and best-effort like every other audit write.
    const changed = rows[0] || null;
    if (deps.audit && changed) {
      const ev = (kind, meta) => { try { const p = deps.audit({ kind, userId: id, email: changed.email, meta }); if (p && p.catch) p.catch(() => {}); } catch (e) { console.error("audit failed:", (e && e.message) || e); } };
      if (body.role !== undefined) ev("role_change", { role: changed.role });
      if (body.blocked !== undefined) ev(body.blocked ? "suspend" : "unsuspend", {});
      if (body.team_id !== undefined) ev("team_change", { team: changed.team_id == null ? "none" : String(changed.team_id) });
    }
    return json({ member: rows[0] || null });
  }

  if (method === "DELETE") {
    const id = rowIdOf(memberId);
    if (!id) return json({ error: "no member id" }, 400);
    // Read BEFORE the delete: afterwards there is no row to name, and a log
    // line that says only "member 41 was deleted" is the least useful version
    // of the one event that cannot be undone.
    const gone = (await deps.query(db, "SELECT id, email FROM _users WHERE id=?", [id]))[0] || null;
    const r = await deps.exec(db, "DELETE FROM _users WHERE id=?", [id]);
    if (!r.changes) return json({ error: "no such member" }, 404);
    if (deps.audit) {
      try { const p = deps.audit({ kind: "member_delete", userId: id, email: gone && gone.email, meta: { reason: "owner" } }); if (p && p.catch) p.catch(() => {}); }
      catch (e) { console.error("audit failed:", (e && e.message) || e); }
    }
    // Their rows are left alone on purpose. owner_id no longer matches anyone,
    // so nothing is readable as that member — but a deleted customer's bookings
    // should not silently vanish from the owner's list.
    return json({ ok: true, id });
  }
  if (method !== "GET") return json({ error: "method not allowed" }, 405);

  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(params.limit, 10) || 50));
  const offset = Math.max(0, parseInt(params.offset, 10) || 0);
  let members = [];
  try {
    members = await deps.query(db, "SELECT " + MEMBER_COLUMNS.map(deps.ident).join(",") + " FROM _users ORDER BY id DESC LIMIT ? OFFSET ?", [limit, offset]);
  } catch {
    // A site with no member tables never had `_users` created — that is not an
    // error, it is a site with no members.
    return json({ members: [], limit, offset });
  }
  return json({ members, limit, offset });
}

function stripFts(row) {
  if (row && row._fts !== undefined) delete row._fts;
  return row || null;
}

/**
 * How the site is doing: views, visitors, and the last seven days.
 *
 * `site_hits` has been written on every visit since the D1 era and **nothing has
 * ever read it** — the route the panel calls did not exist, so a published site
 * collected traffic its owner could never see. (64 real hits by the time this
 * was written.)
 *
 * The numbers live in Supabase rather than the site's own database, so this
 * takes `assertOwner` and not `openSite`: no Neon connection is needed, and
 * resolving one would be a round trip spent on nothing.
 *
 * The aggregation itself is the `site_analytics` RPC — count-distinct and a
 * seven-day generate_series are not things a REST filter can express. That
 * function used to do its OWN ownership check, against `published_sites`, a
 * table the current builder never writes: the two shared zero rows, so it
 * refused every caller. The check belongs here, where it is tested and where it
 * matches every other door onto a site.
 *
 * deps: ownerOf(slug), plus
 *   readAnalytics(slug) → {views, visitors, series:[{day, views}], …}
 */
export async function handleOwnerAnalytics(deps, { slug, uid } = {}) {
  const gate = await assertOwner(deps, slug, uid);
  if (gate.error) return gate.error;

  let stats;
  try { stats = await deps.readAnalytics(slug); }
  catch { return json({ error: "couldn't read your traffic just now — try again in a moment" }, 503); }

  // A site nobody has visited is not an error, and must not read as one: zeros
  // and an empty week, so the panel says "no visits yet" instead of "failed".
  const series = Array.isArray(stats && stats.series) ? stats.series : [];
  return json({
    ok: true,
    views: num(stats && stats.views),
    visitors: num(stats && stats.visitors),
    views7: num(stats && stats.views7),
    visitors7: num(stats && stats.visitors7),
    series: series.map((s) => ({ day: String((s && s.day) || ""), views: num(s && s.views) })),
  });
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
