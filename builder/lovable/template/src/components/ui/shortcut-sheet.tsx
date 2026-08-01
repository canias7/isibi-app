import { KbdChord } from "@/components/ui/kbd-chord";
import { cn } from "@/lib/utils";
/**
 * Every shortcut, grouped, in one place.
 *
 * A real `<dl>`: each row is a description (what it does) paired with a term
 * (the keys). That is exactly what a definition list is for, and it is why a
 * screen reader can walk this in pairs instead of reading two disconnected
 * columns.
 *
 * GROUPED BY WHAT THEY DO, not alphabetically by key. Nobody arrives here
 * knowing the key — they arrive knowing the task, and an alphabetical list of
 * chords is a lookup table for a question nobody has.
 *
 * The action comes FIRST in each row, for the same reason. Scanning a column of
 * verbs finds "Duplicate"; scanning a column of ⌘-something finds nothing.
 *
 * Empty groups are dropped rather than rendered as a heading with nothing under
 * it, which reads as a loading failure.
 */
export type ShortcutGroup = { title: string; items: { chord: string; does: string }[] };

export function ShortcutSheet({ groups, className }: {
  groups: ShortcutGroup[];
  className?: string;
}) {
  const shown = groups.filter((g) => g.items.length);
  if (!shown.length) return null;
  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {shown.map((g) => (
        <section key={g.title}>
          <h3 className="mb-2 text-sm font-medium">{g.title}</h3>
          <dl className="flex flex-col divide-y divide-border rounded-md border border-border">
            {g.items.map((s) => (
              <div key={s.chord + s.does} className="flex items-center justify-between gap-4 px-3 py-2">
                <dd className="min-w-0 text-sm">{s.does}</dd>
                <dt className="shrink-0"><KbdChord chord={s.chord} /></dt>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
