// The owner importing a CSV into one table — the route's decisions, driven, and
// the wire from the Data panel to the handler, read.
//
// Same door as `handleOwnerWrite`'s POST, a whole file at a time, under the
// same rules; every refusal that door makes, this one makes for the same
// reason, and the one thing it adds — a bad line costs itself and nothing
// else — is the thing most worth a test.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { handleOwnerImport } from "../site-owner.mjs";
import { IMPORT_BATCH } from "../site-csv.mjs";

const SPEC = {
  tables: [
    { name: "services", access: "display", columns: [{ name: "title", type: "text" }, { name: "price", type: "integer" }, { name: "on_menu", type: "boolean" }] },
    { name: "posts", access: "feed", columns: [{ name: "body" }] },
    { name: "mine", read: "own", write: "own", columns: [{ name: "note" }] },
    // A model sometimes DECLARES the engine's own columns. They are in the
    // stored spec then, and the import must still refuse to write them.
    { name: "orders", access: "display", columns: [{ name: "id", type: "integer" }, { name: "created_at" }, { name: "owner_id" }, { name: "item" }] },
  ],
};

function harness(over = {}) {
  const seen = [];
  const deps = {
    ownerOf: async () => "owner-1",
    dbFor: async () => "postgres://conn",
    loadSchema: async () => SPEC,
    exec: async (_db, sql, args) => { seen.push({ sql, args }); return { changes: (sql.match(/\(\?/g) || []).length }; },
    ident: (n) => '"' + n + '"',
    ...over,
  };
  return { deps, seen };
}
const imp = (deps, o = {}) => handleOwnerImport(deps, { slug: "cafe", table: "services", uid: "owner-1", ...o });

test("a file becomes ONE multi-row INSERT with the matched columns, and the reply counts it", async () => {
  const { deps, seen } = harness();
  const r = await imp(deps, { text: "Title,Price,Notes\nCut,25,walk-in\nShave,18,\n" });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.kept, 2);
  assert.equal(r.body.total, 2);
  assert.deepEqual(r.body.columns, ["title", "price"]);
  assert.deepEqual(r.body.ignored, ["Notes"]);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].sql, 'INSERT INTO "services" ("title","price") VALUES (?,?),(?,?)');
  assert.deepEqual(seen[0].args, ["Cut", 25, "Shave", 18]);
});

test("rows go in a hundred at a time", async () => {
  const { deps, seen } = harness();
  const lines = ["title,price"];
  for (let i = 0; i < 250; i++) lines.push(`Item ${i},${i}`);
  const r = await imp(deps, { text: lines.join("\n") });
  assert.equal(r.body.kept, 250);
  assert.deepEqual(seen.map((s) => (s.sql.match(/\(\?,\?\)/g) || []).length), [IMPORT_BATCH, IMPORT_BATCH, 50]);
});

test("a batch Postgres refuses is retried a row at a time, and the bad line names itself", async () => {
  // The whole point of the per-row fallback: one duplicate in a hundred costs
  // one row, not a hundred, and the owner is told WHICH line.
  const { deps, seen } = harness({
    exec: async (_db, sql, args) => {
      seen.push({ sql, args });
      if (args.includes("Shave")) throw new Error('duplicate key value violates unique constraint "services_title_key"');
      return { changes: 1 };
    },
  });
  const r = await imp(deps, { text: "title,price\nCut,25\nShave,18\nBeard,12" });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
  assert.equal(r.body.kept, 2);
  assert.deepEqual(r.body.problems, [{ line: 3, reason: "that already exists" }]);
  assert.equal(r.body.skipped, 1);
  // The batch, then each of its three rows on its own.
  assert.equal(seen.length, 4);
  assert.equal((seen[0].sql.match(/\(\?,\?\)/g) || []).length, 3);
  for (const s of seen.slice(1)) assert.equal((s.sql.match(/\(\?,\?\)/g) || []).length, 1);
});

test("a cell the column cannot take is skipped BEFORE any INSERT, by line, and the rest go in", async () => {
  const { deps, seen } = harness();
  const r = await imp(deps, { text: "title,price,on_menu\nCut,25,yes\nShave,eighteen,no\nBeard,12,maybe\nTrim,9,y" });
  assert.equal(r.body.kept, 2);
  assert.deepEqual(r.body.problems, [
    { line: 3, reason: "price is not a whole number" },
    { line: 4, reason: "on_menu is not yes or no" },
  ]);
  assert.equal(r.body.total, 4, "total counts the skipped rows too");
  assert.deepEqual(seen[0].args, ["Cut", 25, true, "Trim", 9, true]);
});

