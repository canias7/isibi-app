// A published site on the OWNER'S OWN domain.
//
// A barber shop does not want to hand out `gofarther.dev/s/sharp-fade-barbers/`.
// They want `sharpfadebarbers.com`, and until that works the builder produces
// something people are reluctant to put on a business card.
//
// WHY THIS IS PLATFORM CODE, and it is a different reason from the other four.
// Not a credential this time: it is that serving somebody else's domain over
// HTTPS needs a CERTIFICATE for that domain, and a certificate can only be
// issued to whoever controls the zone it is served from. That is us. No amount
// of model-written anything reaches it.
//
// The mechanism is Cloudflare for SaaS: we register the customer's hostname
// against our zone, they point DNS at us, Cloudflare issues and renews the
// certificate, and the request arrives at this Worker with their `Host`. This
// module is the decision half — what may be claimed, by whom, and what the
// owner has to be told to do. The API calls live in `worker.js`.

/**
 * OUR OWN NAMES, WHICH NOBODY ELSE MAY EVER CLAIM.
 *
 * This is the single most important line in the file. Requests are routed by
 * `Host`, so a stored row saying `gofarther.dev → some-slug` would serve a
 * stranger's site in place of the whole platform — the app, the sign-in page,
 * every API route. `www.` is the same hole one label along, and a wildcard
 * subdomain claim would take the auth proxy with it.
 *
 * Matched as a SUFFIX with a dot, not with `endsWith` alone: `endsWith(".dev")`
 * is not the question, and `notgofarther.dev` must remain claimable by whoever
 * actually owns it.
 *
 * `gofarther.app` IS IN HERE FOR A SECOND REASON, and it is the one that bites.
 * Every published site has an automatic address at `<slug>.gofarther.app`, so
 * leaving that zone claimable lets somebody register `sharp-fade.gofarther.app`
 * as their "custom domain" pointing at THEIR slug — two rows answering for one
 * hostname, and whichever the lookup finds first wins. The subdomain space is
 * ours to hand out, never a customer's to claim.
 */
export const OWN_ZONES = ["gofarther.dev", "gofarther.app"];

/**
 * The two zones do DIFFERENT JOBS, and `isOwnHostname` can no longer tell them
 * apart — which is the trap in this change rather than a detail of it.
 *
 * `APP_ZONE` serves the workspace: the builder, sign-in, every `/api/` route.
 * `SITE_ZONE` serves customers' published sites, one subdomain each, and
 * NOTHING of the app. Before this there was one zone and `isOwnHostname` meant
 * both things at once; anything that asked it "is this the app?" now has to ask
 * `isAppHostname` instead, or a site on the `.app` zone gets served as though
 * it were mounted under `/s/<slug>/` on the workspace.
 *
 * Keeping customer content on a separate REGISTRABLE domain is worth having on
 * its own: model-written page code runs on `gofarther.app`, so a stored XSS on
 * somebody's published site is same-origin with nothing that matters — the
 * owner's session lives on `gofarther.dev` and cookies do not cross a
 * registrable boundary.
 */
export const APP_ZONE = "gofarther.dev";
export const SITE_ZONE = "gofarther.app";

/**
 * IS THE SITE ZONE ACTUALLY SERVING? One switch, and everything reads it.
 *
 * The zone has to be added to Cloudflare, its nameservers moved and a wildcard
 * record created before a single `<slug>.gofarther.app` resolves. Until then a
 * pretty URL is a link that does not load, so `siteHostFor` answers null and
 * every caller falls back to the `/s/<slug>/` address that has always worked.
 *
 * It pairs with the Worker route in `wrangler.jsonc`: a route for
 * a zone that is not in the account FAILS THE WHOLE DEPLOY at the routes PUT —
 * measured on 2026-08-07 with the bare wildcard route, which took three merges
 * down. The two must flip together, and `test/site-zone.test.mjs` asserts they agree in both
 * directions so neither can be turned on alone.
 */
export const SITE_ZONE_LIVE = true;

/**
 * Labels under the site zone that are never a customer's site.
 *
 * Some are already taken by DNS the platform needs (`www`, `_domainconnect`);
 * the rest are the names anything we build later would reach for first. A slug
 * is claimed first-come and cannot be renamed, so a customer holding `api` is
 * a name we can never use again — cheaper to reserve now than to negotiate.
 */
