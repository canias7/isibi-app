import { cn } from "@/lib/utils";
/**
 * Where the electricity came from — as shares, with the period named.
 *
 * THE PERIOD IS PART OF THE CLAIM. A mix is an annual average, a monthly one or
 * right now, and those differ enormously — a "100% renewable" tariff is an
 * annual accounting statement, and the electricity arriving this second came
 * from whatever the grid was running.
 *
 * SHARES ARE LABELLED IN TEXT, never by colour. A pie of six similar wedges is
 * the standard rendering and is unreadable in greyscale, in print, and to
 * anyone who cannot distinguish the colours — so this is a list with bars.
 *
 * IT SHOWS WHETHER THE CLAIM IS BACKED BY CERTIFICATES rather than by supply.
 * Most consumer renewable tariffs are certificate-backed; that is legal and
 * ordinary and it is not the same thing as the wires carrying wind power, and
 * only one of those is what a customer thinks they bought.
 *
 * SHARES ARE SHOWN AS GIVEN, not silently normalised to 100. If the caller's
 * numbers do not add up, that is worth seeing rather than papering over.
 *
 * THE GAP BETWEEN ROWS EXCEEDS THE GAP INSIDE ONE. Spaced evenly, each bar
 * reads as an underline of the source beneath it and every share is attributed
 * to the wrong fuel.
 */
export type MixSource = { id: string; label: string; percent: number };

export function GenerationMix({ sources, period, certificateBacked, className }: {
  sources: MixSource[];
  /** Free text — "year to March 2026", "right now". */
  period?: string;
  /** True where the claim rests on purchased certificates. */
  certificateBacked?: boolean;
  className?: string;
}) {
  const total = sources.reduce((n, s) => n + s.percent, 0);
  const off = Math.abs(total - 100) > 0.5;
  return (
    <div data-slot="generation-mix" className={cn("space-y-1.5", className)}>
      {period && <p className="text-xs text-muted-foreground">{period}</p>}
      <ul className="space-y-2.5">
        {sources.map((s) => (
          <li key={s.id} className="space-y-0.5">
            <p className="flex items-baseline gap-3 text-sm">
              <span className="min-w-0 flex-1">{s.label}</span>
              <span className="shrink-0 tabular-nums">{s.percent}%</span>
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full border border-border" aria-hidden="true">
              <span className="block h-full bg-foreground" style={{ width: `${Math.min(100, s.percent)}%` }} />
            </div>
          </li>
        ))}
      </ul>
      {off && (
        <p className="text-xs font-medium tabular-nums">These add up to {total.toFixed(1)}%, not 100%.</p>
      )}
      {certificateBacked !== undefined && (
        <p className="text-xs text-muted-foreground">
          {certificateBacked
            ? "Backed by purchased certificates — the electricity delivered to you is whatever the grid was carrying."
            : "Matched to generation, not to purchased certificates."}
        </p>
      )}
    </div>
  );
}
