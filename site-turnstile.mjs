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
 * Read a submission as EXACTLY ONE ROW, or say why it is not one (audit A30-2).
 *
 * PostgREST takes a JSON array as a bulk insert and also accepts CSV and
 * form-encoded bodies. Where the spam check is on, anything but one JSON object
 * sent as `application/json` must be refused BEFORE the token is judged:
 * otherwise a list of rows carries no token, skips the check, and lands many
 * rows from one request. Returns `{ row }` (the parsed object) or `{ bad }`.
 */
export function oneRow(sent, contentType) {
  const type = String(contentType || "").split(";")[0].trim().toLowerCase();
  if (type !== "application/json") return { bad: "content-type" };
  let body;
  try { body = JSON.parse(typeof sent === "string" ? sent : ""); } catch { return { bad: "not-json" }; }
  if (Array.isArray(body)) return { bad: "array" };
  if (!body || typeof body !== "object") return { bad: "not-object" };
  return { row: body };
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

/**
 * THE FUNCTION A `data/rpc/<fn>` CALL NAMES, or null for any other path
 * (decision 2a, 2026-10-22).
 *
 * Lower-cased because declared names are lower-case and a looser match only
 * gates MORE. Trailing slashes are dropped so `rpc/book_slot/` cannot slip past
 * as "not a function call". A `rpc/` with nothing after it names nothing.
 */
export function rpcName(path) {
  const m = /^rpc\/+(.+)$/i.exec(String(path || ""));
  if (!m) return null;
  const fn = m[1].replace(/\/+$/, "").toLowerCase();
  return fn || null;
}

/**
 * DOES THE SITE DECLARE THIS FUNCTION AS ONE THAT WRITES?
 *
 * Exactly `writes === true` on the stored declaration. Absent (every function
 * declared before 2026-10-22) or anything else is a read, so nothing that
 * worked before this field existed is gated by it.
 */
export function rpcWrites(spec, fn) {
  if (!fn) return false;
  const fns = spec && Array.isArray(spec.functions) ? spec.functions : [];
  return fns.some((f) => f && String(f.name || "").toLowerCase() === fn && f.writes === true);
}

/**
 * THE SPAM CHECK FOR A DATABASE-FUNCTION CALL (decision 2a, the owner's option A).
 *
 * Returns null when the path is not `rpc/<fn>` (the caller's insert gate
 * applies). Otherwise `{ sent?, refused?, verdict? }`:
 *   - the token field is stripped from a one-object body whatever happens, as
 *     the insert path does, because it is not one of the function's arguments;
 *   - no secret configured: passes, exactly as before;
 *   - the function is not declared `writes: true`: passes (reads, old specs);
 *   - a declared write: the token is required and verified exactly as an
 *     insert's is. A body that is not one JSON object carries no token, so the
 *     verifier refuses it ("no token").
 *
 * deps: { config: async () => ({ secret }), spec: async () => spec, post }.
 * A schema that cannot be read fails open, as the insert gate does.
 */
export async function rpcGate(deps, { path, sent, contentType, ip }) {
  const fn = rpcName(path);
  if (fn === null) return null;
  const body = oneRow(sent, contentType).row || null;
  const had = !!body && TOKEN_FIELD in body;
  const { token, row } = takeToken(body);
  const out = had ? { sent: JSON.stringify(row) } : {};
  const { secret } = (await deps.config()) || {};
  if (!secret) return out;
  let spec;
  try { spec = await deps.spec(); } catch { return out; }
  if (!rpcWrites(spec, fn)) return out;
  const verdict = await verify({ post: deps.post }, { secret, token, ip });
  if (verdict.ok) return { ...out, verdict };
  return { ...out, verdict, refused: "That didn't look like it came from a person. Please try again." };
}

// ── THE PLATFORM'S OWN PAIR (2026-10-25, owner: "Go Farther provides spam
// protection itself", on by default) ─────────────────────────────────────────
//
// ONE key pair on our Cloudflare account (Worker env `TURNSTILE_SITE_KEY` /
// `TURNSTILE_SECRET`) covers every site served on our own zones, because a
// Turnstile widget's hostname covers its subdomains. A site's OWN pair, in its
// secrets, still wins. Unset, or the deploy's `-` sentinel (wrangler refuses
// an empty value), is off exactly as before; half a pair is off (A30-7).
const envValue = (x) => {
  const s = typeof x === "string" ? x.trim() : "";
  return s && s !== "-" ? s : "";
};
export function platformPair(env) {
  const secret = envValue(env && env.TURNSTILE_SECRET);
  const siteKey = envValue(env && env.TURNSTILE_SITE_KEY);
  return secret && siteKey ? { secret, siteKey } : null;
}

/**
 * The pair a request is judged by. `own` is the site's own read
 * (`{ secret, siteKey }`); `covered` is `true` only when the platform's widget
 * can render where the request came from (our own hostnames). A site on a
 * customer's own domain is not covered, so it stays as its own pair says (off
 * without one). Anything but `true` is not covered.
 */
export function chooseTurnstile(own, env, { covered } = {}) {
  const mine = {
    secret: own && typeof own.secret === "string" ? own.secret : "",
    siteKey: own && typeof own.siteKey === "string" ? own.siteKey : "",
  };
  if (mine.secret) return { ...mine, source: "site" };
  const p = platformPair(env);
  if (p && covered === true) return { ...p, source: "platform" };
  return { ...mine, source: "off" };
}
