/** Factory floor: effectiveness, movement, flow and the board on the wall. */

const TONE = "var(--foreground)";

/* ------------------------------------------------------------- OEE waterfall */
/**
 * Overall equipment effectiveness as the losses that produce it.
 *
 * OEE is availability × performance × quality, and the final number is
 * COMPUTED from the three — a headline OEE that does not equal the product
 * of its own factors is the standard way this metric gets fudged.
 */
export function OeeWaterfall({
  plannedMinutes, downtimeMinutes, idealRate, actualUnits, goodUnits, height = 230, label,
}: {
  plannedMinutes: number; downtimeMinutes: number;
  /** units per minute at full speed */ idealRate: number;
  actualUnits: number; goodUnits: number; height?: number; label?: string;
}) {
  if (plannedMinutes <= 0) return null;
  const runMinutes = plannedMinutes - downtimeMinutes;
  const availability = runMinutes / plannedMinutes;
  const performance = runMinutes > 0 ? actualUnits / (idealRate * runMinutes) : 0;
  const quality = actualUnits > 0 ? goodUnits / actualUnits : 0;
  const oee = availability * performance * quality;

  const steps = [
    { label: "Planned", from: 1, to: 1, base: true },
    { label: "Availability", from: 1, to: availability, loss: 1 - availability },
    { label: "Performance", from: availability, to: availability * performance, loss: availability * (1 - performance) },
    { label: "Quality", from: availability * performance, to: oee, loss: availability * performance * (1 - quality) },
    { label: "OEE", from: 0, to: oee, base: true },
  ];

  return (
    <div className="w-full">
      <div className="relative flex items-end gap-2" style={{ height }}>
        {steps.map((s) => (
          <div key={s.label} className="relative flex-1" style={{ height: "100%" }}>
            {s.base ? (
              <div className="absolute bottom-0 w-full" style={{ height: `${s.to * 100}%`, background: TONE }} />
            ) : (
              <>
                <div className="absolute bottom-0 w-full" style={{ height: `${s.to * 100}%`, background: TONE, opacity: 0.18 }} />
                <div className="absolute w-full border-2" style={{
                  bottom: `${s.to * 100}%`, height: `${(s.loss ?? 0) * 100}%`,
                  borderColor: TONE, background: "var(--background)",
                  backgroundImage: "repeating-linear-gradient(45deg, transparent 0 3px, color-mix(in oklch, var(--foreground) 22%, transparent) 3px 4px)",
                }} />
              </>
            )}
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2">
        {steps.map((s) => (
          <div key={s.label} className="flex-1 text-center">
            <div className="text-[9px] text-muted-foreground">{s.label}</div>
            <div className="text-[10px] font-semibold tabular-nums">
              {s.base ? `${Math.round(s.to * 100)}%` : `−${Math.round((s.loss ?? 0) * 100)}%`}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground" aria-label={label}>
        {Math.round(availability * 100)}% × {Math.round(performance * 100)}% × {Math.round(quality * 100)}% = {Math.round(oee * 100)}% ·
        hatched blocks are what was lost
      </p>
    </div>
  );
}

/* ------------------------------------------------------- spaghetti diagram */
/**
 * The path a person or part actually walks round a workspace.
 *
 * The total DISTANCE is measured off the path, because the point of drawing
 * it is to compare before and after a re-layout — a picture with no number
 * proves nothing.
 */
export function SpaghettiDiagram({
  stations, path, metresPerUnit = 1, size = 300, label,
}: {
  stations: { label: string; x: number; y: number }[];
  /** station labels, in the order visited */ path: string[];
  metresPerUnit?: number; size?: number; label?: string;
}) {
  if (!stations.length || path.length < 2) return null;
  const at = new Map(stations.map((s) => [s.label, s]));
  const pts = path.map((p) => at.get(p)).filter(Boolean) as { x: number; y: number }[];
  let dist = 0;
  for (let i = 1; i < pts.length; i++) dist += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  const visits = new Map<string, number>();
  path.forEach((p) => visits.set(p, (visits.get(p) ?? 0) + 1));

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" style={{ maxWidth: size }}
        role="img" aria-label={label ?? `${Math.round(dist * metresPerUnit)} m walked over ${path.length} moves`}>
        <rect x={1} y={1} width={98} height={98} fill="var(--muted)" fillOpacity={0.25} stroke="var(--border)" strokeWidth={0.4} />
        {pts.slice(1).map((p, i) => (
          <line key={i} x1={pts[i].x} y1={pts[i].y} x2={p.x} y2={p.y}
            stroke={TONE} strokeWidth={1.1} strokeOpacity={0.55} strokeLinecap="round" />
        ))}
        {stations.map((s) => {
          const n = visits.get(s.label) ?? 0;
          return (
            <g key={s.label}>
              <rect x={s.x - 5} y={s.y - 3.4} width={10} height={6.8} rx={1}
                fill={n ? TONE : "var(--background)"} stroke={TONE} strokeWidth={0.7} />
              <text x={s.x} y={s.y + 1.4} fontSize={3.2} textAnchor="middle"
                fill={n ? "var(--background)" : "var(--foreground)"}>{s.label}</text>
              {n > 1 ? <text x={s.x + 6.4} y={s.y - 3} fontSize={3.4} className="fill-muted-foreground">×{n}</text> : null}
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-[10px] text-muted-foreground">
        {path.length - 1} moves · about {Math.round(dist * metresPerUnit)} m walked · stations visited more than once carry a count
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ kanban snapshot */
/**
 * The board as it stands, with each column against its WIP limit — a column
 * over its limit is outlined, since that is the only thing the limit is for.
 */
export function KanbanSnapshot({
  columns, label,
}: {
  columns: { name: string; cards: { title: string; age?: number }[]; wipLimit?: number }[];
  label?: string;
}) {
  if (!columns.length) return null;
  const over = columns.filter((c) => c.wipLimit != null && c.cards.length > c.wipLimit);

  return (
    <div className="w-full">
      <div className="flex gap-2 overflow-x-auto">
        {columns.map((c) => {
          const breached = c.wipLimit != null && c.cards.length > c.wipLimit;
          return (
            <div key={c.name} className="min-w-[92px] flex-1 rounded-[4px] p-1.5"
              style={{
                background: "var(--muted)",
                outline: breached ? `2px solid ${TONE}` : undefined,
                outlineOffset: breached ? "-2px" : undefined,
              }}>
              <div className="flex items-baseline justify-between gap-1">
                <span className="truncate text-[10px] font-semibold">{c.name}</span>
                <span className="text-[9px] tabular-nums text-muted-foreground">
                  {c.cards.length}{c.wipLimit != null ? `/${c.wipLimit}` : ""}
                </span>
              </div>
              <div className="mt-1 space-y-1">
                {c.cards.map((card, i) => (
                  <div key={i} className="rounded-[3px] px-1.5 py-1 text-[9px] leading-tight"
                    style={{ background: "var(--background)", borderLeft: `${Math.min(4, 1 + (card.age ?? 0) / 3)}px solid ${TONE}` }}
                    title={card.age != null ? `${card.age} days in this column` : undefined}>
                    {card.title}
                  </div>
                ))}
                {!c.cards.length ? <div className="py-2 text-center text-[9px] text-muted-foreground">empty</div> : null}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        A thicker left edge is an older card · {over.length ? `${over.map((c) => c.name).join(", ")} over the limit` : "every column within its limit"}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- heijunka box */
/** The levelling box: product against time slot, one card per unit of work. */
export function HeijunkaBox({
  slots, products, /** grid[product][slot] */ grid, size = 400, label,
}: {
  slots: string[]; products: string[]; grid: number[][]; size?: number; label?: string;
}) {
  if (!products.length || !slots.length) return null;
  const perSlot = slots.map((_, s) => products.reduce((sum, __, p) => sum + (grid[p]?.[s] ?? 0), 0));
  const peak = Math.max(...perSlot), trough = Math.min(...perSlot);

  return (
    <div className="w-full overflow-x-auto">
      <table className="border-collapse text-[10px]" style={{ minWidth: Math.min(size, 260) }}>
        <tbody>
          <tr>
            <td />
            {slots.map((s) => <td key={s} className="px-1 pb-1 text-center font-semibold">{s}</td>)}
          </tr>
          {products.map((p, pi) => (
            <tr key={p}>
              <td className="pr-1.5 font-semibold whitespace-nowrap">{p}</td>
              {slots.map((_, si) => {
                const n = grid[pi]?.[si] ?? 0;
                return (
                  <td key={si} className="border p-0.5 align-middle" style={{ borderColor: "var(--border)" }}>
                    <div className="flex min-h-[18px] flex-wrap items-center justify-center gap-[2px]">
                      {Array.from({ length: n }, (_, k) => (
                        <span key={k} className="h-2 w-3 rounded-[1px]" style={{ background: TONE }} />
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
          <tr>
            <td className="pt-1 pr-1.5 text-right text-[9px] text-muted-foreground">total</td>
            {perSlot.map((n, i) => (
              <td key={i} className="pt-1 text-center text-[10px] font-semibold tabular-nums">{n}</td>
            ))}
          </tr>
        </tbody>
      </table>
      <p className="mt-1 text-[10px] text-muted-foreground" aria-label={label}>
        {peak === trough ? "Perfectly level — every slot carries the same load" : `Peak ${peak} against trough ${trough} — levelling means closing that gap`}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- andon board */
/**
 * Line status at a glance. Each state carries a GLYPH as well as a fill —
 * this is the board people read from across a factory floor, where colour
 * alone is exactly what fails.
 */
export function AndonBoard({
  lines, label,
}: {
  lines: { name: string; state: "running" | "slow" | "stopped"; note?: string; minutes?: number }[];
  label?: string;
}) {
  if (!lines.length) return null;
  const GLYPH = { running: "▶", slow: "⏸", stopped: "■" } as const;
  const FILL = { running: 1, slow: 0.45, stopped: 0 } as const;
  const stopped = lines.filter((l) => l.state === "stopped");
  const down = stopped.reduce((s, l) => s + (l.minutes ?? 0), 0);

  return (
    <div className="w-full">
      <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}>
        {lines.map((l) => {
          const solid = l.state === "running";
          return (
            <div key={l.name} className="rounded-[4px] border p-2"
              style={{
                borderColor: TONE,
                borderWidth: l.state === "stopped" ? 2 : 1,
                background: solid ? TONE : "var(--background)",
                backgroundImage: l.state === "slow"
                  ? `repeating-linear-gradient(45deg, color-mix(in oklch, ${TONE} 30%, transparent) 0 4px, transparent 4px 8px)` : undefined,
                color: solid ? "var(--background)" : "var(--foreground)",
                opacity: FILL[l.state] === 0 ? 1 : undefined,
              }}>
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-[11px] font-semibold">{l.name}</span>
                <span className="text-[12px] leading-none">{GLYPH[l.state]}</span>
              </div>
              <div className="mt-0.5 text-[9px] uppercase tracking-wide opacity-80">{l.state}</div>
              {l.note ? <div className="mt-0.5 truncate text-[9px] opacity-75">{l.note}</div> : null}
              {l.minutes != null ? <div className="text-[9px] tabular-nums opacity-75">{l.minutes} min</div> : null}
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        ▶ running · ⏸ slowed · ■ stopped · {stopped.length ? `${stopped.length} down, ${down} minutes lost` : "nothing stopped"}
      </p>
    </div>
  );
}
