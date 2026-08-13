/** Legal practice: dockets, authorities, clauses and caseload. */

import { inkOn } from "./_ink";

const TONE = "var(--foreground)";

/* --------------------------------------------------------------- docket timeline */
/**
 * Filings and orders against the court's deadlines.
 *
 * A missed deadline is the only thing that matters here, so slack is COMPUTED
 * per filing rather than left to be read off two dates.
 */
export function DocketTimeline({
  entries, height = 250, label,
}: {
  entries: { day: number; label: string; kind: "filing" | "order" | "hearing"; dueDay?: number }[];
  height?: number; label?: string;
}) {
  if (!entries.length) return null;
  const span = Math.max(...entries.map((e) => Math.max(e.day, e.dueDay ?? 0))) * 1.04;
  const late = entries.filter((e) => e.dueDay != null && e.day > e.dueDay);
  const GLYPH = { filing: "▮", order: "◆", hearing: "▲" } as const;

  return (
    <div className="w-full">
      <div className="space-y-1" style={{ minHeight: height }}>
        {entries.map((e, i) => {
          const slack = e.dueDay == null ? null : e.dueDay - e.day;
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="w-[34%] shrink-0 truncate text-[10px]">
                <span className="mr-1">{GLYPH[e.kind]}</span>{e.label}
              </span>
              <div className="relative h-3.5 flex-1">
                {e.dueDay != null ? (
                  <span className="absolute top-0 bottom-0 rounded-[2px]" style={{
                    left: `${(Math.min(e.day, e.dueDay) / span) * 100}%`,
                    width: `${(Math.abs(e.dueDay - e.day) / span) * 100}%`,
                    background: TONE, opacity: 0.2,
                  }} />
                ) : null}
                <span className="absolute top-[-1px] bottom-[-1px] w-[3px] -translate-x-1/2 rounded-[1px]"
                  style={{ left: `${(e.day / span) * 100}%`, background: TONE }} />
                {e.dueDay != null ? (
                  <span className="absolute top-[-3px] bottom-[-3px] w-px -translate-x-1/2"
                    style={{ left: `${(e.dueDay / span) * 100}%`, background: TONE }} />
                ) : null}
              </div>
              <span className="w-20 shrink-0 text-right text-[9px] tabular-nums text-muted-foreground">
                d{e.day}{slack == null ? "" : slack >= 0 ? ` · ${slack}d spare` : ` · ${-slack}d LATE`}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        ▮ filing · ◆ order · ▲ hearing · the thin line is the deadline, the thick one the actual date ·
        {late.length ? ` ${late.length} filed late` : " nothing filed late"}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- citation network */
/**
 * Authorities and what cites what, with each one's INBOUND count — a case
 * cited by many later cases is load-bearing, and that is not visible from a
 * list of citations going out.
 */
export function CitationNetwork({
  cases, citations, size = 320, label,
}: {
  cases: { id: string; year: number; court?: string }[];
  /** citing → cited */ citations: { from: string; to: string }[]; size?: number; label?: string;
}) {
  if (!cases.length) return null;
  const inbound = new Map(cases.map((c) => [c.id, 0]));
  citations.forEach((c) => inbound.set(c.to, (inbound.get(c.to) ?? 0) + 1));
  const years = [...cases].sort((a, b) => a.year - b.year);
  const minY = years[0].year, maxY = years[years.length - 1].year;
  const pos = new Map(cases.map((c, i) => [c.id, {
    x: ((c.year - minY) / (maxY - minY || 1)) * 88 + 6,
    y: ((i % 5) / 4) * 76 + 12,
  }]));
  const leading = [...inbound.entries()].sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `${cases.length} authorities`}>
        {citations.map((c, i) => {
          const a = pos.get(c.from), b = pos.get(c.to);
          if (!a || !b) return null;
          return <path key={i} d={`M ${a.x},${a.y} Q ${(a.x + b.x) / 2},${(a.y + b.y) / 2 - 12} ${b.x},${b.y}`}
            fill="none" stroke={TONE} strokeWidth={0.4} strokeOpacity={0.35} />;
        })}
        {cases.map((c) => {
          const p = pos.get(c.id)!;
          const n = inbound.get(c.id) ?? 0;
          return (
            <g key={c.id}>
              <circle cx={p.x} cy={p.y} r={1.6 + n * 0.7} fill={TONE} fillOpacity={0.85} />
              {/* The oldest authority sits at the left edge and is usually the most
                  cited, so a centred label runs off the canvas — its first letters
                  are the ones that go. Anchor to the edge the node is against. */}
              <text
                x={p.x < 14 ? p.x - 1.6 - n * 0.7 : p.x > 86 ? p.x + 1.6 + n * 0.7 : p.x}
                y={p.y - 3 - n * 0.5}
                fontSize={3}
                textAnchor={p.x < 14 ? "start" : p.x > 86 ? "end" : "middle"}
                className="fill-muted-foreground"
              >
                {c.id}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Left to right is chronological, size is how often it is CITED ·
        {leading[0]} is the load-bearing authority with {leading[1]} inbound citations
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ clause comparison */
/**
 * The same clause across several agreements, scored on the terms that matter.
 *
 * The point is the OUTLIER — one contract with a materially different cap is
 * what a review is looking for, and it is identified rather than left in a table.
 */
export function ClauseComparison({
  agreements, terms, /** score[agreement][term], 0-1 where 1 is most favourable */ scores, label,
}: {
  agreements: string[]; terms: string[]; scores: number[][]; label?: string;
}) {
  if (!agreements.length) return null;
  const termMean = terms.map((_, t) => scores.reduce((s, r) => s + (r[t] ?? 0), 0) / agreements.length);
  let outlier = { a: 0, t: 0, gap: 0 };
  scores.forEach((row, a) => row.forEach((v, t) => {
    const gap = Math.abs(v - termMean[t]);
    if (gap > outlier.gap) outlier = { a, t, gap };
  }));

  return (
    <div className="w-full overflow-x-auto">
      {/* minmax(58px,…) on six terms plus a "Counterparty form" row label needs
          more width than a card has, so the last column was cut off with the
          scrollbar the only clue. 34px lets the columns shrink to fit first and
          keeps the scroll for genuinely wide comparisons. */}
      <div className="grid w-full gap-px" style={{ gridTemplateColumns: `minmax(0, max-content) repeat(${terms.length}, minmax(34px, 1fr))` }}>
        <span />
        {terms.map((t) => (
          <span key={t} className="pb-1 text-center text-[9px] leading-tight text-muted-foreground">{t}</span>
        ))}
        {agreements.map((a, ai) => (
          <div key={a} className="contents">
            <span className="self-center pr-1.5 text-[10px] whitespace-nowrap">{a}</span>
            {terms.map((t, ti) => {
              const v = scores[ai]?.[ti] ?? 0;
              const isOutlier = ai === outlier.a && ti === outlier.t;
              return (
                <span key={t} className="flex aspect-[5/2] items-center justify-center text-[9px]"
                  style={{
                    background: `color-mix(in oklch, ${TONE} ${Math.round(v * 92)}%, transparent)`,
                    color: inkOn(Math.round(v * 92)),
                    outline: isOutlier ? `2px solid ${TONE}` : undefined, outlineOffset: -2,
                  }}>{Math.round(v * 100)}</span>
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        Higher is more favourable to us · the outlined cell is the biggest departure from the norm —
        {agreements[outlier.a]}'s {terms[outlier.t]}, {Math.round(outlier.gap * 100)} points off the average
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- caseload balance */
/**
 * Matters per fee earner, weighted by complexity.
 *
 * A count alone is not a workload — six straightforward matters is not six
 * heavy ones — so the weighted total is what the bars carry.
 */
export function CaseloadBalance({
  earners, height = 230, label,
}: {
  earners: { name: string; matters: { complexity: number }[] }[]; height?: number; label?: string;
}) {
  if (!earners.length) return null;
  const rows = earners.map((e) => ({
    name: e.name, count: e.matters.length,
    weighted: e.matters.reduce((s, m) => s + m.complexity, 0),
  })).sort((a, b) => b.weighted - a.weighted);
  const maxW = Math.max(...rows.map((r) => r.weighted));
  const maxC = Math.max(...rows.map((r) => r.count));
  const mean = rows.reduce((s, r) => s + r.weighted, 0) / rows.length;
  const over = rows.filter((r) => r.weighted > mean * 1.25);

  return (
    <div className="w-full">
      <div className="space-y-1.5" style={{ minHeight: height }}>
        {rows.map((r) => (
          <div key={r.name}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px]">{r.name}</span>
              <span className="text-[9px] tabular-nums text-muted-foreground">
                {r.count} matters · weight {r.weighted}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1">
              <span className="h-2.5 rounded-[2px]" style={{ width: `${(r.count / maxC) * 26}%`, background: TONE, opacity: 0.35 }} />
              <span className="h-2.5 rounded-[2px]" style={{ width: `${(r.weighted / maxW) * 58}%`, background: TONE }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground" aria-label={label}>
        Pale is the matter count, solid is weighted by complexity ·
        {over.length ? ` ${over.map((r) => r.name).join(", ")} carrying more than a quarter above the average` : " within a quarter of the average all round"}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- settlement ladder */
/**
 * Offers over time against the expected value of going to trial.
 *
 * Expected value is probability times award minus costs, COMPUTED — an offer
 * only looks good or bad against that number, never on its own.
 */
export function SettlementLadder({
  offers, probabilityOfWin, likelyAward, ownCosts, currency = "GBP", height = 240, label,
}: {
  offers: { date: string; amount: number; from: "claimant" | "defendant" }[];
  probabilityOfWin: number; likelyAward: number; ownCosts: number; currency?: string;
  height?: number; label?: string;
}) {
  if (!offers.length) return null;
  const ev = probabilityOfWin * likelyAward - (1 - probabilityOfWin) * ownCosts;
  const max = Math.max(likelyAward, ...offers.map((o) => o.amount)) * 1.06;
  const money = (n: number) => new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  const beats = offers.filter((o) => o.amount >= ev);

  return (
    <div className="w-full">
      <div className="relative flex items-end gap-2" style={{ height }}>
        {offers.map((o, i) => (
          // h-full is load-bearing: the column's only children are absolutely
          // positioned, so without it items-end sizes it to zero and every bar's
          // percentage height resolves against nothing.
          <div key={i} className="relative h-full flex-1" title={`${o.date}: ${money(o.amount)}`}>
            <div className="absolute bottom-0 w-full" style={{
              height: `${(o.amount / max) * 100}%`,
              background: o.from === "defendant" ? TONE : "var(--background)",
              border: o.from === "defendant" ? undefined : `2px solid ${TONE}`,
            }} />
          </div>
        ))}
        <div className="pointer-events-none absolute right-0 left-0 border-t-2 border-dashed border-foreground"
          style={{ bottom: `${(ev / max) * 100}%` }} />
      </div>
      <div className="mt-1 flex gap-2">
        {offers.map((o, i) => <span key={i} className="flex-1 text-center text-[9px] text-muted-foreground">{o.date}</span>)}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground" aria-label={label}>
        Dashed is the expected value of trial: {Math.round(probabilityOfWin * 100)}% × {money(likelyAward)} less
        {" "}{money(ownCosts)} of costs if it goes wrong = {money(ev)} ·
        {beats.length ? ` ${beats.length} offer${beats.length === 1 ? "" : "s"} beat it` : " no offer beats it yet"}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- discovery volume */
/**
 * Documents through review, with the REVIEW RATE turned into elapsed days.
 *
 * A collection of two million documents is a number; at 60 documents an hour
 * per reviewer it is a schedule, and the schedule is what gets argued about.
 */
export function DiscoveryVolume({
  stages, reviewers, docsPerHour, hoursPerDay = 7, label,
}: {
  stages: { name: string; documents: number }[]; reviewers: number; docsPerHour: number;
  hoursPerDay?: number; label?: string;
}) {
  if (!stages.length) return null;
  const start = stages[0].documents;
  const perDay = reviewers * docsPerHour * hoursPerDay;
  const toReview = stages[stages.length - 1].documents;
  const days = perDay > 0 ? toReview / perDay : Infinity;

  return (
    <div className="w-full space-y-1">
      {stages.map((s, i) => (
        <div key={s.name} className="flex items-center gap-2">
          <span className="w-[32%] shrink-0 truncate text-[10px]">{s.name}</span>
          <span className="h-4 rounded-[2px]" style={{ width: `${(s.documents / start) * 52}%`, background: TONE, opacity: 1 - i * 0.13 }} />
          <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground">
            {s.documents.toLocaleString()}
            {i > 0 ? ` · ${Math.round((s.documents / stages[i - 1].documents) * 100)}% kept` : ""}
          </span>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        {toReview.toLocaleString()} to review · {reviewers} reviewers at {docsPerHour}/hour is
        {" "}{perDay.toLocaleString()} a day, so about {Math.ceil(days)} working days —
        that is the schedule the document count hides
      </p>
    </div>
  );
}
