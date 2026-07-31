/** Typography and layout systems, drawn as the specimens they are. */

const TONE = "var(--foreground)";

/* ---------------------------------------------------------------- type scale */
/**
 * A modular scale rendered at its actual sizes.
 *
 * Every step is DERIVED from the base and the ratio, so the specimen can never
 * drift from the tokens a stylesheet would ship — which is the whole reason to
 * have a scale rather than a list of numbers somebody liked.
 */
export function TypeScale({
  base = 16, ratio = 1.25, steps = 7, from = -2, sample = "Handgloves", label,
}: {
  base?: number; ratio?: number; steps?: number; from?: number; sample?: string; label?: string;
}) {
  const rows = Array.from({ length: steps }, (_, i) => {
    const step = from + i;
    return { step, px: base * Math.pow(ratio, step) };
  }).reverse();

  return (
    <div className="w-full">
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.step} className="flex items-baseline gap-3 overflow-hidden">
            <span className="w-16 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
              {r.px.toFixed(1)}px
            </span>
            <span className="truncate leading-none" style={{ fontSize: Math.min(r.px, 46), color: TONE }}>{sample}</span>
            <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground">
              {r.step > 0 ? "+" : ""}{r.step}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        {base}px base × {ratio} per step · every size is base × ratio^step, so the scale cannot drift from its tokens
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- modular grid */
/**
 * Columns, gutters and margins to scale, with the COLUMN WIDTH computed —
 * the number a designer actually needs and the one nobody can do in their head.
 */
export function ModularGrid({
  columns, gutter, margin, width = 1200, height = 170, label,
}: {
  columns: number; /** px */ gutter: number; margin: number; width?: number; height?: number; label?: string;
}) {
  if (columns < 1) return null;
  const usable = width - margin * 2 - gutter * (columns - 1);
  const col = usable / columns;
  const pct = (v: number) => (v / width) * 100;

  return (
    <div className="w-full">
      <div className="relative overflow-hidden rounded-[3px]" style={{ height, background: "var(--muted)" }}>
        {Array.from({ length: columns }, (_, i) => (
          <div key={i} className="absolute top-0 bottom-0"
            style={{ left: `${pct(margin + i * (col + gutter))}%`, width: `${pct(col)}%`, background: TONE, opacity: 0.22 }} />
        ))}
        <div className="absolute top-0 bottom-0 border-r border-dashed border-foreground" style={{ left: `${pct(margin)}%` }} />
        <div className="absolute top-0 bottom-0 border-l border-dashed border-foreground" style={{ right: `${pct(margin)}%` }} />
      </div>
      <div className="mt-1 grid grid-cols-2 gap-x-3 text-[10px] text-muted-foreground">
        <span>{columns} columns · {gutter}px gutters</span>
        <span>{margin}px margins</span>
        <span className="font-medium text-foreground">Column {col.toFixed(1)}px</span>
        <span>Content {usable + gutter * (columns - 1)}px of {width}px</span>
      </div>
      <p className="mt-0.5 text-[10px] text-muted-foreground" aria-label={label}>
        Column width is derived from the container, not chosen — change any input and it follows
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- baseline grid */
/**
 * Text set against a baseline grid, showing whether the line height actually
 * lands on it.
 *
 * The check is arithmetic: a line height that is not a whole multiple of the
 * grid drifts a little further off with every line, which is invisible in a
 * paragraph and obvious over a column.
 */
export function BaselineGrid({
  gridPx = 8, fontPx = 16, lineHeight = 1.5, lines = 9, height = 190, label,
}: {
  gridPx?: number; fontPx?: number; lineHeight?: number; lines?: number; height?: number; label?: string;
}) {
  const linePx = fontPx * lineHeight;
  const multiple = linePx / gridPx;
  const onGrid = Math.abs(multiple - Math.round(multiple)) < 0.001;
  const driftAt = onGrid ? null : Math.ceil(gridPx / 2 / Math.abs(linePx - Math.round(multiple) * gridPx));

  return (
    <div className="w-full">
      <div className="relative overflow-hidden rounded-[3px]" style={{ height, background: "var(--background)" }}>
        {Array.from({ length: Math.ceil(height / gridPx) }, (_, i) => (
          <div key={i} className="absolute right-0 left-0 border-t" style={{ top: i * gridPx, borderColor: "var(--border)" }} />
        ))}
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="absolute left-2 truncate"
            style={{ top: i * linePx, fontSize: fontPx, lineHeight: `${linePx}px`, color: TONE }}>
            The quick brown fox jumps over the lazy dog
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        {gridPx}px grid · {fontPx}px at {lineHeight} is {linePx}px, {multiple.toFixed(3)} grid units ·
        {onGrid ? " lands on every line" : ` drifts off by half a unit after about ${driftAt} lines`}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- contrast ladder */
/**
 * Text tones against their background, with the WCAG contrast ratio computed
 * from the actual luminances — and the 4.5:1 and 3:1 thresholds marked.
 *
 * A palette that only lists hex values tells nobody whether it is readable.
 */
export function ContrastLadder({
  steps = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1], onDark = false, label,
}: {
  /** ink strength, 0-1 */ steps?: number[]; onDark?: boolean; label?: string;
}) {
  // Relative luminance of a grey at level L, sRGB-linearised.
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const lum = (grey: number) => lin(grey);
  const bg = onDark ? 0.07 : 1;
  const ratio = (ink: number) => {
    // Ink blended onto the background at the given strength.
    const c = bg + (onDark ? 1 - bg : 0 - bg) * ink;
    const a = lum(Math.max(c, bg)), b = lum(Math.min(c, bg));
    return (a + 0.05) / (b + 0.05);
  };

  return (
    <div className="w-full rounded-[3px] p-2" style={{ background: onDark ? "#111113" : "#ffffff" }}>
      <div className="space-y-1">
        {steps.map((s) => {
          const r = ratio(s);
          const pass = r >= 4.5 ? "AA" : r >= 3 ? "large only" : "fails";
          const shade = onDark
            ? `rgb(${Math.round((0.07 + (1 - 0.07) * s) * 255)},${Math.round((0.07 + (1 - 0.07) * s) * 255)},${Math.round((0.07 + (1 - 0.07) * s) * 255)})`
            : `rgb(${Math.round((1 - s) * 255)},${Math.round((1 - s) * 255)},${Math.round((1 - s) * 255)})`;
          return (
            <div key={s} className="flex items-baseline gap-2">
              <span className="flex-1 truncate text-[13px]" style={{ color: shade }}>
                Body copy at {Math.round(s * 100)}% ink
              </span>
              <span className="w-12 text-right text-[10px] tabular-nums" style={{ color: onDark ? "#c9c9cc" : "#555" }}>
                {r.toFixed(2)}:1
              </span>
              <span className="w-16 text-right text-[10px]" style={{ color: onDark ? "#c9c9cc" : "#555" }}>{pass}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 text-[10px]" style={{ color: onDark ? "#8b8b90" : "#666" }} aria-label={label}>
        Ratios computed from sRGB luminance, not eyeballed · 4.5:1 for body text, 3:1 for large
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- spacing scale */
/**
 * A spacing scale as actual gaps.
 *
 * Rendered at size rather than listed, because the reason a scale exists is
 * that adjacent steps must be *tellable apart* — and a table of numbers cannot
 * show that two of them are not.
 */
export function SpacingScale({
  base = 4, steps = [1, 2, 3, 4, 6, 8, 12, 16, 24], label,
}: {
  base?: number; steps?: number[]; label?: string;
}) {
  const rows = steps.map((m) => ({ m, px: base * m }));
  // Adjacent steps closer than 1.25× are hard to tell apart in use.
  const tight = rows.slice(1).filter((r, i) => r.px / rows[i].px < 1.25).map((r) => r.px);

  return (
    <div className="w-full">
      <div className="space-y-[3px]">
        {rows.map((r) => (
          <div key={r.m} className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">{r.px}px</span>
            <span className="h-3 shrink-0 rounded-[1px]" style={{ width: 3, background: TONE }} />
            <span style={{ width: r.px }} />
            <span className="h-3 shrink-0 rounded-[1px]" style={{ width: 3, background: TONE }} />
            <span className="ml-2 text-[10px] text-muted-foreground">{base} × {r.m}</span>
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground" aria-label={label}>
        {base}px base · the gap between the marks IS the value ·
        {tight.length ? ` ${tight.join(", ")}px sit under 1.25× of the step below and are hard to tell apart` : " every step is at least 1.25× the one below"}
      </p>
    </div>
  );
}
