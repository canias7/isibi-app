import { cn } from "@/lib/utils";
/**
 * Everyone who can reach this, grouped by what they can do.
 *
 * GROUPED BY PERMISSION, not alphabetically. The question people bring here is
 * "who can edit this", and an A-to-Z list makes them read every row to answer
 * it.
 *
 * INHERITED ACCESS IS SHOWN AND MARKED. Somebody who has access because they are
 * in a group does not appear on a list of direct grants, which is exactly how a
 * permissions review misses people — and removing them from the item does
 * nothing, so saying where it comes from is the difference between a fix and a
 * false fix.
 *
 * The counts are in the group headings so the shape is readable before any
 * individual row.
 */
export type AccessGroup = { level: string; people: { name: string; via?: string }[] };

export function AccessSummary({ groups, className }: {
  groups: AccessGroup[];
  className?: string;
}) {
  const shown = groups.filter((g) => g.people.length);
  if (!shown.length) return null;
  return (
    <div data-slot="access-summary" className={cn("flex flex-col gap-3", className)}>
      {shown.map((g) => (
        <section key={g.level}>
          <h3 className="mb-1 text-sm font-medium tabular-nums">{g.level} · {g.people.length}</h3>
          <ul className="flex flex-col gap-0.5 text-sm">
            {g.people.map((p) => (
              <li key={p.name} className="flex flex-wrap gap-x-2">
                <span>{p.name}</span>
                {p.via && <span className="text-xs text-muted-foreground">via {p.via}</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