const RESERVED_SUBS = new Set([
  "www", "api", "app", "admin", "mail", "email", "smtp", "ns", "ns1", "ns2",
  "cdn", "static", "assets", "files", "img", "images", "media", "upload",
  "saas", "status", "docs", "help", "support", "blog", "dev", "staging",
  "test", "demo", "preview", "dashboard", "account", "billing", "auth",
  "login", "signup", "go", "s", "u", "_domainconnect", "_dck1", "_dck2",
]);

/** RFC 1035 lengths. A label is 63, a name is 253. */
const MAX_LABEL = 63, MAX_NAME = 253;

/**
 * Names that are never a customer's to point at us, whoever asks.
 *
 * `localhost` and the reserved TLDs are here because a row for one of them is a
 * routing entry that could collide with a developer's own machine or with
 * name resolution somewhere we do not control.
 */
const RESERVED_TLDS = new Set(["localhost", "local", "test", "invalid", "example", "internal", "home", "lan", "onion"]);

/**
 * Reduce whatever an owner typed to a bare hostname, or refuse it.
 *
 * People paste `https://www.example.com/`, `example.com.`, `Example.COM`, and
 * `example.com:443`. All of those mean one thing and all of them are accepted;
 * anything that is not a single ordinary hostname is REFUSED rather than
 * cleaned up, because this value ends up as a routing key and a guess about
 * what somebody meant is a guess about whose traffic goes where.
 *
 * ASCII ONLY, and a unicode domain must be given in punycode (`xn--…`). Not
 * laziness: `аpple.com` with a Cyrillic а is a different name that renders
 * identically, and normalising one into the other here would be this platform
 * choosing which of two owners gets the traffic.
 */
export function normalizeHostname(raw) {
  let s = String(raw == null ? "" : raw).trim().toLowerCase();
  if (!s) return null;
  // A protocol and everything after the authority are stripped, not refused —
  // pasting a URL is what people do.
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  s = s.split("/")[0].split("?")[0].split("#")[0];
  // A port is dropped: we serve 443 and nothing else, so `:443` is noise and
  // any other port is a request we cannot honour.
  const colon = s.indexOf(":");
  if (colon >= 0) {
    if (s.slice(colon + 1) !== "443") return null;
    s = s.slice(0, colon);
  }
  // The root dot is legal in DNS and never what somebody types deliberately.
  s = s.replace(/\.$/, "");
  if (!s || s.length > MAX_NAME) return null;

  const labels = s.split(".");
  // A single label is not a domain — it is a machine name on somebody's LAN,
  // and it can never be validated by DNS.
  if (labels.length < 2) return null;
  for (const l of labels) {
    if (!l || l.length > MAX_LABEL) return null;
    // LDH: letters, digits, hyphen, not leading or trailing.
    //
    // THIS ONE LINE IS THE WHOLE CHARACTER GUARD, and it is worth saying so
    // because two separate checks above it were deleted once mutation testing
    // proved they could never fire. A `*` anywhere makes a label that fails
    // here; so does the `@` in `user@example.com`, which splits into the label
    // `user@example`. Both were removed rather than left as protection that
    // reads real and is not — the failure mode this codebase keeps recording.
    // Anything added here later must be checked the same way.
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(l)) return null;
  }
  // A bare IPv4 address parses as four labels of digits. It is not a hostname,
  // cannot be certified, and would be a routing key nobody owns.
  if (/^\d+(\.\d+)+$/.test(s)) return null;
  if (RESERVED_TLDS.has(labels[labels.length - 1])) return null;
  return s;
}

/** Is this one of ours, or under one of ours? Either zone. */
export function isOwnHostname(host) {
  const h = String(host || "").toLowerCase();
  return OWN_ZONES.some((z) => h === z || h.endsWith("." + z));
}

/**
 * Is this the WORKSPACE, as opposed to a published site?
 *
 * The narrow question `isOwnHostname` used to answer by accident, split out
 * when the site zone arrived. Everything that serves the app, and everything
 * that decides whether a bundle is mounted at `/s/<slug>/` or at `/`, asks this
 * one — asking the wide one gives the site zone the app's answer.
 */
export function isAppHostname(host) {
  const h = String(host || "").toLowerCase();
  return h === APP_ZONE || h.endsWith("." + APP_ZONE);
}

