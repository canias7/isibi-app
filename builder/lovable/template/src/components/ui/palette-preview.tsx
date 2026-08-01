import { cn } from "@/lib/utils";
/**
 * A colour palette with its contrast ratios worked out.
 *
 * THE CONTRAST NUMBER IS THE COMPONENT. A row of swatches looks fine and tells
 * nobody that the brand blue on white is 2.8:1 — unreadable for a great many
 * people and a legal problem in several markets. The ratio is computed here so
 * a bad pairing cannot be chosen by accident.
 *
 * IT NAMES THE THRESHOLD THAT WAS MISSED, not just pass or fail. 4.5 for body
 * text, 3 for large text and interface parts — a colour failing one and passing
 * the other is usable in the right place, and a bare cross would have somebody
 * discard it.
 *
 * THE MATHS IS THE WCAG RELATIVE-LUMINANCE FORMULA, not a perceptual
 * approximation. It is what the requirement is written in, so agreeing with it
 * is the whole point.
 *
 * HEX IN, because that is what a brand guideline contains — the component
 * parses it rather than demanding the caller convert.
 */
function luminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  const parts = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2];
}

/** Contrast ratio between two hex colours, 1–21, or null if either is unparseable. */
export function contrastRatio(a: string, b: string): number | null {
  const la = luminance(a), lb = luminance(b);
  if (la === null || lb === null) return null;
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function PalettePreview({ colours, against = "#ffffff", className }: {
  colours: { id: string; label: string; hex: string }[];
  /** What they sit on. */
  against?: string;
  className?: string;
}) {
  return (
    <ul className={cn("divide-y divide-border rounded-md border border-border text-sm", className)}>
      {colours.map((c) => {
        const r = contrastRatio(c.hex, against);
        const body = r !== null && r >= 4.5;
        const large = r !== null && r >= 3;
        return (
          <li key={c.id} className="flex items-center gap-3 px-3 py-2">
            <span aria-hidden="true" style={{ background: c.hex }}
              className="size-8 shrink-0 rounded border border-border" />
            <span className="min-w-0 flex-1">
              <span className="block">{c.label}</span>
              <code className="block font-mono text-xs text-muted-foreground">{c.hex}</code>
            </span>
            <span className="shrink-0 text-right text-xs">
              <span className="block tabular-nums">{r === null ? "—" : `${r.toFixed(1)}:1`}</span>
              <span className={cn("block", body ? "text-muted-foreground" : "font-medium")}>
                {r === null ? "cannot read this colour"
                  : body ? "fine for text"
                  : large ? "large text and borders only"
                  : "too low for text"}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