test("a failure that is NOT a constraint stops the import where it is and says so", async () => {
  // A dropped connection halfway through a file must not become ninety-nine
  // more attempts, and the reply must say where it stopped, because the rows
  // before it are in.
  let n = 0;
  const { deps } = harness({
    exec: async () => { n++; if (n === 2) throw new Error("connection terminated unexpectedly"); return { changes: 100 }; },
  });
  const lines = ["title,price"];
  for (let i = 0; i < 250; i++) lines.push(`Item ${i},${i}`);
  const r = await imp(deps, { text: lines.join("\n") });
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, false);
  assert.equal(r.body.kept, 100);
  assert.equal(r.body.stopped, 102, "the first line of the batch that failed");
  assert.match(r.body.error, /stopped at line 102/);
  assert.equal(n, 2, "and it did not go on to the third batch");
});

// ── the refusals, each the same as the one-row door's ────────────────────────

test("a member-written table is refused BEFORE the file is read — the owner has no member id", async () => {
  const { deps, seen } = harness();
  for (const table of ["posts", "mine"]) {
    const r = await imp(deps, { table, text: "body\nhello" });
    assert.equal(r.status, 409, table);
    assert.equal(r.body.code, "member_table");
  }
  assert.deepEqual(seen, []);
});

test("no such table, no session, someone else's site", async () => {
  const { deps } = harness();
  assert.equal((await imp(deps, { table: "nope", text: "a\n1" })).status, 404);
  assert.equal((await imp(deps, { uid: null, text: "a\n1" })).status, 401);
  const theirs = harness({ ownerOf: async () => "someone-else" });
  assert.equal((await imp(theirs.deps, { text: "title\nCut" })).status, 404);
});

test("an empty file, a huge file, an unreadable file, a file naming no column", async () => {
  const { deps, seen } = harness();
  assert.equal((await imp(deps, { text: "" })).body.code, "empty");
  assert.equal((await imp(deps, { text: "   \n" })).body.code, "empty");
  assert.equal((await imp(deps, { text: undefined })).body.code, "empty");
  const big = await imp(deps, { text: "title\n" + "x".repeat(2 * 1024 * 1024) });
  assert.equal(big.status, 413);
  const bad = await imp(deps, { text: 'title\n"open' });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.code, "bad_csv");
  const none = await imp(deps, { text: "name,cost\nCut,25" });
  assert.equal(none.status, 400);
  assert.equal(none.body.code, "no_columns");
  assert.deepEqual(none.body.columns, ["title", "price", "on_menu"], "and it says which columns the table HAS");
  assert.deepEqual(seen, [], "nothing was written by any of them");
});

test("the engine's own columns are never importable, even when the file names them — and even when the spec DECLARES them", async () => {
  const { deps, seen } = harness();
  const r = await imp(deps, { text: "id,created_at,owner_id,title\n7,2020-01-01,abc,Cut" });
  assert.deepEqual(r.body.columns, ["title"]);
  assert.deepEqual(r.body.ignored, ["id", "created_at", "owner_id"]);
  assert.deepEqual(seen[0].args, ["Cut"]);
  // The case that proves the filter rather than the fixture: `orders` declares
  // id, created_at and owner_id as columns of its own, so a reader that trusts
  // the spec's list would write them — and desynchronise the row from its
  // own index, which is what `pickWritable` refuses for the same reason.
  const r2 = await imp(deps, { table: "orders", text: "id,created_at,owner_id,item\n7,2020-01-01,abc,Cut" });
  assert.deepEqual(r2.body.columns, ["item"]);
  assert.deepEqual(r2.body.ignored, ["id", "created_at", "owner_id"]);
  assert.deepEqual(seen[1].args, ["Cut"]);
});

test("a failure that is NOT a constraint stops the per-row retry too, at the row it hit", async () => {
  // The batch fails on a duplicate (retried per row), and mid-retry the
  // connection drops: the import must stop at THAT row, not try the rest
  // and file the outage as "that didn't work" on every line after it.
  let calls = 0;
  const { deps } = harness({
    exec: async (_db, sql, args) => {
      calls++;
      const tuples = (sql.match(/\(\?,\?\)/g) || []).length;
      if (tuples > 1) throw new Error("duplicate key value violates unique constraint");
      if (args.includes("Beard")) throw new Error("connection terminated unexpectedly");
      return { changes: 1 };
    },
  });
  const r = await imp(deps, { text: "title,price\nCut,25\nShave,18\nBeard,12\nTrim,9" });
  assert.equal(r.body.ok, false);
  assert.equal(r.body.kept, 2, "the two rows before the outage went in");
  assert.equal(r.body.stopped, 4, "the line the outage hit");
  assert.deepEqual(r.body.problems, [], "an outage is not a problem with a line");
  assert.equal(calls, 1 + 3, "the batch, then three rows — Trim was never attempted");
});

