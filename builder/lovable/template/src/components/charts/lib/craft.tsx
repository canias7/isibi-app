/** Making things: textiles, rhythm, rock and what is in the packet. */

const TONE = "var(--foreground)";

/* -------------------------------------------------------------- knitting chart */
/**
 * A stitch chart, read the way it is actually worked: bottom to top, and
 * right-to-left on the odd rows.
 *
 * The row numbers alternate sides to say which way each is read, because a
 * chart numbered down one edge is a chart people knit backwards.
 */
export function KnittingChart({
  rows, legend, size = 320, label,
}: {
  /** bottom row first; each entry is a symbol key */ rows: string[][];
  legend: { symbol: string; name: string }[]; size?: number; label?: string;
}) {
  if (!rows.length) return null;
  const cols = rows[0].length;
  const shown = [...rows].reverse();
  const counts = new Map<string, number>();
  rows.flat().forEach((s) => counts.set(s, (counts.get(s) ?? 0) + 1));

  return (
    <div className="w-full" style={{ maxWidth: size }}>
      <div className="inline-grid gap-px" style={{ gridTemplateColumns: `auto repeat(${cols}, 1fr) auto` }}>
        {shown.map((row, i) => {
          const rowNo = rows.length - i;
          const rightToLeft = rowNo % 2 === 1;
          return (
            <div key={rowNo} className="contents">
              <span className="self-center pr-1 text-right text-[9px] tabular-nums text-muted-foreground">
                {rightToLeft ? "" : rowNo}
              </span>
              {row.map((s, c) => (
                <span key={c} className="flex aspect-square items-center justify-center border text-[10px] leading-none"
                  style={{ borderColor: "var(--border)", background: s === "k" ? "var(--background)" : "var(--muted)" }}
                  title={legend.find((l) => l.symbol === s)?.name ?? s}>
                  {s === "k" ? "" : s}
                </span>
              ))}
              <span className="self-center pl-1 text-[9px] tabular-nums text-muted-foreground">
                {rightToLeft ? rowNo : ""}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {legend.map((l) => (
          <span key={l.symbol}>
            <span className="mr-1 inline-flex h-3.5 w-3.5 items-center justify-center border align-middle text-[9px]"
              style={{ borderColor: "var(--border)", background: l.symbol === "k" ? "var(--background)" : "var(--muted)" }}>
              {l.symbol === "k" ? "" : l.symbol}
            </span>
            {l.name} ×{counts.get(l.symbol) ?? 0}
          </span>
        ))}
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground" aria-label={label}>
        {rows.length} rows of {cols} · odd rows numbered on the right are read right to left, even rows left to right
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- weave draft */
/**
 * The four-part weaving draft: threading, tie-up, treadling and the drawdown.
 *
 * The DRAWDOWN is computed from the other three rather than drawn — that
 * derivation is the entire purpose of a draft, and a hand-drawn one that
 * disagrees has cost somebody a warp.
 */
export function WeaveDraft({
  /** which shaft each warp thread goes on */ threading, /** shafts each treadle lifts */ tieUp,
  /** treadle used on each pick */ treadling, shafts = 4, size = 300, label,
}: {
  threading: number[]; tieUp: number[][]; treadling: number[]; shafts?: number; size?: number; label?: string;
}) {
  if (!threading.length || !treadling.length) return null;
  // A warp thread shows on top where its shaft is lifted by that pick's treadle.
  const cloth = treadling.map((t) => threading.map((sh) => (tieUp[t] ?? []).includes(sh)));
  const warpFaced = cloth.flat().filter(Boolean).length / (cloth.length * threading.length);
  const cell = 9;

  return (
    <div className="w-full" style={{ maxWidth: size, overflowX: "auto" }}>
      <div className="inline-block">
        <div className="flex">
          <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${threading.length}, ${cell}px)` }}>
            {Array.from({ length: shafts }, (_, s) => shafts - 1 - s).flatMap((s) =>
              threading.map((th, i) => (
                <span key={`t${s}-${i}`} style={{ width: cell, height: cell, background: th === s ? TONE : "var(--muted)" }} />
              )))}
          </div>
          <div className="ml-1 grid gap-px" style={{ gridTemplateColumns: `repeat(${tieUp.length}, ${cell}px)` }}>
            {Array.from({ length: shafts }, (_, s) => shafts - 1 - s).flatMap((s) =>
              tieUp.map((tu, i) => (
                <span key={`u${s}-${i}`} style={{ width: cell, height: cell, background: tu.includes(s) ? TONE : "var(--muted)" }} />
              )))}
          </div>
        </div>
        <div className="mt-1 flex">
          <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${threading.length}, ${cell}px)` }}>
            {cloth.flatMap((row, r) => row.map((up, c) => (
              <span key={`c${r}-${c}`} style={{ width: cell, height: cell, background: up ? TONE : "var(--background)", outline: "1px solid var(--border)", outlineOffset: -1 }} />
            )))}
          </div>
          <div className="ml-1 grid gap-px" style={{ gridTemplateColumns: `repeat(${tieUp.length}, ${cell}px)` }}>
            {treadling.flatMap((t, r) => tieUp.map((_, i) => (
              <span key={`r${r}-${i}`} style={{ width: cell, height: cell, background: t === i ? TONE : "var(--muted)" }} />
            )))}
          </div>
        </div>
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        Threading top left, tie-up top right, treadling bottom right · the cloth is COMPUTED from those three ·
        {Math.round(warpFaced * 100)}% warp on the face
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ drum grid */
/**
 * A step sequencer. Beat lines every four steps, because a grid without them
 * cannot be counted, and accents drawn heavier than plain hits.
 */
export function DrumGrid({
  tracks, steps = 16, bpm, label,
}: {
  /** per track, hit strength 0-1 per step */ tracks: { name: string; hits: number[] }[];
  steps?: number; bpm?: number; label?: string;
}) {
  if (!tracks.length) return null;
  const total = tracks.reduce((s, t) => s + t.hits.filter((h) => h > 0).length, 0);
  const bars = steps / 4;

  return (
    <div className="w-full">
      <div className="mb-1 flex text-[9px] text-muted-foreground" style={{ paddingLeft: "22%" }}>
        {Array.from({ length: steps }, (_, i) => (
          <span key={i} className="flex-1 text-center">{i % 4 === 0 ? i / 4 + 1 : ""}</span>
        ))}
      </div>
      <div className="space-y-[3px]">
        {tracks.map((t) => (
          <div key={t.name} className="flex items-center">
            <span className="w-[22%] shrink-0 truncate text-[10px]">{t.name}</span>
            <div className="flex flex-1 gap-[2px]">
              {Array.from({ length: steps }, (_, i) => {
                const v = t.hits[i] ?? 0;
                return (
                  <span key={i} className="h-4 flex-1 rounded-[1px]"
                    style={{
                      background: v > 0 ? TONE : "var(--muted)",
                      opacity: v > 0 ? 0.4 + v * 0.6 : 1,
                      borderLeft: i % 4 === 0 ? `2px solid ${v > 0 ? "var(--background)" : "var(--border)"}` : undefined,
                    }}
                    title={v > 0 ? `${t.name} step ${i + 1} · ${Math.round(v * 100)}%` : undefined} />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        {bars} bars of {steps / bars} · {total} hits · darker is a harder hit
        {bpm ? ` · ${bpm} bpm, so one bar is ${(240 / bpm).toFixed(1)} s` : ""}
      </p>
    </div>
  );
}

/* ------------------------------------------------------ stratigraphic column */
/**
 * Rock units bottom-up (oldest first), with thickness to scale and grain size
 * setting how far each bed juts out.
 *
 * That profile is the convention and it is load-bearing: a coarsening-upward
 * sequence is read from the SHAPE of the edge, not from the labels.
 */
export function StratColumn({
  beds, height = 300, label,
}: {
  /** oldest first */ beds: { name: string; metres: number; grain: number; fossils?: string }[];
  height?: number; label?: string;
}) {
  if (!beds.length) return null;
  const total = beds.reduce((s, b) => s + b.metres, 0);
  const top = beds[beds.length - 1], bottom = beds[0];
  const coarsening = top.grain > bottom.grain;

  return (
    <div className="w-full">
      <div className="flex" style={{ height }}>
        <div className="flex w-16 flex-col-reverse justify-start text-right">
          {beds.map((b, i) => {
            const below = beds.slice(0, i).reduce((s, x) => s + x.metres, 0);
            return (
              <span key={b.name} className="pr-1 text-[9px] tabular-nums text-muted-foreground"
                style={{ height: `${(b.metres / total) * 100}%` }}>{below.toFixed(0)} m</span>
            );
          })}
        </div>
        <div className="flex w-24 flex-col-reverse">
          {beds.map((b) => (
            <div key={b.name} className="border-t" style={{
              height: `${(b.metres / total) * 100}%`,
              width: `${34 + b.grain * 66}%`,
              background: `color-mix(in oklch, ${TONE} ${Math.round(14 + b.grain * 72)}%, transparent)`,
              borderColor: "var(--background)",
            }} title={`${b.name} · ${b.metres} m`} />
          ))}
        </div>
        <div className="flex flex-1 flex-col-reverse">
          {beds.map((b) => (
            <div key={b.name} className="flex items-center pl-2" style={{ height: `${(b.metres / total) * 100}%` }}>
              <span className="truncate text-[10px]">
                {b.name}
                {b.fossils ? <span className="text-muted-foreground"> · {b.fossils}</span> : null}
              </span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground" aria-label={label}>
        Oldest at the base · {total} m logged · wider beds are coarser, so the profile
        {coarsening ? " coarsens upward" : " fines upward"}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------- nutrition label */
/**
 * The panel from the back of the packet, with %RI COMPUTED from the reference
 * intakes rather than reprinted.
 *
 * Per-100g and per-portion are shown side by side, because a portion the
 * manufacturer chose is how a high number is made to look small.
 */
export function NutritionLabel({
  per100g, portionGrams, servings, size = 320, label,
}: {
  per100g: { energyKcal: number; fat: number; saturates: number; carbs: number; sugars: number; fibre?: number; protein: number; salt: number };
  portionGrams: number; servings?: number; size?: number; label?: string;
}) {
  const RI = { energyKcal: 2000, fat: 70, saturates: 20, carbs: 260, sugars: 90, protein: 50, salt: 6 };
  const f = portionGrams / 100;
  const rows: { name: string; per100: number; portion: number; ri?: number; unit: string; indent?: boolean }[] = [
    { name: "Energy", per100: per100g.energyKcal, portion: per100g.energyKcal * f, ri: RI.energyKcal, unit: "kcal" },
    { name: "Fat", per100: per100g.fat, portion: per100g.fat * f, ri: RI.fat, unit: "g" },
    { name: "of which saturates", per100: per100g.saturates, portion: per100g.saturates * f, ri: RI.saturates, unit: "g", indent: true },
    { name: "Carbohydrate", per100: per100g.carbs, portion: per100g.carbs * f, ri: RI.carbs, unit: "g" },
    { name: "of which sugars", per100: per100g.sugars, portion: per100g.sugars * f, ri: RI.sugars, unit: "g", indent: true },
    ...(per100g.fibre != null ? [{ name: "Fibre", per100: per100g.fibre, portion: per100g.fibre * f, unit: "g" }] : []),
    { name: "Protein", per100: per100g.protein, portion: per100g.protein * f, ri: RI.protein, unit: "g" },
    { name: "Salt", per100: per100g.salt, portion: per100g.salt * f, ri: RI.salt, unit: "g" },
  ];
  const high = rows.filter((r) => r.ri && r.portion / r.ri > 0.3);

  return (
    <div className="w-full" style={{ maxWidth: size }}>
      <div className="rounded-[3px] border-2 p-2" style={{ borderColor: TONE }}>
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-2 text-[10px]">
          <span className="font-semibold">Typical values</span>
          <span className="text-right font-semibold">per 100g</span>
          <span className="text-right font-semibold">per {portionGrams}g</span>
          <span className="text-right font-semibold">%RI</span>
          {rows.map((r) => (
            <div key={r.name} className="contents">
              <span className={r.indent ? "pl-3 text-muted-foreground" : ""}>{r.name}</span>
              <span className="text-right tabular-nums">{r.per100.toFixed(r.unit === "kcal" ? 0 : 1)}{r.unit === "kcal" ? "" : r.unit}</span>
              <span className="text-right tabular-nums">{r.portion.toFixed(r.unit === "kcal" ? 0 : 1)}{r.unit === "kcal" ? "" : r.unit}</span>
              <span className="text-right tabular-nums">{r.ri ? `${Math.round((r.portion / r.ri) * 100)}%` : "—"}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        %RI computed against adult reference intakes for the {portionGrams}g portion
        {servings ? `, ${servings} per pack` : ""} ·
        {high.length ? ` ${high.map((r) => r.name.replace("of which ", "")).join(", ")} over 30% of a day in one portion` : " nothing over 30% of a day in one portion"}
      </p>
    </div>
  );
}
