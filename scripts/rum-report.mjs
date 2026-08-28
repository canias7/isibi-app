// IS WEB ANALYTICS ACTUALLY COLLECTING ON THE PUBLISHED SITES? — the one
// question a session cannot answer, asked with CI's own Cloudflare token.
//
// WHY THIS EXISTS (2026-08-28, owner's call: "ok do 3" — analytics ON). The
// state was measured from outside as far as a session can reach: the beacon IS
// injected on the .app zone (browser-like headers required to see it — a
// default curl never does), the published-site CSP has allowed BOTH beacon
// hosts since 2026-08-15, and two live sites carry the same RUM token — so a
// Web Analytics config exists and collection has PLAUSIBLY been working since
// the CSP fix unblocked it. But the only reading of the dashboard on record
// ("No data available", 2026-08-15) PREDATES that fix, so "plausibly" is where
// a session has to stop: the account's analytics need an account token, and a
// session holds none. This script is the `container logs` pattern again — CI's
// deploy token can ask; this is the asking.
//
// STRICTLY READ-ONLY, DELIBERATELY. An earlier plan had a one-shot `--apply`
// to create/enable a RUM site if nothing was collecting — dead on the
// evidence: the beacon is already injected with a live token, so there is no
// config to create, and a second site_info would be two tokens answering for
// one zone. If this report shows zero, the diagnosis continues from what it
// prints rather than from something this script changed.
//
// TWO HALVES, EACH REPORTED WHETHER THE OTHER WORKED:
//   1. The account's RUM site configs (REST) — which tokens exist, whether
//      auto-install is on, and which one is the token measured on the live
//      sites. Each entry is also printed RAW once, bounded — the field names
//      here come from the dashboard's behaviour, not from a documented schema,
//      and a wrong guess must show the true shape rather than a page of
//      `undefined` (the container-logs convention).
//   2. Pageload counts by hostname (GraphQL, `rumPageloadEventsAdaptiveGroups`)
//      — the honest "collecting or not", per site, for the last RUM_DAYS days.
//
// THE EXIT CODE FOLLOWS THE PRIMARY QUESTION: the GraphQL half failing means
// "is data flowing" went unanswered, so the run is red. The site list failing
// alone prints loudly and stays green — half an answer is still an answer.
//
// A REFUSAL NAMES THE LIKELY SCOPE, HEDGED. Cloudflare answers a missing
// permission with the same "Authentication error" a bad token gets (error
// 10000 — the saas-setup lesson), and the dashboard's names for these groups
// vary; the message says what to look for rather than asserting a name that
// may not be in the reader's editor (the 1404 advice-that-cannot-work lesson).
const TOKEN = process.env.CLOUDFLARE_API_TOKEN || "";
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID || "";
const DAYS = Math.min(30, Math.max(1, Number(process.env.RUM_DAYS) || 7));

// The token measured ON the live sites (2026-08-28: `forno-and-co` and
// `shoeroom-1` both serve it in their injected beacon). PUBLIC by construction
// — it is in every page's HTML — so printing and matching it leaks nothing.
const LIVE_BEACON_TOKEN = "16ed207598994f4eadec667bbedc0ad8";

function fail(msg) { console.error("FAIL: " + msg); process.exit(1); }
if (!TOKEN) fail("CLOUDFLARE_API_TOKEN is not set");
if (!ACCOUNT) fail("CLOUDFLARE_ACCOUNT_ID is not set");

function scopeHint(status, text) {
  if (status === 403 || /authentication error/i.test(text)) {
    console.error("If the token is otherwise good, it is missing a READ scope for Web Analytics —");
    console.error("in the token editor look for 'Account Analytics: Read' (the GraphQL half) and,");
    console.error("if your editor lists it, an 'Account Rum'/'RUM: Read' group (the site list).");
    console.error("Add it, then 'Continue to summary' -> 'Update token' — nothing saves until then.");
  }
}

