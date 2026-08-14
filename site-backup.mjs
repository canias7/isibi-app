// A second copy of every site's customer data.
//
// THE GAP THIS CLOSES (2026-08-14 audit, the one HIGH-value gap): a site's
// booking list existed in exactly one place — its Neon database — so one bad
// bug, one wrong delete, or the site's own removal erased every customer and
// appointment permanently, with no nightly copy anywhere. `site-versions.mjs`
// archives page FILES only; the "Backups" panel is the manual CSV export; and
// site-live.mjs's own header says the only removal that worked "drops the Neon
// database and every booking in it, permanently".
//
// THE DESIGN IS ZERO NEW INFRASTRUCTURE. The dump goes to R2 (already paid
// for, no egress fees, nothing serves the `backups/` prefix so it is private
// by construction), driven by the existing 2-minute cron. The object KEY is
// the stamp — `backups/<slug>/<YYYY-MM-DD>.json` — so "did today's backup
// happen" is answered by the store itself: no new table, no new column, and
// two racing ticks that both write the same key write identical content.
//
// WHAT A BACKUP IS AND IS NOT. It is the site's DECLARED tables (the rows a
// business cannot re-type: bookings, orders, enquiries) plus an ALLOW-LISTED
// slice of `_meta` (the schema and the look, enough to rebuild the shape).
// It is NOT `_secrets` — the vault is never read here, asserted by the
// allow-lists in both directions — and NOT the published files, which
// `versions/` already holds. There is deliberately NO restore-in-place in v1:
// restoring rows over a live table is a merge-vs-replace decision nobody has
// made, and a wrong guess destroys the exact data this file exists to keep.
// The owner DOWNLOADS a day and has everything.
//
// COST, STATED. A nightly dump wakes each site's scale-to-zero compute once a
// day for a few seconds — that is the price of having backups at all, and it
// is the only Neon cost here. R2 holds ≤ KEEP_BACKUPS small JSON objects per
// site. Reads outside the night window cost nothing: the runner returns
// before touching anything.

// Rows kept per table. A small business's list fits; a table past the cap is
// dumped to the cap and SAYS SO in the backup itself — a silent truncation
// reads as "everything is here" when it is not, which for a backup is the
// worst possible lie.
export const MAX_TABLE_ROWS = 5000;
// Sites dumped per tick, so one slow database cannot starve the rest of the
// night — the same reason the jobs tick and the teardown sweeper are bounded.
export const MAX_SITES_PER_TICK = 5;
// Days kept. Enough to notice "the data was fine on Tuesday"; small enough
// that a deleted site's history does not linger long in absolute terms even
// if the teardown wipe were ever missed.
export const KEEP_BACKUPS = 7;
// The night window opens at this UTC hour. Before it, the runner is a no-op —
// zero listings, zero heads — and everything after it is retry window, so an
// outage during the small hours does not cost the whole day's backup.
export const BACKUP_HOUR_UTC = 3;

// The `_meta` keys a backup carries. AN ALLOW-LIST, never a dump of the whole
// table: `_meta` also holds service endpoints and whatever lands there next,
// and a backup that copies keys nobody listed is how a credential-shaped
// value ends up in a second store. Same discipline as the audit log's fields.
export const BACKUP_META_KEYS = ["schema", "site_look", "site_tokens", "site_style", "site_logo"];

/** `backups/<slug>/<YYYY-MM-DD>.json` — the key IS the daily stamp. */
export function backupKey(slug, day) {
  return "backups/" + String(slug).toLowerCase() + "/" + day + ".json";
}

/** Today, as the key spells it. Injected `now` so the day boundary is testable. */
export function backupDay(now) {
  return new Date(now).toISOString().slice(0, 10);
}

/**
 * Which declared tables a backup reads. Derived from the site's own stored
 * schema — never a listing of the database, so internal tables (`_secrets`,
 * `_meta`, `_sessions`, anything underscored) are unreachable by
 * construction, and a name that could not have been declared is dropped
 * rather than quoted into SQL.
 */
export function backupTables(spec) {
  const out = [];
  for (const t of ((spec && Array.isArray(spec.tables)) ? spec.tables : [])) {
    const name = t && t.name ? String(t.name).toLowerCase() : "";
    if (!/^[a-z][a-z0-9_]{0,40}$/.test(name)) continue;
    // BELT-AND-BRACES, said plainly: the regex above already refuses a leading
    // underscore (`^[a-z]`), so a mutant removing this line is inert — proven
    // by the sweep. It stays because it is the SECURITY exclusion (`_secrets`,
    // `_meta`, `_sessions`), and the regex is one careless edit (`^[a-z_]`)
    // from silently becoming the only thing that never held it.
    if (name.startsWith("_")) continue;
    if (!out.includes(name)) out.push(name);
  }
  return out.slice(0, 24);
}

