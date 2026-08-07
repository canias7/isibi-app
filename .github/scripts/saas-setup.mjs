// TURN CLOUDFLARE FOR SaaS ON, or say exactly why it cannot be turned on.
//
// Custom domains are fully built — `site-domains.mjs`, the panel, the watcher,
// the Domain Connect flow — and none of it can work until three things exist on
// the zone. This script is those three things, plus a preflight that names the
// missing token permission rather than leaving somebody to guess from a 403.
//
//   1. A FALLBACK ORIGIN RECORD. Cloudflare's own documented form is an
//      ORIGINLESS `AAAA 100::` (the IPv6 discard prefix), proxied. Originless
//      because nothing is ever dialled: the Worker answers before origin
//      resolution. My first draft was `A 192.0.2.1`, reasoned out from the
//      documentation range and wrong in the way that matters — an address in a
//      range somebody might actually route is an address traffic could one day
//      reach, and `100::` cannot be.
//   2. THE ZONE'S FALLBACK ORIGIN, set to that hostname. This is what makes a
//      custom hostname resolve to us at all.
//   3. A WORKER ROUTE `*/*` ON THE ZONE. This is the one that is easy to miss
//      and total when missed. The two routes in `wrangler.jsonc` are
//      `custom_domain` entries for gofarther.dev and www, and a custom hostname
//      is NEITHER — `sharpfadebarbers.com` matches no route, so the request
//      falls through to the fallback origin, finds `100::`, and every custom
//      domain on the platform answers 522. `*/*` is documented as routing all
//      traffic entering the zone INCLUDING custom hostnames.
//
// DRY RUN BY DEFAULT. This edits DNS on the live zone, so it says what it would
// do and changes nothing until `--apply`. A setup script whose first run is also
// its only irreversible run is the wrong shape for something touching
// production DNS.
//
//   node .github/scripts/saas-setup.mjs            # report
//   node .github/scripts/saas-setup.mjs --apply    # make the changes

import { readFileSync } from "node:fs";

const API = "https://api.cloudflare.com/client/v4";
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ZONE_NAME = process.env.SAAS_ZONE || "gofarther.dev";
const ORIGIN = process.env.SAAS_FALLBACK_ORIGIN || ("saas." + ZONE_NAME);
const APPLY = process.argv.includes("--apply");

// Cloudflare's originless address for a fallback origin. Not a placeholder we
// chose — `100::` is the IPv6 discard prefix and is what their own guide uses.
const ORIGINLESS = { type: "AAAA", content: "100::" };
const ROUTE_PATTERN = "*/*";
// The exact line to paste, written once here and once (commented) in
// wrangler.jsonc, with a test holding the two together — an instruction that
// has drifted from the thing it instructs is worse than no instruction, and a
// commented-out line has nothing else checking it.
const WILDCARD_LINE = '{ "pattern": "*/*", "zone_name": "gofarther.dev" }';
const FREE_HOSTNAMES = 100;

// THE DOMAIN CONNECT SIGNING KEY'S PUBLIC HALF, published as a TXT record.
//
// Providers fetch `<DC_KEY_ID>.<syncPubKeyDomain>` — `_dck1.gofarther.dev` — to
// verify the signature on every apply URL we hand an owner. Without it the
// template declares `syncPubKeyDomain` and every signed link is refused, which
// is why the panel offers no button rather than a broken one.
//
// The VALUE is public by construction: it is a public key, and it ends up in
// DNS where anyone can read it. The private half is a GitHub Actions secret and
// is never in this repository — asserted by a test.
const DCK_LABEL = process.env.DC_KEY_ID || "_dck1";
const DCK_FILE = new URL("../../domain-connect/dck1.pub", import.meta.url);

if (!TOKEN) {
  console.error("CLOUDFLARE_API_TOKEN is not set. Nothing can be checked without it.");
  process.exit(1);
}

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
    // THE PAGINATION BLOCK, and it is not decoration. Without it the hostname
    // count falls back to the length of one PAGE, so a zone with 300 registered
    // hostnames reports the page size and claims free headroom that is already
    // spent. Found by driving the script against a stub that said 7 and being
    // told 0.
    info: j && j.result_info,
    // The CODE as well as the message: 10000 is Cloudflare's "authentication
    // error", which is what a missing PERMISSION looks like and reads exactly
    // like a bad token.
    code: err && err.code,
    error: (err && err.message) || (j ? "" : "no JSON body") || ("HTTP " + r.status),
  };
}