/**
 * The ORIGIN a site's root-served paths live on — its uploads, its API.
 *
 * Distinct from `siteUrlFor`, and the difference is the trap. That one answers
 * "where is this site's home page", which is `gofarther.dev/s/<slug>/` when there
 * is no pretty host — a PATH. Appending `/u/<slug>/<file>` to it gives
 * `gofarther.dev/s/<slug>/u/<slug>/<file>`, which is precisely the shape that
 * 404'd every image on the platform. Uploads hang off the ORIGIN, never off the
 * site's home page.
 *
 * The platform's own domain is the fallback because that is where a site with no
 * pretty host really is served from — the tool's domain, standing in for the
 * customer's, which is exactly the case this is for.
 */
export function siteOrigin(slug, appOrigin) {
  const host = siteHostFor(slug);
  return host ? "https://" + host : String(appOrigin || "");
}

/**
 * Paths the Worker answers at the ROOT, so a pretty-hostname rewrite must leave
 * them alone.
 *
 * A published site is served by prefixing the request with `/s/<slug>/`, and
 * `/api/` was excluded from that from the start. `/u/` was not — and it is
 * exactly the same kind of path: `/u/<slug>/<file>` already carries its own slug
 * and is matched at the root, so prefixing it produces `/s/<slug>/u/<slug>/…`,
 * which no route matches.
 *
 * MEASURED LIVE 2026-08-09 on `forno-and-co.gofarther.app`: the home page's one
 * photograph — a real file, really uploaded, and one the customer's build paid
 * for — 404'd on the pretty address and served 200 on `gofarther.dev/s/<slug>/`.
 * So every image on every site was broken on the ONLY address anybody shares,
 * and fine on the one nobody sees.
 *
 * ONE LIST, used by both rewrites. The site-zone branch and the custom-domain
 * branch had a copy each and only ever agreed by coincidence; two lists of the
 * same paths is the failure this codebase keeps recording, most recently in the
 * route-dispatch gates.
 *
 * The cost, stated: a site can serve another site's uploads through its own
 * hostname. Those objects are already public at `gofarther.dev/u/…` and are
 * served `inline` with SVG refused at the door, so this exposes nothing new —
 * and the alternative, checking the path's slug against the hostname's, would
 * break the case a site legitimately has: an owner moving a picture between two
 * of their own sites.
 */
export function servedAtRoot(pathname) {
  const p = String(pathname || "");
  return p.startsWith("/api/") || p.startsWith("/u/");
}

/**
 * The URL prefix a published site is mounted at, from the host it was asked for.
 *
 * FOURTH PLACE TO ASK "WHICH MOUNT IS THIS", and the first one that had to ask
 * it from inside a customer's own Worker script. It was a bare expression in
 * `worker.js` until the site-script tier, which is exactly the shape
 * `isPublishedSiteRequest` was extracted to stop: a rule with two copies, whose
 * drift is silent because the site still renders.
 *
 * One label on the site zone and every custom domain serve the site at the
 * ROOT; only the workspace serves one under a path.
 */
export function mountRootFor(hostname, slug) {
  return isAppHostname(hostname) ? "/s/" + String(slug || "") + "/" : "/";
}

/**
 * Turn a built page's RELATIVE asset references into absolute ones.
 *
 * WHY THIS EXISTS, and it is not cosmetic. The template sets vite `base: "./"`,
 * so every `<script src>` and `<link href>` in a prerendered document is
 * written `./assets/…` — resolved by the browser against the DIRECTORY of
 * whatever URL it was served at. That is correct only when the document is
 * served at the mount root, and wrong everywhere else:
 *
 *   /book            → directory `/`       → /assets/x.js         ✅
 *   /book/           → directory `/book/`  → /book/assets/x.js    ✗ 404
 *   /services/cuts   → directory `/services/` → /services/assets/x.js ✗ 404
 *
 * A 404 on the bundle is a blank page, so a visitor who typed a trailing slash
 * got nothing. The static serve path has always rewritten these; the site's own
 * Worker script served the document verbatim and reintroduced it, which is why
 * this became shared code rather than staying a one-line expression.
 *
 * Anchored on the SPACE before the attribute so it cannot match inside a value,
 * and on `="./` so an already-absolute reference is left alone.
 */
