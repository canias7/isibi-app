import { cn } from "@/lib/utils";
/**
 * "2 of 3 needed" — how many approvals it takes and how many there are.
 *
 * A COUNT, NOT A PERCENTAGE BAR. "67%" of an approval requirement is a number
 * nobody thinks in: the question is whether one more person is enough, and
 * "2 of 3" answers it while a bar does not.
 *
 * IT SAYS WHEN THE THRESHOLD CAN NO LONGER BE MET. If three approvals are
 * needed, two people have rejected and only four exist, the request is dead —
 * and every implementation that only counts upward leaves it sitting in a queue
 * looking merely slow. That is the state worth computing.
 *
 * THE SEGMENTS ARE FILLED, HOLLOW AND CROSSED rather than three colours, so the
 * shape survives greyscale — and the `sr-only` sentence carries the whole state
 * for anybody who cannot see the segments at all.
 *
 * `required` is clamped to the number of approvers, since a rule demanding five
 * signatures from three people can never pass and should read as a
 * configuration error rather than as a permanently pending request.
 */
export function ApprovalQuorum({ approved, rejected = 0, total, required, className }: {
  approved: number;
  rejected?: number;
  /** How many people can approve. */
  total: number;
  /** How many approvals are needed. */
  required: number;
  className?: string;
}) {
  const need = Math.min(required, total);
  const met = approved >= need;
  const possible = total - rejected;
  const dead = !met && possible < need;
  const state = met ? "Approved" : dead ? "Cannot pass" : `${approved} of ${need} needed`;
  return (
    <div data-slot="approval-quorum" className={cn("space-y-1", className)}>
      <p className="text-sm">
        <span className={cn((met || dead) && "font-medium")}>{state}</span>
        {!met && !dead && rejected > 0 && (
          <span className="text-muted-foreground"> · {rejected} rejected</span>
        )}
      </p>
      <span className="sr-only">
        {approved} approved, {rejected} rejected, of {total} approvers; {need} approvals required.
      </span>
      <div aria-hidden="true" className="flex gap-1">
        {Array.from({ length: total }, (_, i) => {
          const kind = i < approved ? "yes" : i < approved + rejected ? "no" : "open";
          return (
            <span key={i}
              className={cn("h-1.5 flex-1 rounded-full",
                kind === "yes" && "bg-foreground",
                kind === "no" && "bg-[repeating-linear-gradient(45deg,var(--color-foreground)_0_2px,transparent_2px_4px)]",
                kind === "open" && "border border-border")} />
          );
        })}
      </div>
    </div>
  );
}
