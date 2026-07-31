/** Film and television: cutting, casting, scheduling and who is on screen. */

const TONE = "var(--foreground)";

/* ------------------------------------------------------------------ shot length */
/**
 * Every shot in a film as a bar, in order.
 *
 * The AVERAGE SHOT LENGTH is the standard measure of a film's cutting, and the
 * distribution around it is the style — a mean of four seconds made of steady
 * fours is a different film from one made of ones and tens.
 */
export function ShotLength({
  shots, height = 200, label,
}: {
  /** seconds, in screen order */ shots: number[]; height?: number; label?: string;
}) {
  if (shots.length < 2) return null;
  const asl = shots.reduce((a, b) => a + b, 0) / shots.length;
  const sorted = [...shots].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const max = Math.max(...shots);
  const longest = shots.indexOf(max);

  return (
    <div className="w-full">
      <div className="relative flex items-end gap-px" style={{ height }}>
        {shots.map((s, i) => (
          <div key={i} className="flex-1" title={`shot ${i + 1}: ${s.toFixed(1)}s`}
            style={{ height: `${(s / max) * 100}%`, background: TONE, opacity: s > asl * 3 ? 1 : 0.6 }} />
        ))}
        <div className="pointer-events-none absolute right-0 left-0 border-t border-dashed border-foreground"
          style={{ bottom: `${(asl / max) * 100}%` }} />
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        {shots.length} shots · average {asl.toFixed(2)}s, median {median.toFixed(2)}s —
        {asl > median * 1.4 ? " the mean is pulled up by a few long takes, so the median is the honest one" : " mean and median agree, so the cutting is even"} ·
        longest is shot {longest + 1} at {max.toFixed(1)}s
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------- screen time */
/**
 * Who is on screen, scene by scene.
 *
 * Total minutes and NUMBER OF SCENES are different things — a character in one
 * long scene reads as a lead by minutes and a bit part by presence — so both
 * are given.
 */
export function ScreenTime({
  characters, scenes, /** grid[character][scene] = minutes */ grid, label,
}: {
  characters: string[]; scenes: string[]; grid: number[][]; label?: string;
}) {
  if (!characters.length) return null;
  const totals = characters.map((_, ci) => (grid[ci] ?? []).reduce((a, b) => a + b, 0));
  const counts = characters.map((_, ci) => (grid[ci] ?? []).filter((v) => v > 0).length);
  const max = Math.max(...grid.flat(), 0.01);
  const order = characters.map((_, i) => i).sort((a, b) => totals[b] - totals[a]);
  const lead = order[0];

  return (
    <div className="w-full overflow-x-auto">
      <div className="inline-grid gap-px" style={{ gridTemplateColumns: `auto repeat(${scenes.length}, minmax(12px, 1fr)) auto` }}>
        <span />
        {scenes.map((s, i) => <span key={s} className="pb-0.5 text-center text-[8px] text-muted-foreground">{i + 1}</span>)}
        <span className="pb-0.5 pl-1.5 text-[9px] text-muted-foreground">total</span>
        {order.map((ci) => (
          <div key={characters[ci]} className="contents">
            <span className="self-center pr-1.5 text-[10px] whitespace-nowrap">{characters[ci]}</span>
            {scenes.map((s, si) => {
              const v = grid[ci]?.[si] ?? 0;
              return <span key={s} className="h-4" style={{ background: v ? `color-mix(in oklch, ${TONE} ${Math.round(20 + (v / max) * 76)}%, transparent)` : "var(--muted)" }}
                title={`${characters[ci]} · ${s}: ${v} min`} />;
            })}
            <span className="self-center pl-1.5 text-[9px] tabular-nums text-muted-foreground whitespace-nowrap">
              {totals[ci].toFixed(0)}m · {counts[ci]} sc
            </span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        {characters[lead]} leads on minutes ({totals[lead].toFixed(0)}) across {counts[lead]} of {scenes.length} scenes —
        minutes and presence are different claims and this shows both
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------- dialogue share */
/**
 * Lines spoken per character, split by who they speak TO.
 *
 * A character with many lines and one interlocutor is isolated in the script,
 * which is invisible in a total.
 */
export function DialogueShare({
  characters, /** lines[from][to] */ lines, label,
}: {
  characters: string[]; lines: number[][]; label?: string;
}) {
  if (!characters.length) return null;
  const totals = characters.map((_, i) => (lines[i] ?? []).reduce((a, b) => a + b, 0));
  const partners = characters.map((_, i) => (lines[i] ?? []).filter((v) => v > 0).length);
  const grand = totals.reduce((a, b) => a + b, 0);
  const max = Math.max(...totals);
  const isolated = characters
    .map((c, i) => ({ c, share: totals[i] / grand, partners: partners[i] }))
    .filter((x) => x.share > 0.1 && x.partners <= 2);

  return (
    <div className="w-full space-y-1">
      {characters.map((c, i) => (
        <div key={c} className="flex items-center gap-2">
          <span className="w-[24%] shrink-0 truncate text-[10px]">{c}</span>
          <div className="flex h-3.5 flex-1 overflow-hidden rounded-[2px]" style={{ width: `${(totals[i] / max) * 100}%` }}>
            {characters.map((t, j) => {
              const v = lines[i]?.[j] ?? 0;
              if (!v) return null;
              return <span key={t} style={{
                width: `${(v / totals[i]) * 100}%`,
                background: `color-mix(in oklch, ${TONE} ${Math.round(96 - (j / Math.max(1, characters.length - 1)) * 66)}%, transparent)`,
                borderRight: "1px solid var(--background)",
              }} title={`${c} → ${t}: ${v} lines`} />;
            })}
          </div>
          <span className="shrink-0 text-[9px] tabular-nums text-muted-foreground">
            {totals[i]} · {partners[i]} others
          </span>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        Each bar is split by who is being spoken to ·
        {isolated.length
          ? ` ${isolated.map((x) => x.c).join(", ")} ${isolated.length === 1 ? "has" : "have"} a big share and almost nobody to say it to`
          : " every major character talks to several others"}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------- edit rhythm */
/**
 * Cutting rate over the running time, smoothed.
 *
 * Pace is a curve, not a number, and an action climax shows as a spike — this
 * is the shape an editor argues about.
 */
export function EditRhythm({
  cuts, runtimeMin, windowMin = 2, height = 220, label,
}: {
  /** minute mark of each cut */ cuts: number[]; runtimeMin: number; windowMin?: number;
  height?: number; label?: string;
}) {
  if (cuts.length < 2) return null;
  const bins = Math.ceil(runtimeMin / windowMin);
  const rate = Array.from({ length: bins }, (_, b) =>
    cuts.filter((c) => c >= b * windowMin && c < (b + 1) * windowMin).length / windowMin);
  const max = Math.max(...rate) * 1.06;
  const mean = rate.reduce((a, b) => a + b, 0) / rate.length;
  const peak = rate.indexOf(Math.max(...rate));

  return (
    <div className="w-full">
      <div className="relative flex items-end gap-[1px]" style={{ height }}>
        {rate.map((r, i) => (
          <div key={i} className="flex-1" title={`${i * windowMin}–${(i + 1) * windowMin} min: ${r.toFixed(1)} cuts/min`}
            style={{ height: `${(r / max) * 100}%`, background: TONE, opacity: r > mean * 1.6 ? 1 : 0.55 }} />
        ))}
        <div className="pointer-events-none absolute right-0 left-0 border-t border-dashed border-foreground"
          style={{ bottom: `${(mean / max) * 100}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>0 min</span><span>{runtimeMin} min</span>
      </div>
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        {cuts.length} cuts, {mean.toFixed(1)} a minute on average · fastest stretch is
        {" "}{peak * windowMin}–{(peak + 1) * windowMin} min at {Math.max(...rate).toFixed(1)} a minute
      </p>
    </div>
  );
}

/* --------------------------------------------------------------------- scene heat */
/** Scenes by length and where they sit, with the act breaks marked. */
export function SceneHeat({
  scenes, acts, height = 230, label,
}: {
  scenes: { n: number; minutes: number; intExt?: "INT" | "EXT"; night?: boolean }[];
  acts: { atMinute: number; name: string }[]; height?: number; label?: string;
}) {
  if (!scenes.length) return null;
  let run = 0;
  const placed = scenes.map((s) => { const from = run; run += s.minutes; return { ...s, from, to: run }; });
  const total = run;
  const max = Math.max(...scenes.map((s) => s.minutes));
  const nights = scenes.filter((s) => s.night).length;

  return (
    <div className="w-full">
      <div className="relative flex items-end" style={{ height }}>
        {placed.map((s) => (
          <div key={s.n} title={`sc ${s.n} · ${s.minutes.toFixed(1)} min · ${s.intExt ?? ""}${s.night ? " NIGHT" : ""}`}
            style={{
              width: `${(s.minutes / total) * 100}%`,
              height: `${(s.minutes / max) * 100}%`,
              background: s.night ? TONE : "var(--background)",
              boxShadow: s.night ? undefined : `inset 0 0 0 1px ${TONE}`,
              opacity: s.intExt === "EXT" ? 1 : 0.65,
              borderRight: "1px solid var(--background)",
            }} />
        ))}
        {acts.map((a) => (
          <div key={a.name} className="absolute top-0 bottom-0 border-l-2 border-dashed border-foreground"
            style={{ left: `${(a.atMinute / total) * 100}%` }} />
        ))}
      </div>
      <div className="relative mt-1 h-3.5">
        {acts.map((a) => (
          <span key={a.name} className="absolute -translate-x-1/2 text-[9px] text-muted-foreground"
            style={{ left: `${Math.min(92, Math.max(8, (a.atMinute / total) * 100))}%` }}>{a.name}</span>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        Width is running time, height is scene length · filled is NIGHT, fainter is INT ·
        {scenes.length} scenes over {total.toFixed(0)} min, {nights} at night — which is the shooting cost
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------- release window */
/**
 * Revenue by window over time, with the CROSSOVER computed — the week home
 * revenue overtakes theatrical is the whole argument about window length.
 */
export function ReleaseWindow({
  weeks, windows, height = 240, label,
}: {
  weeks: string[]; windows: { name: string; revenue: number[] }[]; height?: number; label?: string;
}) {
  if (!windows.length) return null;
  const totals = weeks.map((_, i) => windows.reduce((s, w) => s + (w.revenue[i] ?? 0), 0));
  const max = Math.max(...totals) * 1.05;
  const first = windows[0], rest = windows.slice(1);
  const crossover = weeks.findIndex((_, i) =>
    rest.reduce((s, w) => s + (w.revenue[i] ?? 0), 0) > (first.revenue[i] ?? 0));

  return (
    <div className="w-full">
      <div className="flex items-end" style={{ height }}>
        {weeks.map((w, i) => (
          <div key={w} className="flex h-full flex-1 flex-col justify-end" title={w}>
            {windows.map((win, wi) => (
              <span key={win.name} style={{
                height: `${((win.revenue[i] ?? 0) / max) * 100}%`,
                background: `color-mix(in oklch, ${TONE} ${Math.round(94 - (wi / Math.max(1, windows.length - 1)) * 68)}%, transparent)`,
              }} />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{weeks[0]}</span><span>{weeks[weeks.length - 1]}</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 text-[10px] text-muted-foreground">
        {windows.map((w, i) => (
          <span key={w.name} className="flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: `color-mix(in oklch, ${TONE} ${Math.round(94 - (i / Math.max(1, windows.length - 1)) * 68)}%, transparent)` }} />{w.name}
          </span>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground" aria-label={label}>
        {crossover >= 0
          ? `Everything else overtakes ${first.name} in ${weeks[crossover]} — that week is the argument about window length`
          : `${first.name} stays ahead throughout`}
      </p>
    </div>
  );
}
