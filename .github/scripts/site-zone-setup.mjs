// THE SITE ZONE — `gofarther.app`, where every published site gets an address.
//
// A customer's site is `<slug>.gofarther.app`. That needs three things and this
// script owns the two that live at Cloudflare:
//
//   1. the zone in this account, nameservers moved, status ACTIVE      (by hand)
//   2. DNS: `*` and `@`, both originless AAAA 100::, both PROXIED      (here)
//   3. a Worker route `*/*` on the zone                        (wrangler.jsonc)
//
// Step 3 CANNOT be done here, and that is the same lesson `saas-setup.mjs`
// records for the other zone: wrangler publishes routes with a PUT that deletes
// any it was not told about, so a route created out of band survives exactly
// until the next deploy. It has to be the line in `wrangler.jsonc`.
//
// ORDER MATTERS. A route naming a zone the account does not hold fails the
// routes PUT and therefore the WHOLE deploy — measured on 2026-08-07 against
// `gofarther.dev` before it had Cloudflare for SaaS, three merges lost to an
// error naming an unrelated feature. So: zone first, DNS second, route last.
//
// DRY RUN BY DEFAULT. It edits DNS on a live zone; `--apply` is deliberate.
//
// WHY BOTH `*` AND `@`. The wildcard is what serves the sites. The apex is what
// serves somebody who types the bare domain into a browser — the Worker answers
// it with a 301 to gofarther.dev, and with no record at the apex there is
// nothing for that redirect to run on and the domain reads as broken.
//
// WHY ORIGINLESS. `AAAA 100::` is Cloudflare's own documented placeholder and
// the Worker answers before origin resolution, so nothing is ever dialled. An
// address out of a documentation range is NOT the same promise: it is an
// address somebody might one day route. Unproxied, either one is a timeout from
// the other direction, because Cloudflare would try to REACH it.
//
// NO CLOUDFLARE FOR SAAS HERE, unlike the other zone. These are subdomains of a
// zone we own, so Universal SSL covers `gofarther.app` and `*.gofarther.app`
// free — which is exactly one wildcard level, and exactly why `siteHostSlug`
// refuses `a.b.gofarther.app`: there is no certificate for it and never will be.
const API = "https://api.cloudflare.com/client/v4";
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ZONE_NAME = process.env.SITE_ZONE || "gofarther.app";
const APP_ZONE = process.env.APP_ZONE || "gofarther.dev";
const APPLY = process.argv.includes("--apply");

const ORIGINLESS = { type: "AAAA", content: "100::" };
// The comment we stamp on records we create. `saas-setup.mjs` uses the same
// idea for the same reason: it is the only way to tell a record this script
// made from one an operator made, and overwriting the second is how a script
// like this takes a live domain down.
const MARK = "created by site-zone-setup";
const ROUTE_LINE = '{ "pattern": "*/*", "zone_name": "gofarther.app" }';

let failed = false;
const say = (...a) => console.log(...a);
const bad = (...a) => { failed = true; console.log(...a); };

async function cf(path, init = {}) {
  const r = await fetch(API + path, {
    ...init,
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json", ...(init.headers || {}) },
    signal: AbortSignal.timeout(20000),
  });
  const j = await r.json().catch(() => null);
  const err = j && Array.isArray(j.errors) && j.errors[0];
  return {
    ok: r.ok && j && j.success === true,
    status: r.status,
    result: j && j.result,
    info: j && j.result_info,
    // The CODE as well as the message: Cloudflare answers a missing PERMISSION
    // with 10000 "Authentication error", which is indistinguishable from a bad
    // token unless the probe names the scope it was reaching for.
    code: err && err.code,
    error: (err && err.message) || (j ? "" : "no JSON body") || ("HTTP " + r.status),
  };
}

async function probe(label, permission, path) {
  const r = await cf(path);
  if (r.ok) { say(`  ok    ${label}`); return r; }
  bad(`  MISSING ${label}\n          add "${permission}" to the API token\n          (Cloudflare said ${r.code || r.status}: ${r.error})`);
  return null;
}

say(`Site zone — ${ZONE_NAME}`);
say(APPLY ? "MODE: apply (this will change DNS)\n" : "MODE: dry run (nothing will be changed)\n");

if (!TOKEN) {
  bad("  no CLOUDFLARE_API_TOKEN in the environment — nothing can be checked");
  process.exit(1);
}

// ── 1. the zone ───────────────────────────────────────────────────────────────
const zoneRes = await probe("read the zone", "Zone: Read", `/zones?name=${encodeURIComponent(ZONE_NAME)}`);
const zone = zoneRes && Array.isArray(zoneRes.result) && zoneRes.result[0];
if (!zone) {
  // THE EXPECTED FIRST RUN, not an error to panic about. Say what to do rather
  // than only that something is absent.
  bad(`\n  NOT IN THIS ACCOUNT  ${ZONE_NAME} has not been added to Cloudflare yet.`);
  bad(`          1. Cloudflare dashboard → Add a domain → ${ZONE_NAME}`);
  bad(`          2. Change the nameservers at the registrar to the two Cloudflare gives you`);
  bad(`          3. Wait for the zone to read Active, then run this again`);
  bad(`\n  Until then, leave the route in wrangler.jsonc COMMENTED OUT. Enabling it`);
  bad(`  now fails the routes PUT and takes the whole deploy with it.`);
  process.exit(1);
}
const Z = zone.id;
say(`  ok    zone found (${Z})`);

