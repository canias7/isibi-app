// WHERE IS THIS DOMAIN'S DNS, AND CAN WE CONFIGURE IT FOR THEM?
//
// "Add a CNAME at whoever you bought the domain from" is the sentence that
// loses people. They do not necessarily know who that is, they have never seen
// a DNS page, and the one at their provider is four clicks deep behind a name
// like "Manage Zones".
//
// A domain's nameservers say exactly who is holding its DNS — publicly, over an
// ordinary lookup, with no permission needed from anybody. So the panel can stop
// guessing: "Your DNS is at GoDaddy", with a link straight to the page.
//
// TWO SEPARATE QUESTIONS, and conflating them is how this feature over-promises.
//   1. WHO holds the DNS?           → answerable for everybody, right now
//   2. Can WE write the record?     → needs that provider's API and a
//                                     credential the site owner grants us
// A provider we can identify but not automate is still worth identifying: a
// deep link into the right page is most of the value and costs nothing.

/**
 * Nameserver suffix → provider.
 *
 * Matched on the SUFFIX of the nameserver hostname, because every provider runs
 * numbered hosts (`ns1.`, `ns2.`, `dns17.`) off one zone. Order matters where
 * one suffix contains another, so the list is walked in order and the first
 * match wins.
 *
 * TWO MATCH FORMS, DECLARED not inferred. `ns` is a suffix — the safe default,
 * and right for almost everybody. `part` is a string that appears anywhere in
 * the nameserver, which some providers genuinely need: Route 53 answers
 * `ns-1234.awsdns-56.org`, where the brand is in the MIDDLE of a label and no
 * suffix can reach it.
 *
 * The first version inferred this from a trailing dot in the entry, and that
 * silently failed for Route 53 — the largest provider on the list. An implicit
 * convention nobody can see is worse than two named fields.
 *
 * `dns` is a deep link to the page holding the records — not the provider's home
 * page. Landing somebody on a marketing site when they are three minutes into a
 * task is the same as not linking at all.
 *
 * THERE IS NO `api` FIELD, and its absence is deliberate. The first draft
 * carried one on every entry, uniformly `false`, meaning "we cannot write
 * records here yet" — which made the panel branch that reads `true` dead code,
 * and made the field itself the declared-and-acted-on-by-nothing shape this
 * codebase has recorded six times. Writing a customer's records needs a
 * credential they grant us through a flow that does not exist, and the day one
 * does, the field comes back attached to it.
 *
 * Detection is complete on its own and is most of the value: knowing it is
 * GoDaddy, and landing on the right page, is the part people are stuck on.
 */
export const PROVIDERS = [
  { id: "cloudflare", name: "Cloudflare", ns: ["ns.cloudflare.com"], dns: "https://dash.cloudflare.com/?to=/:account/:zone/dns" },
  { id: "godaddy", name: "GoDaddy", ns: ["domaincontrol.com", "godaddy.com"], dns: "https://dcc.godaddy.com/control/dnsmanagement" },
  { id: "namecheap", name: "Namecheap", ns: ["registrar-servers.com", "namecheaphosting.com"], dns: "https://ap.www.namecheap.com/domains/list/" },
  { id: "squarespace", name: "Squarespace", ns: ["squarespacedns.com", "googledomains.com"], dns: "https://account.squarespace.com/domains" },
  { id: "route53", name: "Amazon Route 53", ns: [], part: ["awsdns"], dns: "https://console.aws.amazon.com/route53/v2/hostedzones" },
  { id: "azure", name: "Azure DNS", ns: [], part: ["azure-dns"], dns: "https://portal.azure.com/#browse/Microsoft.Network%2Fdnszones" },
  { id: "vercel", name: "Vercel", ns: ["vercel-dns.com"], dns: "https://vercel.com/dashboard/domains" },
  { id: "netlify", name: "Netlify", ns: ["nsone.net", "netlify.com"], dns: "https://app.netlify.com/teams/domains" },
  { id: "wix", name: "Wix", ns: ["wixdns.net"], dns: "https://www.wix.com/my-account/domains" },
  { id: "shopify", name: "Shopify", ns: ["shopifydns.com"], dns: "https://admin.shopify.com/settings/domains" },
  { id: "ionos", name: "IONOS", ns: [], part: ["ui-dns.", "ionos."], dns: "https://my.ionos.com/domains" },
  { id: "ovh", name: "OVH", ns: ["ovh.net"], dns: "https://www.ovh.com/manager/#/web/domain" },
  { id: "gandi", name: "Gandi", ns: ["gandi.net"], dns: "https://admin.gandi.net/domain" },
  { id: "hover", name: "Hover", ns: ["hover.com"], dns: "https://www.hover.com/control_panel/domains" },
  { id: "porkbun", name: "Porkbun", ns: ["porkbun.com"], dns: "https://porkbun.com/account/domainsSpeedy" },
  { id: "namedotcom", name: "Name.com", ns: ["name.com"], dns: "https://www.name.com/account/domain" },
  { id: "dnsimple", name: "DNSimple", ns: ["dnsimple.com"], dns: "https://dnsimple.com/a/domains" },
  { id: "digitalocean", name: "DigitalOcean", ns: ["digitalocean.com"], dns: "https://cloud.digitalocean.com/networking/domains" },
  { id: "linode", name: "Akamai / Linode", ns: ["linode.com"], dns: "https://cloud.linode.com/domains" },
  { id: "hetzner", name: "Hetzner", ns: ["hetzner.com", "hetzner.de"], dns: "https://dns.hetzner.com/" },
  { id: "namesilo", name: "NameSilo", ns: ["namesilo.com"], dns: "https://www.namesilo.com/account_domains.php" },
  { id: "dynadot", name: "Dynadot", ns: ["dynadot.com"], dns: "https://www.dynadot.com/domain/manage.html" },
  { id: "networksolutions", name: "Network Solutions", ns: ["worldnic.com"], dns: "https://www.networksolutions.com/my-account/domains" },
  { id: "onetwothreereg", name: "123 Reg", ns: ["123-reg.co.uk"], dns: "https://www.123-reg.co.uk/secure/cpanel/domain" },
  { id: "bluehost", name: "Bluehost", ns: ["bluehost.com"], dns: "https://my.bluehost.com/hosting/app#/domains" },
  { id: "hostgator", name: "HostGator", ns: ["hostgator.com", "launchpad.com"], dns: "https://portal.hostgator.com/domains" },
  { id: "siteground", name: "SiteGround", ns: ["siteground.net", "sgvps.net"], dns: "https://login.siteground.com/" },
  { id: "wordpress", name: "WordPress.com", ns: ["wordpress.com"], dns: "https://wordpress.com/domains/manage" },
  { id: "dnsmadeeasy", name: "DNS Made Easy", ns: ["dnsmadeeasy.com"], dns: "https://cp.dnsmadeeasy.com/" },
  { id: "easydns", name: "easyDNS", ns: [], part: ["easydns."], dns: "https://cp.easydns.com/manage/domains/" },
  { id: "he", name: "Hurricane Electric", ns: ["he.net"], dns: "https://dns.he.net/" },
];

