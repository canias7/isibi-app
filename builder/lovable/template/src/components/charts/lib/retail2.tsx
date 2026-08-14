/** The shop floor: shelves, baskets, cover and markdowns. */

import { inkOn } from "./_ink";

const TONE = "var(--foreground)";
const money = (n: number, cur = "GBP") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: n < 100 ? 2 : 0 }).format(n);

/* ------------------------------------------------------------------ planogram */
/**
 * The shelf as it is actually built: facings across, shelves down.
 *
 * Eye level is marked, because that shelf sells far more than the ones above
 * and below it and a planogram that does not say where it is cannot be judged.
 */
export function Planogram({
  shelves, eyeLevel, label,
}: {
  /** top shelf first */ shelves: { items: { sku: string; facings: number }[] }[];
  /** index of the eye-level shelf */ eyeLevel?: number; label?: string;
}) {
  if (!shelves.length) return null;
  const totalFacings = shelves.reduce((s, sh) => s + sh.items.reduce((t, i) => t + i.facings, 0), 0);
  const eye = eyeLevel ?? Math.min(1, shelves.length - 1);
  const eyeFacings = shelves[eye]?.items.reduce((t, i) => t + i.facings, 0) ?? 0;

  return (
    <div className="w-full">
      <div className="space-y-[3px]">
        {shelves.map((sh, si) => {
          const rowFacings = sh.items.reduce((t, i) => t + i.facings, 0) || 1;
          return (
            <div key={si} className="flex items-stretch gap-1.5">
              <span className="w-14 shrink-0 self-center text-[9px] text-muted-foreground">
                {si === eye ? "eye level" : `shelf ${si + 1}`}
              </span>
              <div className="flex flex-1 gap-px border-b-2 pb-[3px]"
                style={{ borderColor: si === eye ? TONE : "var(--border)" }}>
                {sh.items.map((it) => (
                  <div key={it.sku} className="flex items-center justify-center overflow-hidden rounded-[2px] px-0.5"
                    style={{
                      width: `${(it.facings / rowFacings) * 100}%`, height: 34,
                      background: si === eye ? TONE : "var(--muted)",
                      color: si === eye ? "var(--background)" : "var(--foreground)",
                      outline: si === eye ? undefined : `1px solid var(--border)`,
                    }}
                    title={`${it.sku} · ${it.facings} facings`}>
                    <span className="truncate text-[9px] font-medium">{it.sku}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        Block width is facings · {totalFacings} facings over {shelves.length} shelves ·
        {Math.round((eyeFacings / totalFacings) * 100)}% of them at eye level
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- basket affinity */
/**
 * Which products sell together, as LIFT rather than raw co-occurrence.
 *
 * Two popular items appear together often simply because both are popular;
 * lift divides that out, so only a real association shows.
 */
export function BasketAffinity({
  items, pairs, baskets, size = 340, label,
}: {
  items: { sku: string; baskets: number }[];
  pairs: { a: string; b: string; baskets: number }[];
  baskets: number; size?: number; label?: string;
}) {
  if (!items.length || !pairs.length) return null;
  const support = new Map(items.map((i) => [i.sku, i.baskets / baskets]));
  const scored = pairs.map((p) => {
    const joint = p.baskets / baskets;
    const expected = (support.get(p.a) ?? 0) * (support.get(p.b) ?? 0);
    return { ...p, lift: expected > 0 ? joint / expected : 0, joint };
  }).sort((x, y) => y.lift - x.lift);
  const maxLift = Math.max(...scored.map((s) => s.lift));
  const top = scored[0];

  return (
    <div className="w-full" style={{ maxWidth: size }}>
      <div className="space-y-1">
        {scored.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-[42%] shrink-0 truncate text-[10px]">{s.a} + {s.b}</span>
            <div className="relative h-3 flex-1 rounded-[2px]" style={{ background: "var(--muted)" }}>
              <span className="absolute top-0 bottom-0 left-0 rounded-[2px]"
                style={{ width: `${(s.lift / maxLift) * 100}%`, background: TONE, opacity: s.lift >= 1 ? 1 : 0.35 }} />
              {/* Lift of 1 is "no association at all" and is the only reference
                  that means anything on this scale. */}
              <span className="absolute top-[-2px] bottom-[-2px] w-px" style={{ left: `${(1 / maxLift) * 100}%`, background: TONE }} />
            </div>
            <span className="w-9 text-right text-[10px] tabular-nums">{s.lift.toFixed(2)}</span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        Lift over {baskets.toLocaleString()} baskets · the tick is 1.00, meaning no association ·
        {top.a} and {top.b} appear together {top.lift.toFixed(1)}× more than chance
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- shelf share */
/**
 * Space given against sales earned, per brand.
 *
 * The two bars share a scale, so a brand taking more space than it earns is
 * visible as a mismatch rather than requiring arithmetic.
 */
export function ShelfShare({
  brands, label,
}: {
  brands: { name: string; spaceShare: number; salesShare: number }[]; label?: string;
}) {
  if (!brands.length) return null;
  const max = Math.max(...brands.flatMap((b) => [b.spaceShare, b.salesShare]));
  const worst = brands.reduce((a, b) => (b.spaceShare - b.salesShare > a.spaceShare - a.salesShare ? b : a));

  return (
    <div className="w-full space-y-2">
      {brands.map((b) => {
        const gap = b.spaceShare - b.salesShare;
        return (
          <div key={b.name}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[10px] font-medium">{b.name}</span>
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {gap > 0 ? "+" : ""}{(gap * 100).toFixed(1)} pts {gap > 0 ? "over-spaced" : "under-spaced"}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="w-9 text-[9px] text-muted-foreground">space</span>
              <span className="h-2.5 rounded-[2px]" style={{ width: `${(b.spaceShare / max) * 78}%`, background: TONE, opacity: 0.42 }} />
              <span className="text-[9px] tabular-nums text-muted-foreground">{Math.round(b.spaceShare * 100)}%</span>
            </div>
            <div className="mt-[2px] flex items-center gap-1.5">
              <span className="w-9 text-[9px] text-muted-foreground">sales</span>
              <span className="h-2.5 rounded-[2px]" style={{ width: `${(b.salesShare / max) * 78}%`, background: TONE }} />
              <span className="text-[9px] tabular-nums text-muted-foreground">{Math.round(b.salesShare * 100)}%</span>
            </div>
          </div>
        );
      })}
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        Pale is shelf space, solid is sales · {worst.name} takes the most space for what it earns
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- stock cover */
/**
 * Weeks of cover per line: stock divided by the rate it sells.
 *
 * Units alone say nothing — 400 units is a year of one line and two days of
 * another — so cover is computed and the reorder point drawn against it.
 */
export function StockCover({
  lines, reorderWeeks = 4, height = 220, label,
}: {
  lines: { sku: string; units: number; weeklySales: number }[];
  reorderWeeks?: number; height?: number; label?: string;
}) {
  if (!lines.length) return null;
  const rows = lines.map((l) => ({ ...l, cover: l.weeklySales > 0 ? l.units / l.weeklySales : Infinity }))
    .sort((a, b) => a.cover - b.cover);
  const finite = rows.filter((r) => Number.isFinite(r.cover));
  const max = Math.max(reorderWeeks * 2, ...finite.map((r) => r.cover)) * 1.05;
  const low = rows.filter((r) => r.cover < reorderWeeks);
  const dead = rows.filter((r) => !Number.isFinite(r.cover));

  return (
    <div className="w-full">
      <div className="relative space-y-1" style={{ minHeight: height }}>
        {rows.map((r) => (
          <div key={r.sku} className="flex items-center gap-2">
            <span className="w-24 shrink-0 truncate text-[10px]">{r.sku}</span>
            <div className="relative h-3.5 flex-1 rounded-[2px]" style={{ background: "var(--muted)" }}>
              <span className="absolute top-0 bottom-0 left-0 rounded-[2px]" style={{
                width: Number.isFinite(r.cover) ? `${Math.min(100, (r.cover / max) * 100)}%` : "100%",
                background: Number.isFinite(r.cover) ? TONE : "var(--background)",
                border: Number.isFinite(r.cover) ? undefined : `2px solid ${TONE}`,
                opacity: r.cover < reorderWeeks ? 1 : 0.45,
              }} />
              <span className="absolute top-[-2px] bottom-[-2px] w-px" style={{ left: `${(reorderWeeks / max) * 100}%`, background: TONE }} />
            </div>
            <span className="w-12 text-right text-[9px] tabular-nums text-muted-foreground">
              {Number.isFinite(r.cover) ? `${r.cover.toFixed(1)} wk` : "no sales"}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        Weeks of cover, tick at the {reorderWeeks}-week reorder point ·
        {low.length} line{low.length === 1 ? "" : "s"} below it{dead.length ? `, ${dead.length} not selling at all (outlined)` : ""}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- markdown curve */
/**
 * Price cut against units shifted and margin kept.
 *
 * Revenue and margin are both computed at each step, because the discount that
 * moves the most units is very rarely the one that earns the most.
 */
export function MarkdownCurve({
  fullPrice, unitCost, steps, currency = "GBP", height = 230, label,
}: {
  fullPrice: number; unitCost: number;
  steps: { discount: number; units: number }[]; currency?: string; height?: number; label?: string;
}) {
  if (!steps.length) return null;
  const rows = steps.map((s) => {
    const price = fullPrice * (1 - s.discount);
    return { ...s, price, revenue: price * s.units, margin: (price - unitCost) * s.units };
  });
  const max = Math.max(...rows.map((r) => Math.max(r.revenue, r.margin)));
  const best = rows.reduce((a, b) => (b.margin > a.margin ? b : a));
  const loss = rows.filter((r) => r.price < unitCost);

  return (
    <div className="w-full">
      <div className="flex items-end gap-2" style={{ height }}>
        {rows.map((r) => (
          <div key={r.discount} className="flex h-full flex-1 items-end gap-[2px]" title={`${Math.round(r.discount * 100)}% off`}>
            <div className="flex-1" style={{ height: `${(r.revenue / max) * 100}%`, background: TONE, opacity: 0.3 }} />
            <div className="flex-1" style={{
              height: `${(Math.max(0, r.margin) / max) * 100}%`,
              background: r.margin < 0 ? "var(--background)" : TONE,
              border: r.margin < 0 ? `2px solid ${TONE}` : undefined,
              outline: r === best ? `2px solid ${TONE}` : undefined,
              outlineOffset: r === best ? 1 : undefined,
            }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2">
        {rows.map((r) => (
          <span key={r.discount} className="flex-1 text-center text-[9px] text-muted-foreground">{Math.round(r.discount * 100)}%</span>
        ))}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5" style={{ background: TONE, opacity: 0.3 }} />revenue</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5" style={{ background: TONE }} />margin</span>
      </div>
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        Best margin at {Math.round(best.discount * 100)}% off — {money(best.margin, currency)} on {best.units.toLocaleString()} units ·
        {loss.length ? ` ${loss.map((r) => `${Math.round(r.discount * 100)}%`).join(", ")} sells below cost` : " every step stays above cost"}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ assortment grid */
/** Lines by category and price tier, sized by revenue, with the gaps visible. */
export function AssortmentGrid({
  categories, tiers, cells, label,
}: {
  categories: string[]; tiers: string[];
  /** cells[category][tier] */ cells: { lines: number; revenue: number }[][];
  label?: string;
}) {
  if (!categories.length || !tiers.length) return null;
  const flat = cells.flat();
  const maxRev = Math.max(...flat.map((c) => c?.revenue ?? 0)) || 1;
  const gaps: string[] = [];
  categories.forEach((c, ci) => tiers.forEach((t, ti) => {
    if (!(cells[ci]?.[ti]?.lines)) gaps.push(`${c} / ${t}`);
  }));

  return (
    <div className="w-full overflow-x-auto">
      <div className="grid gap-1" style={{ gridTemplateColumns: `auto repeat(${tiers.length}, minmax(56px, 1fr))` }}>
        <span />
        {tiers.map((t) => <span key={t} className="pb-0.5 text-center text-[10px] font-semibold">{t}</span>)}
        {categories.map((c, ci) => (
          <div key={c} className="contents">
            <span className="self-center pr-1.5 text-[10px] font-semibold whitespace-nowrap">{c}</span>
            {tiers.map((t, ti) => {
              const cell = cells[ci]?.[ti];
              const k = cell ? cell.revenue / maxRev : 0;
              const empty = !cell?.lines;
              return (
                <div key={t} className="flex aspect-[3/2] flex-col items-center justify-center rounded-[3px]"
                  style={{
                    background: empty ? "var(--background)" : `color-mix(in oklch, ${TONE} ${Math.round(12 + k * 84)}%, transparent)`,
                    border: empty ? `1px dashed ${TONE}` : undefined,
                  }}
                  title={cell ? `${cell.lines} lines` : "no lines"}>
                  {empty ? (
                    <span className="text-[10px] text-muted-foreground">gap</span>
                  ) : (
                    <>
                      <span className="text-[12px] font-semibold leading-none"
                        style={{ color: inkOn(Math.round(k * 92)) }}>{cell.lines}</span>
                      <span className="text-[8px] leading-tight"
                        style={{ color: inkOn(Math.round(k * 92)) }}>lines</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        Darker is more revenue, the number is how many lines ·
        {gaps.length ? ` ${gaps.length} empty square${gaps.length === 1 ? "" : "s"}: ${gaps.slice(0, 3).join(", ")}${gaps.length > 3 ? "…" : ""}` : " no gaps in the range"}
      </p>
    </div>
  );
}
