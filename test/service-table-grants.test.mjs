// TRUNCATE is not subject to RLS, so it is the one privilege a service-only
// table can hold and still be emptied by a stranger.
//
// Every table in this migration has RLS enabled, and most have no policies at
// all — so no row is readable or writable by `anon`/`authenticated`. That says
// nothing about TRUNCATE, which is a TABLE-level privilege evaluated before any
// policy is consulted and which empties the table wholesale. Supabase grants ALL
// on `public` to both roles by project default, so all six picked it up at
// creation and none of them chose it.
//
// WHAT THIS FILE CAN AND CANNOT DO. It cannot query Supabase — the unit suite
// runs offline and holds no service key — so it asserts the properties of the
// migration that is the record of the change. The live state is verified with a
// real query at apply time; this is what stops the file being widened later into
// something that breaks the product.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const DIR = new URL("../supabase/applied/", import.meta.url);
const FILE = new URL("20260816034500_revoke_truncate_on_service_tables.sql", DIR);
const sql = fs.readFileSync(FILE, "utf8");
// Comments blanked LINE-WISE and length-preserving, because this file explains
// at length what it does NOT revoke — so prose naming `REVOKE ALL` and `SELECT`
// would be read as statements by every assertion below. The failure that costs
// most here is a scan that reports a clean file.
const code = sql.replace(/^([ \t]*)--.*$/gm, (s) => " ".repeat(s.length));

/** Every table the migration actually names, read out of it. */
const named = [...code.matchAll(/on\s+public\.([a-z_]+)\s+from/gi)].map((m) => m[1]);

/** The tables this migration is responsible for. */
const TABLES = [
  "site_project",        // Neon connection strings, per site. RLS on, no policies.
  "user_site_project",   // the per-user Neon project record. RLS on, no policies.
  "site_backends",       // the site registry. Has an "own read" SELECT policy.
  "site_functions",      // scheduled jobs. Has owner SELECT and owner DELETE policies.
  "neon_teardown",       // the queue that stops deleted projects billing for ever.
  "webhook_queue",       // pending outbound deliveries, across every site.
];

test("every service-only table has TRUNCATE revoked from BOTH roles", () => {
  for (const t of TABLES) {
    const line = code.split("\n").find((l) => new RegExp(`\\bpublic\\.${t}\\b`).test(l));
    assert.ok(line, `${t} is not named in the migration`);
    assert.match(line, /^\s*revoke\s+truncate\b/i, `${t} must have TRUNCATE revoked: ${line.trim()}`);
    // BOTH, and asserted separately. `from anon` alone leaves every signed-in
    // account able to empty the table, which is the larger of the two groups.
    assert.match(line, /\banon\b/, `${t} must revoke from anon`);
    assert.match(line, /\bauthenticated\b/, `${t} must revoke from authenticated`);
  }
});

test("ONLY TRUNCATE is revoked — a wider sweep breaks the product", () => {
  // THE RESTRAINT IS THE POINT, not caution. `site_backends` has an "own read"
  // policy and `site_functions` has owner SELECT and owner DELETE — and RLS
  // decides WHICH rows while the grant decides whether the role may ask at all,
  // so removing the grant makes a policy that permits the row moot. A tidier
  // `REVOKE ALL` here would leave both policies enforcing nothing, and the
  // symptom is a signed-in owner who can no longer see their own sites.
  const statements = code.split(";").map((s) => s.trim()).filter(Boolean);
  assert.ok(statements.length >= TABLES.length, "the migration must still contain its statements");
  for (const s of statements) {
    assert.match(s, /^revoke\s+truncate\s+on\s+public\.[a-z_]+\s+from\s+/i,
      "every statement must be a bare TRUNCATE revoke:\n  " + s.replace(/\s+/g, " ").slice(0, 160));
  }
  // Said as an absence too, because the assertion above passes on an empty file
  // and these are the exact spellings that would undo the policies above.
  assert.ok(!/revoke\s+all\b/i.test(code), "REVOKE ALL would take the reads the product depends on");
  for (const priv of ["select", "insert", "update", "delete", "references", "trigger"]) {
    assert.ok(!new RegExp(`revoke[^;]*\\b${priv}\\b`, "i").test(code),
      `this migration must not revoke ${priv.toUpperCase()}`);
  }
});

test("no table the browser reads directly is in this migration", () => {
  // DERIVED, and it is the half that encodes "do not revoke what the app needs"
  // as a fact rather than a promise. `public/` talks to PostgREST directly for a
  // few tables using the caller's own token; those depend on their grants, so
  // one appearing here would be a client feature about to break silently.
  const seen = new Set();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!/\.(js|html)$/.test(e.name)) continue;
      for (const m of fs.readFileSync(p, "utf8").matchAll(/rest\/v1\/([a-z_]+)/g)) seen.add(m[1]);
    }
  };
  walk(new URL("../public/", import.meta.url).pathname);
  seen.delete("rpc");   // a function call, not a table
  assert.ok(seen.size >= 2,
    "the scan must still find the client's tables — it found " + seen.size + ", and a scan that stops matching reports a clean file");

  // READ OUT OF THE FILE, not off the list above, and the first draft was the
  // other way round: it iterated `TABLES`, so a seventh line added to the
  // migration for a table the browser really does read would have passed
  // untouched — the guard watching the layer below the break, which is exactly
  // the shape it exists to catch.
  assert.ok(named.length >= TABLES.length, "the parse must still see the migration's tables: " + named.join(", "));
  for (const t of named) {
    assert.ok(!seen.has(t),
      t + " is read by the browser directly, so its grants are load-bearing and it does not belong in this migration");
  }
  // And the set we meant is the set that is there — a table quietly dropped
  // from the file is a service-only table left holding TRUNCATE.
  for (const t of TABLES) assert.ok(named.includes(t), t + " is not named in the migration");
});

test("the applied folder is not the CLI's migrations folder", () => {
  // The remote history holds ~84 migrations that were never committed. A
  // `supabase/migrations/` folder holding a handful of files is one the Supabase
  // CLI treats as the WHOLE history, so `db push` and `db reset` would work from
  // something missing most of it. A folder the CLI does not look at cannot
  // mislead it — and the reason has to be written down, or somebody tidies this
  // into the conventional place.
  assert.ok(fs.existsSync(new URL("README.md", DIR)), "the folder must explain itself");
  assert.ok(!fs.existsSync(new URL("../supabase/migrations/", import.meta.url).pathname),
    "if a migrations/ folder is ever added it must hold the FULL history, and this guard should be revisited deliberately");
  assert.match(path.basename(FILE.pathname), /^\d{14}_/,
    "named by its remote version, so a file here can be lined up against the remote history");
});
