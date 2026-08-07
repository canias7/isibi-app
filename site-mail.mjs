// Confirming a submission TO THE PERSON WHO MADE IT, using the site owner's own
// email provider.
//
// WHAT THE PLATFORM OWNS HERE, AND WHY IT IS ONLY THIS. The model writes the
// backend — that is the standing direction, and a catalogue of named features
// was already tried and found to be a guess about what businesses need. So this
// is deliberately NOT another verb: the eight-verb runner (`read save fetch ai
// email notify checkout respond`) is the design that was deleted, and a menu is
// finite — somebody has to extend it forever.
//
// The model decides everything that varies: which table confirms, which column
// holds the address, the subject, the words, and which of the row's own values
// appear in them. The platform owns exactly one thing, and only because there
// is no alternative: HOLDING THE KEY AND OPENING THE CONNECTION. The model's
// output runs in two places and neither can do it — a published page is public
// files, so a key in it is a key given away, and Postgres has no HTTP client
// (measured: `http` and `pg_net` are absent on Neon, asserted in `neon-e2e`).
// That is arithmetic, not a preference, and it is the whole of the exception.
//
// It fires on the WRITE PATH, not on a schedule. The Worker already proxies
// every insert a published site makes, which is where `notifyOwnerOfSubmission`
// hooks; this is one branch beside it. The old runner could only ever be driven
// by the two-minute cron, so "email the customer the moment they book" — the
// thing a booking site actually wants — was structurally out of its reach.

// The providers the vault knows, in the order they are tried. The OWNER picks by
// which key they paste in; the model never names one, so switching provider is
// a Secrets edit rather than a rebuild.
export const MAIL_PROVIDERS = [
  { secret: "RESEND_KEY", provider: "resend" },
  { secret: "SENDGRID_KEY", provider: "sendgrid" },
  { secret: "POSTMARK_KEY", provider: "postmark" },
];

// Anything longer is a mistake or an attack, and both are better refused than
// truncated into a half-sentence somebody has to interpret.
const MAX_SUBJECT = 200;
const MAX_BODY = 4000;
const MAX_ADDR = 254;                 // RFC 5321 maximum

/**
 * Validate a table's `confirm` declaration against the columns it really has.
 *
 * Returns null for anything it cannot fully resolve. A half-valid declaration is
 * worse than none: it publishes a site whose form looks like it confirms and
 * does not, and nobody finds out until a customer says they never got an email.
 */
export function normalizeConfirm(def) {
  const c = def && def.confirm;
  if (!c || typeof c !== "object" || Array.isArray(c)) return null;

  // The recipient column must be one THIS table declares. Without that the model
  // could name a column that does not exist (every send silently has no
  // recipient) or an internal one. Managed columns are excluded too — `id` is
  // not an address, and neither is `owner_id`.
  const cols = new Set((Array.isArray(def.columns) ? def.columns : [])
    .map((x) => String(typeof x === "string" ? x : (x && x.name) || "").toLowerCase())
    .filter(Boolean));
  const to = String(c.to || "").toLowerCase();
  if (!to || !cols.has(to) || to.startsWith("_")) return null;

  const subject = String(c.subject || "").trim().slice(0, MAX_SUBJECT);
  const body = String(c.body || "").trim().slice(0, MAX_BODY);
  if (!subject || !body) return null;

  return { to, subject, body };
}

/** Escape for HTML text. Values come from a form, so they are a stranger's. */
export function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * Fill `{column}` from the submitted row.
 *
 * ESCAPED ON THE WAY IN, always. The template is the owner's (via the model) and
 * the VALUES are typed by a stranger into a public form — so `{name}` holding
 * `<script>` must arrive as text. Escaping at the point of substitution rather
 * than over the finished string is what keeps the owner's own markup working.
 *
 * An unknown placeholder becomes empty rather than staying literal: a customer
 * reading "Thanks {frist_name}" has been shown a bug, and an empty gap is the
 * quieter failure.
 */