// ── the wire ─────────────────────────────────────────────────────────────────

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");
const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../public/styles.css", import.meta.url), "utf8");

test("the route: its own matcher, in the one list, dispatched to the handler with the body's text", () => {
  // `om`'s last segment is a row id, so `/import` needs a matcher of its own;
  // and a matcher that is not in the `if (om || …)` list is a route that
  // cannot be entered — the `dm2` bug, which test/api-auth.test.mjs guards in
  // general and this pins for this one.
  const m = worker.match(/const im = url\.pathname\.match\((\/[^\n]+\/i)\);/);
  assert.ok(m, "the import matcher is gone");
  const re = new RegExp(m[1].slice(1, -2), "i");
  const hit = "/api/site/cafe-1/rows/services/import".match(re);
  assert.ok(hit && hit[1] === "cafe-1" && hit[2] === "services");
  assert.equal("/api/site/cafe-1/rows/services/7".match(re), null, "a row id is not an import");
  assert.equal("/api/site/cafe-1/rows/import".match(re), null, "a table is required");

  assert.match(worker, /if \(om \|\| im \|\| mm \|\|/, "im is not in the dispatch condition");
  assert.match(worker, /const ownerSlug = \(om \|\| im \|\| mm \|\|/, "im is not in the slug list");

  const branch = worker.indexOf("} else if (im) {");
  assert.ok(branch > 0, "no dispatch branch for im");
  const end = worker.indexOf("} else if (request.method === \"GET\") {", branch);
  assert.ok(end > branch, "the GET branch no longer follows");
  const body = worker.slice(branch, end);
  assert.match(body, /request\.method !== "POST"/, "a GET on /import must be 405, not a crash on a null `om`");
  assert.match(body, /cl > MAX_IMPORT_BYTES/, "the size is not refused before the body is read");
  assert.match(body, /handleOwnerImport\(ownerDeps, \{/, "the handler is not called");
  assert.match(body, /text: await request\.text\(\)/, "the body is not handed over as text");
  assert.match(worker, /import \{ MAX_IMPORT_BYTES \} from "\.\/site-csv\.mjs"/);
});

test("the Data panel offers Import CSV exactly where it offers + Add, and posts the file as text", () => {
  const at = chat.indexOf("const importBtn = ");
  assert.ok(at > 0, "no import button");
  assert.match(chat.slice(at, at + 200), /\(canAdd && !siteDataForm\)/, "the button is not gated the way + Add is");
  assert.match(chat, /notifyBtn \+ importBtn \+ addBtn/, "the button is built and never rendered");
  const h = chat.indexOf("document.getElementById('stDataImport')");
  assert.ok(h > 0, "no click handler");
  const handler = chat.slice(h, chat.indexOf("inp.click();", h));
  assert.match(handler, /inp\.accept = '\.csv,text\/csv,text\/plain'/);
  assert.match(handler, /f\.size > 2 \* 1024 \* 1024/, "a too-big file is uploaded and refused instead of refused here");
  assert.match(handler, /'\/rows\/' \+ encodeURIComponent\(sel\) \+ '\/import'/, "the POST does not reach the import route");
  assert.match(handler, /'Content-Type': 'text\/csv'/);
  assert.match(handler, /sbToast\(importWords\(d\)\)/, "the reply is not read back to the owner");
  assert.match(handler, /if \(done\) \{ siteDataForm = null; loadSiteData\(site\); \}/, "the table is not reloaded after a success");
  assert.match(css, /\.st-data-import \{/);
});

test("importWords says what went in and names the first line that did not", () => {
  const src = chat.slice(chat.indexOf("function importWords(d) {"), chat.indexOf("function jobWords(j) {"));
  const importWords = new Function(src + "; return importWords;")();
  assert.equal(importWords({ kept: 120 }), "Imported 120 rows.");
  assert.equal(importWords({ kept: 1 }), "Imported 1 row.");
  assert.equal(importWords({ kept: 118, problems: [{ line: 14, reason: "price is required" }, { line: 77, reason: "that already exists" }] }),
    "Imported 118 rows. 2 rows skipped — line 14: price is required.");
  assert.equal(importWords({ kept: 3, ignored: ["Notes", "Colour"] }), "Imported 3 rows. Ignored columns: Notes, Colour.");
  assert.equal(importWords({ kept: 5000, truncated: 12 }), "Imported 5000 rows. 12 rows past the 5,000 cap were left out.");
  assert.equal(importWords({ kept: 100, stopped: 102 }), "Imported 100 rows. Stopped at line 102 — try again from there.");
});
