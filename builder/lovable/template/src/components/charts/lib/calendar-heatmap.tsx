/**
 * A year of daily counts as a week-column grid — the shape people know from
 * contribution graphs.
 *
 * `heat-strip` in the ui kit is the one-dimensional version of this; a year of
 * bookings needs two, because the useful question is "which DAY of the week is
 * quiet", and that is only visible once the weeks stack into columns.
 *
 * Intensity is bucketed, not continuous: five steps read as five steps, where a
 * continuous ramp makes 61 and 64 look different when they are not.
 */
export type Day = { date: string; value: number };

export function CalendarHeatmap({
  days,
  weeks = 26,
  cell = 11,
  gap = 3,
  levels,
  label,
  startWeekday = 1,
  showMonths = true,
  showWeekdays = true,
}: {
  days: Day[];
  weeks?: number;
  cell?: number;
  gap?: number;
  /** Five fills, lightest first. Defaults to a monochrome ramp of the ink colour. */
  levels?: [string, string, string, string, string];
  label?: string;
  /** 0 = weeks start Sunday, 1 = Monday. */
  startWeekday?: 0 | 1;
  showMonths?: boolean;
  showWeekdays?: boolean;
}) {
  if (!days.length) return null;

  const ramp = levels ?? ([
    "var(--muted)",
    "color-mix(in oklch, var(--foreground) 18%, var(--muted))",
    "color-mix(in oklch, var(--foreground) 38%, var(--muted))",
    "color-mix(in oklch, var(--foreground) 62%, var(--muted))",
    "var(--foreground)",
  ] as [string, string, string, string, string]);

  const hi = Math.max(...days.map((d) => d.value)) || 1;
  // Zero is its own level. Without that a quiet day and a missing day look the
  // same, and "we were closed" reads as "nobody came".
  const level = (v: number) => (v <= 0 ? 0 : Math.min(4, Math.floor((v / hi) * 3.999) + 1));

  const recent = days.slice(-weeks * 7);
  const first = new Date(recent[0].date + "T00:00:00Z");
  const lead = (first.getUTCDay() - startWeekday + 7) % 7;
  const cols: (Day | null)[][] = [];
  let col: (Day | null)[] = Array(lead).fill(null);
  for (const d of recent) {
    col.push(d);
    if (col.length === 7) { cols.push(col); col = []; }
  }
  if (col.length) cols.push([...col, ...Array(7 - col.length).fill(null)]);

  const step = cell + gap;
  const padL = showWeekdays ? 26 : 0;
  const padT = showMonths ? 14 : 0;
  const w = padL + cols.length * step;
  const h = padT + 7 * step;

  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const rowName = (r: number) => names[(r + startWeekday) % 7];

  const months: { x: number; text: string }[] = [];
  if (showMonths) {
    let last = "";
    cols.forEach((c, i) => {
      const d = c.find(Boolean);
      if (!d) return;
      const m = new Date(d.date + "T00:00:00Z").toLocaleString("en", { month: "short", timeZone: "UTC" });
      if (m !== last) { months.push({ x: padL + i * step, text: m }); last = m; }
    });
  }

  const total = recent.reduce((s, d) => s + d.value, 0);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ maxWidth: w }}
      role="img" aria-label={label ?? `${recent.length} days, ${total} in total, peak ${hi}`}>
      {months.map((m) => (
        <text key={m.x + m.text} x={m.x} y={10} className="fill-muted-foreground" fontSize={9}>{m.text}</text>
      ))}
      {showWeekdays && [1, 3, 5].map((r) => (
        <text key={r} x={0} y={padT + r * step + cell - 1} className="fill-muted-foreground" fontSize={9}>
          {rowName(r).slice(0, 3)}
        </text>
      ))}
      {cols.map((c, i) =>
        c.map((d, r) =>
          d ? (
            <rect key={`${i}-${r}`} x={padL + i * step} y={padT + r * step} width={cell} height={cell} rx={2}
              fill={ramp[level(d.value)]}>
              <title>{`${d.date}: ${d.value}`}</title>
            </rect>
          ) : null
        )
      )}
    </svg>
  );
}

/** Deterministic sample data — no Math.random, so every build renders the same. */
export function sampleDays(n: number, seed = 7, from = "2024-01-01"): Day[] {
  const out: Day[] = [];
  const start = new Date(from + "T00:00:00Z");
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const wd = d.getUTCDay();
    const quiet = wd === 0 ? 0.15 : wd === 1 ? 0.5 : 1;
    out.push({ date: d.toISOString().slice(0, 10), value: Math.round(((s % 100) / 100) * 12 * quiet) });
  }
  return out;
}
