import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A 1D barcode, drawn from widths SUPPLIED to it — it does not encode.
 *
 * THE SAME REFUSAL AS `qr-code`, AND FOR THE SAME MEASURED REASON. A Code
 * 128 encoder was written here and it was broken: the pattern table had 106
 * entries where the standard has 107, so Start/Stop were shifted and
 * `CODE128[106]` was `undefined`. Every individual pattern passed the
 * sum-to-11 invariant, which is why nothing caught it — one entry was simply
 * missing from the sequence, and reconstructing it from memory is exactly the
 * confidence that produced the broken QR encoder before it.
 *
 * A WRONG BARCODE IS INDISTINGUISHABLE BY EYE. It renders as convincing
 * stripes and fails in a stockroom, at a till, on a shelf — found by a person
 * holding a scanner, long after anyone could connect it to this file. So the
 * encoding belongs somewhere it can be verified against a real decoder: a
 * library, or the server that already knows the SKU.
 *
 * What this owns is what a caller should not have to know: the quiet zones
 * (10 modules each side, without which a scanner cannot find the code),
 * crisp edges, true black on true white regardless of theme, and the value
 * printed underneath because scanners fail and somebody then types it.
 *
 * `widths` is the standard alternating run-length form — bar, space, bar,
 * space… starting with a bar.
 */
export function Barcode({ widths, value, height = 56, showValue = true, className }: {
  /** Alternating bar/space module widths, starting with a bar. */
  widths: number[];
  /** The human-readable value — printed, and used as the accessible name. */
  value: string;
  height?: number;
  showValue?: boolean;
  className?: string;
}) {
  const QUIET = 10;
  const total = widths.reduce((s, w) => s + w, 0) + QUIET * 2;

  let x = QUIET;
  const bars: React.ReactNode[] = [];
  widths.forEach((w, i) => {
    if (i % 2 === 0 && w > 0) bars.push(<rect key={i} x={x} y={0} width={w} height={height} fill="#000" />);
    x += w;
  });

  if (!widths.length) return null;

  return (
    <figure className={cn("inline-flex flex-col items-center gap-1 bg-white p-2", className)}>
      <svg viewBox={`0 0 ${total} ${height}`} width="100%" style={{ maxWidth: total * 2 }}
        shapeRendering="crispEdges" role="img" aria-label={`Barcode: ${value}`}>
        <rect x="0" y="0" width={total} height={height} fill="#fff" />
        {bars}
      </svg>
      {showValue ? (
        <figcaption className="font-mono text-[11px] tracking-widest text-black">{value}</figcaption>
      ) : null}
    </figure>
  );
}
