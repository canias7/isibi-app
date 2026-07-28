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

const json = (body, status = 200) => ({ status, body });

const MAX_LIMIT = 200;

/**
 * deps:
 *   ownerOf(slug)           → uid | null      who owns this site (throws if unknown)
 *   dbFor(slug)             → conn | null
 *   loadSchema(conn)        → { tables }
 *   query(conn, sql, args)  → rows
 */
export async function handleOwnerData(deps, { slug, table, uid, params = {} } = {}) {
  if (!uid) return json({ error: "sign in" }, 401);

  // Fails CLOSED. An unreadable ownership record must not become "anyone may
  // read this site's submissions" — the same mistake the build route made with
  // `catch {}`, which let one Supabase timeout hand a site to a stranger.
  let owner;
  try { owner = await deps.ownerOf(slug); }
  catch { return json({ error: "couldn't check that site just now — try again in a moment" }, 503); }

  // 404 rather than 403 for a site that is not yours: the slug space is public
  // and guessable, and 403 would confirm which names are taken by someone.
  if (!owner || owner !== uid) return json({ error: "no such site" }, 404);

  const db = await deps.dbFor(slug);
  if (!db) return json({ error: "no such site" }, 404);

  const spec = await deps.loadSchema(db);
  const def = (spec && Array.isArray(spec.tables) ? spec.tables : [])
    .find((t) => t && String(t.name).toLowerCase() === String(table || "").toLowerCase());
  // Only tables the site actually declared. The name reaches SQL, so this is
  // also what keeps it an allow-list rather than an identifier from a stranger.
  if (!def) return json({ error: "no such table" }, 404);

  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(params.limit, 10) || 50));
  const offset = Math.max(0, parseInt(params.offset, 10) || 0);
  const cols = (Array.isArray(def.columns) ? def.columns : [])
    .map((c) => String(typeof c === "string" ? c : (c && c.name) || ""))
    .filter(Boolean);

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
  if (!uid) return json({ error: "sign in" }, 401);
  let owner;
  try { owner = await deps.ownerOf(slug); }
  catch { return json({ error: "couldn't check that site just now — try again in a moment" }, 503); }
  if (!owner || owner !== uid) return json({ error: "no such site" }, 404);

  const db = await deps.dbFor(slug);
  if (!db) return json({ error: "no such site" }, 404);
  const spec = await deps.loadSchema(db);
  const tables = [];
  for (const t of (spec && Array.isArray(spec.tables) ? spec.tables : [])) {
    if (!t || !t.name) continue;
    let count = null;
    // A missing table is not a failure of the whole listing — a schema row can
    // outlive its table if an apply half-succeeded, and the owner still wants
    // to see everything else.
    try {
      const r = await deps.query(db, `SELECT count(*)::int AS n FROM ${deps.ident(t.name)}`);
      count = (r[0] && r[0].n) ?? null;
    } catch { count = null; }
    tables.push({ name: t.name, access: t.access, rows: count });
  }
  return json({ tables });
}
