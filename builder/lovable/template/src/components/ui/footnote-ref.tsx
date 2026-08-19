import { cn } from "@/lib/utils";
/**
 * The little number in the text that jumps to the note.
 *
 * A REAL LINK to a real id, so it works with JavaScript off, can be opened in a
 * new tab, and is reachable by keyboard. The usual implementation is a span with
 * a click handler, which is none of those.
 *
 * `id` on the reference itself is what lets `footnote-list` link BACK — a
 * footnote you can reach and not return from loses the reader's place in a long
 * document, which is the whole reason footnotes are at the bottom rather than
 * inline.
 *
 * The `sr-only` word is what stops a screen reader reading a bare "3" in the
 * middle of a sentence as part of the prose.
 */
export function FootnoteRef({ n, prefix = "fn", className }: {
  n: number;
  /** Shared with footnote-list so the ids match. */
  prefix?: string;
  className?: string;
}) {
  return (
    <sup id={`${prefix}-ref-${n}`} className={cn("ms-0.5", className)}>
      <a href={`#${prefix}-${n}`} className="cursor-pointer text-xs underline underline-offset-2 tabular-nums">
        <span className="sr-only">footnote </span>{n}
      </a>
    </sup>
  );
}
