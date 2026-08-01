import { ClipboardBlocked } from "@/components/ui/clipboard-blocked";
import { cn } from "@/lib/utils";
/**
 * The code that ties a product back to where it came from.
 *
 * IT IS FOR A RECALL, WHICH IS WHY IT IS DESIGNED AROUND SPEED. When a problem
 * is found, the questions are which batch, from which field, harvested when —
 * and every hour spent assembling that is product still on shelves. The code
 * and the three facts sit together.
 *
 * IT IS SELECTABLE AND MONOSPACED, because it gets read off a label over the
 * phone and typed into somebody else's system. Ambiguous characters in a
 * proportional font is how a recall reaches the wrong batch.
 *
 * THE CHAIN IS SHOWN AS STEPS, not as one string. A code that encodes
 * everything is unreadable by a person, and the point at which traceability
 * usually fails is a step nobody recorded — visible here as a gap.
 *
 * A BREAK IN THE CHAIN IS CALLED OUT. Traceability is only as good as its
 * weakest link, and a missing step means the batch cannot be traced at all —
 * which is worth knowing before a recall rather than during one.
 */
export type TraceStep = { id: string; label: string; detail?: string; missing?: boolean };

export function TraceabilityCode({ code, steps = [], className }: {
  code: string;
  /** Oldest first — field, harvest, store, pack. */
  steps?: TraceStep[];
  className?: string;
}) {
  const broken = steps.filter((s) => s.missing);
  return (
    <div className={cn("space-y-2", className)}>
      <ClipboardBlocked value={code} label="Batch code" />
      {broken.length > 0 && (
        <p className="text-xs font-medium">
          {broken.length} {broken.length === 1 ? "step is" : "steps are"} missing — this batch cannot be fully traced.
        </p>
      )}
      {steps.length > 0 && (
        <ol className="divide-y divide-border rounded-md border border-border text-sm">
          {steps.map((s) => (
            <li key={s.id} className="px-3 py-1.5">
              <p className={cn(s.missing && "font-medium")}>{s.label}</p>
              <p className="text-xs text-muted-foreground">
                {s.missing ? "Not recorded" : s.detail}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
