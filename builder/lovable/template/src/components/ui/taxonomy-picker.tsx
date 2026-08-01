import { cn } from "@/lib/utils";
/**
 * Choosing a category by walking down it, one column per level.
 *
 * THE PATH STAYS VISIBLE, which is the thing a tree cannot do. Picking
 * "Espresso" out of a deep taxonomy is only meaningful if you can see it sits
 * under Drinks → Coffee — otherwise two identically-named leaves in different
 * branches are indistinguishable, and that is the standard way a product gets
 * filed in the wrong place.
 *
 * CHOOSING A PARENT CLEARS THE LEVELS BELOW IT. Keeping them leaves a stale
 * child selected under a new parent, which is how an impossible combination
 * gets saved and then cannot be reproduced.
 *
 * A PARENT IS A VALID ANSWER. Plenty of taxonomies file things at every level,
 * and a picker that only accepts leaves cannot express "Drinks, unspecified" —
 * so the current selection is whatever was last chosen, at whatever depth.
 *
 * COLUMNS ON A WIDE SCREEN, STACKED ON A NARROW ONE. Three side-by-side lists
 * in 375px is three unusable lists.
 */
export type TaxonomyNode = { id: string; label: string; children?: TaxonomyNode[] };

export function TaxonomyPicker({ tree, path, onChange, placeholder = "Nothing chosen", className }: {
  tree: TaxonomyNode[];
  /** Ids from the root down. */
  path: string[];
  onChange: (path: string[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const columns: TaxonomyNode[][] = [tree];
  const labels: string[] = [];
  let level = tree;
  for (const id of path) {
    const node = level.find((n) => n.id === id);
    if (!node) break;
    labels.push(node.label);
    if (node.children?.length) { columns.push(node.children); level = node.children; }
    else break;
  }
  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm">
        {labels.length
          ? labels.map((l, i) => (
              <span key={i}>
                {i > 0 && <span aria-hidden="true" className="text-muted-foreground"> › </span>}
                <span className={i === labels.length - 1 ? "font-medium" : "text-muted-foreground"}>{l}</span>
              </span>
            ))
          : <span className="text-muted-foreground">{placeholder}</span>}
      </p>
      <div className="grid gap-2 sm:grid-flow-col sm:auto-cols-fr">
        {columns.map((col, depth) => (
          <ul key={depth} className="max-h-56 overflow-y-auto rounded-md border border-border">
            {col.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => onChange([...path.slice(0, depth), n.id])}
                  className={cn("w-full px-2.5 py-1.5 text-left text-sm hover:bg-muted",
                    path[depth] === n.id && "bg-muted font-medium")}>
                  {n.label}
                  {n.children?.length ? <span aria-hidden="true" className="float-right text-muted-foreground">›</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