export function fill(template, row) {
  const r = row && typeof row === "object" ? row : {};
  const lower = {};
  for (const k of Object.keys(r)) lower[k.toLowerCase()] = r[k];
  return String(template || "").replace(/\{([a-z0-9_]{1,40})\}/gi, (_, k) => {
    const v = lower[String(k).toLowerCase()];
    return v == null || typeof v === "object" ? "" : esc(v);
  });
}

/**
 * A usable email address, or null.
 *
 * Deliberately loose — one @, something either side, no spaces, no commas or
 * newlines (which is what turns one recipient into a header-injected many), and
 * bounded. Refusing an odd but real address is worse than accepting one that
 * bounces, the same call `phone-input` makes.
 */
export function recipient(row, col) {
  const raw = row && typeof row === "object" ? row[col] : null;
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v || v.length > MAX_ADDR) return null;
  if (/[\s,;<>"'\\]/.test(v)) return null;
  const at = v.indexOf("@");
  if (at < 1 || at !== v.lastIndexOf("@") || at === v.length - 1) return null;
  if (!v.slice(at + 1).includes(".")) return null;
  return v;
}

/** Which provider the owner configured, by which key they pasted in. */
export function pickProvider(secrets) {
  const s = secrets && typeof secrets === "object" ? secrets : {};
  for (const p of MAIL_PROVIDERS) {
    const key = s[p.secret];
    if (typeof key === "string" && key.trim()) return { provider: p.provider, key: key.trim() };
  }
  return null;
}

/**
 * Send the confirmation. Injected deps, like `site-notify.mjs` and
 * `publish-pages.mjs`, so every decision here is testable with no network.
 *
 * NEVER THROWS. The booking already succeeded. A broken mailer must not be
 * indistinguishable from a broken form — every failure comes back as a reason
 * instead, and the caller logs it, because this runs detached and the reason
 * would otherwise be lost.
 */
export async function sendConfirmation(deps, { def, row, slug }) {
  try {
    // `collect` only. A `user` or `feed` row is a member writing their own
    // content, and mailing them about it is a notification for using the site
    // normally; `display` is the owner editing their own data.
    if (!def || String(def.access || "").toLowerCase() !== "collect") return { sent: false, reason: "not a collect table" };

    const conf = normalizeConfirm(def);
    if (!conf) return { sent: false, reason: "no confirm declared" };

    const to = recipient(row, conf.to);
    if (!to) return { sent: false, reason: "no usable address in " + conf.to };

    // Best-effort, and SAID to be: it is per-isolate, so a distributed flood
    // still gets through. The real control is the write limit already on this
    // path — reaching this code at all costs an insert into the owner's own
    // table, which they can see. This only stops the cheap case of one address
    // being hit repeatedly from one place.
    if (deps.recentlySent && (await deps.recentlySent(slug, to))) {
      return { sent: false, reason: "cooled down" };
    }

    const secrets = await deps.loadSecrets();
    const picked = pickProvider(secrets);
    // Not an error. Most sites will never configure this, and it is
    // bring-your-own by design — the platform has no fallback sender for a site.
    if (!picked) return { sent: false, reason: "no provider key in Secrets" };

    // The FROM address is the owner's, and a provider will refuse a domain the
    // owner has not verified. Ours is never substituted: a confirmation that
    // arrives from gofarther.dev for a barber shop is a worse outcome than one
    // that does not arrive, and it would spend our reputation on their mail.
    const from = String((secrets && secrets.EMAIL_FROM) || "").trim();
    if (!from) return { sent: false, reason: "no EMAIL_FROM in Secrets" };

    const out = await deps.send({
      provider: picked.provider,
      key: picked.key,
      from,
      to,
      subject: fill(conf.subject, row),
      html: fill(conf.body, row),
    });
    if (deps.markSent) { try { await deps.markSent(slug, to); } catch { /* best effort */ } }
    return out && out.ok
      ? { sent: true, status: out.status }
      : { sent: false, reason: "provider refused", status: (out && out.status) || 0 };
  } catch (e) {
    return { sent: false, reason: "threw", error: String((e && e.message) || e).slice(0, 200) };
  }
}
