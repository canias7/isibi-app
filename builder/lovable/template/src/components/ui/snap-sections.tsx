import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Full-height sections that snap as the page scrolls.
 *
 * `scroll-snap-type: y proximity`, NOT `mandatory`. Mandatory snapping fights
 * anybody trying to read a section taller than their screen — the page pulls
 * itself back to a boundary while they are mid-paragraph, which is the reason
 * this pattern has such a bad reputation. Proximity snaps when a scroll ends
 * near a boundary and leaves a deliberate scroll alone.
 *
 * `scroll-snap-stop` is deliberately NOT `always`. Forcing one section per
 * gesture means a flick that would have travelled three sections stops at the
 * first, so a long page becomes a long series of swipes.
 *
 * `min-h-svh`, not `min-h-screen`, so the sections do not overshoot on a phone
 * whose toolbars are showing. Same reason `app-shell` uses it.
 *
 * The dots are real links to each section, so the sequence is navigable
 * without scrolling at all — and each section is a labelled `<section>` so it
 * is a landmark rather than a scroll position.
 */
export function SnapSections({ sections, className }: {
  sections: { id: string; label: string; content: React.ReactNode }[];
  className?: string;
}) {
  return (
    <div data-slot="snap-sections" className={cn("h-svh snap-y snap-proximity overflow-y-auto", className)}>
      {sections.map((s) => (
        <section key={s.id} id={s.id} aria-label={s.label}
          className="flex min-h-svh snap-start flex-col justify-center">
          {s.content}
        </section>
      ))}
    </div>
  );
}

export function SnapDots({ sections, active, className }: {
  sections: { id: string; label: string }[];
  active?: string;
  className?: string;
}) {
  return (
    <nav aria-label="Sections" className={cn("flex flex-col gap-2", className)}>
      {sections.map((s) => (
        <a key={s.id} href={`#${s.id}`} aria-current={s.id === active ? "true" : undefined}
          aria-label={s.label}
          className={cn("size-2 rounded-full",
            s.id === active ? "bg-foreground" : "bg-muted-foreground/40 hover:bg-muted-foreground")} />
      ))}
    </nav>
  );
}
