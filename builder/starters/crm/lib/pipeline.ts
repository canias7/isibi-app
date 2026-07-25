// pipeline.ts — the sales vocabulary this app shares.
//
// Stages, their order, and how money is formatted live in ONE place because four pages disagree the moment they
// don't: a board column, a funnel step, a dashboard total and a stage dropdown all have to mean the same thing.
// The `stage` values here mirror the enum in isibi.schema.json — the server rejects anything else.

export interface Stage {
  id: string
  title: string
  /** Default likelihood of closing, used to weight the forecast until a rep overrides it on the deal. */
  probability: number
}

/** Open stages, in pipeline order. `won` and `lost` are terminal and deliberately not on the board's path. */
export const STAGES: Stage[] = [
  { id: 'discovery', title: 'Discovery', probability: 20 },
  { id: 'proposal', title: 'Proposal', probability: 50 },
  { id: 'negotiation', title: 'Negotiation', probability: 75 },
]

export const CLOSED: Stage[] = [
  { id: 'won', title: 'Won', probability: 100 },
  { id: 'lost', title: 'Lost', probability: 0 },
]

export const ALL_STAGES = [...STAGES, ...CLOSED]

export const stageTitle = (id) => (ALL_STAGES.find((s) => s.id === id) || { title: id }).title

export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'unqualified']
export const LEAD_SOURCES = ['website', 'referral', 'outbound', 'event', 'inbound-call', 'other']

/** Currency, one implementation. Whole dollars — a pipeline figure with cents in it reads as false precision. */
export const money = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('en-US')

/** Compact form for board headers and KPI tiles, where "$1.2M" beats "$1,240,000". */
export function shortMoney(n) {
  const v = Number(n) || 0
  if (Math.abs(v) >= 1_000_000) return '$' + (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (Math.abs(v) >= 1_000) return '$' + (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'k'
  return money(v)
}

/**
 * Weighted pipeline: each open deal counted at its own probability, not its face value.
 * Won deals count in full; lost ones count for nothing. This is the number a sales manager actually forecasts on,
 * and computing it in one place stops the dashboard and the board quietly disagreeing.
 */
export function weightedValue(deals) {
  return (deals || []).reduce((sum, d) => {
    if (d.stage === 'lost') return sum
    if (d.stage === 'won') return sum + (Number(d.value) || 0)
    const p = d.probability != null ? Number(d.probability) : (ALL_STAGES.find((s) => s.id === d.stage) || { probability: 0 }).probability
    return sum + (Number(d.value) || 0) * (p / 100)
  }, 0)
}

/** Win rate over CLOSED deals only — counting open deals as losses makes every young pipeline look terrible. */
export function winRate(deals) {
  const closed = (deals || []).filter((d) => d.stage === 'won' || d.stage === 'lost')
  if (!closed.length) return null
  return Math.round((closed.filter((d) => d.stage === 'won').length / closed.length) * 100)
}
