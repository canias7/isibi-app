import { SignOffRow } from "@/components/ui/sign-off-row";
import { cn } from "@/lib/utils";
/**
 * Everyone who has to sign, and where it is stuck.
 *
 * IT NAMES WHO IS BLOCKING. "Awaiting 2 approvals" is the standard summary and
 * it is useless — the person reading it wants to know who to chase. The
 * headline names the first outstanding approver, because that is the only
 * actionable fact on the screen.
 *
 * SEQUENTIAL VS PARALLEL CHANGES THE MEANING of the same list. In sequence,
 * only the first waiting person can act and the rest are not late; in parallel
 * everybody is. Stating which it is stops an approver being chased for
 * something they cannot yet do.
 *
 * ONE REJECTION ENDS IT, and the headline says so rather than continuing to
 * report the outstanding count — a rejected request is not waiting on anybody.
 *
 * Rows are `SignOffRow`, so the verdict styling lives in one place.
 */
export type Approver = { id: string; name: string; role?: string; state: "approved" | "rejected" | "waiting"; at?: string; note?: string };

export function ApproverList({ approvers, mode = "parallel", className }: {
  /** In order, when `mode` is "sequence". */
  approvers: Approver[];
  mode?: "parallel" | "sequence";
  className?: string;
}) {
  if (!approvers.length) return null;
  const rejected = approvers.find((a) => a.state === "rejected");
  const waiting = approvers.filter((a) => a.state === "waiting");
  const next = waiting[0];
  return (
    <div data-slot="approver-list" className={cn("rounded-md border border-border", className)}>
      <p className="border-b border-border px-3 py-2 text-sm">
        {rejected ? (
          <span><span className="font-medium">Rejected</span> by {rejected.name}</span>
        ) : next ? (
          <span>
            Waiting on <span className="font-medium">{next.name}</span>
            {waiting.length > 1 && (
              <span className="text-muted-foreground">
                {mode === "sequence" ? `, then ${waiting.length - 1} more` : ` and ${waiting.length - 1} others`}
              </span>
            )}
          </span>
        ) : (
          <span className="font-medium">Fully approved</span>
        )}
      </p>
      <ul className="divide-y divide-border">
        {approvers.map((a) => <SignOffRow key={a.id} {...a} />)}
      </ul>
    </div>
  );
}
