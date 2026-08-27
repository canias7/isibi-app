import { cn } from "@/lib/utils";
/**
 * A catalogued item — with the fields that decide whether it is the right one.
 *
 * EDITION AND YEAR ARE AS IMPORTANT AS THE TITLE. A reader asked for a specific
 * edition gets the wrong book from a record showing only title and author, and
 * finds out after travelling to collect it.
 *
 * IT SEPARATES WHAT THE ITEM IS FROM WHERE THE COPY IS. One record can have
 * several holdings in different branches with different loan rules, and merging
 * them produces a record that says "available" about a copy in another city.
 *
 * THE IDENTIFIER IS SHOWN AND IS THE STABLE HANDLE. Titles are ambiguous and
 * get re-catalogued; the control number is what a request, a citation and an
 * interloan all key off.
 *
 * A RECORD THAT IS A DESCRIPTION RATHER THAN AN ITEM SAYS SO. Archives
 * catalogue at collection level, and a reader ordering "the papers of" expects
 * one box and receives forty.
 */
export function CatalogueRecord({ title, creator, edition, year, publisher, identifier, medium, level, summary, className }: {
  title: string;
  /** Author, artist, originator. */
  creator?: string;
  edition?: string;
  /** Free text — dates are frequently ranges or uncertain. */
  year?: string;
  publisher?: string;
  /** The control number. */
  identifier?: string;
  /** "Book", "Map", "Photograph", "Sound recording". */
  medium?: string;
  /** "item" or a collection-level description. */
  level?: "item" | "collection";
  summary?: string;
  className?: string;
}) {
  return (
    <div data-slot="catalogue-record" className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className="font-medium">{title}</span>
        {creator && <span className="block text-muted-foreground">{creator}</span>}
      </p>
      <p className="text-xs text-muted-foreground">
        {[edition, year, publisher, medium].filter(Boolean).join(" · ")}
      </p>
      {identifier && (
        <p className="text-xs">
          <span className="text-muted-foreground">Reference </span>
          <code className="font-mono">{identifier}</code>
        </p>
      )}
      {summary && <p className="text-xs">{summary}</p>}
      {level === "collection" && (
        <p className="text-xs font-medium">
          This describes a whole collection, not one item — ordering it may produce many boxes.
        </p>
      )}
    </div>
  );
}
