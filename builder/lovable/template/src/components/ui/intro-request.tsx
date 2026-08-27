import { useId } from "react";
import { cn } from "@/lib/utils";
/**
 * Asking to be introduced — through somebody who has to agree.
 *
 * THE INTRODUCER SEES THE MESSAGE BEFORE IT IS SENT, and the requester is told
 * so. An introduction spends somebody else's relationship, and a request they
 * cannot read before forwarding is a request they will stop accepting.
 *
 * DECLINING IS EASY AND SILENT FOR THE INTRODUCER. If saying no is awkward,
 * introductions get forwarded reluctantly and land badly, which is worse for
 * everybody than a decline nobody hears about.
 *
 * THE REASON FIELD IS SHORT ON PURPOSE. A long pitch to a stranger's contact
 * does not get forwarded; two sentences does. The limit is doing the requester
 * a favour rather than saving space.
 *
 * IT SAYS THE INTRODUCER MAY EDIT. They know how to talk to their own contact,
 * and a forwarded message they could not adjust is one they will rewrite by
 * hand or not send.
 */
export function IntroRequest({ toName, viaName, reason, onReasonChange, maxLength = 300, introducerCanEdit = true, className }: {
  /** Who you want to meet. */
  toName: string;
  /** Who would introduce you. */
  viaName: string;
  reason: string;
  onReasonChange: (next: string) => void;
  maxLength?: number;
  introducerCanEdit?: boolean;
  className?: string;
}) {
  const id = useId();
  const left = maxLength - reason.length;
  return (
    <div data-slot="intro-request" className={cn("space-y-1", className)}>
      <p className="text-sm">
        Ask <span className="font-medium">{viaName}</span> to introduce you to{" "}
        <span className="font-medium">{toName}</span>.
      </p>
      <label htmlFor={id} className="block text-xs font-medium">Why, in a sentence or two</label>
      <textarea
        id={id}
        rows={3}
        value={reason}
        maxLength={maxLength}
        onChange={(e) => onReasonChange(e.target.value)}
        className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm"
        aria-describedby={`${id}-help`}
      />
      <p id={`${id}-help`} className="text-xs tabular-nums text-muted-foreground">
        {left} characters left. Short ones get forwarded; long ones do not.
      </p>
      <p className="text-xs">
        {viaName} reads this before anything is sent{introducerCanEdit ? ", and can change it" : ""}.
      </p>
      <p className="text-xs text-muted-foreground">
        If they would rather not, nothing happens and you are not told why. An introduction spends their relationship, not ours.
      </p>
    </div>
  );
}
