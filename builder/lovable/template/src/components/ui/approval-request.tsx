import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * What is being asked of an approver, above the two buttons.
 *
 * THE ASK IS STATED BEFORE THE BUTTONS, because an approval screen that opens
 * with Approve and Reject invites a decision before the thing has been read —
 * and an approver who does that twenty times a day is a rubber stamp with a
 * salary. Requester, subject and any amount come first.
 *
 * REJECT IS NOT DESTRUCTIVE STYLING. It is an ordinary outline button: a red
 * button reads as dangerous and pushes an approver toward the other one, which
 * is exactly the bias an approval flow must not have. Both outcomes are equally
 * legitimate, so they look equally ordinary.
 *
 * BOTH BUTTONS DISABLE TOGETHER while `busy` — a double-approved request is a
 * duplicate payment or a duplicate order in most systems that have one.
 *
 * `amount` is passed pre-formatted, since currency belongs to the caller's
 * `money` helper and not to a component about approving things.
 */
export function ApprovalRequest({ title, requestedBy, requestedAt, amount, detail, onApprove, onReject, busy, approveLabel = "Approve", rejectLabel = "Reject", className }: {
  title: string;
  requestedBy: string;
  /** Free text — "2 hours ago". */
  requestedAt?: string;
  /** Pre-formatted. */
  amount?: string;
  detail?: React.ReactNode;
  onApprove: () => void;
  onReject: () => void;
  busy?: boolean;
  approveLabel?: string;
  rejectLabel?: string;
  className?: string;
}) {
  return (
    <div data-slot="approval-request" className={cn("rounded-lg border border-border p-4", className)}>
      <p className="font-medium">{title}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">
        {requestedBy}
        {requestedAt && <span> · {requestedAt}</span>}
      </p>
      {amount && <p className="mt-2 text-lg tabular-nums">{amount}</p>}
      {detail && <div className="mt-3 text-sm">{detail}</div>}
      <div className="mt-4 flex gap-2">
        <Button type="button" onClick={onApprove} disabled={busy}>{approveLabel}</Button>
        <Button type="button" variant="outline" onClick={onReject} disabled={busy}>{rejectLabel}</Button>
      </div>
    </div>
  );
}
