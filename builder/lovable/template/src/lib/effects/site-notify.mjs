// Telling the owner a booking arrived.
//
// Until now nobody did. A barber shop took an appointment and the only way to
// find out was to log into Go Farther and look at the Data panel — which is a fine
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

import { canWriteAccess } from "./site-access.mjs";

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
 * A table ANYONE may write to (audit A30-6): `access` is the table's
 * definition (or a preset name), asked through `resolveAccess`, never the
 * stored preset string — a pair-declared table is stamped `collect` whatever
 * its pair says. In preset terms, `collect` only. A `user` or `feed` row is a member writing their own content —
 * a recipe, a post — and mailing the owner about each one is a notification
 * about somebody using the site normally. `display` cannot be written by anyone
 * but the owner, who does not need telling about their own edit.
 */
export function shouldNotify({ access, method } = {}) {
  return String(method || "").toUpperCase() === "POST" && canWriteAccess(access);
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

  // THE MISSED COUNTER (audit A12-9, owner's choice 2026-10-23): submissions
  // that arrived inside the cooldown, or whose email could not go, are counted
  // in `site_backends.notify_missed` and named once in the next email sent.
  const n = Number.isInteger(extra) && extra > 0 ? extra : 0;
  const more = n > 0
    ? `<p style="color:#666">You missed ${n} notification${n === 1 ? "" : "s"} since the last email.</p>`
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
 *   claim(slug)          → {ok, owner_uid, missed?} | {ok:false}
 *        one atomic conditional update: sets notified_at and returns the row
 *        ONLY if notifications are on and the cooldown has passed. Whoever wins
 *        sends; everyone else in the window does nothing. `missed` (the count
 *        dropped inside the window) is read when given.
 *   missed               (optional) the missed-notification counter:
 *        take(slug) → n   read and zero it, once a claim is won (0 on any error)
 *        add(slug, n)     count n more (a lost claim, or an email that did not go)
 *        Both fail open: a site whose database has no counter column notifies
 *        exactly as before.
 *   ready()              → anything (optional) | throws
 *        the sender's own settings (the owner's key and EMAIL_FROM), read by
 *        the claim's winner only, so a site with notifications off pays no
 *        read. Its answer is handed to send as the second argument.
 *   unclaim(slug, claim) → void (optional)
 *        hands the window back when `ready` throws (audit A12-9): a site with
 *        no key must not spend the cooldown on an email that cannot go.
 *   emailOf(uid)         → address | null
 *   send({to, subject, html}, ready) → void
 *
 * Returns what it did, for the log — this runs detached, so a thrown error
 * would otherwise vanish.
 */
export async function notifyOwner(deps, { slug, table, access, method, row } = {}) {
  if (!shouldNotify({ access, method })) return { sent: false, reason: "not_a_submission" };

  let claim;
  // Nothing here may throw into the caller: the submission already succeeded,
  // and a broken mailer must not look like a broken booking form.
  const counter = deps.missed && typeof deps.missed === "object" ? deps.missed : null;
  // Counting never throws into the caller and never holds the email back.
  const count = async (n) => { if (counter && typeof counter.add === "function" && n > 0) { try { await counter.add(slug, n); } catch { /* fail open */ } } };
  try { claim = await deps.claim(slug); }
  catch (e) { await count(1); return { sent: false, reason: "claim_failed", error: String((e && e.message) || e) }; }
  if (!claim || !claim.ok) { await count(1); return { sent: false, reason: "cooling_down_or_off" }; }

  // Taken (and zeroed) by the winner; handed back, plus this one, on a failure.
  let taken = 0;
  if (counter && typeof counter.take === "function") {
    try { const t = await counter.take(slug); taken = Number.isInteger(t) && t > 0 ? t : 0; } catch { taken = 0; }
  }
  const owed = taken + (Number.isInteger(claim.missed) && claim.missed > 0 ? claim.missed : 0);
  const lost = async (out) => { await count(taken + 1); return out; };

  let mail;
  if (typeof deps.ready === "function") {
    try { mail = await deps.ready(); }
    catch (e) {
      if (typeof deps.unclaim === "function") { try { await deps.unclaim(slug, claim); } catch { /* the window lapses on its own */ } }
      return lost({ sent: false, reason: "no_sender", error: String((e && e.message) || e) });
    }
  }

  let to;
  try { to = await deps.emailOf(claim.owner_uid); }
  catch (e) { return lost({ sent: false, reason: "lookup_failed", error: String((e && e.message) || e) }); }
  if (!to) return lost({ sent: false, reason: "no_address" });

  const { subject, html } = submissionEmail({ slug, table, row, extra: owed });
  try { await deps.send({ to, subject, html }, mail); }
  catch (e) { return lost({ sent: false, reason: "send_failed", error: String((e && e.message) || e) }); }
  return { sent: true, to, missed: owed };
}
