// Enqueue sites for a platform-wide republish.
//
// WHY THIS EXISTS. Every published site is its own Worker script with React and
// TanStack bundled INTO it — a Worker cannot load code at runtime, so there is
// no shared framework layer to patch. When an advisory lands, the only fix is to
// republish every site, and this is the operation that starts that.
//
// IT ONLY WRITES ROWS. The work is done by the Worker's cron, one site per
// two-minute tick, through `site-rebuild.mjs`. So this script cannot itself
// break anything: the worst it can do is queue too many sites, which the drain
// then works through and which `--dry` shows first.
//
// IT WRITES SUPABASE DIRECTLY WITH THE SERVICE KEY rather than calling a route.
// A platform-wide republish is an operator action, not an owner one, so adding a
// route would mean a new authenticated surface that exists for a thing a person
// does roughly never. The service key is already in this repo's Actions secrets
// for the other operator scripts.
//
// SAFE TO RUN TWICE. `site_rebuild.slug` is the primary key and this upserts
// with `ignore-duplicates`, so a second sweep while the first is still draining
// adds the sites it missed and leaves the in-flight rows — including their
// attempt counts and their `last_error` — exactly as they are. Re-queuing a site
// that is parked at the backoff cap would silently reset the record of why it is
// stuck.
//
// Usage:
//   node .github/scripts/enqueue-rebuild.mjs --dry
//   node .github/scripts/enqueue-rebuild.mjs --apply --reason "react 19.2.1"
//   node .github/scripts/enqueue-rebuild.mjs --apply --only cafe,barber

const URL_BASE = process.env.SUPABASE_URL || "https://ujrqdmmtcptvimazlhom.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_KEY || "";
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : ""; };

const APPLY = has("--apply");
const REASON = (val("--reason") || "platform rebuild").slice(0, 200);
const ONLY = (val("--only") || "").split(",").map((s) => s.trim()).filter(Boolean);

if (!KEY) { console.error("SUPABASE_SERVICE_KEY is not set"); process.exit(2); }

const rest = (path, init) =>
  fetch(`${URL_BASE}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: "Bearer " + KEY,
      "content-type": "application/json",
      ...((init || {}).headers || {}),
    },
  });

const fail = (m) => { console.error("FATAL:", m); process.exit(1); };

// ── which sites ──────────────────────────────────────────────────────────────
//
// `site_backends` is the ownership record and the site-delete route removes it
// last, so it is the authoritative list of what exists. Paged, because a
// PostgREST read without a range caps at the project default and a silent
// truncation here means a sweep that reports success and misses the tail.
const all = [];
for (let from = 0; ; from += 1000) {
  const r = await rest(`site_backends?select=slug&order=slug.asc`, {
    headers: { Range: `${from}-${from + 999}` },
  });
  if (!r.ok) fail("site_backends read " + r.status + " " + (await r.text()).slice(0, 200));
  const page = await r.json();
  all.push(...page.map((x) => String(x.slug || "")).filter(Boolean));
  if (page.length < 1000) break;
}

const slugs = ONLY.length ? all.filter((s) => ONLY.includes(s)) : all;
const missing = ONLY.filter((s) => !all.includes(s));

// ── what is already queued ───────────────────────────────────────────────────
const q = await rest(`site_rebuild?select=slug,attempts,last_error`);
if (!q.ok) fail("site_rebuild read " + q.status);
const queued = await q.json();
const already = new Set(queued.map((x) => x.slug));
const fresh = slugs.filter((s) => !already.has(s));

console.log(`sites on the platform : ${all.length}`);
if (ONLY.length) console.log(`filtered to --only     : ${slugs.length}${missing.length ? "  (unknown: " + missing.join(",") + ")" : ""}`);
console.log(`already queued         : ${queued.length}`);
console.log(`to enqueue             : ${fresh.length}`);
// The parked ones are the point of printing the queue: a site stuck at the
// backoff cap is one somebody has to look at, and a sweep is when they would.
for (const row of queued) {
  if (Number(row.attempts) > 0) console.log(`  parked: ${row.slug}  attempts=${row.attempts}  ${String(row.last_error || "").slice(0, 120)}`);
}

// AT ONE SITE PER TWO-MINUTE TICK. Printed rather than left to be worked out,
// because "republish everything" sounds instant and is not — and the number is
// what tells an operator whether to start it now or overnight.
const hours = (fresh.length * 2) / 60;
console.log(`\nthe drain does ONE site per 2-minute tick -> about ${hours < 1 ? Math.round(hours * 60) + " minutes" : hours.toFixed(1) + " hours"}`);

if (!APPLY) {
  console.log("\nDRY RUN — nothing written. Re-run with --apply.");
  process.exit(0);
}
if (!fresh.length) { console.log("\nnothing to do."); process.exit(0); }

// ── enqueue ──────────────────────────────────────────────────────────────────
//
// `ignore-duplicates` is what makes a second sweep safe: a slug already in the
// queue keeps its attempts and its last_error rather than being reset to a fresh
// row, which would throw away the record of why it is stuck.
const rows = fresh.map((slug) => ({ slug, reason: REASON }));
for (let i = 0; i < rows.length; i += 500) {
  const chunk = rows.slice(i, i + 500);
  const w = await rest(`site_rebuild`, {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(chunk),
  });
  if (!w.ok) fail("site_rebuild insert " + w.status + " " + (await w.text()).slice(0, 200));
  console.log(`enqueued ${Math.min(i + chunk.length, rows.length)}/${rows.length}`);
}
console.log("\ndone. The Worker's cron drains it from here — watch `site rebuild:` in the logs.");
