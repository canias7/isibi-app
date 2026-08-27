import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Live WCAG contrast arithmetic for a colour pair somebody is choosing.
 *
 * IT COMPUTES THE REAL FORMULA — relative luminance with the sRGB transfer
 * curve, not a lightness difference. The naive |L1-L2| guess passes pairs that
 * fail and fails pairs that pass; the piecewise curve (channel/12.92 below the
 * threshold, the 2.4 power above) is the entire correctness of this component
 * and is why it exists rather than eyeballing.
 *
 * IT REPORTS AGAINST BOTH THRESHOLDS BY USE: 4.5:1 for body text, 3:1 for
 * large text and UI parts. A single pass/fail hides that a failing body pair
 * is often a fine heading pair — which is usually the fix.
 *
 * THE VERDICT IS WORDS AND THE RATIO, never a traffic light. This is an
 * accessibility tool; failing its own rules would be the joke version.
 *
 * The preview shows REAL TEXT in both sizes, because a swatch pair reads as
 * fine long after text on it stopped being legible.
 */
export function relativeLuminance(hex: string): number | null {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    // The sRGB transfer curve — the part the naive guess skips.
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number | null {
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  if (la == null || lb == null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function ContrastCheck({ foreground, background, className }: {
  foreground: string;
  background: string;
  className?: string;
}) {
  const ratio = contrastRatio(foreground, background);
  if (ratio == null) {
    return <p data-slot="contrast-check" className={cn("text-xs text-muted-foreground", className)}>Enter two six-digit hex colours.</p>;
  }
  const body = ratio >= 4.5;
  const large = ratio >= 3;
  const shown = `${(Math.round(ratio * 100) / 100).toFixed(2)}:1`;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div style={{ backgroundColor: background, color: foreground }}
        className="rounded-md border border-border p-3">
        <p className="text-sm">Body text at this size needs 4.5:1.</p>
        <p className="text-xl font-semibold">Large text needs 3:1.</p>
      </div>
      <p className="text-sm">
        <strong className="font-semibold tabular-nums">{shown}</strong>
        {" — "}
        {body ? "fine for any text."
          : large ? "fine for large text and headings; too low for body text."
          : "too low for text of any size."}
      </p>
    </div>
  );
}
