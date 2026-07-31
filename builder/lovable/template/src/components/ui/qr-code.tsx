import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Renders a QR code from a matrix. It does NOT encode one, and that is a
 * deliberate refusal rather than an omission.
 *
 * A QR encoder was written for this file and MEASURED BROKEN: it produced a
 * plausible-looking pattern of the right size for every version, and jsQR
 * decoded exactly none of them. That is the whole argument. A QR code is a spec
 * with Reed-Solomon error correction, mask evaluation and two separately-placed
 * copies of the format bits, and a wrong one is indistinguishable from a right
 * one by eye — so shipping a hand-rolled encoder means shipping a poster nobody
 * can scan, discovered by a customer standing in a shop. Same family of refusal
 * as `code-block` shipping no syntax highlighting and `location-card` embedding
 * no map: the thing that cannot be done well without a real dependency is not
 * done badly here.
 *
 * Pass a matrix from a library (`qrcode`, `qr-creator`) or from a server. What
 * this owns is everything around it, and those parts are real:
 *
 * THE QUIET ZONE IS FOUR MODULES and it is not decoration — scanners use it to
 * find the code's edge, and a QR flush against a background fails to scan on a
 * large share of phones. It is the commonest reason a hand-made QR "sometimes
 * doesn't work".
 *
 * `shapeRendering="crispEdges"`, or the modules antialias into grey fringes at
 * small sizes and the contrast a scanner needs is gone.
 *
 * IT IS ALWAYS BLACK ON WHITE, never the brand colours, and the white is
 * explicit rather than inherited — a QR on a dark background is unreadable to
 * most scanners, and a page in dark mode would otherwise invert it.
 *
 * THE VALUE IS PRINTED UNDERNEATH. A code with no visible address cannot be
 * typed by somebody whose camera will not focus, and cannot be checked by
 * anybody wary of scanning an unknown code — which is a reasonable thing to be.
 */
export function QrCode({ matrix, value, size = 160, quiet = 4, showValue = true, label, className }: {
  matrix: boolean[][];
  value?: string;
  size?: number;
  quiet?: number;
  showValue?: boolean;
  label?: string;
  className?: string;
}) {
  const n = matrix.length;
  if (!n || matrix.some((r) => r.length !== n)) {
    return <p className={cn("text-xs text-muted-foreground", className)}>That is not a square QR matrix.</p>;
  }
  const total = n + quiet * 2;
  return (
    <figure className={cn("flex flex-col items-center gap-2", className)}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${total} ${total}`}
        shapeRendering="crispEdges"
        role="img"
        aria-label={label ?? (value ? `QR code for ${value}` : "QR code")}
        className="rounded"
      >
        {/* The quiet zone, in explicit white: a QR inheriting a dark page does not scan. */}
        <rect width={total} height={total} fill="#ffffff" />
        {matrix.map((row, y) =>
          row.map((on, x) => (on ? (
            <rect key={`${x}-${y}`} x={x + quiet} y={y + quiet} width={1} height={1} fill="#000000" />
          ) : null)))}
      </svg>
      {showValue && value ? (
        <figcaption className="max-w-full truncate text-xs text-muted-foreground">{value}</figcaption>
      ) : null}
    </figure>
  );
}
