// DOMAIN CONNECT — the owner clicks one button and their DNS provider writes
// the records.
//
// The open standard (domainconnect.org) that GoDaddy and IONOS wrote for exactly
// this problem. It sidesteps the thing that makes per-provider integration
// unaffordable: there is NO OAuth app to register, NO API key to collect, and NO
// IP allow-list to maintain. We never touch their DNS and never hold a
// credential for it.
//
// HOW IT ACTUALLY WORKS, because the shape is the reason it is cheap:
//
//   1. The domain publishes `_domainconnect.<domain>` as a TXT record naming its
//      DNS provider's Domain Connect endpoint. Anyone can read it.
//   2. That endpoint's `/v2/{domain}/settings` says whether the provider
//      supports the flow and where its consent screen lives.
//   3. We send the OWNER'S BROWSER there with the records we want as query
//      parameters. The provider authenticates them — in their own session, on
//      their own site — shows exactly what will change, and applies it.
//
// So the trust runs the right way round: the provider never trusts us, the
// owner never hands us anything, and we never see their password.
//
// WHAT IS STILL NEEDED, stated plainly because it is the whole gate: a template
// describing our records has to be registered with each provider, through the
// Domain Connect Templates repository that providers ingest. Until ours is
// there, the apply URL is a 404 at their end. The discovery half below is
// complete and correct today, and it is what tells us which owners this will
// ever work for.

/** The TXT record that names a domain's Domain Connect endpoint. */
export const DISCOVERY_PREFIX = "_domainconnect";

/**
 * Read the discovery record.
 *
 * A plain public TXT lookup, so this works for any domain without permission
 * from anybody — same property that makes nameserver detection universal.
 */
export async function discover(deps, domain) {
  const zone = String(domain || "").toLowerCase().replace(/\.$/, "");
  if (!zone || zone.split(".").length < 2) return null;
  let body;
  try {
    const r = await deps.fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(DISCOVERY_PREFIX + "." + zone)}&type=TXT`,
      { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(5000) });
    if (!r || !r.ok) return null;
    body = await r.json();
  } catch { return null; }
  const txt = (body && Array.isArray(body.Answer) ? body.Answer : [])
    .filter((a) => a && a.type === 16)
    // A TXT record arrives quoted, and long ones arrive as several quoted
    // strings that have to be joined — a host name is short enough that this
    // never bites, but the unquoting does.
    .map((a) => String(a.data || "").replace(/"/g, "").trim())
    .filter(Boolean)[0];
  return safeHost(txt);
}

/**
 * A hostname we are willing to fetch from.
 *
 * THE VALUE COMES OFF SOMEBODY ELSE'S DOMAIN, so it is attacker-controlled by
 * whoever runs that zone. We are about to make a server-side request to it and
 * later send the OWNER'S BROWSER to a URL derived from it, so it is treated as
 * hostile input: a bare hostname, nothing else. No scheme, no path, no port, no
 * credentials, no address literal.
 */
export function safeHost(raw) {
  const s = String(raw == null ? "" : raw).trim().toLowerCase().replace(/\.$/, "");
  if (!s || s.length > 253) return null;
  const labels = s.split(".");
  if (labels.length < 2) return null;
  for (const l of labels) {
    if (!l || l.length > 63) return null;
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(l)) return null;
  }
  // Four labels of digits is an address, not a name, and an address here is a
  // request aimed somewhere on our own network.
  if (/^\d+(\.\d+)+$/.test(s)) return null;
  return s;
}

/**
 * Ask the provider what it supports.
 *
 * `urlSyncUX` is the consent screen. `urlAsyncUX` is the OAuth variant, which
 * needs a client id per provider and is deliberately NOT used here — the whole
 * reason to reach for this standard is that the synchronous flow needs no
 * registration of ours beyond the template.
 */
export async function settings(deps, host, domain) {
  const h = safeHost(host);
  const d = String(domain || "").toLowerCase().replace(/\.$/, "");
  if (!h || !d) return null;
  try {
    const r = await deps.fetch(`https://${h}/v2/${encodeURIComponent(d)}/settings`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r || !r.ok) return null;
    const j = await r.json();
    return parseSettings(j);
  } catch { return null; }
}

