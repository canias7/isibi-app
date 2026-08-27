import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The horizontal stepper across the top of a multi-stage process.
 *
 * THE CURRENT STEP IS `aria-current="step"` and the completed ones carry a
 * word, not only a tick. A row of circles is meaningless to a screen reader,
 * and "step 3 of 5, Payment, current" is the whole state of the page in one
 * announcement.
 *
 * A SKIPPED STEP IS ITS OWN STATE. Processes branch — no deposit means no
 * payment step — and rendering a skipped step as incomplete makes it look like
 * something is outstanding forever.
 *
 * COMPLETED STEPS ARE LINKS and future ones are not. Going back is normal and
 * jumping ahead past required input is not, so the affordance matches: only
 * what can be reached looks reachable.
 *
 * On a phone it collapses to "Step 3 of 5 — Payment" rather than shrinking five
 * labels into unreadable slivers.
 */
export type Phase = { key: string; label: string; state?: "done" | "current" | "todo" | "skipped"; href?: string };

export function PhaseBar({ phases, className }: { phases: Phase[]; className?: string }) {
  const currentIndex = phases.findIndex((p) => p.state === "current");
  const current = phases[currentIndex];

  return (
    <nav data-slot="phase-bar" aria-label="Progress" className={className}>
      {/* On a phone, one legible line beats five unreadable ones. */}
      <p className="text-sm sm:hidden">
        Step <span className="tabular-nums">{currentIndex + 1}</span> of{" "}
        <span className="tabular-nums">{phases.length}</span>
        {current ? <> &mdash; <strong className="font-medium">{current.label}</strong></> : null}
      </p>
      <ol className="hidden items-center gap-1 sm:flex">
        {phases.map((p, i) => {
          const done = p.state === "done";
          const skipped = p.state === "skipped";
          const now = p.state === "current";
          const body = (
            <>
              <span aria-hidden className={cn("grid size-5 shrink-0 place-items-center rounded-full border text-[10px] tabular-nums",
                done ? "border-foreground bg-foreground text-background"
                  : now ? "border-foreground font-semibold"
                  : "border-muted-foreground text-muted-foreground")}>
                {done ? <Check className="size-3" /> : i + 1}
              </span>
              <span className={cn("truncate text-xs",
                now ? "font-medium" : skipped ? "text-muted-foreground line-through" : done ? "" : "text-muted-foreground")}>
                {p.label}
              </span>
              <span className="sr-only">
                {done ? " — done" : now ? " — current step" : skipped ? " — skipped" : " — not started"}
              </span>
            </>
          );
          return (
            <li key={p.key} className="flex min-w-0 flex-1 items-center gap-1.5" aria-current={now ? "step" : undefined}>
              {done && p.href ? (
                <a href={p.href} className="flex min-w-0 items-center gap-1.5 hover:underline">{body}</a>
              ) : body}
              {i < phases.length - 1 ? <span aria-hidden className="h-px flex-1 bg-border" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
