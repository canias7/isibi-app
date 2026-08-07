// Keeping bots out of a published site's forms.
//
// WHY THE PLATFORM OWNS THIS. A generated site's form is a public URL that
// writes to a database, which is the most reliably spammed thing on the
// internet. The model cannot solve it: verification is a call to Cloudflare
// carrying a SECRET, and the model's output runs either in a public page (where
// a secret is a secret given away) or in Postgres (which has no HTTP client).
// Same two walls as payments and mail.
//
// The SITE key is public and belongs in the page — that is how the widget is
// designed, and it is why only half of this is ours. The owner pastes both into
// Secrets; the page gets the site key, the Worker keeps the secret.
//
// OPT-IN, AND SILENT WHEN UNCONFIGURED. A site with no `TURNSTILE_SECRET` is
// unchanged, because turning this on for everyone would break every form the
// generator has already published — the widget has to be IN the page for a token
// to exist, and existing pages do not have one.

export const TOKEN_FIELD = "cf-turnstile-response";
export const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
// Cloudflare's tokens are ~2KB at the top end. Anything far past that is not a
// token and is not worth a round trip to be told so.
export const MAX_TOKEN = 4096;

/**
 * Pull the token out of a submission and remove it from the row.
 *
 * REMOVED, not just read: the field is not a column the site declared, so
 * leaving it in means PostgREST refuses the insert for an unknown column — the
 * protection would break every form it was turned on for. It is also not
 * something to store; it is single-use and spent by the time the row is written.
 */
export function takeToken(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { token: null, row: body };
  const { [TOKEN_FIELD]: raw, ...row } = body;
  const token = typeof raw === "string" && raw && raw.length <= MAX_TOKEN ? raw : null;
  return { token, row };
}

/**
 * Is this submission allowed through?
 *
 * Three outcomes, not two, and the distinction is the whole design:
 *
 *   "off"      no secret configured — every site today, and it must stay open
 *   "pass"     verified
 *   "fail"     configured, and the token was missing, reused or forged
 *
 * FAILS OPEN ON AN OUTAGE, deliberately, and this is the same call `site-pwned`
 * makes for the same reason: Cloudflare being slow or unreachable is not a
 * reason to stop a barber shop taking bookings. A spammer gets through during
 * somebody else's outage; a refusal loses a real customer's booking permanently.
 * The two are not symmetric.
 */
export async function verify(deps, { secret, token, ip }) {
  if (!secret) return { ok: true, state: "off" };
  // Configured and no token is a REFUSAL, not an outage: the widget is in the
  // page, so a submission without one did not come from the page.
  if (!token) return { ok: false, state: "fail", reason: "no token" };

  let res;
  try {
    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", token);
    // The visitor's address, which Cloudflare uses to score the token. Omitted
    // rather than guessed when we do not have a trustworthy one — an
    // attacker-settable header here would let a caller pick their own reputation.
    if (ip) form.set("remoteip", ip);
    res = await deps.post(VERIFY_URL, form);
  } catch (e) {
    // THE NAME, NEVER THE MESSAGE. The reason is surfaced to the owner and
    // logged, and an exception message is text a third-party client wrote — it
    // can quote the request, and the request body carries the site's secret.
    // An error NAME (`TimeoutError`, `TypeError`) is a fixed vocabulary and
    // cannot carry one.
    return { ok: true, state: "unknown", reason: "unreachable: " + String((e && e.name) || "error").slice(0, 40) };
  }
  if (!res || !res.ok) return { ok: true, state: "unknown", reason: "verify " + ((res && res.status) || 0) };

  let body;
  try { body = await res.json(); } catch { return { ok: true, state: "unknown", reason: "unparseable" }; }
  // `success` must be exactly true. A body that is not the shape we expect reads
  // as an outage rather than as a pass, for the same reason the parse failure
  // above does — but it must never read as a pass, or a changed response format
  // silently disables the whole thing.
  if (body && body.success === true) return { ok: true, state: "pass" };
  const codes = (body && Array.isArray(body["error-codes"]) ? body["error-codes"] : []).slice(0, 4);
  // A BROKEN SECRET IS OURS, NOT THE VISITOR'S. `invalid-input-secret` means the
  // owner pasted the wrong value, and refusing every submission over that would
  // silently close the business's contact form. It is reported and let through,
  // where a bad token is refused.
  if (codes.includes("invalid-input-secret") || codes.includes("missing-input-secret")) {
    return { ok: true, state: "unknown", reason: "the site's Turnstile secret is not valid" };
  }
  return { ok: false, state: "fail", reason: codes.join(",") || "rejected" };
}
