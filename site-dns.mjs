// Looking up what a domain ACTUALLY points at, right now.
//
// WHY THIS EXISTS. "Waiting for DNS" is true and useless. It is the same
// sentence whether the owner has not touched their registrar yet, typed
// `saas.gofarther.dev.` with a trailing dot into a field that already appends
// one, put the record on `www` when they meant the apex, or done everything
// right four minutes ago. Those need four different responses and the panel was
// giving one.
//
// So: resolve it ourselves and SAY WHAT WE SEE. A live answer turns a support
// conversation into a sentence somebody can act on without leaving the page.
//
// DNS-over-HTTPS, which needs no key, no account and no library — it is an
// ordinary GET returning JSON. The resolver is a third party on a path an owner
// waits on, so every failure reads as "unknown" and never as a verdict.

/** Cloudflare's public resolver. `application/dns-json` is the response shape. */
export const DOH = "https://cloudflare-dns.com/dns-query";

/** NOERROR / NXDOMAIN — the only two rcodes this has to tell apart. */
const NOERROR = 0, NXDOMAIN = 3;

/** One DoH question. Returns the parsed body, or null if anything went wrong. */
async function ask(deps, name, type) {
  try {
    const r = await deps.fetch(`${DOH}?name=${encodeURIComponent(name)}&type=${type}`, {
      headers: { accept: "application/dns-json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!r || !r.ok) return null;
    return await r.json();
  } catch { return null; }
}

/** The record values of a given type, trailing dots stripped and lowercased. */
function answers(body, type) {
  const list = body && Array.isArray(body.Answer) ? body.Answer : [];
  return list.filter((a) => a && a.type === type)
    .map((a) => String(a.data || "").trim().replace(/\.$/, "").toLowerCase())
    .filter(Boolean);
}

/**
 * Where does this hostname point?
 *
 * Four verdicts, and the distinction between them is the entire value:
 *
 *   ok         it resolves to us — DNS is done, only the certificate is left
 *   elsewhere  it resolves, to something else. THE MOST USEFUL ANSWER, because
 *              it means the owner has a record and it is wrong, which is a
 *              different problem from not having one, and it names what they
 *              have got so they can find it
 *   missing    it does not resolve at all — nothing has been added yet
 *   unknown    the resolver did not answer. NOT a verdict about the domain, and
 *              it must never be shown as one
 *
 * THE APEX NEEDS A SECOND QUESTION. A bare domain cannot hold a CNAME, so a
 * correctly-configured apex resolves to A records via the provider's flattening
 * — asking only for a CNAME would report `missing` for a domain that is set up
 * perfectly. So the target's own addresses are resolved too and the two sets are
 * compared. That is one extra lookup on the case most likely to be an apex, and
 * skipping it would make this tool wrong exactly where owners need it most.
 */
export async function checkDns(deps, { hostname, target }) {
  const host = String(hostname || "").toLowerCase();
  const want = String(target || "").toLowerCase().replace(/\.$/, "");
  if (!host || !want) return { state: "unknown", reason: "nothing to look up" };

  const cname = await ask(deps, host, "CNAME");
  if (!cname) return { state: "unknown", reason: "the DNS lookup didn't answer" };

  const cnames = answers(cname, 5);
  if (cnames.length) {
    // A CNAME to us, or a chain that passes through us — either is correct.
    if (cnames.some((c) => c === want || c.endsWith("." + want))) return { state: "ok", via: "CNAME", points: cnames[0] };
    return { state: "elsewhere", via: "CNAME", points: cnames[0] };
  }

  // No CNAME. Either nothing is there, or it is an apex flattened to addresses.
  const a = await ask(deps, host, "A");
  if (!a) return { state: "unknown", reason: "the DNS lookup didn't answer" };
  const ips = answers(a, 1);
  if (!ips.length) {
    // NXDOMAIN is definite; NOERROR with no answer means the name exists and
    // has no address, which for this purpose is the same thing to do about it.
    const rcode = a.Status === undefined ? NOERROR : a.Status;
    return { state: "missing", reason: rcode === NXDOMAIN ? "that domain doesn't resolve yet" : "no record found yet" };
  }

  // Compare against the TARGET'S OWN addresses rather than a hardcoded list.
  // Cloudflare's anycast ranges are not ours to pin, and a list baked in here
  // would start reporting correct setups as wrong the day they change.
  const ta = await ask(deps, want, "A");
  const targetIps = ta ? answers(ta, 1) : [];
  if (!targetIps.length) return { state: "unknown", reason: "couldn't resolve our own address to compare" };
  if (ips.some((ip) => targetIps.includes(ip))) return { state: "ok", via: "A", points: ips[0] };
  return { state: "elsewhere", via: "A", points: ips[0] };
}

/**
 * One sentence for the owner.
 *
 * Written here rather than in the panel so the wording is testable, and because
 * every one of these is a thing somebody reads while mildly annoyed.
 */
export function dnsSentence(check, target) {
  const c = check || {};
  if (c.state === "ok") return "Your DNS is pointing here. Waiting on the certificate now — that usually takes a few minutes.";
  if (c.state === "elsewhere") return "That domain currently points at " + (c.points || "somewhere else") + ". Change the " + (c.via || "CNAME") + " record to " + target + ".";
  if (c.state === "missing") return "No record yet. Add the record below at whoever you bought the domain from — changes can take up to an hour to spread.";
  return "Couldn't check the DNS just now. This doesn't mean anything is wrong.";
}