// NOT A PERMISSION PROBLEM, and the first version of this script called it one.
//
// Cloudflare answers 1404 on the custom-hostnames endpoints when the ZONE has no
// Cloudflare for SaaS entitlement — nothing to do with the token, and adding
// every scope in the dashboard would not move it. The live run said exactly that
// and was told to add "SSL and Certificates: Read", which is advice that cannot
// work. Its own message is worse than unhelpful: it points at an Enterprise
// sales form, while custom hostnames are self-serve on Free, Pro and Business
// with 100 hostnames included.
const NOT_ENTITLED = 1404;
let notEntitled = false;

/** A probe that names the scope to add — or says when a scope is not the problem. */
async function probe(label, permission, path) {
  const r = await cf(path);
  if (r.ok) { say(`  ok    ${label}`); return r; }
  if (r.code === NOT_ENTITLED) {
    notEntitled = true;
    bad(`  NOT ENABLED  Cloudflare for SaaS is off for this zone. THIS IS NOT THE TOKEN.`);
    bad(`          Turn it on: Cloudflare dashboard → ${ZONE_NAME} → SSL/TLS → Custom Hostnames`);
    bad(`          → Enable Cloudflare for SaaS. Self-serve on Free/Pro/Business, 100 hostnames`);
    bad(`          included, $0.10/month each after that. Ignore the "contact sales" text in`);
    bad(`          Cloudflare's own error — that is boilerplate and it is wrong for this plan.`);
    return null;
  }
  bad(`  MISSING ${label}\n          add "${permission}" to the API token\n          (Cloudflare said ${r.code || r.status}: ${r.error})`);
  return null;
}

/** Why a custom-hostname step is being skipped — the token, or the entitlement. */
const sslBlocker = () => (notEntitled ? "Cloudflare for SaaS is not enabled on this zone" : "cannot read custom hostnames with this token");

say(`Cloudflare for SaaS — ${ZONE_NAME}`);
say(APPLY ? "MODE: apply (this will change DNS)\n" : "MODE: dry run (nothing will be changed)\n");

// ------------------------------------------------------------------ the zone

say("Token permissions");
const zoneRes = await probe("read the zone", "Zone: Read", `/zones?name=${encodeURIComponent(ZONE_NAME)}`);
const zone = zoneRes && Array.isArray(zoneRes.result) && zoneRes.result[0];
if (!zone) {
  bad(`\nCannot resolve the zone ${ZONE_NAME}. Everything below needs it — stopping.`);
  process.exit(1);
}
const Z = zone.id;
say(`        zone id ${Z}, plan ${(zone.plan && zone.plan.name) || "unknown"}`);

const dnsOk = await probe("read DNS records", "Zone → DNS: Read (Edit to create)", `/zones/${Z}/dns_records?per_page=1`);
const sslOk = await probe("read custom hostnames", "Zone → SSL and Certificates: Read (Edit to create)", `/zones/${Z}/custom_hostnames?per_page=1`);
// Routes are VERIFIED, not created — wrangler.jsonc owns them, and a route
// created here would be reconciled away by the next deploy. So a token without
// this permission reports a skip rather than a failure.
const routesRes = await cf(`/zones/${Z}/workers/routes`);
if (routesRes.ok) say("  ok    read Worker routes");
else say(`  skip  read Worker routes — add "Zone → Workers Routes: Read" to check this automatically\n          (Cloudflare said ${routesRes.code || routesRes.status})`);

// ----------------------------------------------------- 1. the originless record

