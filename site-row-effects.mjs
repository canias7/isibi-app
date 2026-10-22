// WHAT HAPPENS AFTER A ROW IS CREATED OR UPDATED — one step, every write path.
//
// The audit of 2026-10-17 (A12-1, A30-3) found the four side effects a site can
// declare — the owner's notification, the submitter's confirmation, the text
// message and the outward webhook — wired only into the data proxy. An order
// is inserted by `handleCheckout` on the owner connection and marked paid by
// the site's Stripe webhook; neither path passed through the proxy, so a shop
// that declared a receipt and a webhook sent neither. This module is the one
// decision all three paths now share; the Worker supplies the four senders.
//
// Every sender is the OWNER'S OWN key from the site's Secrets (RESEND_KEY,
// SENDGRID_KEY or POSTMARK_KEY with EMAIL_FROM; Twilio; WEBHOOK_URL). Nothing
// here can reach the platform's own sender.
//
// WHEN THE PERSON-FACING EFFECTS FIRE. `submission: true` means "a person just
// handed this row over": the proxy's POST, and — for a payable table — the
// moment the order is PAID, not the moment the pending row is written. A
// pending row is a customer on their way to Stripe who may never pay; a
// receipt or an owner email for it would be a promise about money nobody
// took. The webhook is different: it reports every declared action, so the
// pending insert is `created` and the paid flip is `updated`.

/**
 * Run the declared side effects for one row. Never throws, never awaits a
 * sender's delivery beyond handing it off: each dep is fire-and-forget in the
 * Worker, and one failing must not stop the others.
 *
 * deps: { notify(row), confirm(row), sms(row), webhook(action, row) }
 */
export function runRowEffects(deps, { def, action, row, submission = false } = {}) {
  const fired = [];
  if (!def) return fired;
  const r = row && typeof row === "object" ? row : {};
  const call = (name, fn) => {
    if (typeof fn !== "function") return;
    try { fn(); fired.push(name); } catch { /* a sender's fault is its own */ }
  };
  if (submission) {
    call("notify", () => deps.notify(r));
    call("confirm", () => deps.confirm(r));
    call("sms", () => deps.sms(r));
  }
  if (action === "created" || action === "updated" || action === "deleted") {
    call("webhook", () => deps.webhook(action, r));
  }
  return fired;
}
