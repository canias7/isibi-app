/** Game design: progression, drops, pacing and where the economy leaks. */

const TONE = "var(--foreground)";

/* -------------------------------------------------------------------- skill tree */
type Skill = { id: string; name: string; cost: number; taken?: boolean; requires?: string[] };

/**
 * A talent tree with prerequisites, and the CHEAPEST route to each unlocked
 * node computed — a tree that lists node costs without the path cost hides
 * the actual price of the thing at the bottom.
 */
export function SkillTree({
  skills, tiers, budget, size = 340, label,
}: {
  skills: Skill[]; /** tiers[tierIndex] = skill ids */ tiers: string[][]; budget?: number;
  size?: number; label?: string;
}) {
  if (!tiers.length) return null;
  const byId = new Map(skills.map((s) => [s.id, s]));
  const pathCost = (id: string, seen = new Set<string>()): number => {
    const s = byId.get(id);
    if (!s || seen.has(id)) return 0;
    seen.add(id);
    return s.cost + (s.requires ?? []).reduce((acc, r) => acc + pathCost(r, seen), 0);
  };
  const spent = skills.filter((s) => s.taken).reduce((a, s) => a + s.cost, 0);
  const pos = new Map<string, { x: number; y: number }>();
  tiers.forEach((row, ti) => row.forEach((id, i) => pos.set(id, {
    x: ((i + 0.5) / row.length) * 100, y: ((ti + 0.5) / tiers.length) * 100,
  })));

  return (
    <div className="w-full" style={{ maxWidth: size }}>
      <div className="relative" style={{ height: tiers.length * 62 }}>
        <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none">
          {skills.flatMap((s) => (s.requires ?? []).map((r) => {
            const a = pos.get(r), b = pos.get(s.id);
            if (!a || !b) return null;
            return <line key={`${r}-${s.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={TONE} strokeWidth={1} strokeOpacity={s.taken ? 0.8 : 0.25} vectorEffect="non-scaling-stroke" />;
          }))}
        </svg>
        {skills.map((s) => {
          const p = pos.get(s.id);
          if (!p) return null;
          return (
            <span key={s.id}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-1.5 py-0.5 text-[9px] whitespace-nowrap"
              style={{
                left: `${p.x}%`, top: `${p.y}%`,
                background: s.taken ? TONE : "var(--background)",
                color: s.taken ? "var(--background)" : "var(--foreground)",
                borderColor: TONE,
              }} title={`${s.name}: ${s.cost} here, ${pathCost(s.id)} with prerequisites`}>
              {s.name} <span className="opacity-70">{pathCost(s.id)}</span>
            </span>
          );
        })}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        The number is the FULL path cost, not the node's own · {spent} spent
        {budget != null ? ` of ${budget} available` : ""} · filled nodes are taken
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------- loot table */
/**
 * Drop rates with the EXPECTED ATTEMPTS to see each one.
 *
 * A 0.5% drop rate means nothing to most people; "you will probably see it by
 * attempt 138" does, and that is what the median run works out at.
 */
export function LootTable({
  drops, label,
}: {
  drops: { item: string; rate: number; tier?: string }[]; label?: string;
}) {
  if (!drops.length) return null;
  const rows = [...drops].sort((a, b) => b.rate - a.rate).map((d) => ({
    ...d,
    // Median attempts: n where 1-(1-p)^n = 0.5.
    median: d.rate > 0 ? Math.ceil(Math.log(0.5) / Math.log(1 - d.rate)) : Infinity,
  }));
  const total = rows.reduce((s, r) => s + r.rate, 0);
  const rarest = rows[rows.length - 1];

  return (
    <div className="w-full">
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.item} className="flex items-center gap-2">
            <span className="w-[34%] shrink-0 truncate text-[10px]">
              {r.item}{r.tier ? <span className="text-muted-foreground"> {r.tier}</span> : null}
            </span>
            <span className="h-3 rounded-[2px]" style={{ width: `${Math.max(1, (r.rate / rows[0].rate) * 40)}%`, background: TONE }} />
            <span className="ml-auto shrink-0 text-right text-[9px] tabular-nums text-muted-foreground">
              {(r.rate * 100).toFixed(2)}% · half see it by {Number.isFinite(r.median) ? r.median : "never"}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        Rates sum to {(total * 100).toFixed(1)}%{total > 1 ? " — over 100%, so these are independent rolls" : ""} ·
        {rarest.item} takes a median of {Number.isFinite(rarest.median) ? rarest.median : "∞"} attempts, which is the
        number a player actually feels
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------- match length */
/**
 * How long matches run, with the target window drawn.
 *
 * The tail is the design problem — a mode with a good median and a long tail
 * has matches people abandon — so the share outside the window is counted.
 */
export function MatchLength({
  buckets, targetFrom, targetTo, height = 230, label,
}: {
  buckets: { minutes: number; matches: number }[]; targetFrom: number; targetTo: number;
  height?: number; label?: string;
}) {
  if (!buckets.length) return null;
  const total = buckets.reduce((s, b) => s + b.matches, 0);
  const max = Math.max(...buckets.map((b) => b.matches));
  const maxMin = Math.max(...buckets.map((b) => b.minutes));
  let run = 0;
  const median = buckets.find((b) => { run += b.matches; return run >= total / 2; })?.minutes ?? 0;
  const outside = buckets.filter((b) => b.minutes < targetFrom || b.minutes > targetTo)
    .reduce((s, b) => s + b.matches, 0);

  return (
    <div className="w-full">
      <div className="relative flex items-end gap-[2px]" style={{ height }}>
        <div className="absolute top-0 bottom-0" style={{
          left: `${(targetFrom / maxMin) * 100}%`, width: `${((targetTo - targetFrom) / maxMin) * 100}%`,
          background: TONE, opacity: 0.1,
        }} />
        {buckets.map((b) => (
          <div key={b.minutes} className="flex-1" title={`${b.minutes} min: ${b.matches}`}
            style={{ height: `${(b.matches / max) * 100}%`, background: TONE, opacity: b.minutes >= targetFrom && b.minutes <= targetTo ? 1 : 0.4 }} />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>0 min</span><span>{maxMin} min</span>
      </div>
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        Median {median} min, target {targetFrom}–{targetTo} · {Math.round((outside / total) * 100)}% fall outside it,
        and the long ones are the matches people leave
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ progression funnel */
/**
 * Where players stop, by level.
 *
 * The STEEPEST single drop is the one to fix — a funnel that loses 5% a level
 * for twenty levels and one that loses 60% at level three look similar in
 * total and need completely different work.
 */
export function ProgressionFunnel({
  levels, height = 240, label,
}: {
  levels: { name: string; players: number }[]; height?: number; label?: string;
}) {
  if (levels.length < 2) return null;
  const start = levels[0].players;
  const drops = levels.slice(1).map((l, i) => ({
    from: levels[i].name, to: l.name, share: 1 - l.players / levels[i].players,
  }));
  const worst = drops.reduce((a, b) => (b.share > a.share ? b : a));

  return (
    <div className="w-full">
      <div className="space-y-[3px]" style={{ minHeight: height }}>
        {levels.map((l, i) => {
          const drop = i > 0 ? 1 - l.players / levels[i - 1].players : 0;
          const bad = drop === worst.share && i > 0;
          return (
            <div key={l.name} className="flex items-center gap-2">
              <span className="w-[26%] shrink-0 truncate text-[10px]">{l.name}</span>
              <div className="h-4 rounded-[2px]" style={{
                width: `${(l.players / start) * 58}%`,
                background: bad ? "var(--background)" : TONE,
                border: bad ? `2px solid ${TONE}` : undefined,
              }} />
              <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground">
                {l.players.toLocaleString()}{i > 0 ? ` · −${Math.round(drop * 100)}%` : ""}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        {Math.round((levels[levels.length - 1].players / start) * 100)}% reach the end · the steepest single drop is
        {" "}{worst.from} → {worst.to} at {Math.round(worst.share * 100)}%, and that is the one to fix
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ economy sinks */
/**
 * Currency created against currency destroyed.
 *
 * If faucets exceed sinks the economy inflates, and the NET is what predicts
 * that — a chart of either half alone says nothing about prices.
 */
export function EconomySinks({
  faucets, sinks, height = 250, label,
}: {
  faucets: { name: string; amount: number }[]; sinks: { name: string; amount: number }[];
  height?: number; label?: string;
}) {
  if (!faucets.length && !sinks.length) return null;
  const inTotal = faucets.reduce((s, f) => s + f.amount, 0);
  const outTotal = sinks.reduce((s, f) => s + f.amount, 0);
  const max = Math.max(inTotal, outTotal);
  const net = inTotal - outTotal;

  const column = (items: { name: string; amount: number }[], total: number, hatched: boolean) => (
    <div className="flex flex-1 flex-col justify-end" style={{ height }}>
      {items.map((it, i) => (
        <div key={it.name} className="flex items-center justify-center overflow-hidden px-1 text-[9px]"
          style={{
            height: `${(it.amount / max) * 100}%`,
            background: hatched ? "var(--background)" : TONE,
            color: hatched ? "var(--foreground)" : "var(--background)",
            boxShadow: hatched ? `inset 0 0 0 1px ${TONE}` : undefined,
            opacity: hatched ? 1 : 1 - i * 0.12,
            borderTop: "1px solid var(--background)",
          }} title={`${it.name}: ${it.amount.toLocaleString()}`}>
          <span className="truncate">{it.amount / total > 0.12 ? it.name : ""}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="w-full">
      <div className="flex gap-3">{column(faucets, inTotal, false)}{column(sinks, outTotal, true)}</div>
      <div className="mt-1 flex gap-3 text-center text-[10px] text-muted-foreground">
        <span className="flex-1">created {inTotal.toLocaleString()}</span>
        <span className="flex-1">destroyed {outTotal.toLocaleString()}</span>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground" aria-label={label}>
        Solid is faucets, outlined is sinks · net {net >= 0 ? "+" : ""}{net.toLocaleString()} a day —
        {net > 0 ? " the economy is inflating and prices will follow" : " sinks are keeping up"}
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- difficulty curve */
/**
 * Challenge against player skill over a playthrough.
 *
 * FLOW is the band between boredom and frustration; both failure modes are the
 * gap between the two lines, so it is the gap that is shaded and measured.
 */
export function DifficultyCurve({
  points, tolerance = 1.2, height = 250, label,
}: {
  points: { stage: string; challenge: number; skill: number }[]; tolerance?: number;
  height?: number; label?: string;
}) {
  if (points.length < 2) return null;
  const max = Math.max(...points.flatMap((p) => [p.challenge, p.skill])) * 1.1;
  const x = (i: number) => (i / (points.length - 1)) * 100;
  const y = (v: number) => 100 - (v / max) * 100;
  const frustrating = points.filter((p) => p.challenge > p.skill * tolerance);
  const boring = points.filter((p) => p.challenge < p.skill / tolerance);

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 100" width="100%" preserveAspectRatio="none" style={{ height }}
        role="img" aria-label={label ?? `${frustrating.length} spikes, ${boring.length} lulls`}>
        <polygon points={`${points.map((p, i) => `${x(i)},${y(p.challenge)}`).join(" ")} ${[...points].reverse().map((p, i) => `${x(points.length - 1 - i)},${y(p.skill)}`).join(" ")}`}
          fill={TONE} fillOpacity={0.14} />
        <polyline points={points.map((p, i) => `${x(i)},${y(p.skill)}`).join(" ")}
          fill="none" stroke={TONE} strokeWidth={1.8} strokeDasharray="5 3" vectorEffect="non-scaling-stroke" />
        <polyline points={points.map((p, i) => `${x(i)},${y(p.challenge)}`).join(" ")}
          fill="none" stroke={TONE} strokeWidth={2.2} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-1 flex">
        {points.map((p) => <span key={p.stage} className="flex-1 text-center text-[9px] text-muted-foreground">{p.stage}</span>)}
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground">
        Solid is challenge, dashed is skill · {frustrating.length ? `${frustrating.map((p) => p.stage).join(", ")} spike above what the player can do` : "no frustration spikes"} ·
        {boring.length ? ` ${boring.map((p) => p.stage).join(", ")} fall below it and go slack` : " no slack stretches"}
      </p>
    </div>
  );
}
