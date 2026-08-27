import * as React from "react";
import { SearchInput } from "@/components/ui/search-input";
import { cn } from "@/lib/utils";
/**
 * A searchable list of people, grouped by first letter.
 *
 * Grouping uses `localeCompare` and a normalised initial, so "Ávila" files
 * under A rather than after Z — which is what a naive `charAt(0)` comparison
 * does, and it hides people in a directory that is supposed to find them.
 *
 * The filter matches ANYWHERE in the name, not just the start: people search
 * a staff directory by surname at least as often as by first name.
 */
export function DirectoryList({ people, renderPerson, placeholder = "Search people", className }: {
  people: { id: string | number; name: string }[];
  renderPerson: (person: { id: string | number; name: string }) => React.ReactNode;
  placeholder?: string; className?: string;
}) {
  const [q, setQ] = React.useState("");
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const hits = q.trim() ? people.filter((p) => norm(p.name).includes(norm(q.trim()))) : people;
  const groups = new Map<string, typeof people>();
  for (const p of [...hits].sort((a, b) => a.name.localeCompare(b.name))) {
    const initial = (norm(p.name)[0] ?? "#").toUpperCase();
    const key = /[A-Z]/.test(initial) ? initial : "#";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  return (
    <div data-slot="directory-list" className={cn("space-y-4", className)}>
      <SearchInput value={q} onChange={setQ} placeholder={placeholder} />
      {hits.length === 0
        ? <p className="py-8 text-center text-sm text-muted-foreground">Nobody matched “{q}”.</p>
        : Array.from(groups, ([letter, list]) => (
            <section key={letter}>
              <h3 className="border-b border-border pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{letter}</h3>
              <div>{list.map((p) => <React.Fragment key={p.id}>{renderPerson(p)}</React.Fragment>)}</div>
            </section>
          ))}
    </div>
  );
}