/**
 * Dump one site. deps:
 *   loadSchema()        → the site's stored schema (loadSiteSchema)
 *   readTable(name, n)  → up to n rows (the caller owns the SQL and its quoting)
 *   readMeta(keys)      → {k: v} for the allow-listed keys that exist
 *
 * Returns the backup OBJECT; the caller serialises and stores it. Throws on a
 * schema that cannot be read — a backup of a site whose shape is unknown
 * would be an empty file wearing a date, which reads as "backed up" and is
 * not.
 */
export async function dumpSite(deps, { slug, now }) {
  const spec = await deps.loadSchema();
  const tables = backupTables(spec);
  const out = { v: 1, slug: String(slug).toLowerCase(), at: new Date(now).toISOString(), tables: {}, meta: {} };
  for (const name of tables) {
    // One over the cap, so truncation is a FACT (there was a row we did not
    // keep) rather than an inference from hitting the boundary exactly.
    const rows = await deps.readTable(name, MAX_TABLE_ROWS + 1);
    const list = Array.isArray(rows) ? rows : [];
    out.tables[name] = {
      rows: list.slice(0, MAX_TABLE_ROWS),
      ...(list.length > MAX_TABLE_ROWS ? { truncated: true } : {}),
    };
  }
  const meta = await deps.readMeta(BACKUP_META_KEYS);
  for (const k of BACKUP_META_KEYS) {
    if (meta && meta[k] !== undefined && meta[k] !== null) out.meta[k] = meta[k];
  }
  return out;
}

/**
 * One cron tick's worth of nightly backups. deps:
 *   hour()          → current UTC hour (injected so the window is testable)
 *   now()           → ms since epoch
 *   listSites()     → [{slug}] — every built site (bounded by the caller)
 *   exists(key)     → boolean — is this object already in the store
 *   put(key, json)  → store the serialized backup
 *   list(prefix)    → [key] — this site's existing backups (any order)
 *   remove(key)     → delete one
 *   dump(slug)      → the backup object (the caller wires dumpSite with the
 *                     site's own connection)
 *   warn(msg)       → where a per-site failure goes
 *
 * NEVER THROWS, and one site's failure never stops the rest — this runs
 * detached on the cron beside work that matters more. Idempotent per day by
 * the object key. Retention runs only after a successful put, so a night of
 * failures can never DELETE history: being unable to write a new copy must
 * not become a reason to lose an old one.
 */
export async function runNightlyBackups(deps) {
  try {
    if (deps.hour() < BACKUP_HOUR_UTC) return { skipped: "night window" };
    const day = backupDay(deps.now());
    const sites = (await deps.listSites()) || [];
    let made = 0, failed = 0, checked = 0;
    for (const s of sites) {
      const slug = s && s.slug ? String(s.slug).toLowerCase() : "";
      if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(slug)) continue;
      if (made >= MAX_SITES_PER_TICK) break;
      checked++;
      const key = backupKey(slug, day);
      try {
        if (await deps.exists(key)) continue;
        const dump = await deps.dump(slug);
        // A dump with no tables at all is a site with nothing declared —
        // legal, and still written: the meta half is a real backup of the
        // site's shape, and skipping it would re-dump every tick all night.
        await deps.put(key, JSON.stringify(dump));
        made++;
        // Retention, newest KEEP_BACKUPS by key — the keys are ISO dates, so
        // lexicographic IS chronological. Best-effort: a failed prune costs
        // pennies of storage, never the new backup.
        try {
          const keys = ((await deps.list("backups/" + slug + "/")) || []).slice().sort();
          for (const old of keys.slice(0, Math.max(0, keys.length - KEEP_BACKUPS))) {
            await deps.remove(old);
          }
        } catch (e) { deps.warn?.("backup prune failed for " + slug + ": " + ((e && e.message) || e)); }
      } catch (e) {
        failed++;
        deps.warn?.("backup failed for " + slug + ": " + ((e && e.message) || e));
      }
    }
    return { day, made, failed, checked };
  } catch (e) {
    deps.warn?.("backup tick failed: " + ((e && e.message) || e));
    return { failed: true };
  }
}

/**
 * The list an owner sees: newest first, date and size only. The panel needs
 * nothing else, and returning less than everything is the habit that keeps a
 * second copy of customer data from becoming a third.
 */
export function backupListing(objects) {
  const out = [];
  for (const o of (Array.isArray(objects) ? objects : [])) {
    const m = String((o && o.key) || "").match(/\/(\d{4}-\d{2}-\d{2})\.json$/);
    if (!m) continue;
    out.push({ day: m[1], size: Number(o && o.size) || 0 });
  }
  out.sort((a, b) => (a.day < b.day ? 1 : -1));
  return out.slice(0, KEEP_BACKUPS + 3);
}

/** A day out of a path, refused unless it is exactly the shape we mint. */
export function backupDayParam(raw) {
  const s = String(raw || "");
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}
