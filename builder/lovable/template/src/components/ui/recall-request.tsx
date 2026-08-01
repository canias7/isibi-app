import { Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Pulling your own request back before it is decided.
 *
 * THE REQUESTER'S ONLY EXIT. Every approval flow has a submit and nearly none
 * have a withdraw — so somebody who spots their own mistake has to ask an
 * approver to reject it, which puts a rejection on their record for a typo.
 * This is the honest way out.
 *
 * IT DISAPPEARS ONCE ANYBODY HAS ACTED, and says why rather than sitting there
 * disabled. Recalling something a colleague has already approved undoes their
 * work without telling them, so past the first decision the answer is a new
 * request, not a recall.
 *
 * IT CONFIRMS, because a recall on most systems is not a pause — the request is
 * gone and resubmitting starts the approvals again from nobody.
 *
 * A plain button, not destructive styling: withdrawing your own draft is an
 * ordinary act and dressing it in red implies a consequence it does not have.
 */
export function RecallRequest({ onRecall, decidedBy, busy, label = "Recall this request", warning = "This withdraws the request. Approvals start again if you resubmit.", className }: {
  onRecall: () => void;
  /** Name of the first person who has already decided, if any. */
  decidedBy?: string;
  busy?: boolean;
  label?: string;
  warning?: string;
  className?: string;
}) {
  if (decidedBy) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        {decidedBy} has already decided, so this can no longer be recalled. Submit a new request instead.
      </p>
    );
  }
  return (
    <button type="button" disabled={busy}
      onClick={() => { if (window.confirm(warning)) onRecall(); }}
      className={cn("inline-flex items-center gap-1.5 text-sm underline underline-offset-2 disabled:opacity-50", className)}>
      <Undo2 className="size-3.5" aria-hidden="true" />
      {label}
    </button>
  );
}
