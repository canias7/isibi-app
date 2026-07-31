/** Publishing: paywalls, decay, cohorts and who is doing the writing. */

const TONE = "var(--foreground)";

/* ------------------------------------------------------------------ paywall funnel */
/**
 * Readers through the wall, with the conversion at each step AND the
 * cumulative rate — the compounding is the point, because five steps at 40%
 * each is 1%, which nobody reads off the individual numbers.
 */
export function PaywallFunnel({
  steps, label,
}: {
  steps: { name: string; people: number }[]; label?: string;
}) {
  if (steps.length < 2) return null;
  const start = steps[0].people;
  const rows = steps.map((s, i) => ({
    ...s,
    step: i === 0 ? 1 : s.people / steps[i - 1].people,
    cumulative: s.people / start,
  }));
  const worst = rows.slice(1).reduce((a, b) => (b.step < a.step ? b : a));

  return (
    <div className="w-full space-y-1">
      {rows.map((r, i) => (
        <div key={r.name} className="flex items-center gap-2">
          <span className="w-[26%] shrink-0 truncate text-[10px]">{r.name}</span>
          <div className="h-4 rounded-[2px]" style={{
            width: `${Math.max(1, r.cumulative * 56)}%`,
            background: r === worst ? "var(--background)" : TONE,
            border: r === worst ? `2px solid ${TONE}` : undefined,
          }} />
          <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground">
            {r.people.toLocaleString()}
            {i > 0 ? ` · ${Math.round(r.step * 100)}% of last, ${(r.cumulative * 100).toFixed(2)}% of all` : ""}
          </span>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        {(rows[rows.length - 1].cumulative * 100).toFixed(2)}% get all the way through — steps that each look
        healthy compound to almost nothing · the weakest is {worst.name} at {Math.round(worst.step * 100)}%
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------- article decay */
/**
 * Traffic to a piece over the days after publication, on a log axis.
 *
 * The HALF-LIFE is what distinguishes news from evergreen, and it is computed
 * from the curve rather than assumed from the section it ran in.
 */
export function ArticleDecay({
  articles, height = 250, label,
}: {
  articles: { title: string; daily: number[] }[]; height?: number; label?: string;
}) {
  if (!articles.length) return null;
  const n = Math.max(...articles.map((a) => a.daily.length));
  const all = articles.flatMap((a) => a.daily.filter((v) => v > 0));
  const hi = Math.max(...all) * 1.3, lo = Math.max(1, Math.min(...all)) * 0.7;
  const x = (i: number) => (i / Math.max(1, n - 1)) * 100;
  const y = (v: number) => 100 - ((Math.log10(Math.max(1, v)) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * 100;
  const dashes = ["", "5 3", "2 2", "7 2 2 2"];
  const halfLives = articles.map((a) => {
    const peak = Math.max(...a.daily);
    const idx = a.daily.findIndex((v) => v <= peak / 2);
    return { title: a.title, days: idx < 0 ? null : idx };
  });

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `${articles.length} articles`}>
        {articles.map((a, i) => (
          <polyline key={a.title} points={a.daily.map((v, j) => `${x(j)},${y(v)}`).join(" ")}
            fill="none" stroke={TONE} strokeWidth={1.9} strokeDasharray={dashes[i % dashes.length] || undefined} vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>day 0</span><span>log traffic</span><span>day {n - 1}</span>
      </div>
      <div className="mt-0.5 space-y-0.5">
        {halfLives.map((h, i) => (
          <p key={h.title} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <svg width="16" height="4"><line x1={0} y1={2} x2={16} y2={2} stroke={TONE} strokeWidth={1.9} strokeDasharray={dashes[i % dashes.length] || undefined} /></svg>
            {h.title} · {h.days == null ? "no half-life inside the window" : `half-life ${h.days} day${h.days === 1 ? "" : "s"}`}
          </p>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- newsletter cohort */
/**
 * Retention by signup cohort, as a triangle.
 *
 * Reading DOWN a column compares cohorts at the same age, which is the only
 * fair comparison — reading across a row mixes ages and always flatters the
 * newest cohort.
 */
export function NewsletterCohort({
  cohorts, label,
}: {
  cohorts: { name: string; size: number; retained: number[] }[]; label?: string;
}) {
  if (!cohorts.length) return null;
  const periods = Math.max(...cohorts.map((c) => c.retained.length));
  const rate = cohorts.map((c) => c.retained.map((v) => v / c.size));
  const colMean = Array.from({ length: periods }, (_, p) => {
    const v = rate.map((r) => r[p]).filter((x): x is number => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  });
  const lastFull = periods - 1;
  const best = rate.reduce((bi, r, i) => ((r[Math.min(3, lastFull)] ?? 0) > (rate[bi][Math.min(3, lastFull)] ?? 0) ? i : bi), 0);

  return (
    <div className="w-full overflow-x-auto">
      <div className="inline-grid gap-px" style={{ gridTemplateColumns: `auto auto repeat(${periods}, minmax(30px, 1fr))` }}>
        <span /><span className="pb-1 pr-1.5 text-right text-[9px] text-muted-foreground">size</span>
        {Array.from({ length: periods }, (_, p) => (
          <span key={p} className="pb-1 text-center text-[9px] text-muted-foreground">m{p}</span>
        ))}
        {cohorts.map((c, ci) => (
          <div key={c.name} className="contents">
            <span className="self-center pr-1.5 text-[10px] whitespace-nowrap">{c.name}</span>
            <span className="self-center pr-1.5 text-right text-[9px] tabular-nums text-muted-foreground">{c.size}</span>
            {Array.from({ length: periods }, (_, p) => {
              const v = rate[ci][p];
              return (
                <span key={p} className="flex aspect-[3/2] items-center justify-center text-[9px]"
                  style={{
                    background: v == null ? "var(--background)" : `color-mix(in oklch, ${TONE} ${Math.round(v * 94)}%, transparent)`,
                    color: v != null && v > 0.55 ? "var(--background)" : "var(--foreground)",
                  }}>{v == null ? "" : Math.round(v * 100)}</span>
              );
            })}
          </div>
        ))}
        <span className="pt-1 pr-1.5 text-right text-[9px] text-muted-foreground">mean</span><span />
        {colMean.map((m, p) => (
          <span key={p} className="pt-1 text-center text-[10px] font-semibold tabular-nums">{m == null ? "" : Math.round(m * 100)}</span>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        Read DOWN a column to compare cohorts at the same age · {cohorts[best].name} holds up best ·
        the newest cohorts have short rows because they are young, not because they are good
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- readership daypart */
/** When people read, by day and hour, with the publishing window overlaid. */
export function ReadershipDaypart({
  days, /** grid[day][hour] */ grid, publishHours = [], label,
}: {
  days: string[]; grid: number[][]; publishHours?: number[]; label?: string;
}) {
  if (!grid.length) return null;
  const max = Math.max(...grid.flat());
  const hourTotals = Array.from({ length: 24 }, (_, h) => grid.reduce((s, r) => s + (r[h] ?? 0), 0));
  const peakHour = hourTotals.indexOf(Math.max(...hourTotals));
  const publishedAtPeak = publishHours.includes(peakHour);

  return (
    <div className="w-full overflow-x-auto">
      <div className="inline-grid gap-px" style={{ gridTemplateColumns: `auto repeat(24, minmax(12px, 1fr))` }}>
        <span />
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h} className="pb-0.5 text-center text-[8px] text-muted-foreground">{h % 6 === 0 ? h : ""}</span>
        ))}
        {days.map((d, di) => (
          <div key={d} className="contents">
            <span className="self-center pr-1.5 text-[10px] whitespace-nowrap">{d}</span>
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="aspect-square"
                style={{
                  background: `color-mix(in oklch, ${TONE} ${Math.round(((grid[di]?.[h] ?? 0) / max) * 94)}%, transparent)`,
                  boxShadow: publishHours.includes(h) ? `inset 0 0 0 1px ${TONE}` : undefined,
                }} title={`${d} ${h}:00 · ${grid[di]?.[h] ?? 0}`} />
            ))}
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        Outlined columns are when things are published · the busiest hour is {peakHour}:00
        {publishedAtPeak ? ", which is already covered" : ", and nothing is published then"}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- subscription mix */
/**
 * Revenue by plan against subscriber counts.
 *
 * The plan with the most subscribers is very often not the one paying for the
 * business, and both bars are drawn so the gap is unmissable.
 */
export function SubscriptionMix({
  plans, currency = "GBP", label,
}: {
  plans: { name: string; subscribers: number; monthlyPrice: number }[]; currency?: string; label?: string;
}) {
  if (!plans.length) return null;
  const rows = plans.map((p) => ({ ...p, revenue: p.subscribers * p.monthlyPrice }));
  const totalSubs = rows.reduce((s, r) => s + r.subscribers, 0);
  const totalRev = rows.reduce((s, r) => s + r.revenue, 0);
  const mostSubs = rows.reduce((a, b) => (b.subscribers > a.subscribers ? b : a));
  const mostRev = rows.reduce((a, b) => (b.revenue > a.revenue ? b : a));
  const money = (n: number) => new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

  return (
    <div className="w-full space-y-2">
      {rows.map((r) => (
        <div key={r.name}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] font-medium">{r.name} <span className="text-muted-foreground">{money(r.monthlyPrice)}/mo</span></span>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {Math.round((r.subscribers / totalSubs) * 100)}% of people · {Math.round((r.revenue / totalRev) * 100)}% of money
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="h-2.5 rounded-[2px]" style={{ width: `${(r.subscribers / mostSubs.subscribers) * 44}%`, background: TONE, opacity: 0.4 }} />
            <span className="h-2.5 rounded-[2px]" style={{ width: `${(r.revenue / mostRev.revenue) * 44}%`, background: TONE }} />
          </div>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        Pale is subscribers, solid is revenue · {mostSubs.name} has the most people,
        {mostSubs.name === mostRev.name ? " and also the most money" : ` but ${mostRev.name} brings the most money`}
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- contributor load */
/**
 * Output per contributor, with the CONCENTRATION measured.
 *
 * A masthead of forty where four people write half of everything is a
 * different newsroom from one where forty share it, and only the share of the
 * top few says which.
 */
export function ContributorLoad({
  contributors, height = 230, label,
}: {
  contributors: { name: string; pieces: number }[]; height?: number; label?: string;
}) {
  if (!contributors.length) return null;
  const sorted = [...contributors].sort((a, b) => b.pieces - a.pieces);
  const total = sorted.reduce((s, c) => s + c.pieces, 0);
  const topN = Math.max(1, Math.ceil(sorted.length * 0.2));
  const topShare = sorted.slice(0, topN).reduce((s, c) => s + c.pieces, 0) / total;
  const max = sorted[0].pieces;
  let run = 0;
  const half = sorted.findIndex((c) => { run += c.pieces; return run >= total / 2; }) + 1;

  return (
    <div className="w-full">
      <div className="relative flex items-end gap-[2px]" style={{ height }}>
        {sorted.map((c, i) => (
          <div key={c.name} className="flex-1" title={`${c.name}: ${c.pieces}`}
            style={{ height: `${(c.pieces / max) * 100}%`, background: TONE, opacity: i < half ? 1 : 0.42 }} />
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        {sorted.length} contributors, {total} pieces · the solid bars are the {half} people who write half of it ·
        the top fifth account for {Math.round(topShare * 100)}%
      </p>
    </div>
  );
}
