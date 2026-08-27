import * as React from "react";
import { cn, toDate } from "@/lib/utils";
/**
 * A day's schedule, grouped under date headings.
 *
 * Grouping happens here rather than in the caller because it is the part
 * everyone gets subtly wrong — grouping on an ISO prefix puts anything after
 * midnight UTC on tomorrow's list for half the world. This groups on the
 * viewer's own local date.
 */
export function AgendaList({ items, empty = "Nothing scheduled.", className }: {
  items: { id: string | number; at: string | number | Date; title: string; meta?: React.ReactNode }[];
  empty?: string; className?: string;
}) {
  const groups: { key: string; label: string; items: typeof items }[] = [];
  for (const it of [...items].sort((a, b) => +toDate(a.at) - +toDate(b.at))) {
    const d = toDate(it.at);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, label: d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }), items: [] };
      groups.push(g);
    }
    g.items.push(it);
  }
  if (!groups.length) return <p data-slot="agenda-list" className={cn("py-8 text-center text-sm text-muted-foreground", className)}>{empty}</p>;
  return (
    <div className={cn("space-y-5", className)}>
      {groups.map((g) => (
        <section key={g.key}>
          <h3 className="border-b border-border pb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{g.label}</h3>
          <ul className="divide-y divide-border">
            {g.items.map((it) => (
              <li key={it.id} className="flex gap-4 py-2.5 text-sm">
                {/* Wide enough, and non-wrapping, for a 12-hour clock: "11:24 PM"
                    broke onto two lines at w-16 and knocked the whole row out of
                    line for every locale that is not 24-hour. */}
                <span className="w-20 shrink-0 whitespace-nowrap tabular-nums text-muted-foreground">
                  {toDate(it.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block">{it.title}</span>
                  {it.meta && <span className="block text-xs text-muted-foreground">{it.meta}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
