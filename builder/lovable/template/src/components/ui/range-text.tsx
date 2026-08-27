import { cn } from "@/lib/utils";
/**
 * "£20–£45", "from £20", "up to £45" — a range with either end possibly open.
 *
 * OPEN-ENDED RANGES ARE THE COMMON CASE and the one every naive implementation
 * gets wrong. A price list with no upper bound renders "£20–" or "£20–null";
 * this reads "from £20", which is the sentence a person would say.
 *
 * AN EN DASH, NOT A HYPHEN, and no spaces around it. That is the typographic
 * convention for a range in most of the world, and a hyphen between two numbers
 * reads as a minus sign — genuinely ambiguous when either end can be negative.
 *
 * EQUAL ENDS COLLAPSE TO ONE VALUE. "£20–£20" is something only a program would
 * write, and it makes a fixed price look like an estimate.
 *
 * VALUES ARE PRE-FORMATTED STRINGS, so currency, units and locale stay with the
 * caller's own `money` or `date-format` — a range component that also formats
 * numbers would have to know about both and would get one of them wrong.
 */
export function RangeText({ from, to, fromWord = "from", toWord = "up to", emptyNote, className }: {
  /** Pre-formatted. Omit for an open lower end. */
  from?: string | null;
  /** Pre-formatted. Omit for an open upper end. */
  to?: string | null;
  fromWord?: string;
  toWord?: string;
  /** Shown when both ends are missing. */
  emptyNote?: string;
  className?: string;
}) {
  const a = from ?? null;
  const b = to ?? null;
  let text: string | null;
  if (a && b) text = a === b ? a : `${a}–${b}`;
  else if (a) text = `${fromWord} ${a}`;
  else if (b) text = `${toWord} ${b}`;
  else text = emptyNote ?? null;
  if (!text) return null;
  return <span data-slot="range-text" className={cn("tabular-nums", className)}>{text}</span>;
}
