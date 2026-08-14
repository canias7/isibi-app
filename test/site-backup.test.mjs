// The nightly second copy of every site's customer data.
//
// The gap this closes (2026-08-14 audit, the one HIGH-value gap): a site's
// booking list existed in exactly one place, so one bad bug or one wrong
// delete erased every customer permanently, with no copy anywhere. Most of
// what is asserted here is about what a backup must NEVER do — read the
// vault, delete history it failed to replace, or leak past its allow-lists —
// because a backup that misbehaves is worse than none: it is a second copy of
// customer data behaving badly.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  backupKey, backupDay, backupTables, dumpSite, runNightlyBackups,
  backupListing, backupDayParam,
  MAX_TABLE_ROWS, MAX_SITES_PER_TICK, KEEP_BACKUPS, BACKUP_HOUR_UTC, BACKUP_META_KEYS,
} from "../site-backup.mjs";

const worker = fs.readFileSync(new URL("../worker.js", import.meta.url), "utf8");

// ── what a backup contains ───────────────────────────────────────────────────

test("the key is the daily stamp, and the day param mints nothing else", () => {
  assert.equal(backupKey("Cafe", "2026-08-14"), "backups/cafe/2026-08-14.json");
  assert.equal(backupDay(Date.parse("2026-08-14T23:59:00Z")), "2026-08-14");
  assert.equal(backupDayParam("2026-08-14"), "2026-08-14");
  for (const bad of ["2026-8-14", "../../sites", "2026-08-14.json", "", null, "20260814"]) {
    assert.equal(backupDayParam(bad), null, JSON.stringify(bad));
  }
});

test("only DECLARED tables are dumped — internal tables are unreachable by construction", () => {
  // Never a listing of the database: `_secrets`, `_meta` and `_sessions` are
  // not declared tables, so they cannot even be named. A name that could not
  // have been declared is dropped rather than quoted into SQL.
  const spec = { tables: [
    { name: "bookings" }, { name: "_secrets" }, { name: "_meta" },
    { name: "drop table" }, { name: "Bookings" }, { name: "services" },
  ] };
  assert.deepEqual(backupTables(spec), ["bookings", "services"]);
  assert.deepEqual(backupTables(null), []);
});

test("truncation is a FACT in the dump, never a silent cap", async () => {
  // One row over the cap is requested, so "there was a row we did not keep"
  // is observed rather than inferred from hitting the boundary exactly.
  let asked = 0;
  const deps = {
    loadSchema: async () => ({ tables: [{ name: "bookings" }, { name: "services" }] }),
    readTable: async (name, n) => {
      asked = n;
      if (name === "bookings") return Array.from({ length: MAX_TABLE_ROWS + 1 }, (_, i) => ({ id: i }));
      return [{ id: 1 }];
    },
    readMeta: async () => ({}),
  };
  const out = await dumpSite(deps, { slug: "cafe", now: Date.parse("2026-08-14T04:00:00Z") });
  assert.equal(asked, MAX_TABLE_ROWS + 1);
  assert.equal(out.tables.bookings.rows.length, MAX_TABLE_ROWS);
  assert.equal(out.tables.bookings.truncated, true);
  assert.equal(out.tables.services.truncated, undefined, "a table under the cap must not claim truncation");
  assert.equal(out.slug, "cafe");
});

test("THE META HALF IS AN ALLOW-LIST — extra keys from the reader never leak in", async () => {
  // `_meta` also holds service endpoints and whatever lands there next; a
  // backup that copies keys nobody listed is how a credential-shaped value
  // ends up in a second store. Same discipline as the audit log's fields.
  const deps = {
    loadSchema: async () => ({ tables: [] }),
    readTable: async () => [],
    readMeta: async () => ({ schema: { tables: [] }, site_look: { brand: "X" }, auth_info: { url: "https://a" }, stray: "no" }),
  };
  const out = await dumpSite(deps, { slug: "cafe", now: 0 });
  assert.deepEqual(Object.keys(out.meta).sort(), ["schema", "site_look"]);
  assert.ok(!("auth_info" in out.meta), "an unlisted meta key leaked into the backup");
  // And the vault can never be on the list.
  assert.ok(!BACKUP_META_KEYS.some((k) => /secret/i.test(k)), "the vault is on the backup's allow-list");
});

test("an unreadable schema THROWS rather than writing an empty file wearing a date", async () => {
  const deps = { loadSchema: async () => { throw new Error("db down"); }, readTable: async () => [], readMeta: async () => ({}) };
  await assert.rejects(() => dumpSite(deps, { slug: "cafe", now: 0 }), /db down/);
});

// ── the nightly runner ───────────────────────────────────────────────────────

const runnerDeps = (over = {}) => {
  const calls = { puts: [], removed: [], dumps: [], warned: [] };
  const deps = {
    hour: () => 4,
    now: () => Date.parse("2026-08-14T04:10:00Z"),
    listSites: async () => [{ slug: "cafe" }, { slug: "barber" }],
    exists: async () => false,
    put: async (key, json) => calls.puts.push({ key, json }),
    list: async () => [],
    remove: async (key) => calls.removed.push(key),
    dump: async (slug) => { calls.dumps.push(slug); return { v: 1, slug }; },
    warn: (m) => calls.warned.push(String(m)),
    ...over,
  };
  return { deps, calls };
};

