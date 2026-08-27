import { cn } from "@/lib/utils";
/**
 * The line the match was found in, with the term marked.
 *
 * A RESULT WITHOUT CONTEXT IS A GUESS. A title alone does not say why it
 * matched, and on a long document the reader has to open it to find out — which
 * for a list of twenty results means twenty round trips.
 *
 * THE MATCH IS MARKED WITH `<mark>` AND WEIGHT, not colour alone. `<mark>` is
 * the element for exactly this and carries meaning to a screen reader; the
 * weight is what makes it survive greyscale.
 *
 * THE QUERY IS ESCAPED BEFORE IT BECOMES A REGEX. An unescaped bracket throws —
 * a crash triggered by somebody typing "(" into a search box, which is the same
 * hazard `highlight-match` records.
 */
export function MatchContext({ text, query, where, className }: {
  /** The surrounding line. */
  text: string;
  /** What to mark inside it. */
  query: string;
  /** Where it was found — "in Notes". */
  where?: string;
  className?: string;
}) {
  if (!text) return null;
  const q = query.trim();
  const parts: React.ReactNode[] = [];
  if (q) {
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${safe})`, "ig");
    text.split(re).forEach((chunk, i) => {
      if (!chunk) return;
      parts.push(
        i % 2 === 1
          ? <mark key={i} className="bg-transparent font-semibold underline underline-offset-2">{chunk}</mark>
          : <span key={i}>{chunk}</span>,
      );
    });
  } else {
    parts.push(<span key="all">{text}</span>);
  }
  return (
    <p data-slot="match-context" className={cn("text-sm text-muted-foreground", className)}>
      {where && <span className="text-xs">{where} — </span>}
      …{parts}…
    </p>
  );
}
