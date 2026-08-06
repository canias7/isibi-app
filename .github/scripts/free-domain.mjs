// Free a zone's apex + www for a Workers Custom Domain.
//
// WHY THIS EXISTS. `wrangler.jsonc` declares gofarther.dev and www.gofarther.dev
// as `custom_domain: true`. A Workers Custom Domain creates its OWN DNS record
// for that hostname, and Cloudflare refuses to create one where a conflicting
// A/AAAA/CNAME already sits — so a deploy against a zone whose apex is already
// answering fails at the domain-binding step rather than taking over quietly.
// This zone was serving a Lovable site from a proxied apex record.
//
// THE SAFETY IS THE TYPE FILTER, NOT THE NAME, and that is the whole reason the
// decision below is a pure function with its own test. The apex of this zone
// also carries MX and TXT records — Cloudflare Email Sending's routing, the
// SPF, the DKIM key, the DMARC policy — and every one of them has the name
// `gofarther.dev`, character for character, identical to the record being
// removed. A filter that matched on name alone would delete the platform's own
// auth mail on the way to freeing a hostname, and nobody would find out until
// login codes started landing in junk folders days later. Only A, AAAA and
// CNAME can conflict with a Custom Domain, so only those three are considered.
//
// Names match EXACTLY, against the apex and `www.` + apex. Not a suffix test:
// `notgofarther.dev` ends with the zone name and is a different domain.
// Subdomains (docs, mail, relay, smtp, model) are out of scope by the same rule.
import { pathToFileURL } from "node:url";

const API = "https://api.cloudflare.com/client/v4";

// The only record types that can collide with a Workers Custom Domain. MX, TXT,
// SRV, CAA and everything else coexist with one and must survive.
export const CONFLICTING = new Set(["A", "AAAA", "CNAME"]);

// The whole decision, as one pure function so the survival property can be
// asserted without a token, a zone, or a network call.
export function conflictingRecords(records, zoneName) {
  const zone = String(zoneName || "").trim().toLowerCase();
  if (!zone) return [];
  const targets = new Set([zone, "www." + zone]);
  return (records || []).filter(
    (r) => r && CONFLICTING.has(r.type) && targets.has(String(r.name || "").toLowerCase())
  );
}

// ── the runner ───────────────────────────────────────────────────────────────
// Guarded so importing this module for its filter cannot delete anything.

async function main() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const zoneName = String(process.env.ZONE_NAME || "").trim().toLowerCase();
  const apply = String(process.env.APPLY || "").toLowerCase() === "true";

  if (!token) {
    console.error("CLOUDFLARE_API_TOKEN is not set.");
    process.exit(1);
  }
  // A blank or wildcard zone would list every record on the account. Refuse
  // rather than interpret.
  if (!zoneName || zoneName.includes("*") || !zoneName.includes(".")) {
    console.error("ZONE_NAME must be a bare apex domain, e.g. gofarther.dev — got: " + JSON.stringify(zoneName));
    process.exit(1);
  }

  const call = async (path, init) => {
    const res = await fetch(API + path, {
      ...init,
      headers: { authorization: "Bearer " + token, "content-type": "application/json", ...(init?.headers || {}) },
    });
    let body = null;
    try { body = await res.json(); } catch { /* not json */ }
    return { status: res.status, body };
  };

  // A permission failure must be reported as one. The deploy token is scoped
  // for Workers, and DNS edit is a separate permission it may simply not carry
  // — an operator reading "0 records deleted" would take that for success.
  const fail = (what, r) => {
    const errs = (r.body && r.body.errors) || [];
    console.error("\n" + what + " failed — HTTP " + r.status);
    for (const e of errs) console.error("  [" + e.code + "] " + e.message);
    if (r.status === 403 || r.status === 401 || errs.some((e) => e.code === 9109 || e.code === 10000)) {
      console.error("\nThis reads as a PERMISSION problem, not a missing record.");
      console.error("CLOUDFLARE_API_TOKEN needs Zone:Zone:Read and Zone:DNS:Edit on " + zoneName + ".");
      console.error("It is a Workers deploy token, so it may well have neither.");
    }
    process.exit(1);
  };

  console.log((apply ? "APPLY" : "DRY RUN") + " — freeing the apex and www of " + zoneName + "\n");

  const zones = await call("/zones?name=" + encodeURIComponent(zoneName));
  if (!zones.body || !zones.body.success) fail("Zone lookup", zones);
  const zone = (zones.body.result || [])[0];
  if (!zone) {
    console.error("No zone named " + zoneName + " on this account.");
    process.exit(1);
  }
  console.log("zone " + zone.name + "  id " + zone.id + "  status " + zone.status + "\n");

  const recs = await call("/zones/" + zone.id + "/dns_records?per_page=500");
  if (!recs.body || !recs.body.success) fail("DNS record listing", recs);
  const all = recs.body.result || [];

  const doomed = conflictingRecords(all, zoneName);
  const doomedIds = new Set(doomed.map((r) => r.id));
  const kept = all.filter((r) => !doomedIds.has(r.id));

  const line = (r) =>
    "  " + String(r.type).padEnd(6) + String(r.name).padEnd(36) +
    String(r.content).slice(0, 44).padEnd(46) + (r.proxied ? "proxied" : "dns only");

  console.log("READ " + all.length + " records. These " + doomed.length + " conflict with a Custom Domain:");
  if (!doomed.length) console.log("  (none — the apex and www are already free)");
  for (const r of doomed) console.log(line(r));

  // The listing is the only record of what was there. Printed on the dry run
  // AND on the apply, because the apply is the run somebody scrolls back to.
  if (doomed.length) {
    console.log("\nRestore values, if this ever has to be undone:");
    for (const r of doomed) {
      console.log("  " + JSON.stringify({ type: r.type, name: r.name, content: r.content, proxied: r.proxied, ttl: r.ttl }));
    }
  }

  const mail = kept.filter((r) => ["MX", "TXT"].includes(r.type));
  console.log("\nUNTOUCHED — " + kept.length + " records stay, including " + mail.length + " MX/TXT (mail + verification):");
  for (const r of kept) console.log(line(r));

  if (!apply) {
    console.log("\nDRY RUN — nothing was deleted. Re-run with apply=true to remove the " + doomed.length + " above.");
    return;
  }

  let gone = 0;
  for (const r of doomed) {
    const del = await call("/zones/" + zone.id + "/dns_records/" + r.id, { method: "DELETE" });
    if (!del.body || !del.body.success) fail("Deleting " + r.type + " " + r.name, del);
    console.log("deleted  " + r.type + " " + r.name + " -> " + r.content);
    gone++;
  }

  console.log("\n" + gone + " deleted. The apex and www are free for a Workers Custom Domain.");
  console.log(zoneName + " will stop answering until the Worker deploys.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
