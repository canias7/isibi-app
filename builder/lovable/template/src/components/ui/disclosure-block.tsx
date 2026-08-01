import { cn } from "@/lib/utils";
/**
 * A required disclosure, kept legible instead of buried.
 *
 * IT IS NOT SMALL PRINT AND THAT IS DELIBERATE. Shrinking a disclosure to 9px
 * grey text is the pattern regulators specifically object to — a disclosure
 * that cannot be read has not been made. This renders at the same size as
 * ordinary body text, distinguished by a rule rather than by being diminished.
 *
 * IT SAYS WHAT KIND OF DISCLOSURE IT IS. "Paid partnership", "risk warning",
 * "affiliate link" — the category is what tells a reader how to weigh what
 * follows, and an unlabelled paragraph of legal text gets skipped entirely.
 *
 * IT SITS BEFORE THE THING IT QUALIFIES, when placement is the caller's choice
 * — a warning after the decision is not a warning. The component cannot
 * enforce that, so it says so here where somebody placing it will read it.
 *
 * NO COLLAPSING. A disclosure behind a "read more" is one nobody reads, which
 * is the entire objection to burying it in the first place.
 */
export function DisclosureBlock({ kind, children, source, className }: {
  /** What sort — "Paid partnership", "Risk warning". */
  kind: string;
  children: React.ReactNode;
  /** Who requires it, where that adds weight. */
  source?: string;
  className?: string;
}) {
  return (
    <aside className={cn("border-l-2 border-foreground pl-3 text-sm", className)}>
      <p className="text-xs font-medium uppercase tracking-wide">{kind}</p>
      <div className="mt-0.5">{children}</div>
      {source && <p className="mt-0.5 text-xs text-muted-foreground">Required by {source}.</p>}
    </aside>
  );
}
