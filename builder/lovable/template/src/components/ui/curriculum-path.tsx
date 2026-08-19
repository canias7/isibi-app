import { Check, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The modules of a course, in order, with where you have got to.
 *
 * Not `stepper`, which is a position in a flow you are completing right now,
 * and not `course-card`, which sells the course. This is the contents page of
 * one somebody is part way through.
 *
 * A real `<ol>`, because it is a sequence and the order is the meaning. A
 * screen reader announces "3 of 8" from the markup alone.
 *
 * FOUR STATES, EACH WITH A SHAPE AND A WORD — filled and ticked for done, ringed
 * for current, hollow and numbered for still to come, dashed with a padlock for
 * locked. No state is carried by colour, which is the house rule and is also the
 * only version of this that works printed, in greyscale, or for the ~8% of men
 * who would see three of the four as one.
 *
 * A LOCKED MODULE SAYS WHY IT IS LOCKED, naming the module that unlocks it. A
 * disabled row with no explanation is the single most reported "the site is
 * broken" — the reader cannot tell a rule from a bug. Derived from the order so
 * it cannot go stale, overridable with `lockedNote` for the cases that are not
 * simply the previous module.
 */
export type Module = {
  key: string;
  title: string;
  summary?: string;
  /** e.g. "6 lessons · 40 min" */
  meta?: string;
  state: "done" | "current" | "todo" | "locked";
  href?: string;
  /** Overrides the derived "Finish X first". */
  lockedNote?: string;
};

const WORD = { done: "Completed", current: "In progress", todo: "Not started", locked: "Locked" } as const;

export function CurriculumPath({ modules, onOpen, className }: {
  modules: Module[];
  onOpen?: (key: string) => void;
  className?: string;
}) {
  if (!modules.length) return null;
  return (
    <ol className={cn("flex flex-col", className)}>
      {modules.map((m, i) => {
        const locked = m.state === "locked";
        const openable = !locked && (m.href || onOpen);
        const why = m.lockedNote ?? (i > 0 ? `Finish ${modules[i - 1].title} first` : "Not available yet");
        const body = (
          <>
            <p className={cn("font-medium", locked && "text-muted-foreground")}>{m.title}</p>
            {m.summary && <p className="mt-0.5 text-sm text-muted-foreground">{m.summary}</p>}
            <p className="mt-1 text-xs text-muted-foreground">
              <span className="sr-only">{WORD[m.state]}. </span>
              {locked ? why : m.meta ?? WORD[m.state]}
            </p>
          </>
        );
        return (
          <li key={m.key} aria-current={m.state === "current" ? "step" : undefined}
            className="flex gap-3">
            <div className="flex flex-col items-center">
              <span aria-hidden className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full border text-xs tabular-nums",
                m.state === "done" && "border-foreground bg-foreground text-background",
                m.state === "current" && "border-2 border-foreground font-semibold",
                m.state === "todo" && "border-border text-muted-foreground",
                m.state === "locked" && "border border-dashed border-border text-muted-foreground",
              )}>
                {m.state === "done" ? <Check className="size-4" />
                  : m.state === "locked" ? <Lock className="size-3.5" />
                  : i + 1}
              </span>
              {i < modules.length - 1 && <span aria-hidden className="w-px flex-1 bg-border" />}
            </div>
            <div className="min-w-0 flex-1 pb-6">
              {openable ? (
                m.href ? (
                  <a href={m.href} className="block rounded-sm underline-offset-4 hover:underline">{body}</a>
                ) : (
                  <button type="button" onClick={() => onOpen?.(m.key)}
                    className="block w-full cursor-pointer text-start underline-offset-4 hover:underline">{body}</button>
                )
              ) : body}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
