import { cn } from "@/lib/utils";
/**
 * The hierarchy of a collection — where a thing sits within the whole.
 *
 * ARCHIVES ARE NESTED AND THE PATH IS THE MEANING. A letter means one thing
 * loose and another as item 3 of file 12 of the papers of a named person, and a
 * flat search result strips exactly the context that makes it evidence.
 *
 * IT SHOWS WHAT IS NOT DESCRIBED. Most collections are catalogued to file level
 * and no further, so "12 files, contents not listed" is the honest and
 * necessary answer to a reader deciding whether to travel.
 *
 * EXTENT IS GIVEN IN PHYSICAL TERMS. "40 boxes" or "3 linear metres" tells a
 * reader whether this is an afternoon or a fortnight; a count of records does
 * not, and it is what they will actually face on the desk.
 *
 * THE PATH IS A LIST OF LEVELS, not a breadcrumb of links. A reader reading this
 * on paper — which is how finding aids are still often used — gets the same
 * information.
 */
export type AidLevel = { id: string; level: string; reference?: string; title: string };

export function FindingAid({ path, extent, describedTo, childCount, childrenListed, className }: {
  /** Outermost first — fonds, series, file, item. */
  path: AidLevel[];
  /** "3 linear metres", "40 boxes". */
  extent?: string;
  /** The lowest level described — "file". */
  describedTo?: string;
  /** How many children the last level has. */
  childCount?: number;
  /** False where those children are not individually catalogued. */
  childrenListed?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      <ol className="space-y-0.5">
        {path.map((l, i) => (
          <li key={l.id} style={{ paddingLeft: `${i * 12}px` }} className="text-xs">
            <span className="text-muted-foreground">{l.level}</span>
            {l.reference && <span className="font-mono"> {l.reference}</span>}
            <span className={cn(i === path.length - 1 && "font-medium")}> {l.title}</span>
          </li>
        ))}
      </ol>
      {extent && <p className="text-xs text-muted-foreground">{extent}</p>}
      {childCount !== undefined && (
        <p className={cn("text-xs tabular-nums", childrenListed === false ? "font-medium" : "text-muted-foreground")}>
          {childCount} {childCount === 1 ? "item" : "items"} inside
          {childrenListed === false
            ? " — contents not individually listed, so you will be searching by hand."
            : ""}
        </p>
      )}
      {describedTo && (
        <p className="text-xs text-muted-foreground">Described to {describedTo} level.</p>
      )}
    </div>
  );
}
