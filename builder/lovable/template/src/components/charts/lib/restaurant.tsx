/** Running a restaurant: the menu, the room, the pass and the cellar. */

const TONE = "var(--foreground)";
const money = (n: number, cur = "GBP") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: n < 100 ? 2 : 0 }).format(n);

/* ---------------------------------------------------------- menu engineering */
/**
 * Popularity against contribution, in the four named quadrants.
 *
 * Both axes are measured against the MENU'S OWN average rather than a fixed
 * line, because a dish selling 8% of covers is a star on a ten-item menu and a
 * dog on a forty-item one.
 */
export function MenuEngineering({
  dishes, currency = "GBP", height = 280, label,
}: {
  dishes: { name: string; sold: number; price: number; foodCost: number }[]; currency?: string;
  height?: number; label?: string;
}) {
  if (!dishes.length) return null;
  const totalSold = dishes.reduce((s, d) => s + d.sold, 0);
  const rows = dishes.map((d) => ({ ...d, share: d.sold / totalSold, margin: d.price - d.foodCost }));
  const meanShare = 1 / dishes.length;
  const meanMargin = rows.reduce((s, r) => s + r.margin * r.share, 0);
  const quadrant = (r: (typeof rows)[number]) =>
    r.share >= meanShare
      ? (r.margin >= meanMargin ? "Star" : "Plough horse")
      : (r.margin >= meanMargin ? "Puzzle" : "Dog");
  const hiShare = Math.max(...rows.map((r) => r.share)) * 1.15;
  const hiMargin = Math.max(...rows.map((r) => r.margin)) * 1.12;
  const x = (v: number) => (v / hiShare) * 100;
  const y = (v: number) => 100 - (v / hiMargin) * 100;
  const dogs = rows.filter((r) => quadrant(r) === "Dog");

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none">
          <line x1={x(meanShare)} y1={0} x2={x(meanShare)} y2={100} stroke={TONE} strokeWidth={1.4} strokeOpacity={0.5} vectorEffect="non-scaling-stroke" />
          <line x1={0} y1={y(meanMargin)} x2={100} y2={y(meanMargin)} stroke={TONE} strokeWidth={1.4} strokeOpacity={0.5} vectorEffect="non-scaling-stroke" />
        </svg>
        {rows.map((r) => (
          <span key={r.name} className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${x(r.share)}%`, top: `${y(r.margin)}%`, background: TONE }}
            title={`${r.name}: ${quadrant(r)}`} />
        ))}
        {rows.map((r) => (
          <span key={`l${r.name}`} className="absolute text-[9px] whitespace-nowrap text-muted-foreground"
            style={{
              ...(x(r.share) > 62 ? { right: `${100 - x(r.share) + 2}%` } : { left: `${x(r.share) + 2}%` }),
              top: `${y(r.margin)}%`, transform: "translateY(-50%)",
            }}>{r.name}</span>
        ))}
        <span className="absolute top-1 right-1 text-[9px] text-muted-foreground">Star</span>
        <span className="absolute top-1 left-1 text-[9px] text-muted-foreground">Puzzle</span>
        <span className="absolute bottom-1 right-1 text-[9px] text-muted-foreground">Plough horse</span>
        <span className="absolute bottom-1 left-1 text-[9px] text-muted-foreground">Dog</span>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground" aria-label={label}>
        Lines are the menu's own averages — {(meanShare * 100).toFixed(1)}% of covers and {money(meanMargin, currency)} contribution ·
        {dogs.length ? ` ${dogs.map((d) => d.name).join(", ")} in the bottom-left: change or cut` : " nothing in the bottom-left"}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- covers by service */
/** Covers per half hour across a day, with the kitchen's ceiling drawn. */
export function CoversByService({
  slots, kitchenCapacity, height = 230, label,
}: {
  slots: { time: string; covers: number }[]; kitchenCapacity: number; height?: number; label?: string;
}) {
  if (!slots.length) return null;
  const max = Math.max(kitchenCapacity, ...slots.map((s) => s.covers)) * 1.06;
  const over = slots.filter((s) => s.covers > kitchenCapacity);
  const total = slots.reduce((s, x) => s + x.covers, 0);
  const peak = slots.reduce((a, b) => (b.covers > a.covers ? b : a));

  return (
    <div className="w-full">
      <div className="relative flex items-end gap-[2px]" style={{ height }}>
        {slots.map((s) => (
          <div key={s.time} className="flex-1" title={`${s.time}: ${s.covers}`}
            style={{
              height: `${(s.covers / max) * 100}%`,
              background: s.covers > kitchenCapacity ? "var(--background)" : TONE,
              border: s.covers > kitchenCapacity ? `1.5px solid ${TONE}` : undefined,
            }} />
        ))}
        <div className="pointer-events-none absolute right-0 left-0 border-t-2 border-dashed border-foreground"
          style={{ bottom: `${(kitchenCapacity / max) * 100}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{slots[0].time}</span><span>{slots[slots.length - 1].time}</span>
      </div>
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        {total} covers · peak {peak.covers} at {peak.time} against a kitchen ceiling of {kitchenCapacity} ·
        {over.length ? ` ${over.length} slots over it (outlined) — that is where the tickets back up` : " never over it"}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------- table turn */
/**
 * How long each table is held, with turns per service COMPUTED.
 *
 * Revenue per table is turns times average spend, so a long dwell on a
 * four-top costs more than it looks — the turns number is what says so.
 */
export function TableTurn({
  tables, serviceMinutes, label,
}: {
  tables: { id: string; seats: number; sittings: { fromMin: number; toMin: number; covers: number }[] }[];
  serviceMinutes: number; label?: string;
}) {
  if (!tables.length) return null;
  const rows = tables.map((t) => {
    const used = t.sittings.reduce((s, x) => s + (x.toMin - x.fromMin), 0);
    return { ...t, turns: t.sittings.length, utilisation: used / serviceMinutes, covers: t.sittings.reduce((s, x) => s + x.covers, 0) };
  });
  const totalCovers = rows.reduce((s, r) => s + r.covers, 0);
  const worst = rows.reduce((a, b) => (b.turns < a.turns ? b : a));

  return (
    <div className="w-full space-y-1">
      {rows.map((t) => (
        <div key={t.id} className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-[10px]">{t.id} <span className="text-muted-foreground">×{t.seats}</span></span>
          <div className="relative h-4 flex-1 rounded-[2px]" style={{ background: "var(--muted)" }}>
            {t.sittings.map((s, i) => (
              <span key={i} className="absolute top-0 bottom-0 flex items-center justify-center rounded-[2px] text-[8px]"
                style={{
                  left: `${(s.fromMin / serviceMinutes) * 100}%`,
                  width: `${((s.toMin - s.fromMin) / serviceMinutes) * 100}%`,
                  background: TONE, color: "var(--background)",
                }} title={`${s.covers} covers, ${s.toMin - s.fromMin} min`}>{s.covers}</span>
            ))}
          </div>
          <span className="w-20 shrink-0 text-right text-[9px] tabular-nums text-muted-foreground">
            {t.turns} turns · {Math.round(t.utilisation * 100)}%
          </span>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        {totalCovers} covers over {(serviceMinutes / 60).toFixed(1)} hours · {worst.id} turned only {worst.turns} time
        {worst.turns === 1 ? "" : "s"}, which is where the covers are being lost
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------------- prep list */
/** Prep by station against the time available before service. */
export function PrepList({
  stations, minutesToService, label,
}: {
  stations: { name: string; tasks: { name: string; minutes: number; done?: boolean }[] }[];
  minutesToService: number; label?: string;
}) {
  if (!stations.length) return null;
  const rows = stations.map((s) => {
    const left = s.tasks.filter((t) => !t.done).reduce((a, t) => a + t.minutes, 0);
    return { ...s, left, over: left > minutesToService };
  }).sort((a, b) => b.left - a.left);
  const behind = rows.filter((r) => r.over);
  const max = Math.max(minutesToService, ...rows.map((r) => r.left)) * 1.05;

  return (
    <div className="w-full space-y-1.5">
      {rows.map((s) => (
        <div key={s.name}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] font-medium">{s.name}</span>
            <span className="text-[9px] tabular-nums text-muted-foreground">
              {s.left} min left of {s.tasks.reduce((a, t) => a + t.minutes, 0)}
            </span>
          </div>
          <div className="relative mt-0.5 h-4 rounded-[2px]" style={{ background: "var(--muted)" }}>
            <span className="absolute top-0 bottom-0 left-0 rounded-[2px]" style={{
              width: `${(s.left / max) * 100}%`,
              background: s.over ? "var(--background)" : TONE,
              boxShadow: s.over ? `inset 0 0 0 2px ${TONE}` : undefined,
            }} />
            <span className="absolute top-[-2px] bottom-[-2px] w-0.5" style={{ left: `${(minutesToService / max) * 100}%`, background: TONE }} />
          </div>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        The tick is {minutesToService} minutes to service ·
        {behind.length ? ` ${behind.map((r) => r.name).join(", ")} cannot finish in time (outlined)` : " every station finishes in time"}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------------- waste log */
/**
 * What gets thrown away, by value rather than by weight.
 *
 * Weight flatters expensive waste: two kilos of trimmings and two kilos of
 * fillet are the same bar until it is priced.
 */
export function WasteLog({
  items, currency = "GBP", height = 230, label,
}: {
  items: { name: string; kg: number; costPerKg: number; reason: string }[]; currency?: string;
  height?: number; label?: string;
}) {
  if (!items.length) return null;
  const rows = items.map((i) => ({ ...i, value: i.kg * i.costPerKg })).sort((a, b) => b.value - a.value);
  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const totalKg = rows.reduce((s, r) => s + r.kg, 0);
  const maxKg = Math.max(...rows.map((r) => r.kg));
  const maxV = Math.max(...rows.map((r) => r.value));
  const byKg = [...rows].sort((a, b) => b.kg - a.kg)[0];

  return (
    <div className="w-full" style={{ minHeight: height }}>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.name}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[10px]">{r.name} <span className="text-muted-foreground">{r.reason}</span></span>
              <span className="text-[9px] tabular-nums text-muted-foreground">{r.kg} kg · {money(r.value, currency)}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-1">
              <span className="h-2.5 rounded-[2px]" style={{ width: `${(r.kg / maxKg) * 30}%`, background: TONE, opacity: 0.35 }} />
              <span className="h-2.5 rounded-[2px]" style={{ width: `${(r.value / maxV) * 56}%`, background: TONE }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground" aria-label={label}>
        Pale is weight, solid is money · {totalKg.toFixed(1)} kg worth {money(totalValue, currency)} ·
        {byKg.name === rows[0].name
          ? ` ${rows[0].name} tops both`
          : ` ${byKg.name} is the heaviest but ${rows[0].name} is the expensive one`}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------- wine margin */
/**
 * Bottle cost against list price, with cash margin AND percentage — they rank
 * differently, and a list priced only on percentage leaves money on the table
 * at the top end.
 */
export function WineMargin({
  wines, currency = "GBP", height = 260, label,
}: {
  wines: { name: string; cost: number; list: number }[]; currency?: string; height?: number; label?: string;
}) {
  if (!wines.length) return null;
  const rows = wines.map((w) => ({ ...w, cash: w.list - w.cost, pct: (w.list - w.cost) / w.list }));
  const hiCost = Math.max(...rows.map((r) => r.cost)) * 1.12;
  const hiList = Math.max(...rows.map((r) => r.list)) * 1.08;
  const x = (v: number) => (v / hiCost) * 100;
  const y = (v: number) => 100 - (v / hiList) * 100;
  const bestCash = rows.reduce((a, b) => (b.cash > a.cash ? b : a));
  const bestPct = rows.reduce((a, b) => (b.pct > a.pct ? b : a));

  return (
    <div className="w-full">
      <div className="relative" style={{ height }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none">
          {[2, 3, 4].map((m) => (
            <line key={m} x1={0} y1={y(0)} x2={x(hiList / m)} y2={y(hiList)}
              stroke={TONE} strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.35} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {rows.map((r) => (
          <span key={r.name} className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${x(r.cost)}%`, top: `${y(r.list)}%`, background: TONE }}
            title={`${r.name}: ${money(r.cash, currency)} cash, ${Math.round(r.pct * 100)}%`} />
        ))}
        {rows.map((r) => (
          <span key={`l${r.name}`} className="absolute text-[9px] whitespace-nowrap text-muted-foreground"
            style={{
              ...(x(r.cost) > 60 ? { right: `${100 - x(r.cost) + 2}%` } : { left: `${x(r.cost) + 2}%` }),
              top: `${y(r.list)}%`, transform: "translateY(-50%)",
            }}>{r.name}</span>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>cost →</span><span>dashed lines are ×2, ×3 and ×4</span>
      </div>
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        {bestPct.name} has the best percentage at {Math.round(bestPct.pct * 100)}%, but {bestCash.name} puts
        {" "}{money(bestCash.cash, currency)} in the till against {money(bestPct.cash, currency)} — the till takes cash
      </p>
    </div>
  );
}
