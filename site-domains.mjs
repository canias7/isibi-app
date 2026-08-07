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
 */
export const OWN_ZONES = ["gofarther.dev"];

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

/** Is this one of ours, or under one of ours? */
export function isOwnHostname(host) {
  const h = String(host || "").toLowerCase();
  return OWN_ZONES.some((z) => h === z || h.endsWith("." + z));
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
