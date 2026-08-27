import { cn } from "@/lib/utils";
/**
 * Try these, in this order.
 *
 * ORDERED BY LIKELIHOOD OF WORKING, not by effort — and it is a real `<ol>`, so
 * the order is structural and a screen reader announces the count. The commonest
 * fix goes first because most readers stop after one.
 *
 * EACH STEP IS ONE ACTION. "Clear your cache and cookies and restart the
 * browser and try a private window" is four steps pretending to be one, and
 * somebody who does two of them and gives up cannot tell you which.
 *
 * The last step is a HANDOFF, not another attempt. A troubleshooting list that
 * ends without a way to reach a person leaves the reader stuck at the bottom
 * having done everything asked of them, which is the worst place to abandon
 * anybody.
 */
export function RecoverySteps({ steps, fallback, className }: {
  /** Most likely to work first. */
  steps: { text: React.ReactNode; done?: boolean }[];
  /** The way out when none of them worked. */
  fallback?: React.ReactNode;
  className?: string;
}) {
  if (!steps.length) return null;
  return (
    <div data-slot="recovery-steps" className={cn("flex flex-col gap-2", className)}>
      <ol className="flex flex-col gap-1.5 text-sm">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden className={cn("shrink-0 tabular-nums", s.done ? "text-muted-foreground line-through" : "")}>{i + 1}.</span>
            <span className={cn("min-w-0", s.done && "text-muted-foreground line-through")}>
              {s.done && <span className="sr-only">Done: </span>}
              {s.text}
            </span>
          </li>
        ))}
      </ol>
      {fallback && <p className="text-sm text-muted-foreground">{fallback}</p>}
    </div>
  );
}
