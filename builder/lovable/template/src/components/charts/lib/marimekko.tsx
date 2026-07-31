/**
 * A mosaic: column WIDTH is one measure, segment HEIGHT is another.
 *
 * The one chart that answers "which segment is big, and is it big because the
 * category is big or because its share is high?" — a stacked bar chart makes
 * every column the same width and hides exactly that.
 *
 * The area of each tile is the product of the two, which is the whole point and
 * also the trap: areas are hard to compare precisely, so the labels carry the
 * numbers rather than relying on the eye.
 */
export type Column = { label: string; total: number; parts: { label: string; value: number }[] };

export function Marimekko({
  columns,
  height = 240,
  gap = 2,
  tones,
  format = (n: number) => String(n),
  showColumnLabels = true,
  showShares = false,
  label,
}: {
  columns: Column[];
  height?: number;
  gap?: number;
  /** One fill per part index. Defaults to a monochrome ramp. */
  tones?: string[];
  format?: (n: number) => string;
  showColumnLabels?: boolean;
  showShares?: boolean;
  label?: string;
}) {
  if (!columns.length) return null;

  const ramp = tones ?? [
    "var(--foreground)",
    "color-mix(in oklch, var(--foreground) 62%, transparent)",
    "color-mix(in oklch, var(--foreground) 38%, transparent)",
    "color-mix(in oklch, var(--foreground) 20%, transparent)",
    "color-mix(in oklch, var(--foreground) 10%, transparent)",
  ];

  const grand = columns.reduce((s, c) => s + c.total, 0) || 1;

  return (
    <div className="w-full" role="img"
      aria-label={label ?? `${columns.length} categories, width by size and height by share`}>
      <div className="flex w-full" style={{ height, gap }}>
        {columns.map((c) => {
          const sum = c.parts.reduce((s, p) => s + p.value, 0) || 1;
          return (
            <div key={c.label} className="flex flex-col" style={{ width: `${(c.total / grand) * 100}%` }}>
              {c.parts.map((p, pi) => (
                <div key={p.label}
                  className="flex items-center justify-center overflow-hidden text-[9px] leading-none"
                  style={{
                    height: `${(p.value / sum) * 100}%`,
                    background: ramp[pi % ramp.length],
                    color: pi === 0 ? "var(--background)" : "var(--foreground)",
                  }}
                  title={`${c.label} · ${p.label}: ${format(p.value)} (${Math.round((p.value / sum) * 100)}%)`}
                >
                  {showShares && (p.value / sum) > 0.12 ? `${Math.round((p.value / sum) * 100)}%` : ""}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {showColumnLabels ? (
        <div className="flex w-full" style={{ gap }}>
          {columns.map((c) => (
            <div key={c.label} className="truncate pt-1 text-center text-[10px] text-muted-foreground"
              style={{ width: `${(c.total / grand) * 100}%` }}>
              {c.label}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export const SERVICE_MIX: Column[] = [
  { label: "Cuts", total: 468, parts: [{ label: "Regular", value: 300 }, { label: "New", value: 120 }, { label: "Walk-in", value: 48 }] },
  { label: "Beard", total: 231, parts: [{ label: "Regular", value: 140 }, { label: "New", value: 61 }, { label: "Walk-in", value: 30 }] },
  { label: "Colour", total: 184, parts: [{ label: "Regular", value: 60 }, { label: "New", value: 104 }, { label: "Walk-in", value: 20 }] },
  { label: "Towel", total: 122, parts: [{ label: "Regular", value: 80 }, { label: "New", value: 30 }, { label: "Walk-in", value: 12 }] },
];
