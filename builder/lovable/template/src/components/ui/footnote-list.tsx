import { cn } from "@/lib/utils";
/**
 * The notes themselves, each linking back to where it was cited.
 *
 * THE RETURN LINK IS THE PART THAT GETS FORGOTTEN. Jumping down to a footnote is
 * easy; getting back to the paragraph you were reading in a long document is
 * not, and without it the reader has to scroll and re-find their place.
 *
 * A real `<ol>` so the numbering is structural rather than typed — a hand-typed
 * "1." drifts the moment a note is inserted, and a screen reader announces the
 * count for free.
 *
 * The ids are shared with `footnote-ref` through one `prefix`, so a page with
 * two independent sets of notes cannot collide.
 */
export function FootnoteList({ notes, prefix = "fn", label = "Notes", className }: {
  notes: React.ReactNode[];
  prefix?: string; label?: string;
  className?: string;
}) {
  if (!notes.length) return null;
  return (
    <section data-slot="footnote-list" aria-label={label} className={cn("border-t border-border pt-4", className)}>
      <h2 className="mb-2 text-sm font-medium">{label}</h2>
      <ol className="flex flex-col gap-1.5 text-sm text-muted-foreground">
        {notes.map((note, i) => (
          <li key={i} id={`${prefix}-${i + 1}`} className="flex gap-2">
            <span className="shrink-0 tabular-nums">{i + 1}.</span>
            <span className="min-w-0">
              {note}{" "}
              <a href={`#${prefix}-ref-${i + 1}`} className="cursor-pointer underline underline-offset-2">
                <span aria-hidden>↩</span><span className="sr-only">back to reference {i + 1}</span>
              </a>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
