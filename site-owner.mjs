// The site owner reading their own data.
//
// The oldest gap in the builder: a booking form writes to a `collect` table, and
// `collect` is write-only BY DESIGN — one visitor must never read back another's
// submission. Which meant nobody could, including the person the bookings were
// for. A barber shop took appointments it could not see.
//
// This is a different door from /api/db. That one is the published site's public
// API, where the caller is a visitor with no Go Farther account. This one is the
// owner's, authenticated by their Go Farther session, and it can read anything in
// their own site because it is their data.
//
// Injected like the rest, so the decisions run without Supabase, Neon or a
// Worker — see test/site-owner.test.mjs.

import { isManagedColumn, resolveAccess, accessLabel } from "./site-access.mjs";
import { constraintError } from "./site-errors.mjs";
import { parseCsv, importPlan, MAX_IMPORT_BYTES, IMPORT_BATCH } from "./site-csv.mjs";

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
  // LABELLED BY THE RESOLVED PAIR, not the stamped preset name — a table
  // declared `{read:"public", write:"none"}` is a display table and read back as
  // "collect" before this, which is what the Data panel showed the owner.
  return json({ rows, limit, offset, access: accessLabel(def), memberRows: memberWritten(def) });
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
      name: t.name, access: accessLabel(t), rows: count,
      // WHOSE ROWS THESE ARE, as a fact rather than a name to be re-derived.
      // The client used to compare the access string against 'user'/'feed' to
      // decide whether "+ Add" makes sense; a pair spelling the same thing
      // matches neither, and a client copy of the resolution rule is a second
      // place that can disagree with `site-access.mjs`. One boolean instead.
      memberRows: memberWritten(t),
      columns: columnNames(t).filter((c) => !isManagedColumn(c)),
      // Whether this table takes card payments. A BOOLEAN, not the declaration:
      // the panel only needs to say which tables are paid, and `payment.from`
      // is the site's own business rather than something to widen this payload
      // for. The Data panel already renders every field it is given.
      paid: !!t.payment,
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

  // THE PAIR, NOT THE PRESET NAME. `normalizeSchema` stamps
  // `access: "collect"` on ANY table that did not declare one of the five
  // shorthands — and the design tool actively tells the model that pairs are
  // the escape hatch and to leave `access` out. So a member table spelled
  // `{read:"own", write:"own"}` arrived here wearing "collect", walked past the
  // 409 below, and the owner's POST wrote a row with `owner_id` NULL: invisible
  // to every member-scoped read, which is exactly the orphan that 409 exists to
  // prevent. Third place this month that asked the name instead of resolving.
  const access = resolveAccess(def);
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

/**
 * Do this table's rows belong to a MEMBER of the site rather than to the owner?
 *
 * The one question behind both the 409 on an owner POST and the client's "+ Add"
 * button, asked of the write axis so a preset and the pair that spells the same
 * thing answer identically.
 */
function memberWritten(def) {
  const w = resolveAccess(def).write;
  return w === "own" || w === "members";
}

