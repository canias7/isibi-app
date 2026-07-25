// desk.ts — the support desk's shared vocabulary.
//
// Statuses, priorities and the SLA clock live in one place because the queue, the detail pane and the dashboard
// all have to agree on what "overdue" means. The status values mirror the enum in isibi.schema.json and the
// allowed moves mirror its `transitions` block — the server rejects anything else with a 409, so offering an
// illegal move would just produce an error the agent cannot act on.

/** Minutes to first response. Mirrors `sla.mins` in isibi.schema.json — change both together. */
export const SLA_MINUTES = 240

// Mirrors the `enum` columns in isibi.schema.json, which the generated db-types.ts turns into the same literal
// types — so a form can hold a TYPED value rather than a bare string that only fails at the server.
export type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed'
export type Priority = 'urgent' | 'high' | 'normal' | 'low'

export const STATUSES: TicketStatus[] = ['open', 'pending', 'resolved', 'closed']
export const PRIORITIES: Priority[] = ['urgent', 'high', 'normal', 'low']

/** Which statuses a ticket may move to next. Mirrors the schema's `transitions`. */
export const NEXT_STATUS = {
  open: ['pending', 'resolved'],
  pending: ['open', 'resolved'],
  resolved: ['closed', 'open'],
  closed: ['open'],
}

/** A ticket still waiting on us. `resolved` and `closed` stop the clock. */
export const isLive = (t) => t && t.status !== 'resolved' && t.status !== 'closed'

/**
 * Minutes remaining against the SLA, or null when the clock has stopped.
 * Negative means breached — SlaBadge renders that as overdue rather than as time left, so the sign carries
 * meaning and must not be clamped to zero here.
 */
export function minutesLeft(ticket, now = Date.now()) {
  if (!isLive(ticket) || !ticket.created_at) return null
  const started = Date.parse(String(ticket.created_at).replace(' ', 'T'))
  if (!Number.isFinite(started)) return null
  return Math.round((started + SLA_MINUTES * 60_000 - now) / 60_000)
}

/** Sort for the agent queue: breached first, then urgency, then oldest. The order agents actually work in. */
export function queueOrder(a, b) {
  const la = minutesLeft(a), lb = minutesLeft(b)
  const breach = (n) => (n == null ? 2 : n < 0 ? 0 : 1)
  if (breach(la) !== breach(lb)) return breach(la) - breach(lb)
  const p = (t) => PRIORITIES.indexOf(t.priority || 'normal')
  if (p(a) !== p(b)) return p(a) - p(b)
  return String(a.created_at || '').localeCompare(String(b.created_at || ''))
}

/** Relative time for a thread, where "3h ago" reads faster than a timestamp. */
export function ago(iso) {
  if (!iso) return ''
  const t = Date.parse(String(iso).replace(' ', 'T'))
  if (!Number.isFinite(t)) return String(iso).slice(0, 10)
  const mins = Math.round((Date.now() - t) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`
  return `${Math.round(mins / 1440)}d ago`
}

/**
 * Canned replies. Kept as data rather than a table so the desk works on day one; move them into the database
 * when a team wants to edit their own.
 */
export const CANNED = [
  { id: 'ack', label: 'Acknowledge', body: 'Thanks for getting in touch — I have picked this up and will come back to you shortly.' },
  { id: 'info', label: 'Need more detail', body: 'To get to the bottom of this, could you tell me what you were doing just before it happened, and what you expected to see instead?' },
  { id: 'fixed', label: 'Resolved', body: 'This should be sorted now. Have a look when you get a moment and tell me if anything still looks wrong — I will keep the ticket open until you do.' },
]