test("outside the night window it is a NO-OP — zero listings, zero heads", async () => {
  let listed = 0;
  const { deps } = runnerDeps({ hour: () => BACKUP_HOUR_UTC - 1, listSites: async () => { listed++; return []; } });
  const out = await runNightlyBackups(deps);
  assert.equal(out.skipped, "night window");
  assert.equal(listed, 0, "the runner did work outside the window — 720 ticks a day of it");
});

test("idempotent per day by the OBJECT KEY — an existing backup is never re-dumped", async () => {
  const { deps, calls } = runnerDeps({ exists: async (key) => key.includes("/cafe/") });
  const out = await runNightlyBackups(deps);
  assert.deepEqual(calls.dumps, ["barber"], "a site already backed up today was dumped again");
  assert.equal(out.made, 1);
  assert.equal(calls.puts[0].key, "backups/barber/2026-08-14.json");
});

test("one tick is bounded, so one slow database cannot starve the night", async () => {
  const many = Array.from({ length: MAX_SITES_PER_TICK + 4 }, (_, i) => ({ slug: "s" + i }));
  const { deps, calls } = runnerDeps({ listSites: async () => many });
  await runNightlyBackups(deps);
  assert.equal(calls.dumps.length, MAX_SITES_PER_TICK);
});

test("one site's failure never stops the rest, and it is WARNED, not swallowed", async () => {
  const { deps, calls } = runnerDeps({
    dump: async (slug) => { if (slug === "cafe") throw new Error("neon down"); calls.dumps.push(slug); return { v: 1 }; },
  });
  const out = await runNightlyBackups(deps);
  assert.equal(out.failed, 1);
  assert.equal(out.made, 1);
  assert.deepEqual(calls.dumps, ["barber"]);
  assert.ok(calls.warned.some((m) => /cafe/.test(m) && /neon down/.test(m)), "the failure vanished into silence");
});

test("RETENTION KEEPS THE NEWEST AND RUNS ONLY AFTER A SUCCESSFUL PUT", async () => {
  // Being unable to write a new copy must never become a reason to lose an
  // old one — a night of failures that DELETED history would be this feature
  // attacking the thing it exists to protect.
  const days = Array.from({ length: KEEP_BACKUPS + 3 }, (_, i) => "backups/cafe/2026-08-" + String(i + 1).padStart(2, "0") + ".json");
  const { deps, calls } = runnerDeps({
    listSites: async () => [{ slug: "cafe" }],
    list: async () => [...days].reverse(),   // any order — the module sorts
  });
  await runNightlyBackups(deps);
  assert.deepEqual(calls.removed, days.slice(0, 3), "it must prune exactly the oldest beyond the keep");

  const failing = runnerDeps({
    listSites: async () => [{ slug: "cafe" }],
    put: async () => { throw new Error("r2 down"); },
    list: async () => days,
  });
  await runNightlyBackups(failing.deps);
  assert.deepEqual(failing.calls.removed, [], "a failed put still pruned — history lost to an outage");
});

test("junk slugs are skipped and the runner NEVER throws", async () => {
  const { deps, calls } = runnerDeps({ listSites: async () => [{ slug: "../evil" }, { slug: "ok-site" }, null] });
  await runNightlyBackups(deps);
  assert.deepEqual(calls.dumps, ["ok-site"]);
  const broken = runnerDeps({ listSites: async () => { throw new Error("supabase down"); } });
  const out = await runNightlyBackups(broken.deps);
  assert.equal(out.failed, true);
  assert.ok(broken.calls.warned.length, "a dead tick vanished into silence");
});

test("the owner's listing is newest-first, day and size only", () => {
  const out = backupListing([
    { key: "backups/cafe/2026-08-12.json", size: 100 },
    { key: "backups/cafe/2026-08-14.json", size: 300 },
    { key: "backups/cafe/junk.txt", size: 1 },
    { key: "backups/cafe/2026-08-13.json", size: 200 },
  ]);
  assert.deepEqual(out, [
    { day: "2026-08-14", size: 300 },
    { day: "2026-08-13", size: 200 },
    { day: "2026-08-12", size: 100 },
  ]);
});

// ── the wiring ───────────────────────────────────────────────────────────────

test("the cron drives it and the worker supplies real deps", () => {
  assert.match(worker, /ctx\.waitUntil\(runNightlyBackups\(backupDeps\(env\)\)\)/, "nothing runs the nightly backups");
  assert.match(worker, /import \{[^}]*runNightlyBackups[^}]*\} from "\.\/site-backup\.mjs"/,
    "a call to a name that was never imported is a ReferenceError on the cron");
  const at = worker.indexOf("function backupDeps(env)");
  assert.ok(at > 0, "backupDeps is gone — rescope this");
  const deps = worker.slice(at, worker.indexOf("async function runScheduledSiteJobs", at));
  // The dump's SQL goes through the same hands as every other identifier, and
  // keeps the OLDEST rows when truncating — the newest are still visible in
  // the owner's panel; the oldest are the ones only a backup still has.
  assert.match(deps, /sqlQuery\(conn, "SELECT \* FROM " \+ sqlIdent\(name\) \+ " ORDER BY id ASC LIMIT "/,
    "the table read lost its quoting or its oldest-first order");
  assert.match(deps, /SELECT k, v FROM _meta WHERE k IN \(/, "the meta read moved — rescope this");
  assert.equal(/_secrets/.test(deps), false, "the backup deps mention the vault");
});