say("\n1. Fallback origin record");
let recordReady = false;
if (dnsOk) {
  const q = await cf(`/zones/${Z}/dns_records?name=${encodeURIComponent(ORIGIN)}`);
  const rows = (q.ok && Array.isArray(q.result) ? q.result : []);
  const mine = rows.find((x) => x.type === ORIGINLESS.type && x.content === ORIGINLESS.content);
  if (rows.length && !mine) {
    // SOMEBODY ELSE'S RECORD IS NEVER OVERWRITTEN. If this name already points
    // at something real, changing it is an outage on whatever uses it — and a
    // setup script is the last thing that should be allowed to cause one.
    bad(`  REFUSING to touch ${ORIGIN}: it already exists as ${rows.map((x) => x.type + " " + x.content).join(", ")}`);
    bad(`  Pick a different name with SAAS_FALLBACK_ORIGIN, or remove that record by hand first.`);
  } else if (mine && mine.proxied) {
    say(`  ok    ${ORIGIN} is ${ORIGINLESS.type} ${ORIGINLESS.content}, proxied`);
    recordReady = true;
  } else if (mine) {
    // Ours, and unproxied — which serves a 522 to every custom domain, because
    // an unproxied record means Cloudflare tries to REACH the address.
    say(`  fix   ${ORIGIN} exists but is NOT proxied — custom domains would 522`);
    if (APPLY) {
      const u = await cf(`/zones/${Z}/dns_records/${mine.id}`, {
        method: "PATCH", body: JSON.stringify({ proxied: true }),
      });
      if (u.ok) { say("        proxied now"); recordReady = true; }
      else bad(`        could not proxy it: ${u.code || u.status} ${u.error}`);
    }
  } else {
    say(`  todo  create ${ORIGIN} as ${ORIGINLESS.type} ${ORIGINLESS.content}, proxied`);
    if (APPLY) {
      const c = await cf(`/zones/${Z}/dns_records`, {
        method: "POST",
        body: JSON.stringify({ ...ORIGINLESS, name: ORIGIN, proxied: true, ttl: 1, comment: "Cloudflare for SaaS fallback origin (originless)" }),
      });
      if (c.ok) { say("        created"); recordReady = true; }
      else bad(`        could not create it: ${c.code || c.status} ${c.error}\n        this needs "Zone → DNS: Edit"`);
    }
  }
} else {
  say("  skip  cannot read DNS with this token");
}

// ------------------------------------------------------ 2. the zone's fallback

say("\n2. Zone fallback origin");
let fallbackReady = false;
if (sslOk) {
  const fo = await cf(`/zones/${Z}/custom_hostnames/fallback_origin`);
  const current = fo.ok && fo.result && fo.result.origin;
  if (current === ORIGIN) {
    fallbackReady = true;
    say(`  ok    set to ${ORIGIN} (status ${fo.result.status || "unknown"})`);
  } else {
    say(`  todo  set to ${ORIGIN}${current ? ` (currently ${current})` : " (currently unset)"}`);
    // The record has to exist first — pointed at a name with no DNS behind it,
    // Cloudflare accepts the value and every custom hostname fails to resolve.
    if (APPLY && !recordReady) {
      bad("        not setting it: the record above is not ready, and a fallback origin");
      bad("        pointing at a name with no DNS behind it fails silently");
    } else if (APPLY) {
      const p = await cf(`/zones/${Z}/custom_hostnames/fallback_origin`, {
        method: "PUT", body: JSON.stringify({ origin: ORIGIN }),
      });
      if (p.ok) { fallbackReady = true; say(`        set (status ${(p.result && p.result.status) || "pending"}, takes a few minutes)`); }
      else bad(`        could not set it: ${p.code || p.status} ${p.error}\n        this needs "Zone → SSL and Certificates: Edit"`);
    }
  }
} else {
  say(`  skip  ${sslBlocker()}`);
}

// ---------------------------------------------------------- 3. the worker route

say("\n3. Worker route");
if (routesRes.ok) {
  const routes = Array.isArray(routesRes.result) ? routesRes.result : [];
  const wild = routes.find((r) => r.pattern === ROUTE_PATTERN);
  if (wild) {
    say(`  ok    ${ROUTE_PATTERN} → ${wild.script || "(no script)"}`);
  } else {
    // NOT a failure while steps 1 and 2 are outstanding — it is the NEXT step,
    // and it has to be second. Enabled before the zone has a fallback origin,
    // the routes call is rejected and takes the whole deploy with it; that is
    // measured, not cautious.
    const ready = recordReady || fallbackReady;
    (ready ? bad : say)(`  ${ready ? "TODO NOW" : "later "} add this line to "routes" in wrangler.jsonc and deploy:`);
    say(`            ${WILDCARD_LINE}`);
    say(`          It is already there, commented out, with the same text.`);
    if (!ready) say(`          Do steps 1 and 2 first — a "*/*" route is refused on a zone with no`);
    if (!ready) say(`          Cloudflare for SaaS, and the refusal fails the deploy.`);
    say(`          Without it, every custom domain answers 522: a customer hostname`);
    say(`          matches no route and falls through to ${ORIGINLESS.content}.`);
    say(`          routes today: ${routes.map((r) => r.pattern).join(", ") || "(none)"}`);
  }
} else {
  say(`  skip  cannot read Worker routes with this token`);
  say(`        check by hand: the zone needs a ${ROUTE_PATTERN} route to the Worker`);
}

