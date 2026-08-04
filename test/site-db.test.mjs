// Unit tests for the Neon site-database layer.
// Pure functions only — no network, no database. Run: node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  toPgPlaceholders,
  pgParams,
  dbNameForSite,
  projectNameForUser,
  connForDatabase,
  scrubSecrets,
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

// ------------------------------------------------------- provisioning errors
//
// A build that cannot provision used to answer `detail: "{}"` and nothing else.
// Measured live 2026-08-04: build smoke failed that way and the cause could not
// be recovered from the response, the log, or anywhere else — a dead key, a plan
// limit, a project quota and a Neon outage all produce that same empty object,
// and each needs a completely different fix. Same shape as the `upstream: 400`
// incident one layer up.

test("a connection string never survives into an error", () => {
  // A Neon error can echo the parameters it was handed, and those carry a
  // PASSWORD. The scrub is what stands between that and a 502 body.
  const leaked = 'failed for postgres://neondb_owner:npg_S3cr3tPw@ep-x.aws.neon.tech/db?sslmode=require';
  const clean = scrubSecrets(leaked);
  assert.ok(!/npg_S3cr3tPw/.test(clean), "the password must not survive");
  assert.ok(!/neondb_owner/.test(clean), "nor the role it belongs to");
  assert.match(clean, /\[redacted\]/);
  assert.match(clean, /^failed for /, "and the rest of the message is kept");
});

test("it scrubs postgresql:// too, and every occurrence", () => {
  const two = scrubSecrets("a postgresql://u:p@h/d and postgres://u2:p2@h2/d2 b");
  assert.ok(!/:p@|:p2@/.test(two), two);
  assert.equal((two.match(/\[redacted\]/g) || []).length, 2);
});

test("text that is not a URI is left alone", () => {
  // Over-scrubbing would destroy the message this exists to preserve.
  const msg = "project quota exceeded: 100 of 100 projects on this plan";
  assert.equal(scrubSecrets(msg), msg);
});

test("the neon fetch keeps a non-JSON body instead of reporting {}", () => {
  // Asserted on the SOURCE: neonApi is network-bound and the invariant is about
  // which parser runs first. `r.json().catch(() => ({}))` is the exact line that
  // turned an HTML gateway page into an empty object, so it must not come back.
  const src = fs.readFileSync(new URL("../site-db.mjs", import.meta.url), "utf8");
  // COMMENTS BLANKED, NOT REMOVED — the comment above the fix QUOTES the bad
  // pattern in order to explain it, so a raw scan reports the explanation as the
  // defect. (Blanking rather than deleting keeps every offset valid, which is
  // the rule this repo arrived at after three separate off-by-region bugs.)
  const blanked = src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) => m.replace(/[^\n]/g, " "));
  const fn = blanked.slice(blanked.indexOf("async function neonApi"), blanked.indexOf("export function scrubSecrets"));
  assert.ok(fn.length > 200, "the guard must actually be looking at the function");
  assert.ok(!/\.json\(\)\s*\.catch/.test(fn),
    "reading the body as JSON-or-{} discards every non-JSON error Neon can send");
  assert.match(fn, /await r\.text\(\)/, "the body has to be read as text first");
  assert.match(fn, /e\.status = r\.status/, "and the status carried, since it is the whole diagnosis");
});

test("the build route returns the upstream status, not just a sentence", () => {
  const src = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
  const i = src.indexOf('"could not provision the database"');
  assert.ok(i > 0, "the provisioning failure branch must still exist");
  const branch = src.slice(i - 400, i + 400);
  assert.match(branch, /upstream:\s*\(e && e\.status\)/, "a 401, a 403 and a 500 are indistinguishable without it");
  assert.match(branch, /scrubSecrets\(/, "and the detail is scrubbed before it leaves the Worker");
});