export function absolutizeAssets(html, mountRoot) {
  return String(html == null ? "" : html)
    .replace(/(\s(?:src|href))="\.\//g, '$1="' + (mountRoot || "/"));
}

/**
 * Is this request going to be answered by a published customer site?
 *
 * THE SECURITY HEADERS NEED THIS AND WERE ASKING THE WRONG QUESTION. `harden()`
 * in worker.js picked the permissive website policy off the raw pathname —
 * `/s/…` or `/preview/…` — which was the whole truth only while a site was
 * served from `gofarther.dev/s/<slug>/`. Both hostname rewrites replace the
 * pathname INSIDE `handleRequest`, and `harden` is handed the original request,
 * so `<slug>.gofarther.app/` arrived looking like `/` and every published site
 * on every customer-facing address was served the platform's lockdown policy:
 * `frame-ancestors 'none'`, `X-Frame-Options: DENY`, and a `frame-src` with no
 * map hosts. Measured live on two real sites 2026-08-10.
 *
 * It lives HERE rather than in worker.js because worker.js cannot be imported
 * and this is the third place that had to answer "which mount is this" — the
 * two rewrites being the others. A copy in an untestable file is how the answer
 * drifts, and the drift is silent: the site still renders, so only a person
 * looking at a preview pane or a map can tell.
 *
 * Asked through the same helpers the rewrites use, in the same order. `/api/`
 * and `/u/` stay on the app policy because the router leaves them unrewritten;
 * the bare zone apex is NOT a site (no label), so its redirect keeps the strict
 * headers rather than being handed a customer policy it has no use for.
 */
export function isPublishedSiteRequest(hostname, pathname) {
  const p = String(pathname || "");
  if (p.startsWith("/s/") || p.startsWith("/preview/")) return true;
  if (servedAtRoot(p)) return false;
  return !!siteHostSlug(hostname) || !isOwnHostname(hostname);
}

/**
 * A slug that may be a DNS label.
 *
 * A build slug is already `[a-z0-9-]` capped at 60 (`worker.js`), so this is
 * nearly always true — but that filter permits `-shop` and `shop-`, which are
 * not legal labels, and a name that cannot exist in DNS must not be offered as
 * an address. Such a site keeps the `/s/<slug>/` one and loses nothing.
 */
function labelOk(slug) {
  const s = String(slug || "").toLowerCase();
  return s.length > 0 && s.length <= MAX_LABEL && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(s);
}

/**
 * `<slug>.gofarther.app` → the slug, or null.
 *
 * ONE LABEL, DELIBERATELY. Cloudflare's Universal SSL covers `gofarther.app`
 * and `*.gofarther.app` and nothing deeper, so `a.b.gofarther.app` has no
 * certificate and cannot be served over HTTPS at all — matching it here would
 * be routing a request to a site the browser will refuse to load, which reads
 * to the visitor as the site being broken rather than the name being wrong.
 *
 * The apex and `www` answer null too. They are the zone itself, not a site;
 * `worker.js` sends them to the workspace rather than serving whichever
 * customer happened to pick that word.
 */
export function siteHostSlug(host) {
  const h = String(host || "").toLowerCase().replace(/\.$/, "");
  const suffix = "." + SITE_ZONE;
  if (!h.endsWith(suffix)) return null;
  const label = h.slice(0, -suffix.length);
  if (RESERVED_SUBS.has(label)) return null;
  // `labelOk` IS THE WHOLE SECOND-LABEL CHECK. There was an explicit
  // `label.includes(".")` here and a mutation proved it could never fire: the
  // label pattern permits no dot, so `a.b` fails it anyway. Removed rather than
  // left as protection that reads real and is not — the same call, for the same
  // reason, that `normalizeHostname` records two lines above its own LDH test.
  return labelOk(label) ? label : null;
}

/**
 * The other direction: a slug → the address to SHOW somebody, or null.
 *
 * Null while the zone is dark, and null for a slug that cannot be a label —
 * both mean "this site has no pretty address", which every caller already
 * handles by falling back to `/s/<slug>/`.
 *
 * The inverse of `siteHostSlug` and asserted to be: two functions that disagree
 * about which hostname belongs to which site is a link the panel prints and the
 * router does not recognise.
 */
export function siteLabelFor(slug) {
  const s = String(slug || "").toLowerCase();
  if (RESERVED_SUBS.has(s) || !labelOk(s)) return null;
  return s + "." + SITE_ZONE;
}

export function siteHostFor(slug) {
  // TWO QUESTIONS, KEPT APART, and a mutation is why. Folded together, every
  // assertion about which slugs can be a hostname passed VACUOUSLY while the
  // zone was dark — the flag returned null first, so deleting the label rules
  // entirely changed nothing any test could see, and they would have come back
  // to life untested on the day the flag flipped. `siteLabelFor` answers "can
  // this slug be a hostname" and is testable today; this one answers "should we
  // show it yet".
  return SITE_ZONE_LIVE ? siteLabelFor(slug) : null;
}

/** The full public URL of a published site, pretty when there is one. */
export function siteUrlFor(slug, origin) {
  const host = siteHostFor(slug);
  if (host) return "https://" + host + "/";
  return String(origin || "") + "/s/" + String(slug || "") + "/";
}

/**
 * May this hostname be claimed at all?
 *
 * Returns `null` when it may, or a sentence the owner can act on. A REASON
 * rather than a boolean, because "that domain cannot be used" with nothing
 * after it is the kind of message that generates a support conversation.
 */
export function claimRefusal(raw) {
  const host = normalizeHostname(raw);
  if (!host) return "That doesn't look like a domain name. Enter it like sharpfadebarbers.com.";
  if (isOwnHostname(host)) return "That domain belongs to this platform and can't be pointed at a site.";
  return null;
}

/**
 * An apex (`example.com`) or a subdomain (`www.example.com`)?
 *
 * It decides what the owner has to do, and the two are genuinely different
 * problems: a CNAME is illegal at the apex of a zone, so an owner whose DNS
 * provider has no ALIAS/ANAME/flattening cannot point their bare domain at us
 * with a CNAME however clearly we ask.
 *
 * DELIBERATELY NAIVE — two labels is apex, more is a subdomain. That is wrong
 * for `example.co.uk`, which is an apex with three, and getting it right needs
 * the public suffix list: ~10,000 entries that go stale, shipped into a Worker,
 * to change the WORDING of an instruction. The cost of being wrong is telling a
 * `.co.uk` owner to use a CNAME when they could have; the cost of being right
 * is a list nobody maintains. Both forms are offered either way.
 */
export function isApex(host) {
  return String(host || "").split(".").length === 2;
}

/**
 * What the owner has to add at their DNS provider.
 *
 * `target` is our fallback origin — the hostname Cloudflare for SaaS routes
 * custom hostnames to. Returned as DATA, not a sentence, so the panel can
 * render a copyable table: an owner is about to type this into a form on
 * another website and a paragraph is the wrong shape for that.
 */
export function dnsInstructions(host, target) {
  const apex = isApex(host);
  const records = [{
    kind: "CNAME",
    name: apex ? "@" : host.split(".").slice(0, -2).join("."),
    value: target,
    note: apex
      ? "At the apex a plain CNAME is illegal, so this needs your provider's ALIAS, ANAME or CNAME-flattening option. If they don't offer one, use www instead and redirect the bare domain to it."
      : "A plain CNAME record.",
  }];
  return { hostname: host, apex, records };
}

/**
 * Turn Cloudflare's custom-hostname record into what the OWNER needs to see.
 *
 * Two independent things have to happen and an owner who is shown one number
 * cannot tell which is stuck: DNS has to point at us (`status`), and the
 * certificate has to be issued (`ssl.status`). A domain can be verified and
 * have no certificate, which serves nothing, and it can have a certificate
 * while DNS still points at the old host, which also serves nothing.
 *
 * `pending_validation` is not a failure and must not read as one — issuing
 * routinely takes minutes and can take longer while DNS propagates.
 */
export function readStatus(rec) {
  const r = rec && typeof rec === "object" ? rec : {};
  const ssl = r.ssl && typeof r.ssl === "object" ? r.ssl : {};
  const dns = String(r.status || "unknown").toLowerCase();
  const cert = String(ssl.status || "unknown").toLowerCase();
  const live = dns === "active" && cert === "active";
  // The records the owner may still need to add. Ownership verification is a
  // TXT; certificate validation is a second TXT (or an HTTP file) and is only
  // present while it is outstanding.
  const pending = [];
  const ov = r.ownership_verification;
  if (!live && ov && ov.name && ov.value) pending.push({ kind: String(ov.type || "TXT").toUpperCase(), name: ov.name, value: ov.value });
  for (const v of (Array.isArray(ssl.validation_records) ? ssl.validation_records : []).slice(0, 4)) {
    if (v && v.txt_name && v.txt_value) pending.push({ kind: "TXT", name: v.txt_name, value: v.txt_value });
  }
  return {
    live,
    dns,
    cert,
    // Named separately from the raw statuses so a panel never has to interpret
    // a provider's vocabulary, and so a new value from Cloudflare degrades to
    // "still working" rather than to a scary word we did not anticipate.
    stage: live ? "live"
      : dns !== "active" ? "waiting for DNS"
      : "issuing the certificate",
    // Only these two are terminal. Everything else is in progress.
    failed: dns === "moved" || dns === "deleted" || cert === "timing_out" || cert === "deleted",
    pending,
  };
}
