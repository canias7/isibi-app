import { cn } from "@/lib/utils";
/**
 * Which model decided where the credit went, and what it hides.
 *
 * THE MODEL IS THE ANSWER, NOT THE DATA. Last-click and first-click attribute
 * the same customer to different channels, and the two reports are both correct
 * and contradictory. A channel report without the model named is an argument
 * waiting to happen between two teams reading different dashboards.
 *
 * IT SAYS WHAT THE CHOSEN MODEL UNDER-CREDITS. Last-click starves everything
 * that introduced the customer; first-click starves everything that closed
 * them. Naming the bias with the model is what stops a budget being moved on a
 * number that was never measuring that.
 *
 * THE WINDOW IS PART OF IT. A 7-day window and a 90-day one give different
 * answers for anything with a long consideration period, and the shorter one
 * always flatters the last channel.
 *
 * UNATTRIBUTED IS COUNTED. Direct traffic and blocked referrers are a real and
 * often large slice, and a report where the channels sum to 100% has quietly
 * distributed them.
 */
const MODELS = {
  "last-click": { label: "Last click", misses: "everything that introduced the customer earlier" },
  "first-click": { label: "First click", misses: "everything that persuaded them at the end" },
  linear: { label: "Shared evenly", misses: "which touch actually mattered" },
  "position-based": { label: "First and last weighted", misses: "the middle of the journey" },
} as const;

export function AttributionNote({ model, window: period, unattributed, className }: {
  model: keyof typeof MODELS;
  /** Free text — "30 days". */
  window?: string;
  /** Percentage that could not be attributed. */
  unattributed?: number;
  className?: string;
}) {
  const m = MODELS[model];
  return (
    <p className={cn("space-y-0.5 text-xs text-muted-foreground", className)}>
      <span className="block">
        Credit given by <span className="text-foreground">{m.label}</span>
        {period && <span> over {period}</span>}.
      </span>
      <span className="block">This under-credits {m.misses}.</span>
      {unattributed !== undefined && unattributed > 0 && (
        <span className="block">
          <span className="tabular-nums text-foreground">{Math.round(unattributed)}%</span> could not be attributed to
          anything and is not in these figures.
        </span>
      )}
    </p>
  );
}
