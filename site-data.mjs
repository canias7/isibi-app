// The data API a generated site talks to.
//
//   GET    /api/db/<slug>/rows/<table>          list
//   POST   /api/db/<slug>/rows/<table>          create
//   PATCH  /api/db/<slug>/rows/<table>/<id>     update
//   DELETE /api/db/<slug>/rows/<table>/<id>     delete
//
// One generic handler for every site, driven entirely by that site's declared
// schema — the old per-feature route sprawl is what made this 20k lines before.
//
// SECURITY. These endpoints are unauthenticated: anyone who can load a published
// site can call them. Everything is therefore an allow-list read from the site's
// own `_meta.schema`, never from the request:
//   - the table must be declared, and its declared access level must permit the
//     operation. The engine's levels (see site-schema.mjs) are:
//       collect  anyone INSERTs; nobody reads publicly (owner reads in-app)
//       display  anyone READs; no public writes (owner-managed content)
//       user     site login; each visitor sees only THEIR rows
//       feed     anyone READs; a logged-in visitor writes their own
//       admin    anyone READs; only an admin site-user WRITES
//     Anything needing a site login is refused until visitor accounts exist —
//     serving those rows would hand every visitor everyone else's data.
//   - only declared columns can be written or filtered on; managed columns are
//     never writable.
//   - identifiers reach SQL only via sqlIdent(); values only as bound params.
import { sqlQuery, sqlExec } from "./site-db.mjs";
import { loadSiteSchema, sqlIdent } from "./site-schema.mjs";
// The permission rules live in their own leaf module because the page generator
// has to predict them to lint a page before it is published, and restating them
// in both places is how they drifted.
import { isManagedColumn, canReadAccess, canWriteAccess, needsMember } from "./site-access.mjs";
import { limitFor, bucketKey, tooMany } from "./rate-limit.mjs";

const MAX_LIMIT = 100;
const MAX_BODY_KEYS = 60;

const json = (body, status, headers) => Response.json(body, { status: status || 200, headers });

function tableFor(spec, name) {
  const want = String(name || "").toLowerCase();
  return (spec.tables || []).find((t) => t && String(t.name).toLowerCase() === want) || null;
}

function columnNames(def) {
  return (def.columns || [])
    .map((c) => (typeof c === "string" ? c : c && c.name))
    .filter(Boolean)
    .map(String);
}

// Columns an app may write: declared, not managed.
function writableColumns(def) {
  return columnNames(def).filter((c) => !isManagedColumn(c));
}