test("EVERY backups/ REFERENCE IN THE WORKER IS ONE OF THE THREE ALLOWED PLACES", () => {
  // The prefix is private only because nothing serves it. This is the guard
  // that keeps it so: a new `"backups/"` literal anywhere else — a public
  // route, a rewrite, anything — fails here and has to say what it is.
  const zones = [
    ["function backupDeps(env)", "async function runScheduledSiteJobs"],
    ["} else if (bk) {", "} else if (nt) {"],
    ["let backupsRemoved = 0;", "async function handleRequest"],
  ].map(([a, b]) => {
    const s = worker.indexOf(a);
    const e = worker.indexOf(b, s);
    assert.ok(s > 0 && e > s, "zone moved: " + a);
    return [s, e];
  });
  const hits = [...worker.matchAll(/"backups\/"/g)].map((m) => m.index);
  // TWO literals, not three: backupDeps never spells the prefix — the module
  // hands it complete keys — so only the owner route and the teardown name it.
  assert.ok(hits.length >= 2, "the backups prefix is no longer referenced — the feature fell out");
  for (const i of hits) {
    assert.ok(zones.some(([s, e]) => i > s && i < e),
      "a backups/ reference outside the cron, the owner route and the teardown — offset " + i);
  }
});

test("the owner route is gated, read-only, and downloads as an ATTACHMENT", () => {
  const at = worker.indexOf("} else if (bk) {");
  assert.ok(at > 0, "the backups route is gone");
  const end = worker.indexOf("} else if (", at + 1);
  const h = worker.slice(at, end);
  const gate = h.indexOf("assertOwner(ownerDeps, bslug, ou.id)");
  const read = h.indexOf(".get(backupKey(");
  assert.ok(gate > 0, "the handler does not check ownership");
  assert.ok(read > gate, "the object is read before ownership is proven");
  assert.match(h, /method !== "GET"/, "a read-only surface accepts writes — retention is the cron's job");
  assert.match(h, /content-disposition/, "owner-held customer data served inline on our origin");
  assert.match(h, /backupDayParam\(/, "the day in the path reaches the store unvalidated");
});

test("deleting a site deletes its backups — a second copy must not outlive the first", () => {
  const del = worker.indexOf("async function deleteSiteFor");
  assert.ok(del > 0, "deleteSiteFor moved — rescope this");
  const body = worker.slice(del, worker.indexOf("\n}", worker.indexOf("domainsReleased", del)));
  const bk = body.search(/backups\/" \+ dslug/);
  assert.ok(bk > 0, "the teardown no longer wipes the backups prefix");
  // BEFORE the registration row, with both anchors proven — after it a failed
  // wipe is permanent, because the delete route 404s with no row to authorise
  // against. Same reasoning, same test shape, as the jobs cleanup.
  const row = body.indexOf('site_backends?slug=eq.${encodeURIComponent(dslug)}`, { method: "DELETE"');
  assert.ok(row > 0, "the registration delete moved — rescope this");
  assert.ok(bk < row, "the backups wipe runs after the row delete — a failure there is unretryable");
  assert.match(body, /bCursor = \(got && got\.truncated\) \? got\.cursor : undefined/,
    "the prefix sweep does not follow the cursor — it can leave objects behind");
});

test("the panel shows the nightly copies, and an unreadable list is not an empty one", () => {
  const chat = fs.readFileSync(new URL("../public/chat.js", import.meta.url), "utf8");
  const at = chat.indexOf("async function siteBackups(site)");
  assert.ok(at > 0, "the panel is gone");
  const end = chat.indexOf("\nasync function siteVersions(", at);
  assert.ok(end > at, "the panel's landmark moved — rescope this");
  const panel = chat.slice(at, end);
  assert.match(panel, /'\/api\/site\/' \+ encodeURIComponent\(slug\) \+ '\/backups'/, "nothing fetches the nightly list");
  // THE SECTION MARKUP, not just the id — `bkNightly` also appears in the
  // fetch handler's getElementById, so a bare match passed while the section
  // it renders into was deleted (found by mutation: the handler ran, found no
  // box, and returned silently — the list fetched and shown nowhere).
  assert.match(panel, /Nightly copies<\/b><div id="bkNightly"/, "the nightly section has nowhere to render");
  // "No backups" on a failed read tells the owner the feature does not exist,
  // and they stop looking — the jobs panel's own rule.
  assert.match(panel, /Couldn’t load the backups/, "a failed load reads as an empty schedule");
  assert.match(panel, /'\/backups\/' \+ encodeURIComponent\(/, "the Download button posts nowhere");
});
