// A published site sending a text message.
//
// WHY IT EXISTS SEPARATELY FROM EMAIL. A booking confirmation by SMS is read;
// an emailed one lands beside forty others. For a barber shop, a garage or a
// restaurant that difference IS the feature — it is what stops the no-show. And
// nothing about it can be model-written: sending a text is an HTTP call carrying
// a credential, and model output runs in a public page or in Postgres.
//
// BRING-YOUR-OWN, like mail and payments, and here the reason is sharper than
// philosophy: an SMS costs real money per message, several cents of it, on
// somebody's account. It has to be the OWNER'S account or the platform is
// funding a channel anyone with a form can spend. There is no fallback sender
// and there must not be one.
//
// Modelled on `site-mail.mjs` deliberately — same declaration shapes, same
// never-throws contract, same "the model decides the message, the platform owns
// the wire". A site that already declares `confirm` gets SMS by adding `sms`,
// and either may be used alone.

/**
 * The providers the vault knows, in the order they are tried. The OWNER picks by
 * which key they paste in; the model never names one, so switching provider is a
 * Secrets edit rather than a rebuild.
 *
 * Twilio needs TWO values, which is why this carries a `also` rather than a
 * single secret name: an account SID without its token is not a usable
 * credential, and treating it as one would pick Twilio and then fail every send.
 */
export const SMS_PROVIDERS = [
  { secret: "TWILIO_SID", also: "TWILIO_TOKEN", provider: "twilio" },
  { secret: "MESSAGEBIRD_KEY", provider: "messagebird" },
  { secret: "VONAGE_KEY", also: "VONAGE_SECRET", provider: "vonage" },
];

/**
 * 480 characters is three SMS segments.
 *
 * A cap, not a truncation of convenience: a message is BILLED PER SEGMENT, so a
 * runaway body written by a model-authored function is a bill on the owner's
 * account with no ceiling. Refusing at three is a message that did not send;
 * accepting at eighty is an invoice.
 */
export const MAX_BODY = 480;

/**
 * Normalise a phone number to E.164, or refuse it.
 *
 * STRICT, AND DELIBERATELY UNFORGIVING, because both failure modes cost money
 * and one of them is worse than not sending: a number that is wrong but valid
 * delivers somebody else's booking details to a stranger. Guessing a country
 * code from a local number is exactly that mistake — `01632 960123` is a
 * different real number in a dozen countries.
 *
 * So: an explicit `+`, then 8 to 15 digits, and nothing else. Spaces, dashes and
 * brackets are stripped because people type them; a second number, a comma or a
 * letter is refused rather than cleaned up, for the same reason
 * `site-mail.mjs`'s `recipient` refuses a list — a builder returning
 * "+1555…, +1444…" is injection whether the channel is a header or a payload.
 */