// ── 1. the RUM site configs ──────────────────────────────────────────────────
let listOk = false;
try {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/rum/site_info/list?per_page=50`, {
    headers: { authorization: `Bearer ${TOKEN}` },
    signal: AbortSignal.timeout(30000),
  });
  const text = await r.text();
  if (!r.ok) {
    console.error("site list answered", r.status, text.slice(0, 500));
    scopeHint(r.status, text);
  } else {
    const j = JSON.parse(text);
    const sites = (j && j.result) || [];
    console.log(`RUM site configs on the account: ${Array.isArray(sites) ? sites.length : "?"}`);
    for (const s of Array.isArray(sites) ? sites : []) {
      const tok = (s && s.site_token) || "";
      const mark = tok === LIVE_BEACON_TOKEN ? "  <-- THE TOKEN THE LIVE SITES SERVE" : "";
      console.log(`- site_tag=${s && s.site_tag} token=${tok} auto_install=${s && s.auto_install}${mark}`);
      console.log(`  raw: ${JSON.stringify(s).slice(0, 400)}`);
    }
    if (Array.isArray(sites) && !sites.some((s) => s && s.site_token === LIVE_BEACON_TOKEN)) {
      console.log("NOTE: no config carries the live sites' beacon token — the injection is");
      console.log("coming from somewhere this listing does not cover (another account, or a");
      console.log("zone-level setting), which is itself the finding.");
    }
    listOk = true;
  }
} catch (e) { console.error("site list failed:", e && e.message); }

// ── 2. pageloads by hostname — the collecting-or-not answer ─────────────────
const to = new Date();
const from = new Date(to.getTime() - DAYS * 24 * 3600 * 1000);
const query = `query Pageloads($account: String!, $from: Time!, $to: Time!) {
  viewer { accounts(filter: { accountTag: $account }) {
    rumPageloadEventsAdaptiveGroups(
      filter: { datetime_geq: $from, datetime_lt: $to }
      limit: 100
      orderBy: [count_DESC]
    ) { count dimensions { requestHost siteTag } }
  } }
}`;
let gqlOk = false;
try {
  const r = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ query, variables: { account: ACCOUNT, from: from.toISOString(), to: to.toISOString() } }),
    signal: AbortSignal.timeout(30000),
  });
  const text = await r.text();
  let j = null;
  try { j = JSON.parse(text); } catch { /* printed below */ }
  // GraphQL answers 200 with an `errors` array, so the status alone says
  // nothing — an unknown field or a missing scope both arrive as errors[].
  const errs = (j && j.errors) || (!r.ok ? [{ message: `HTTP ${r.status}` }] : null);
  if (errs && errs.length) {
    console.error("graphql answered with errors:", JSON.stringify(errs).slice(0, 600));
    scopeHint(r.status, text);
  } else {
    const groups = (((((j || {}).data || {}).viewer || {}).accounts || [])[0] || {}).rumPageloadEventsAdaptiveGroups || [];
    const total = groups.reduce((n, g) => n + (Number(g && g.count) || 0), 0);
    console.log(`\npageloads in the last ${DAYS}d: ${total}${total ? "" : "  <-- NOTHING IS COLLECTING"}`);
    for (const g of groups) {
      const d = (g && g.dimensions) || {};
      console.log(`- ${d.requestHost || "?"} (site_tag ${d.siteTag || "?"}): ${g.count}`);
    }
    if (!groups.length) {
      console.log("zero rows: either no visits at all in the window, or the beacon's sends");
      console.log("are not landing. A visit to a live site and a re-read separates the two.");
    }
    gqlOk = true;
  }
} catch (e) { console.error("graphql query failed:", e && e.message); }

console.log(`\nsite list: ${listOk ? "ok" : "FAILED"} · pageload query: ${gqlOk ? "ok" : "FAILED"}`);
if (!gqlOk) process.exit(1);
