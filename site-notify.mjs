// Telling the owner a booking arrived.
//
// Until now nobody did. A barber shop took an appointment and the only way to
// find out was to log into isibi and look at the Data panel — which is a fine
// place to review bookings and a terrible way to learn one exists.
//
// Three things make this harder than "send an email":
//
//  1. It must never slow the visitor down. The submit already succeeded by the
//     time any of this runs; a mailer being slow or down must not turn a
//     successful booking into a failed one.
//  2. It must not be weaponisable. A form is a public endpoint, and "every POST
//     sends the owner an email" is a mail bomb aimed at our own customer with a
//     trigger anyone on the internet can pull. Hence the cooldown, which is
//     claimed in the DATABASE — a per-isolate memory would let every colo send
//     its own copy of the same burst.
//  3. The submission is attacker-controlled text going into an HTML email. Same
//     class of problem as the CSV export, and the same discipline: escape it.

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ESC[c]);

/** One notification per site per window, however many submissions arrive. */
export const COOLDOWN_MS = 5 * 60_000;
/** Fields shown in the email. A form with fifty fields should not produce a wall. */
export const MAX_FIELDS = 12;
const MAX_VALUE_CHARS = 200;

/**
 * Is this a submission worth an email?
 *
 * `collect` only. A `user` or `feed` row is a member writing their own content —
 * a recipe, a post — and mailing the owner about each one is a notification
 * about somebody using the site normally. `display` cannot be written by anyone
 * but the owner, who does not need telling about their own edit.
 */
export function shouldNotify({ access, method } = {}) {
  return String(method || "").toUpperCase() === "POST" &&
         String(access || "").toLowerCase() === "collect";
}

/**
 * The email. Values are escaped, keys are escaped, and the row is trimmed to
 * something a person can read on a phone.
 *
 * Deliberately NOT a full dump: the owner is being told something arrived and
 * given enough to act on it, with a link to the place that holds the rest.
 */
export function submissionEmail({ slug, table, row, extra = 0 } = {}) {
  const entries = Object.entries(row || {})
    .filter(([k]) => k !== "id" && k !== "_fts" && k !== "owner_id")
    .slice(0, MAX_FIELDS);

  const rows = entries.map(([k, v]) => {
    let s = v && typeof v === "object" ? JSON.stringify(v) : String(v == null ? "" : v);
    if (s.length > MAX_VALUE_CHARS) s = s.slice(0, MAX_VALUE_CHARS) + "…";
    return `<tr><td style="padding:4px 12px 4px 0;color:#666;white-space:nowrap">${escapeHtml(k.replace(/_/g, " "))}</td>` +
           `<td style="padding:4px 0">${escapeHtml(s)}</td></tr>`;
  }).join("");

  const more = extra > 0
    ? `<p style="color:#666">…and ${extra} more since the last email.</p>`
    : "";

  return {
    subject: `New ${String(table).replace(/_/g, " ")} on ${slug}`,
    html:
      `<p>Someone just submitted your <strong>${escapeHtml(String(table).replace(/_/g, " "))}</strong> form on <strong>${escapeHtml(slug)}</strong>.</p>` +
      (rows ? `<table style="border-collapse:collapse;font:14px system-ui,sans-serif">${rows}</table>` : "") +
      more +
      `<p><a href="https://gofarther.dev/">Open it in Go Farther</a></p>` +
      `<p style="color:#999;font-size:12px">You can turn these off in the site's Data panel.</p>`,
  };
}

/**
 * deps:
 *   claim(slug)          → {ok, owner_uid, missed} | {ok:false}
 *        one atomic conditional update: sets notified_at and returns the row
 *        ONLY if notifications are on and the cooldown has passed. Whoever wins
 *        sends; everyone else in the window does nothing.
 *   emailOf(uid)         → address | null
 *   send({to, subject, html}) → void
 *
 * Returns what it did, for the log — this runs detached, so a thrown error
 * would otherwise vanish.
 */
export async function notifyOwner(deps, { slug, table, access, method, row } = {}) {
  if (!shouldNotify({ access, method })) return { sent: false, reason: "not_a_submission" };

  let claim;
  // Nothing here may throw into the caller: the submission already succeeded,
  // and a broken mailer must not look like a broken booking form.
  try { claim = await deps.claim(slug); }
  catch (e) { return { sent: false, reason: "claim_failed", error: String((e && e.message) || e) }; }
  if (!claim || !claim.ok) return { sent: false, reason: "cooling_down_or_off" };

  let to;
  try { to = await deps.emailOf(claim.owner_uid); }
  catch (e) { return { sent: false, reason: "lookup_failed", error: String((e && e.message) || e) }; }
  if (!to) return { sent: false, reason: "no_address" };

  const { subject, html } = submissionEmail({ slug, table, row, extra: claim.missed || 0 });
  try { await deps.send({ to, subject, html }); }
  catch (e) { return { sent: false, reason: "send_failed", error: String((e && e.message) || e) }; }
  return { sent: true, to };
}
