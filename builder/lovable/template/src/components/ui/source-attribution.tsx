import { cn } from "@/lib/utils";
/**
 * Where a value came from.
 *
 * TYPED, IMPORTED AND INFERRED ARE DIFFERENT CLAIMS. A phone number somebody
 * entered, one pulled from a spreadsheet, and one guessed from a website all
 * look identical in a field — and only the first is anybody's responsibility.
 *
 * IT LINKS TO THE SOURCE where there is one, because the useful action on a
 * doubtful imported value is going back to the file it came from.
 *
 * Deliberately small and per-field rather than a banner. Attribution on the
 * record says the record was imported; attribution on the field says THIS value
 * was, which is the question that actually gets asked.
 */
export function SourceAttribution({ source, at, href, className }: {
  /** "typed by Sam" · "imported from customers.csv" · "found on their website". */
  source: string;
  at?: string;
  href?: string;
  className?: string;
}) {
  return (
    <p data-slot="source-attribution" className={cn("text-xs text-muted-foreground", className)}>
      {href ? <a href={href} className="underline underline-offset-2">{source}</a> : source}
      {at ? ` · ${at}` : ""}
    </p>
  );
}
