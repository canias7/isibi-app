// "That password has appeared in a data breach."
//
// The single highest-value password rule, and the only one that is about the
// password rather than about its shape. A complexity rule mostly produces
// `Password1!`; this catches the actual thing that gets accounts taken over,
// which is somebody reusing a password that is already on a list.
//
// K-ANONYMITY, so the password never leaves and neither does its full hash. We
// send the first five characters of the SHA-1 and get back every suffix sharing
// that prefix — several hundred of them — and do the comparison here. The
// service learns a prefix that matches roughly 1 in 2^20 of all hashes and
// nothing else. No key, no account, no cost.
//
// FAILS OPEN, deliberately and without apology: if the service is slow, down,
// rate-limiting us or blocked by the network, the answer is "we could not
// check", and refusing a signup because a third party is unavailable would make
// somebody else's outage into ours. The check is advice we can usually give, not
// a gate we can always enforce — treating it as a gate is how a dependency
// becomes a single point of failure for creating an account.

const enc = new TextEncoder();

export const PWNED_HOST = "https://api.pwnedpasswords.com/range/";
/** Short: this sits in the middle of a signup, and the fallback is fine. */
export const PWNED_TIMEOUT_MS = 2500;
/**
 * How many appearances count as "known".
 *
 * 1 is right. A password in the list even once is in a wordlist an attacker
 * already has; there is no threshold below which reuse is safe.
 */
export const PWNED_MIN_COUNT = 1;

/** SHA-1, because that is the corpus's format. Not used to store anything. */
export async function sha1Hex(text) {
  const digest = await crypto.subtle.digest("SHA-1", enc.encode(String(text)));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/**
 * Parse the range response.
 *
 * Lines are `SUFFIX:COUNT`. Anything that is not a hex suffix and a number is
 * skipped rather than trusted — this is a third party's body and it changes.
 */
export function countIn(body, suffix) {
  const want = String(suffix || "").toUpperCase();
  if (!want) return 0;
  for (const line of String(body || "").split("\n")) {
    const [s, c] = line.trim().split(":");
    if (!s || s.toUpperCase() !== want) continue;
    const n = parseInt(c, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }
  return 0;
}

/**
 * Has this password been in a breach?
 *
 * Returns {known:true, count} · {known:false} · {unknown:true, reason} — three
 * outcomes, not two, because "we could not check" is not "it is fine" and the
 * caller should be able to tell them apart even though both let the signup
 * through.
 *
 * `fetchImpl` is injected so the tests never touch the network.
 */
export async function checkPwned(password, { fetchImpl, timeoutMs = PWNED_TIMEOUT_MS } = {}) {
  if (typeof password !== "string" || !password) return { unknown: true, reason: "empty" };
  const doFetch = fetchImpl || (typeof fetch === "function" ? fetch : null);
  if (!doFetch) return { unknown: true, reason: "no_fetch" };

  let hash;
  try { hash = await sha1Hex(password); }
  catch { return { unknown: true, reason: "hash" }; }
  const prefix = hash.slice(0, 5), suffix = hash.slice(5);

  let body;
  try {
    const res = await doFetch(PWNED_HOST + prefix, {
      headers: { "add-padding": "true" }, // so the response size does not leak how many matches there were
      signal: typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined,
    });
    if (!res || !res.ok) return { unknown: true, reason: "status" };
    body = await res.text();
  } catch {
    // Down, slow, blocked, rate-limited — all the same answer, and none of them
    // is a reason to refuse somebody an account.
    return { unknown: true, reason: "unreachable" };
  }

  const count = countIn(body, suffix);
  return count >= PWNED_MIN_COUNT ? { known: true, count } : { known: false };
}

/** What to tell somebody. Names the problem without lecturing about symbols. */
export const PWNED_MESSAGE =
  "That password has appeared in a data breach — choose a different one.";
