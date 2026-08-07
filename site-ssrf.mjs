// Is this host one we may connect to?
//
// A LEAF MODULE, no imports — like `site-access.mjs` and `site-errors.mjs`, and
// for the same reason. Two callers now ask this question: `safeFetch`, which
// fetches a URL a user pasted into the gallery importer, and the outbound
// webhook, which POSTs to a URL a site owner configured. A second copy would
// drift, and the direction it drifts in is one caller quietly permitting a host
// the other refuses — which is the whole of the protection.
//
// WHAT IT DEFENDS. Our Worker is inside Cloudflare's network and holds no
// special routes, but "fetch this URL for me" is still a request made from OUR
// side of the internet: an attacker who chooses the URL chooses what we connect
// to. Loopback, RFC1918, CGNAT and — the expensive one — 169.254.169.254, the
// cloud metadata endpoint that on several providers hands out credentials to
// anything that asks.
//
// The tricks below are all ways of writing an address that a naive string check
// misses, and each is a real, published bypass rather than a hypothetical:
// decimal/hex/octal integer forms of an IPv4, IPv4 embedded in IPv6 (both
// dotted and the hex form `new URL()` normalises to), NAT64, a trailing-dot
// FQDN, and the hostnames cloud providers resolve internally.

function ipv4Blocked(o) {
  const [a, b] = o;
  if (o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  if (a === 0) return true;                          // 0.0.0.0/8 "this network"
  if (a === 10) return true;                         // private
  if (a === 127) return true;                        // loopback
  if (a === 169 && b === 254) return true;           // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;  // private
  if (a === 192 && b === 168) return true;           // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function parseIPv4(h) {
  const toInt = (p) =>
    /^0x[0-9a-f]+$/i.test(p) ? parseInt(p, 16) :
    /^0[0-7]+$/.test(p) ? parseInt(p, 8) :
    /^\d+$/.test(p) ? parseInt(p, 10) : NaN;
  const parts = h.split(".");
  if (parts.length === 4) {
    const o = parts.map(toInt);
    if (o.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) return o;
  }
  // Single-integer form (decimal / 0x-hex / 0-octal) → 32-bit dotted quad.
  const n = /^0x[0-9a-f]+$/i.test(h) ? parseInt(h, 16) : /^0[0-7]+$/.test(h) ? parseInt(h, 8) : /^\d+$/.test(h) ? parseInt(h, 10) : NaN;
  if (Number.isInteger(n) && n >= 0 && n <= 0xffffffff) return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  return null;
}

// Extract the embedded IPv4 from an IPv4-mapped (::ffff:…) or NAT64 (64:ff9b::…)
// IPv6 host, in dotted OR the hex form new URL() normalizes to (::ffff:7f00:1).
function embeddedIPv4(h) {
  const dotted = h.match(/(?:^|:)((?:\d{1,3}\.){3}\d{1,3})$/);
  if (dotted) return parseIPv4(dotted[1]);
  if (/(^|:)ffff:[0-9a-f]{1,4}(:[0-9a-f]{1,4})?$/i.test(h) || /^64:ff9b:/i.test(h)) {
    const g = h.split(":").filter((x) => x !== "");
    const last = g.slice(-2).map((x) => parseInt(x, 16));
    const w1 = last.length === 2 ? last[0] : 0;
    const w2 = last.length === 2 ? last[1] : last[0];
    if (Number.isInteger(w1) && Number.isInteger(w2) && w1 <= 0xffff && w2 <= 0xffff) {
      return [(w1 >> 8) & 255, w1 & 255, (w2 >> 8) & 255, w2 & 255];
    }
  }
  return null;
}

export function hostIsBlocked(rawHost) {
  let h = (rawHost || "").toLowerCase().trim();
  if (!h) return true;
  if (h.endsWith(".")) h = h.slice(0, -1);           // trailing-dot FQDN
  if (h.startsWith("[")) { const e = h.indexOf("]"); h = e > 0 ? h.slice(1, e) : h.slice(1); }
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".internal") ||
      h.endsWith(".local") || h === "metadata.google.internal") return true;
  if (h.includes(":")) {                             // IPv6
    if (h === "::1" || h === "::") return true;      // loopback / unspecified
    if (/^fe[89ab]/.test(h)) return true;            // link-local fe80::/10
    if (/^f[cd]/.test(h)) return true;               // unique-local fc00::/7
    const embedded = embeddedIPv4(h);                // IPv4-mapped / NAT64 (dotted or hex-normalized)
    if (embedded && ipv4Blocked(embedded)) return true;
    return false;                                    // other public IPv6
  }
  const ip = parseIPv4(h);
  if (ip) return ipv4Blocked(ip);
  return false;                                      // regular hostname
}

/**
 * The whole check for a URL we are about to call OUT to: parseable, a scheme we
 * allow, and a host we may reach. Returns a reason string, or null when it is
 * fine — a reason rather than `false` because the caller has to tell an owner
 * why their webhook never fires, and "blocked" alone is not something anybody
 * can act on.
 *
 * `https` is required by default and that is a different rule from `safeFetch`,
 * which permits `http` because it fetches pages people paste in. A webhook
 * carries a customer's name, email and message off our network, and sending
 * that in clear text is not something to leave to whether the owner remembered
 * the `s`.
 */
export function blockedReason(raw, { allowHttp = false } = {}) {
  let u;
  try { u = new URL(String(raw || "")); } catch { return "not a valid URL"; }
  if (u.protocol !== "https:" && !(allowHttp && u.protocol === "http:")) {
    return allowHttp ? "only http and https are allowed" : "must be https";
  }
  if (hostIsBlocked(u.hostname)) return "that host is not reachable from here";
  return null;
}