// ----------------------------------------------------------------- where we are

// ------------------------------------------- 4. the Domain Connect public key

say(`\n4. Domain Connect signing key (${DCK_LABEL}.${ZONE_NAME})`);
let pub = null;
try {
  pub = readFileSync(DCK_FILE, "utf8").trim();
} catch {
  bad(`  MISSING  domain-connect/dck1.pub is not readable — nothing to publish`);
}
if (pub && !/^p=[A-Za-z0-9+/]+=*$/.test(pub)) {
  // A malformed value publishes a record providers cannot parse, and the only
  // symptom is every apply link being refused with no error anywhere we can see.
  bad(`  MALFORMED  dck1.pub must be "p=<base64 DER>"; got ${pub.slice(0, 12)}…`);
  pub = null;
}
if (pub && dnsOk) {
  const name = `${DCK_LABEL}.${ZONE_NAME}`;
  const q = await cf(`/zones/${Z}/dns_records?type=TXT&name=${encodeURIComponent(name)}`);
  const rows = (q.ok && Array.isArray(q.result) ? q.result : []);
  // Cloudflare returns TXT content quoted; compare unquoted.
  const unq = (v) => String(v || "").replace(/^"|"$/g, "");
  const exact = rows.find((r) => unq(r.content) === pub);
  if (exact) {
    say(`  ok    published and matches domain-connect/dck1.pub`);
  } else if (rows.length) {
    // ROTATION IS A NEW LABEL, NEVER AN EDIT. Every apply link already sitting
    // in somebody's browser was signed under the key this record publishes;
    // replacing it in place voids all of them, silently, and the owner sees a
    // provider refuse a link we told them to use. So a DIFFERENT value here is
    // refused rather than overwritten.
    bad(`  REFUSING to overwrite ${name}: it already holds a different key.`);
    bad(`  Rotating means publishing a NEW label (_dck2…) and changing DC_KEY_ID —`);
    bad(`  never editing this record, or every link already signed stops verifying.`);
  } else {
    say(`  todo  publish ${name} TXT`);
    if (APPLY) {
      const c = await cf(`/zones/${Z}/dns_records`, {
        method: "POST",
        body: JSON.stringify({ type: "TXT", name, content: pub, ttl: 1, comment: "Domain Connect signing key (public half)" }),
      });
      if (c.ok) say("        published");
      else bad(`        could not publish it: ${c.code || c.status} ${c.error}`);
    }
  }
} else if (pub) {
  say(`  skip  cannot read DNS with this token`);
}

say("\nHostnames");
if (sslOk) {
  // One row, because only the COUNT is wanted and it comes from `result_info`
  // rather than from the rows. Asking for a page of them would be reading
  // customers' domain names to arrive at a number the API already gives.
  const list = await cf(`/zones/${Z}/custom_hostnames?per_page=1`);
  const n = list.ok && list.info && Number.isFinite(list.info.total_count) ? list.info.total_count : null;
  if (n == null) {
    // NOT ZERO. "You have 100 free left" is the one wrong answer that costs
    // money, so an unreadable count says it is unreadable.
    bad(`  could not read the count (${list.code || list.status}: ${list.error})`);
  } else {
    say(`  ${n} registered — ${Math.max(0, FREE_HOSTNAMES - n)} left before the first one bills`);
  }
} else {
  say(`  skip  ${sslBlocker()}`);
}

say("");
if (failed) {
  say("NOT READY. Fix the points marked MISSING/REFUSING above and run again.");
  process.exit(1);
}
say(APPLY ? "Ready. Add a domain in Cloud → Domains and watch it go live." : "Nothing is wrong. Re-run with --apply to make the changes marked todo/fix.");
