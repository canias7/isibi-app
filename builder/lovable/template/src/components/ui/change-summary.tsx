import { cn } from "@/lib/utils";
/**
 * How much changed, in three numbers.
 *
 * The counts are the summary a diff needs before anybody opens it — "142
 * changed" and "2 changed" call for completely different amounts of attention,
 * and finding that out by scrolling a diff is the slow way.
 *
 * SIGNS RATHER THAN COLOUR: +, −, and ~ carry which is which, each with a word
 * in `sr-only` text. The convention this replaces is green and red, which is
 * invisible in greyscale, in print, and to the commonest form of colour
 * blindness — and this component is small enough that colour would be the ONLY
 * signal, unlike a diff where position also tells you.
 *
 * A ZERO IS OMITTED rather than rendered. "3 added, 0 removed, 0 changed" makes
 * the reader parse three numbers to learn one fact.
 *
 * Nothing at all changed is its own sentence, because an empty row where three
 * numbers usually are reads as a loading state.
 */
export function ChangeSummary({ added = 0, removed = 0, changed = 0, unchangedNote = "No changes", className }: {
  added?: number;
  removed?: number;
  changed?: number;
  unchangedNote?: string;
  className?: string;
}) {
  const parts: { sign: string; word: string; n: number }[] = [
    { sign: "+", word: "added", n: added },
    { sign: "−", word: "removed", n: removed },
    { sign: "~", word: "changed", n: changed },
  ].filter((p) => p.n > 0);

  if (!parts.length) {
    return <span className={cn("text-sm text-muted-foreground", className)}>{unchangedNote}</span>;
  }
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-3 text-sm tabular-nums", className)}>
      {parts.map((p) => (
        <span key={p.word}>
          <span aria-hidden>{p.sign}</span>{p.n}
          <span className="sr-only"> {p.word}</span>
        </span>
      ))}
    </span>
  );
}
