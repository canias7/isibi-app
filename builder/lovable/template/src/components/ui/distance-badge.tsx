import { cn } from "@/lib/utils";
/**
 * How far away something is.
 *
 * Takes METRES and formats to the reader's own units — miles for en-GB and
 * en-US, kilometres for everywhere else, via `Intl.Locale`'s measurement
 * system rather than a hardcoded list of countries.
 *
 * Short distances lose their decimal: "0.2 mi" is less use than "350 yd" to
 * somebody deciding whether to walk.
 */
export function DistanceBadge({ metres, className }: { metres: number; className?: string }) {
  if (!Number.isFinite(metres) || metres < 0) return null;
  const loc = new Intl.Locale(typeof navigator !== "undefined" ? navigator.language : "en-GB");
  const info = loc as unknown as { getTextInfo?: unknown; measurementSystem?: string };
  const imperial = (info.measurementSystem ?? (/^en-(GB|US|MM|LR)/i.test(loc.toString()) ? "uskm" : "metric")) !== "metric";
  let text: string;
  if (imperial) {
    const yards = metres * 1.09361;
    text = yards < 800 ? `${Math.round(yards / 10) * 10} yd` : `${(metres / 1609.34).toFixed(1)} mi`;
  } else {
    text = metres < 950 ? `${Math.round(metres / 10) * 10} m` : `${(metres / 1000).toFixed(1)} km`;
  }
  return <span data-slot="distance-badge" className={cn("text-xs tabular-nums text-muted-foreground", className)}>{text} away</span>;
}