export function toE164(raw) {
  const s = String(raw == null ? "" : raw).trim();
  if (!s) return null;
  // Anything outside this alphabet means it is not a single plain number.
  if (!/^\+[0-9 ()\-.]+$/.test(s)) return null;
  const digits = s.slice(1).replace(/[^0-9]/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return "+" + digits;
}

/**
 * Validate a table's `sms` declaration against the columns it really has.
 *
 * Returns null for anything it cannot fully resolve — a half-valid declaration
 * publishes a site that looks as though it texts and does not, and nobody finds
 * out until a customer says they never got one.
 */
export function normalizeSms(def) {
  const c = def && def.sms;
  if (!c || typeof c !== "object" || Array.isArray(c)) return null;

  // THE FUNCTION FORM, and the one that matches the standing direction: the
  // model writes SQL that takes the row id and returns `{to, body}`, computed
  // from anything on the site. The cross-reference — does that function exist,
  // and is it internal? — cannot happen here, because `coerceTable` sees one
  // table and not `spec.functions`; `normalizeSchema` drops it if it does not
  // resolve, exactly as it does for `confirm`.
  const fn = String(c.fn || c.function || "").toLowerCase();
  if (fn) return /^[a-z][a-z0-9_]{0,40}$/.test(fn) && !fn.startsWith("_") ? { fn } : null;

  // The template form. The recipient column must be one THIS table declares, or
  // the model can name a column that does not exist and every send silently has
  // no recipient.
  const cols = new Set((Array.isArray(def.columns) ? def.columns : [])
    .map((x) => String(typeof x === "string" ? x : (x && x.name) || "").toLowerCase())
    .filter(Boolean));
  const to = String(c.to || "").toLowerCase();
  if (!to || !cols.has(to) || to.startsWith("_")) return null;
  const body = String(c.body || c.message || c.text || "").slice(0, MAX_BODY).trim();
  if (!body) return null;
  return { to, body };
}

/** `{name}` filled from the row. Unknown fields become empty, never the token. */
export function fillSms(template, row) {
  return String(template || "").replace(/\{([a-z0-9_]{1,40})\}/gi, (_, k) => {
    const v = row && row[String(k).toLowerCase()];
    return v == null ? "" : String(v);
  }).slice(0, MAX_BODY);
}

/** Which provider the owner configured, and the credentials for it. */
export function pickSmsProvider(secrets) {
  const s = secrets && typeof secrets === "object" ? secrets : {};
  const val = (n) => (typeof s[n] === "string" && s[n].trim() ? s[n].trim() : "");
  for (const p of SMS_PROVIDERS) {
    const key = val(p.secret);
    if (!key) continue;
    // BOTH HALVES OR NEITHER. A SID with no token is not a credential, and
    // picking the provider anyway means every send fails against an account
    // that looks configured — while a provider further down the list, which IS
    // fully configured, never gets tried.
    if (p.also) {
      const second = val(p.also);
      if (!second) continue;
      return { provider: p.provider, key, secret: second };
    }
    return { provider: p.provider, key, secret: "" };
  }
  return null;
}

/**
 * Send the text. Injected deps, so every decision is testable with no network.
 *
 * NEVER THROWS, for the same reason `sendConfirmation` does not: the booking
 * already succeeded and a broken SMS account must not be indistinguishable from
 * a broken form. Every failure comes back as a reason, and the caller logs it,
 * because this runs detached and the reason would otherwise be lost.
 */
export async function sendSms(deps, { def, row, slug }) {
  try {
    // `collect` only, matching the mail path exactly. A `user`/`feed` row is a
    // member writing their own content, and texting them about it is a message
    // they pay for — in attention — for using the site normally.
    if (!def || String(def.access || "").toLowerCase() !== "collect") return { sent: false, reason: "not a collect table" };

    const conf = normalizeSms(def);
    if (!conf) return { sent: false, reason: "no sms declared" };

    let built;
    if (conf.fn) {
      if (!deps.callFn) return { sent: false, reason: "no function runner" };
      const rowId = row && row.id;
      if (rowId == null) return { sent: false, reason: "no row id to build from" };
      const got = await deps.callFn(conf.fn, rowId);
      if (!got || typeof got !== "object") return { sent: false, reason: "sms function returned nothing" };
      built = { to: toE164(got.to), body: String(got.body == null ? "" : got.body).slice(0, MAX_BODY) };
    } else {
      built = { to: toE164(row && row[conf.to]), body: fillSms(conf.body, row) };
    }
    if (!built.to) return { sent: false, reason: "no usable number" };
    if (!built.body.trim()) return { sent: false, reason: "nothing to say" };

    // Best-effort and SAID to be: per-isolate, so a distributed flood still gets
    // through. The real control is the write limit already on this path —
    // reaching here costs an insert into the owner's own table, which they can
    // see. This stops the cheap case of one number being hit repeatedly.
    if (deps.recentlySent && (await deps.recentlySent(slug, built.to))) {
      return { sent: false, reason: "cooled down" };
    }

    const secrets = await deps.loadSecrets();
    const picked = pickSmsProvider(secrets);
    // Not an error. Most sites will never configure this, and there is no
    // platform fallback by design — every message costs the sender money.
    if (!picked) return { sent: false, reason: "no provider key in Secrets" };

    // The sender is the OWNER'S, always. Ours is never substituted: a number
    // belongs to whoever pays the carrier for it, and there is no shared one to
    // fall back to. An alphanumeric sender id (up to 11 characters, "SHARPFADE")
    // is allowed where a plain number is not, because several countries permit
    // one and it is what a small business actually wants to appear as.
    const from = String((secrets && secrets.SMS_FROM) || "").trim();
    if (!from) return { sent: false, reason: "no SMS_FROM in Secrets" };
    const sender = toE164(from) || (/^[A-Za-z0-9 ]{1,11}$/.test(from) ? from : null);
    if (!sender) return { sent: false, reason: "SMS_FROM is not a number or a sender id" };

    const res = await deps.send({
      provider: picked.provider, key: picked.key, secret: picked.secret,
      from: sender, to: built.to, body: built.body,
    });
    if (!res || res.ok !== true) {
      return { sent: false, reason: "provider refused" + (res && res.status ? " (" + res.status + ")" : "") };
    }
    if (deps.markSent) await deps.markSent(slug, built.to);
    return { sent: true, provider: picked.provider };
  } catch (e) {
    // The NAME, never the message: a provider client's error can quote the
    // request, and the request carries the account credential.
    return { sent: false, reason: "sms failed: " + String((e && e.name) || "error").slice(0, 40) };
  }
}