/**
 * Normalise the settings document, or refuse it.
 *
 * `urlSyncUX` DECIDES WHERE WE SEND SOMEBODY'S BROWSER, and it arrived from a
 * host named by a TXT record on a domain we do not control. So it must be an
 * absolute https URL and nothing else — a relative one, a `javascript:` one or
 * a scheme we do not recognise is refused rather than repaired.
 */
export function parseSettings(raw) {
  const j = raw && typeof raw === "object" ? raw : null;
  if (!j) return null;
  const providerId = String(j.providerId || "").trim().slice(0, 80);
  if (!providerId) return null;
  const providerName = String(j.providerName || j.providerDisplayName || providerId).trim().slice(0, 80);
  const sync = httpsUrl(j.urlSyncUX);
  // ASYNC-ONLY IS A REAL ANSWER, not a failure. Some providers offer only the
  // OAuth variant, which needs a client id registered with each of them — so we
  // cannot use it, and "your provider supports this but needs a sign-in we have
  // not built" is a different thing from "your provider does not support this".
  // An owner told the second one stops looking.
  //
  // Returned as an object WITHOUT `urlSyncUX`, so `applyUrl` — which guards on
  // exactly that — physically cannot build a link to a screen that will not
  // work. The first draft computed this flag AFTER a `return null` that made it
  // unreachable, which is the dead-field shape this codebase keeps recording.
  if (!sync) {
    return httpsUrl(j.urlAsyncUX) ? { providerId, providerName, asyncOnly: true } : null;
  }
  return { providerId, providerName, urlSyncUX: sync, asyncOnly: false };
}

/** An absolute https URL, or null. */
export function httpsUrl(raw) {
  const s = String(raw == null ? "" : raw).trim();
  if (!s) return null;
  let u;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== "https:") return null;
  // Credentials in a URL we are about to open in somebody's browser are never
  // something a legitimate provider sends.
  if (u.username || u.password) return null;
  if (!safeHost(u.hostname)) return null;
  return u.origin + u.pathname.replace(/\/$/, "");
}

/**
 * The URL that shows the owner their provider's "apply these records?" screen.
 *
 * NO CREDENTIAL OF OURS TRAVELS IN IT, which is what makes the synchronous flow
 * safe to hand to a browser: the worst a hostile endpoint learns is the domain
 * and the record we wanted to set, both of which become public DNS the moment
 * the change is made.
 *
 * `providerId`/`serviceId` name OUR template — the one that has to be
 * registered with the provider. Template variables go in as ordinary query
 * parameters and are URL-encoded, because a value with an `&` in it would
 * otherwise append a parameter of the caller's choosing to a URL the owner is
 * about to trust.
 */
export function applyUrl(set, { serviceId, provider, domain, host, params, redirectUri, state }) {
  if (!set || !set.urlSyncUX) return null;
  const d = String(domain || "").toLowerCase().replace(/\.$/, "");
  const svc = String(serviceId || "").trim();
  const prov = String(provider || "").trim();
  if (!d || !svc || !prov) return null;
  const u = new URL(set.urlSyncUX +
    "/v2/domainTemplates/providers/" + encodeURIComponent(prov) +
    "/services/" + encodeURIComponent(svc) + "/apply");
  u.searchParams.set("domain", d);
  // The SUBDOMAIN the records go on, and only when there is one. Sent empty it
  // is a template variable with no value, which some providers reject and
  // others apply at the apex — the two worst possible outcomes to pick between.
  if (host) u.searchParams.set("host", String(host));
  for (const [k, v] of Object.entries(params || {})) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(k)) continue;
    if (v == null) continue;
    u.searchParams.set(k, String(v).slice(0, 300));
  }
  if (redirectUri) {
    const back = httpsUrl(redirectUri);
    if (back) {
      u.searchParams.set("redirect_uri", back);
      // Only meaningful alongside a return URL, and it is what proves the
      // callback belongs to the request we started.
      if (state) u.searchParams.set("state", String(state).slice(0, 120));
    }
  }
  // RETURNED AS TWO PARTS so the signature can be taken over the query exactly
  // as it will be sent. Rebuilt for signing, the bytes could differ from the
  // bytes on the wire — different escaping, different order — and every
  // signature would fail verification for a reason nobody could see.
  const query = u.search.replace(/^\?/, "");
  return { url: u.toString(), base: u.origin + u.pathname, query };
}