async function runWrite(deps, { db, def, access, tn, method, rowId, body }) {
  if (method === "POST") {
    // A `user`/`feed` row belongs to a MEMBER, and the owner is not one — their
    // Go Farther account has no id in this database's `_users`. A row created here
    // would carry owner_id NULL: invisible to every `user` read (which scopes to
    // the caller's own id) and unattributable in a feed. Refused rather than
    // silently creating an orphan.
    // ASKED OF THE WRITE AXIS, which is the thing that decides it: a row whose
    // writer is a member carries that member's id, and the owner has none.
    // `user` and `feed` are both `write: "own"`; a pair spelling the same thing
    // is refused identically, which is the point.
    if (access.write === "own" || access.write === "members") {
      return json({ error: "rows here belong to a member of your site, so they can only be added by one", access: accessLabel(def), code: "member_table" }, 409);
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


function stripFts(row) {
  if (row && row._fts !== undefined) delete row._fts;
  return row || null;
}

// The declared columns WITH their types, which the CSV reader needs and the
// name-only `columnNames` above throws away. A string entry is a text column.
const columnDefs = (def) => (Array.isArray(def.columns) ? def.columns : [])
  .map((c) => (typeof c === "string" ? { name: c, type: "text" }
    : (c && c.name ? { name: String(c.name), type: String(c.type || "text") } : null)))
  .filter(Boolean);

/**
 * A CSV file into one table (owner, 2026-09-03 — the backend services round).
 *
 * The same door as `handleOwnerWrite`'s POST, taking a whole spreadsheet
 * instead of one row, under the same rules: the site's own table, the
 * declared columns and not the engine's, and NEVER a member-written table —
 * a row the owner adds to one carries no member id and is invisible to every
 * member read, the orphan the 409 exists to prevent.
 *
 * WHAT A ROW THAT FAILS COSTS: itself. Rows go in a hundred at a time; a
 * batch Postgres refuses is retried one row at a time, so the bad line is
 * named ("line 14: price is required") and the other ninety-nine go in. A
 * cell the column cannot take is caught before any INSERT, by `importPlan`,
 * and named the same way. The reply says how many went in, which lines did
 * not and why, which headers matched nothing, and how many rows past the cap
 * were left unread — the owner reads it as one sentence in the Data panel.
 *
 * NOT A TRANSACTION, and said so: rows that went in before a failure stay in.
 * The alternative — a whole file refused for one bad line — is the failure
 * the per-row retry exists to avoid, and an owner who imports the file again
 * after fixing line 14 wants line 14, not a second copy of the other 499.
 *
 * deps: as handleOwnerWrite (ownerOf, dbFor, loadSchema, exec, ident).
 */
export async function handleOwnerImport(deps, { slug, table, uid, text } = {}) {
  const open = await openSite(deps, slug, uid);
  if (open.error) return open.error;
  const db = open.db;

  const spec = await deps.loadSchema(db);
  const def = tableFor(spec, table);
  if (!def) return json({ error: "no such table" }, 404);

  const access = resolveAccess(def);
  if (access.write === "own" || access.write === "members") {
    return json({ error: "rows here belong to a member of your site, so they can only be added by one", access: accessLabel(def), code: "member_table" }, 409);
  }
  if (typeof text !== "string" || !text.trim()) return json({ error: "that file is empty", code: "empty" }, 400);
  if (text.length > MAX_IMPORT_BYTES) return json({ error: "that file is too big — keep it under 2 MB", code: "too_big" }, 413);

  const parsed = parseCsv(text);
  if (parsed.error) {
    return json({
      error: parsed.error === "unterminated quote"
        ? "the file has an unclosed quote, so its columns can’t be read"
        : "the file has no header line naming the columns",
      code: "bad_csv",
    }, 400);
  }
  const writable = columnDefs(def).filter((c) => !isManagedColumn(c.name));
  const plan = importPlan(writable, parsed);
  if (!plan.columns.length) {
    return json({
      error: "none of the file’s columns match this table — the first line has to name them",
      code: "no_columns", columns: writable.map((c) => c.name), headers: parsed.headers,
    }, 400);
  }

  const tn = deps.ident(def.name);
  const cols = plan.columns.map((c) => c.name);
  const colList = "(" + cols.map(deps.ident).join(",") + ")";
  const tuple = "(" + cols.map(() => "?").join(",") + ")";
  const insert = (rows) => deps.exec(db,
    "INSERT INTO " + tn + " " + colList + " VALUES " + rows.map(() => tuple).join(","),
    rows.flatMap((r) => r.values));

  let kept = 0, stopped = null;
  const problems = plan.skipped.slice();
  for (let i = 0; i < plan.rows.length && !stopped; i += IMPORT_BATCH) {
    const batch = plan.rows.slice(i, i + IMPORT_BATCH);
    try { await insert(batch); kept += batch.length; continue; }
    catch (e) {
      // Not a constraint — a dropped connection, a missing table — is ours,
      // and stops the import where it is rather than trying 99 more times.
      if (!constraintError(e)) { stopped = batch[0].line; break; }
    }
    for (const row of batch) {
      try { await insert([row]); kept++; }
      catch (e) {
        const known = constraintError(e);
        if (!known) { stopped = row.line; break; }
        problems.push({ line: row.line, reason: known.body.error });
      }
    }
  }
  if (stopped) console.error("owner import stopped:", slug, def.name, "line", stopped);
  problems.sort((a, b) => a.line - b.line);
  return json({
    ok: !stopped, kept,
    total: plan.rows.length + plan.skipped.length,
    skipped: problems.length, problems: problems.slice(0, 20),
    ignored: plan.ignored, columns: cols, truncated: parsed.truncated,
    ...(stopped ? { stopped, error: "stopped at line " + stopped + " — that didn’t work; the rows before it are in" } : {}),
  });
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

// ── The site's members, on Neon Auth ────────────────────────────────────────
//
// Rebuilt 2026-07-30. The old version read a hand-rolled `_users` table that no
// longer exists; identity is Neon Auth's, and it keeps its people in the SITE's
// own database, so this is still one query on a connection the route already has.
//
// Every reference is SCHEMA-QUALIFIED and `"user"` is quoted, which is load
// bearing rather than tidy: Postgres resolves a bare `user` to the USER value
// function and returns the current ROLE NAME instead of erroring, so an
// unqualified query here would hand the owner a one-row list containing their
// database role and look like a site with exactly one member.
const MEMBER_COLUMNS = ["id", "email", "name", "emailVerified", "role", "banned", "banReason", "banExpires", "createdAt"];

// Named explicitly, never `SELECT *`. There is no password on this table —
// Better Auth keeps credentials in `neon_auth.account`, which this file never
// touches — but the discipline is what stops a column added upstream from
// silently starting to leave the database.
const MEMBER_SELECT = MEMBER_COLUMNS.map((c) => 'u."' + c + '"').join(", ");

const memberView = (r) => ({
  id: r == null ? null : String(r.id),
  email: (r && r.email) || "",
  name: (r && r.name) || "",
  verified: !!(r && r.emailVerified),
  role: String((r && r.role) || "user").toLowerCase(),
  suspended: !!(r && r.banned),
  reason: (r && r.banReason) || null,
  until: (r && r.banExpires) || null,
  created_at: (r && r.createdAt) || null,
});

/**
 * A member id is a UUID here, not the sequential integer it used to be. Checked
 * on the way in because it reaches SQL as a parameter against a `uuid` column —
 * a malformed one is a Postgres type error, which would surface to the owner as
 * a 500 rather than "no such member".
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET    → the site's members
 * PATCH  → set a member's `role`, or suspend / reinstate them
 * DELETE → remove a member
 *
 * Suspension is Better Auth's `banned` column rather than a flag of ours, so the
 * auth server refuses the sign-in as well — a suspension enforced only by our
 * read path would let the member keep a session it had already been given.
 *
 * Deleting a member deliberately LEAVES THEIR ROWS. `owner_id` stops matching
 * anybody, so the rows drop out of every member-scoped read and stay visible to
 * the owner — a cancelled customer's bookings should not silently vanish from the
 * appointment list.
 */
export async function handleOwnerMembers(deps, { slug, uid, method = "GET", memberId, body = {}, params = {} } = {}) {
  const site = await openSite(deps, slug, uid);
  if (site.error) return site.error;
  const { db } = site;

  if (method === "GET") {
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(params.limit, 10) || 100));
    const offset = Math.max(0, parseInt(params.offset, 10) || 0);
    const rows = await deps.query(db,
      "SELECT " + MEMBER_SELECT + ' FROM neon_auth."user" u ORDER BY u."createdAt" DESC NULLS LAST LIMIT ? OFFSET ?',
      [limit, offset]);
    return json({ members: (rows || []).map(memberView) });
  }

  if (!memberId || !UUID_RE.test(String(memberId))) return json({ error: "no such member" }, 404);
  const id = String(memberId);

  if (method === "DELETE") {
    const r = await deps.exec(db, 'DELETE FROM neon_auth."user" WHERE id=?', [id]);
    if (!r.changes) return json({ error: "no such member" }, 404);
    return json({ ok: true, id });
  }

  if (method === "PATCH") {
    const cols = [], vals = [];
    // A role is allow-listed against what THIS site's tables actually check. An
    // owner inventing a role no table names has granted a permission nothing can
    // ever test — it reads as "I gave them access" and does nothing at all.
    if ("role" in body) {
      const spec = await deps.loadSchema(db);
      const allowed = new Set(["user", "admin"]);
      for (const t of declaredTables(spec)) {
        for (const r of (Array.isArray(t.writeRoles) ? t.writeRoles : [])) allowed.add(String(r).toLowerCase());
      }
      // A string, not anything stringifiable: String(7) is "7", which passes a
      // shape test and would make a number a role.
      if (typeof body.role !== "string") return json({ error: "that is not a role" }, 400);
      const role = body.role.toLowerCase();
      if (!allowed.has(role)) {
        return json({ error: "no table on this site checks that role", roles: [...allowed].sort() }, 400);
      }
      cols.push('role=?'); vals.push(role);
    }
    // A real boolean. `suspended: "false"` would suspend the member the owner was
    // reinstating.
    if ("suspended" in body) {
      if (typeof body.suspended !== "boolean") return json({ error: "suspended must be true or false" }, 400);
      cols.push('banned=?'); vals.push(body.suspended);
      // Reinstating clears the reason and the expiry as well, or a lapsed ban's
      // text stays attached to a live account and reads as still-suspended.
      cols.push('"banReason"=?'); vals.push(body.suspended ? String(body.reason || "").slice(0, 200) || null : null);
      cols.push('"banExpires"=?'); vals.push(null);
    }
    if (!cols.length) return json({ error: "nothing to change" }, 400);

    const r = await deps.exec(db, 'UPDATE neon_auth."user" SET ' + cols.join(", ") + " WHERE id=?", vals.concat([id]));
    if (!r.changes) return json({ error: "no such member" }, 404);
    const back = await deps.query(db, "SELECT " + MEMBER_SELECT + ' FROM neon_auth."user" u WHERE u.id=?', [id]);
    return json({ ok: true, member: memberView(back[0]) });
  }

  return json({ error: "method not allowed" }, 405);
}
