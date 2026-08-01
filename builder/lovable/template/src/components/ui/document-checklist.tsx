import { cn } from "@/lib/utils";
/**
 * What has to be supplied — with the alternatives, which is the whole point.
 *
 * MOST REQUIREMENTS ARE "ONE OF THESE", NOT "THIS". A list demanding a passport
 * excludes everyone without one; the real rule is almost always any of four
 * documents, and rendering it as a single item turns an ordinary application
 * into an impossible one for the people least able to argue.
 *
 * IT SAYS WHETHER A COPY WILL DO. Original-only is a trip to an office and is
 * the single most expensive line on any checklist — so it is stated per item
 * rather than in a footnote.
 *
 * WHAT CANNOT BE SUPPLIED HAS A ROUTE. Somebody with no fixed address or no
 * documents at all is exactly who the process exists for, and a checklist with
 * no exception route is where they give up.
 *
 * SUPPLIED ITEMS STAY VISIBLE, not removed. A list that empties as it is
 * completed loses the record of what was sent, which is the first thing anybody
 * asks about later.
 */
export type ChecklistItem = {
  id: string;
  /** What it is for — "proof of address". */
  label: string;
  /** Any one of these satisfies it. */
  anyOf?: string[];
  supplied?: boolean;
  originalRequired?: boolean;
  note?: string;
};

export function DocumentChecklist({ items, cannotSupplyRoute, className }: {
  items: ChecklistItem[];
  /** What to do if none of the options is possible. */
  cannotSupplyRoute?: string;
  className?: string;
}) {
  const left = items.filter((i) => !i.supplied).length;
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-sm">
        {left === 0
          ? "Everything has been supplied."
          : <span className="font-medium">{left} still needed</span>}
      </p>
      <ul className="divide-y divide-border rounded-md border border-border text-sm">
        {items.map((i) => (
          <li key={i.id} className="px-3 py-2">
            <p className="flex items-baseline gap-3">
              <span className={cn("min-w-0 flex-1", i.supplied && "text-muted-foreground")}>{i.label}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {i.supplied ? "Supplied" : "Needed"}
              </span>
            </p>
            {i.anyOf && i.anyOf.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Any one of: {i.anyOf.join(", ")}
              </p>
            )}
            {i.originalRequired && !i.supplied && (
              <p className="text-xs font-medium">The original — a copy will not do.</p>
            )}
            {i.note && <p className="text-xs text-muted-foreground">{i.note}</p>}
          </li>
        ))}
      </ul>
      {cannotSupplyRoute && (
        <p className="text-xs">If you cannot supply any of these, {cannotSupplyRoute}</p>
      )}
    </div>
  );
}
