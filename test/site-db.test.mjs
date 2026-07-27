// Unit tests for the Neon site-database layer.
// Pure functions only — no network, no database. Run: node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toPgPlaceholders,
  pgParams,
  dbNameForSite,
  projectNameForUser,
  connForDatabase,
} from "../site-db.mjs";

// ------------------------------------------------------------ placeholders

test("numbers placeholders in order", () => {
  assert.equal(
    toPgPlaceholders("SELECT * FROM t WHERE a=? AND b=? LIMIT ?"),
    "SELECT * FROM t WHERE a=$1 AND b=$2 LIMIT $3",
  );
});

test("leaves a ? inside a string literal alone", () => {
  assert.equal(
    toPgPlaceholders("SELECT * FROM t WHERE label='what?' AND id=?"),
    "SELECT * FROM t WHERE label='what?' AND id=$1",
  );
});

test("handles '' escapes inside a literal", () => {
  // the '' is an escaped quote, so the ? after it is still inside the literal
  assert.equal(
    toPgPlaceholders("SELECT 'it''s a ? here', ? FROM t"),
    "SELECT 'it''s a ? here', $1 FROM t",
  );
});

test("leaves a ? inside a quoted identifier alone", () => {
  assert.equal(
    toPgPlaceholders('SELECT "we?rd" FROM t WHERE id=?'),
    'SELECT "we?rd" FROM t WHERE id=$1',
  );
});

test("handles \"\" escapes inside an identifier", () => {
  assert.equal(
    toPgPlaceholders('SELECT "a""?b" FROM t WHERE id=?'),
    'SELECT "a""?b" FROM t WHERE id=$1',
  );
});

test("leaves a ? inside a line comment alone", () => {
  assert.equal(
    toPgPlaceholders("SELECT 1 -- why? because\nWHERE id=?"),
    "SELECT 1 -- why? because\nWHERE id=$1",
  );
});

test("leaves a ? inside a block comment alone", () => {
  assert.equal(
    toPgPlaceholders("SELECT /* huh? */ 1 WHERE id=?"),
    "SELECT /* huh? */ 1 WHERE id=$1",
  );
});

test("an unterminated literal swallows the rest (no spurious placeholders)", () => {
  // malformed SQL should fail in Postgres, not silently gain a parameter
  assert.equal(toPgPlaceholders("SELECT 'oops ? "), "SELECT 'oops ? ");
});

test("no placeholders is a no-op", () => {
  const sql = "CREATE TABLE IF NOT EXISTS t (id INTEGER PRIMARY KEY)";
  assert.equal(toPgPlaceholders(sql), sql);
});

test("real statements from the site runtime", () => {
  assert.equal(
    toPgPlaceholders(
      'INSERT OR IGNORE INTO _bookmarks (user_id,target,created_at) VALUES (?,?,?)',
    ),
    'INSERT OR IGNORE INTO _bookmarks (user_id,target,created_at) VALUES ($1,$2,$3)',
  );
  assert.equal(
    toPgPlaceholders('SELECT 1 FROM _bookmarks WHERE user_id=? AND target=?'),
    'SELECT 1 FROM _bookmarks WHERE user_id=$1 AND target=$2',
  );
  assert.equal(
    toPgPlaceholders('SELECT id FROM "posts" WHERE id=? AND owner_id=?'),
    'SELECT id FROM "posts" WHERE id=$1 AND owner_id=$2',
  );
});

// ----------------------------------------------------------------- params

test("coerces booleans to 1/0 and undefined to null", () => {
  assert.deepEqual(pgParams([true, false, undefined, null, 0, "x"]), [1, 0, null, null, 0, "x"]);
});

test("empty and missing params are an empty array", () => {
  assert.deepEqual(pgParams([]), []);
  assert.deepEqual(pgParams(null), []);
  assert.deepEqual(pgParams(undefined), []);
});

// ------------------------------------------------------------------ names

test("site slug becomes a safe database identifier", () => {
  assert.equal(dbNameForSite("my-restaurant"), "site_my_restaurant");
  assert.equal(dbNameForSite("Already_Fine"), "site_already_fine");
  assert.equal(dbNameForSite("--weird--slug--"), "site_weird_slug");
});

test("database identifiers stay within Postgres's 63-char limit", () => {
  assert.ok(dbNameForSite("x".repeat(200)).length <= 63);
});

test("a slug with nothing usable in it is rejected, not silently coerced", () => {
  assert.throws(() => dbNameForSite("---"), /bad site slug/);
  assert.throws(() => dbNameForSite(""), /bad site slug/);
  assert.throws(() => dbNameForSite(null), /bad site slug/);
});

test("a slug cannot inject SQL through the database name", () => {
  assert.equal(dbNameForSite('a"; DROP DATABASE x; --'), "site_a_drop_database_x");
});

test("project name is derived from the user id", () => {
  assert.equal(projectNameForUser("abc123"), "isibi-user-abc123");
});

// ------------------------------------------------------------ connections

test("swaps the database in a connection URI, keeping host/role/password", () => {
  const base = "postgresql://neondb_owner:secret@ep-cool-1.us-east-1.aws.neon.tech/neondb?sslmode=require";
  const out = connForDatabase(base, "site_my_restaurant");
  assert.ok(out.startsWith("postgresql://neondb_owner:secret@ep-cool-1.us-east-1.aws.neon.tech/site_my_restaurant"));
  assert.ok(out.includes("sslmode=require"));
});