if (zone.status !== "active") {
  bad(`\n  NOT ACTIVE YET  the zone reads "${zone.status}".`);
  if (Array.isArray(zone.name_servers) && zone.name_servers.length) {
    bad(`          set these two nameservers at the registrar:`);
    for (const ns of zone.name_servers) bad(`            ${ns}`);
  }
  bad(`          Nothing below can be relied on until it is active.`);
}

// ── 2. DNS ────────────────────────────────────────────────────────────────────
const dnsOk = await probe("read DNS records", "Zone → DNS: Read (Edit to create)", `/zones/${Z}/dns_records?per_page=1`);

/**
 * One record, checked and created.
 *
 * REFUSES TO OVERWRITE A RECORD IT DID NOT CREATE. A `*` or apex record already
 * on the zone belongs to whoever put it there — a mail provider's setup, a
 * holding page, a redirect — and replacing it silently is how a script like this
 * takes something down that nobody connected to this change.
 */
async function ensureRecord(name, label) {
  if (!dnsOk) { say(`  skip  ${label} — cannot read DNS with this token`); return false; }
  const q = await cf(`/zones/${Z}/dns_records?name=${encodeURIComponent(name)}&per_page=50`);
  if (!q.ok) { bad(`  FAIL  could not list ${label} (${q.code || q.status}: ${q.error})`); return false; }
  const rows = Array.isArray(q.result) ? q.result : [];
  const mine = rows.find((r) => r.type === ORIGINLESS.type && r.content === ORIGINLESS.content);
  if (mine) {
    if (mine.proxied) { say(`  ok    ${label} → ${ORIGINLESS.type} ${ORIGINLESS.content}, proxied`); return true; }
    // UNPROXIED IS NOT "NEARLY RIGHT". The Worker only sees the request if
    // Cloudflare is in front of it; grey-clouded, `100::` is dialled directly
    // and every site on the zone times out.
    bad(`  FIX   ${label} exists but is NOT PROXIED — grey-clouded it times out`);
    if (APPLY) {
      const u = await cf(`/zones/${Z}/dns_records/${mine.id}`, {
        method: "PATCH", body: JSON.stringify({ proxied: true }),
      });
      if (u.ok) { say(`        proxied it`); return true; }
      bad(`        could not proxy it (${u.code || u.status}: ${u.error})`);
    }
    return false;
  }
  if (rows.length) {
    bad(`  REFUSED ${label} already has ${rows.length} record(s) this script did not create:`);
    for (const r of rows.slice(0, 5)) bad(`            ${r.type} ${r.name} → ${String(r.content).slice(0, 60)}`);
    bad(`          Remove or repoint them by hand. This script will not overwrite them.`);
    return false;
  }
  if (!APPLY) { say(`  todo  create ${label} → ${ORIGINLESS.type} ${ORIGINLESS.content}, proxied`); return false; }
  const c = await cf(`/zones/${Z}/dns_records`, {
    method: "POST",
    body: JSON.stringify({ ...ORIGINLESS, name, proxied: true, comment: MARK }),
  });
  if (c.ok) { say(`  ok    created ${label}`); return true; }
  bad(`  FAIL  could not create ${label} (${c.code || c.status}: ${c.error})`);
  return false;
}

const wildcardReady = await ensureRecord("*." + ZONE_NAME, "wildcard *." + ZONE_NAME);
const apexReady = await ensureRecord(ZONE_NAME, "apex " + ZONE_NAME);

// ── 3. the Worker route, which this script cannot create ──────────────────────
//
// Reported rather than done, and the report has to read DIFFERENTLY before and
// after its precondition — a pending step whose wording never changes is one
// nobody acts on at the right moment. That is the `saas-setup.mjs` lesson about
// step 3 reading "later" against a bare zone and "TODO NOW" once it is ready.
const routesRes = await cf(`/zones/${Z}/workers/routes`);
const routes = routesRes.ok && Array.isArray(routesRes.result) ? routesRes.result : [];
const routed = routes.some((r) => String(r.pattern) === "*/*");
say("");
if (routed) {
  say(`  ok    Worker route */* is registered on ${ZONE_NAME}`);
} else if (wildcardReady && apexReady && zone.status === "active") {
  say(`  TODO NOW  the zone is ready and nothing is routed to the Worker yet.`);
  say(`          In ONE commit:`);
  say(`            • uncomment  ${ROUTE_LINE}  in wrangler.jsonc`);
  say(`            • set  SITE_ZONE_LIVE = true  in site-domains.mjs`);
  say(`          test/site-zone.test.mjs fails if you move one without the other.`);
} else {
  say(`  later  the Worker route comes AFTER the DNS above. Leave it commented`);
  say(`          out in wrangler.jsonc — a route on a zone that is not ready`);
  say(`          fails the routes PUT and with it the entire deploy.`);
}

// ── what a visitor would get ─────────────────────────────────────────────────
say("");
say(`  Sites will serve at   <slug>.${ZONE_NAME}`);
say(`  The bare domain 301s to  https://${APP_ZONE}/`);
say(`  Universal SSL covers ${ZONE_NAME} and *.${ZONE_NAME} — one label, free,`);
say(`  and no Cloudflare for SaaS hostname is consumed by any of it.`);

say("");
say(APPLY
  ? (failed ? "Some steps did not complete — see FAIL/REFUSED above." : "Zone ready. Next: the route + the flag, in one commit.")
  : "Nothing has been changed. Re-run with --apply to make the steps marked todo/fix.");
process.exit(failed ? 1 : 0);