/**
 * Nameservers that mean the domain is PARKED — bought, and pointed at the
 * registrar's holding page.
 *
 * Worth its own answer. A parked domain resolves, so the DNS check reports
 * `elsewhere` and tells the owner to change a record that does not exist yet —
 * when what is really true is "this domain has never been set up at all", which
 * is a different and much more encouraging thing to be told.
 */
const PARKED = ["sedoparking.com", "parkingcrew.net", "bodis.com", "above.com", "parklogic.com", "cashparking.com", "dan.com", "afternic.com"];

/** The provider whose nameservers these are, or null. */
export function providerFor(nameservers) {
  const list = (Array.isArray(nameservers) ? nameservers : [])
    .map((n) => String(n || "").trim().toLowerCase().replace(/\.$/, ""))
    .filter(Boolean);
  if (!list.length) return null;
  if (list.some((n) => PARKED.some((p) => n === p || n.endsWith("." + p)))) {
    return { id: "parked", name: "a parking page", dns: null, parked: true };
  }
  for (const p of PROVIDERS) {
    // A SUFFIX, anchored on a dot or on the whole name. Without the anchor,
    // `name.com` would match `myname.com` and `he.net` would match almost
    // everything — and naming the wrong provider is worse than naming none,
    // because it sends somebody to sign into an account they do not have.
    const bySuffix = (p.ns || []).some((x) => list.some((n) => n === x || n.endsWith("." + x)));
    // `part` is opt-in per provider precisely because it is the loose form.
    const byPart = (p.part || []).some((x) => list.some((n) => n.includes(x)));
    if (bySuffix || byPart) {
      return { id: p.id, name: p.name, dns: p.dns };
    }
  }
  return null;
}

/**
 * Ask DNS who holds this domain's zone.
 *
 * NS records live on the PARENT zone, so this is answerable for any registered
 * domain by anybody, with no credential — which is what makes the detection
 * half of this feature universal where the automation half cannot be.
 *
 * Asked at the REGISTRABLE domain, not the hostname: `www.shop.com` has no NS
 * records of its own, and asking for them returns nothing while `shop.com`
 * answers. Getting this wrong would report "unknown provider" for every www.
 */
export async function detectProvider(deps, hostname) {
  const host = String(hostname || "").toLowerCase().replace(/\.$/, "");
  const labels = host.split(".").filter(Boolean);
  if (labels.length < 2) return { state: "unknown" };

  // Walk UP from the registrable guess rather than down: two labels is right
  // for `shop.com` and wrong for `shop.co.uk`, and the parent of a name that
  // has no NS records of its own does. Two attempts, which covers both without
  // the public suffix list.
  for (const take of [2, 3]) {
    if (labels.length < take) break;
    const zone = labels.slice(-take).join(".");
    let body;
    try {
      const r = await deps.fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(zone)}&type=NS`, {
        headers: { accept: "application/dns-json" },
        signal: AbortSignal.timeout(5000),
      });
      if (!r || !r.ok) return { state: "unknown" };
      body = await r.json();
    } catch { return { state: "unknown" }; }
    const ns = (body && Array.isArray(body.Answer) ? body.Answer : [])
      .filter((a) => a && a.type === 2)
      .map((a) => String(a.data || "").trim().replace(/\.$/, "").toLowerCase());
    if (!ns.length) continue;
    const p = providerFor(ns);
    // NAMESERVERS ARE RETURNED EITHER WAY. An unrecognised provider is still
    // something to show — "your DNS is at ns1.somehost.net" is enough for
    // somebody to recognise their own hosting company, and it is what tells us
    // which entry to add to the list next.
    return p ? { state: "known", provider: p, nameservers: ns } : { state: "unrecognised", nameservers: ns };
  }
  return { state: "unknown" };
}

/** One line for the panel. */
export function providerSentence(found) {
  const f = found || {};
  if (f.state === "known" && f.provider && f.provider.parked) {
    return "This domain is parked at its registrar and hasn't been set up yet. Point it at us with the record below.";
  }
  if (f.state === "known") return "Your DNS is managed at " + f.provider.name + ".";
  if (f.state === "unrecognised" && f.nameservers && f.nameservers.length) {
    return "Your DNS is managed at " + f.nameservers[0] + " — add the record wherever you manage that.";
  }
  return "";
}