/**
 * SIGN THE APPLY REQUEST.
 *
 * WHY THIS IS NOT OPTIONAL, which their own reviewer checklist taught me and my
 * first draft had wrong. An unsigned template can be invoked by ANYBODY: the
 * apply URL is a plain GET, so a stranger can build
 * `…/providers/gofarther.dev/services/site/apply?domain=victim.com&target=evil.example`,
 * mail it to a GoDaddy customer, and the provider will offer to apply it —
 * under OUR provider name, on the customer's real domain. The standard offers
 * exactly two answers and they are mutually exclusive: `warnPhishing`, where the
 * provider shows a scary interstitial on every apply including ours, or a
 * SIGNATURE, where forged links simply do not verify. The first draft took the
 * first because it needed no key. That was the wrong trade — it makes our own
 * legitimate flow look dangerous AND still lets the forgery through if somebody
 * clicks past the warning.
 *
 * The signature covers the query string EXACTLY as it will be sent, in order,
 * with `sig` and `key` excluded — a provider re-serialising it differently would
 * verify a different string, so the signed bytes and the sent bytes are produced
 * from the same place and never rebuilt.
 */
export async function signQuery(deps, query, keyId) {
  if (!deps || !deps.sign || !query) return null;
  const sig = await deps.sign(query);
  if (!sig) return null;
  return query + "&key=" + encodeURIComponent(String(keyId || "_dck1")) + "&sig=" + encodeURIComponent(sig);
}

/**
 * RSA-SHA256 over the query, base64 — the algorithm the standard specifies.
 *
 * The private key never leaves the Worker and never touches a page: the browser
 * receives a finished URL, and the only thing it could do with the signature is
 * replay the exact request it was already being sent to.
 */
export async function rsaSigner(pkcs8Base64) {
  const raw = String(pkcs8Base64 || "").replace(/-----[A-Z ]+-----/g, "").replace(/\s+/g, "");
  if (!raw) return null;
  let key;
  try {
    // THE DECODE IS INSIDE THE TRY, and it was outside in the first draft.
    // `atob` throws on anything that is not base64, so a mistyped key crashed
    // here instead of returning null — and this is reached from a public route,
    // where an uncaught throw is a bare 1101 with no body. Found by a test that
    // fed it junk.
    const der = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0));
    key = await crypto.subtle.importKey("pkcs8", der,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  } catch { return null; }
  return async (text) => {
    try {
      const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(text));
      return btoa(String.fromCharCode(...new Uint8Array(sig)));
    } catch { return null; }
  };
}

/**
 * The whole discovery question in one call: can this owner be sent to a
 * one-click screen, and whose?
 */
export async function offerFor(deps, domain) {
  const host = await discover(deps, domain);
  if (!host) return { supported: false };
  const set = await settings(deps, host, domain);
  if (!set) return { supported: false, endpoint: host };
  if (set.asyncOnly) return { supported: false, asyncOnly: true, provider: set.providerName, endpoint: host };
  return { supported: true, provider: set.providerName, providerId: set.providerId, settings: set, endpoint: host };
}