// Values are bound; this only decides WHICH columns are addressed.
function pickWritable(def, body) {
  const allowed = new Set(writableColumns(def).map((c) => c.toLowerCase()));
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

// ?status=confirmed&date=2026-07-28 → equality filters on declared columns only.
// Unknown keys are ignored rather than rejected so a stray UTM parameter on a
// link cannot 400 the whole page.
function buildFilter(def, params) {
  const allowed = new Set(columnNames(def).map((c) => c.toLowerCase()));
  const parts = [], vals = [];
  for (const [k, v] of params) {
    if (["limit", "offset", "order", "dir", "q"].includes(k)) continue;
    if (!allowed.has(String(k).toLowerCase())) continue;
    parts.push(sqlIdent(k) + "=?");
    vals.push(v);
  }
  return { sql: parts.length ? " WHERE " + parts.join(" AND ") : "", vals };
}

// The database functions are injected so tests can drive the real handler
// against a fake database. Production passes nothing and gets the real ones.
const REAL = { sqlQuery, sqlExec, loadSiteSchema };

export async function handleSiteData(env, request, url, resolveDb, deps) {
  const { sqlQuery, sqlExec, loadSiteSchema } = deps || REAL;
  const m = url.pathname.match(/^\/api\/db\/([a-z0-9][a-z0-9-]{0,80})\/rows\/([a-z_][a-z0-9_]{0,40})(?:\/(\d+))?$/i);
  if (!m) return null;
  const [, slug, tableName, rowId] = m;

  const db = await resolveDb(env, slug.toLowerCase());
  if (!db) return json({ error: "no such site" }, 404);

  const spec = await loadSiteSchema(db);
  const def = tableFor(spec, tableName);
  if (!def) return json({ error: "no such table" }, 404);

  // Throttle here: late enough to know the table's own declared `rateLimit`,
  // early enough that a flood pays for none of what follows — resolving a
  // visitor costs a database read, and the query itself costs a Neon one.
  if (deps.rateLimit) {
    const limit = limitFor({ spec, def, method: request.method });
    // CF-Connecting-IP ONLY. X-Forwarded-For is a request header like any other
    // — a caller who sets a different one per request would mint a fresh bucket
    // each time and walk straight through this. Cloudflare sets CF-Connecting-IP
    // itself and overwrites whatever the client sent. With no header at all
    // (local, tests) everyone shares the "unknown" bucket, which is the safe
    // direction to fail.
    const key = bucketKey({
      ip: request.headers.get("CF-Connecting-IP") || "",
      slug, table: def.name, method: request.method,
    });
    const verdict = deps.rateLimit(key, limit);
    if (verdict && !verdict.ok) {
      const t = tooMany(verdict);
      return json(t.body, t.status, t.headers);
    }
  }

  // Per-level gate.
  //
  // `collect` is deliberately write-only: a booking form must submit, and must
  // NOT let a visitor read back other people's submissions. `display` is the
  // mirror. The other three need to know WHO is asking, which is what
  // resolveVisitor answers — before visitor accounts existed they were simply
  // refused, which is why half the schema engine was unreachable.
  const access = String(def.access || "collect").toLowerCase();
  const method = request.method;
  const scoped = access === "user" || access === "feed"; // rows belong to a member
  const needsVisitor = needsMember(access);
  const visitor = needsVisitor && deps.resolveVisitor ? await deps.resolveVisitor(request, slug) : null;

  if (needsVisitor && !visitor) {
    return json({ error: "sign in to use this", access, code: "auth" }, 401);
  }

  if (method === "GET") {
    // `user` is the private one: a member sees their own rows and no others.
    // `feed` and `admin` are readable to anyone who is signed in.
    if (!canReadAccess(access) && !needsVisitor) {
      return json({ error: "that table is not readable", access }, 403);
    }
  } else if (!canWriteAccess(access) && !needsVisitor) {
    return json({ error: "that table is not writable here", access }, 403);
  }

  // An `admin` table is a shared CMS: everyone signed in may read it, only the
  // declared roles may write. `writeRoles` is per-table and `admin` always can.
  if (access === "admin" && method !== "GET") {
    const allowed = ["admin"].concat(Array.isArray(def.writeRoles) ? def.writeRoles : []);
    if (!allowed.includes(String((visitor && visitor.role) || "user").toLowerCase())) {
      return json({ error: "you do not have permission to change this", access, code: "role" }, 403);
    }
  }

  // Editing and removing.
  //
  // Answered 2026-07-28, and the answer is the only safe one: a member may touch
  // the rows they OWN, and nothing else. Ids are sequential integers, so scoping
  // by id alone — which is all these handlers used to do — means member A edits
  // member B's row by guessing a number. `collect` and `display` have no owner at
  // all and stay refused.
  if (method === "PATCH" || method === "DELETE") {
    if (!needsVisitor) return json({ error: "that table is submit-only", access }, 403);
  }
  // Rows a member owns are theirs to change; an `admin` table has no owner and is
  // governed by the role check above instead.
  const ownScoped = scoped ? ' AND "owner_id"=?' : "";
  const ownParam = scoped ? [visitor.id] : [];

  const tn = sqlIdent(def.name);
  const cols = columnNames(def);

  try {
    if (request.method === "GET") {
      const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10) || 50));
      const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10) || 0);
      // Ordering is a column NAME in SQL, so it must be allow-listed, not bound.
      const asked = String(url.searchParams.get("order") || "id");
      const order = cols.includes(asked) || asked === "id" ? asked : "id";
      const dir = String(url.searchParams.get("dir") || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
      const f = buildFilter(def, url.searchParams);

      let sql = "SELECT * FROM " + tn + f.sql;
      const vals = f.vals.slice();
      // The `user` level means private-per-member. Appended to the caller's
      // filters rather than replacing them, so no query string can widen it.
      if (access === "user") {
        sql += (f.sql ? " AND " : " WHERE ") + '"owner_id"=?';
        vals.push(visitor.id);
      }
      // Full-text search, when the table declared it.
      const q = (url.searchParams.get("q") || "").trim();
      if (q && def.fts) {
        sql += (f.sql ? " AND " : " WHERE ") + '"_fts" @@ websearch_to_tsquery(\'english\', ?)';
        vals.push(q);
      }
      if (def.trash) sql += (sql.includes("WHERE") ? " AND " : " WHERE ") + '"deleted_at" IS NULL';
      sql += " ORDER BY " + sqlIdent(order) + " " + dir + " LIMIT ? OFFSET ?";
      vals.push(limit, offset);

      const rows = await sqlQuery(db, sql, vals);
      // `_fts` is a generated tsvector — the search index, not data. SELECT *
      // returns it, so an fts table was shipping its whole search vector to
      // every visitor on every read: meaningless to a client, often as large as
      // the text it was built from, and an internal column in a public API.
      //
      // Stripped here rather than swapped for an explicit column list: the list
      // would have to enumerate every managed column the platform might add
      // (position, _version, pinned, expires_at, …) and silently drop any it
      // forgot, which is a worse failure than one wasted column on the internal
      // Neon hop.
      for (const r of rows) if (r && r._fts !== undefined) delete r._fts;
      return json({ rows, limit, offset });
    }

    if (request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const { cols: wc, vals } = pickWritable(def, body);
      // owner_id is stamped from the VERIFIED session, never taken from the body
      // — pickWritable already drops it as a managed column, so a sender cannot
      // claim to be someone else. Added after that, so the order matters.
      if (scoped) { wc.push("owner_id"); vals.push(visitor.id); }
      if (!wc.length) return json({ error: "nothing to write" }, 400);
      const rows = await sqlQuery(
        db,
        "INSERT INTO " + tn + " (" + wc.map(sqlIdent).join(",") + ") VALUES (" +
          wc.map(() => "?").join(",") + ") RETURNING *",
        vals,
      );
      return json({ row: rows[0] || null }, 201);
    }

    if (request.method === "PATCH") {
      if (!rowId) return json({ error: "no row id" }, 400);
      const body = await request.json().catch(() => ({}));
      const { cols: wc, vals } = pickWritable(def, body);
      if (!wc.length) return json({ error: "nothing to update" }, 400);
      const r = await sqlExec(
        db,
        "UPDATE " + tn + " SET " + wc.map((c) => sqlIdent(c) + "=?").join(",") + " WHERE id=?" + ownScoped,
        vals.concat([rowId], ownParam),
      );
      // 404, not 403, when the row is somebody else's. A 403 would confirm the
      // row exists and belongs to another member, which is an enumeration oracle
      // over sequential ids.
      if (!r.changes) return json({ error: "no such row" }, 404);
      const rows = await sqlQuery(db, "SELECT * FROM " + tn + " WHERE id=?" + ownScoped, [rowId].concat(ownParam));
      return json({ row: rows[0] || null });
    }

    if (request.method === "DELETE") {
      if (!rowId) return json({ error: "no row id" }, 400);
      // A table declaring `trash` soft-deletes, so a mistake is recoverable.
      const r = def.trash
        ? await sqlExec(db, "UPDATE " + tn + ' SET "deleted_at"=to_char(now() AT TIME ZONE \'UTC\',\'YYYY-MM-DD HH24:MI:SS\') WHERE id=? AND "deleted_at" IS NULL' + ownScoped, [rowId].concat(ownParam))
        : await sqlExec(db, "DELETE FROM " + tn + " WHERE id=?" + ownScoped, [rowId].concat(ownParam));
      if (!r.changes) return json({ error: "no such row" }, 404);
      return json({ ok: true });
    }

    return json({ error: "method not allowed" }, 405);
  } catch (e) {
    // A constraint doing its job (duplicate, overlap, missing parent, row cap)
    // is the caller's problem to fix, not a server fault.
    const msg = String((e && (e.message || e.detail)) || "");
    if (/duplicate key|unique constraint/i.test(msg)) return json({ error: "that already exists", code: "duplicate" }, 409);
    if (/missing parent/i.test(msg)) return json({ error: "that refers to something that doesn't exist", code: "bad_ref" }, 400);
    if (/row limit reached/i.test(msg)) return json({ error: "no more room", code: "full" }, 409);
    // EXCLUDE USING gist refusing an overlapping interval — a double booking.
    if (/conflicting key value violates exclusion constraint|_nooverlap/i.test(msg)) {
      return json({ error: "that time is already taken", code: "overlap" }, 409);
    }
    // A required field left out is the sender's mistake, not a server fault.
    // Name the column so a form can point at the field instead of just failing.
    const notNull = msg.match(/null value in column "([^"]+)"/i);
    if (notNull) {
      return json({ error: notNull[1].replace(/_/g, " ") + " is required", code: "required", field: notNull[1] }, 400);
    }
    if (/violates check constraint|invalid input syntax|out of range/i.test(msg)) {
      return json({ error: "some of that isn't valid", code: "invalid" }, 400);
    }
    console.error("site data error:", slug, tableName, msg.slice(0, 200));
    return json({ error: "that didn't work" }, 500);
  }
}
