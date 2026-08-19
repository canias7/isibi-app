import { cn } from "@/lib/utils";
/**
 * "All figures in thousands" — the multiplier a whole table is printed in.
 *
 * A TABLE OF SCALED NUMBERS WITH NO HEADER NOTE IS A TRAP. "412" meaning
 * 412,000 is the single most expensive ambiguity in a financial table, and it
 * is invisible: every number looks perfectly ordinary. The convention is a
 * caption above the table, and it is left off constantly.
 *
 * THE UNIT GOES IN THE SAME LINE, because "in thousands" and "in thousands of
 * pounds" are different statements and a table of quantities and a table of
 * money look identical once scaled.
 *
 * IT RENDERS NOTHING AT SCALE 1. A note saying "figures in units" is noise, and
 * noise here trains people to skip the line on the table where it matters.
 *
 * A `<caption>` WHEN INSIDE A TABLE — `as="caption"` puts it in the element
 * screen readers announce before the rows, which is the only position where
 * this is heard before the numbers rather than after them.
 */
const WORDS: Record<number, string> = {
  1000: "thousands",
  1000000: "millions",
  1000000000: "billions",
};

export function NumberScaleNote({ scale, unit, as = "p", className }: {
  /** 1000 for thousands, 1000000 for millions. */
  scale: number;
  /** "pounds", "kg". */
  unit?: string;
  as?: "p" | "caption";
  className?: string;
}) {
  if (!scale || scale === 1) return null;
  const word = WORDS[scale] ?? `units of ${scale.toLocaleString()}`;
  const text = `All figures in ${word}${unit ? ` of ${unit}` : ""}`;
  const cls = cn("text-xs text-muted-foreground", as === "caption" && "text-start", className);
  return as === "caption"
    ? <caption className={cls}>{text}</caption>
    : <p className={cls}>{text}</p>;
}
