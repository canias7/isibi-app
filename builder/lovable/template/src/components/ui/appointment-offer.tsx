import { cn } from "@/lib/utils";
/**
 * A slot being offered — accept, or say why it does not work.
 *
 * DECLINING NEEDS A REASON FIELD, and that is not bureaucracy. An offer refused
 * silently gets replaced by another equally impossible one; "I work then" or "I
 * cannot travel that far" is what makes the next offer different. It is
 * optional, because requiring it is its own barrier.
 *
 * WHAT HAPPENS IF NOBODY REPLIES IS STATED. In most systems an unanswered offer
 * expires and the claim closes — an outcome nobody would choose and many people
 * meet by not opening a letter.
 *
 * TRAVEL IS PART OF THE OFFER. The address, and whether it can be done by
 * phone or video, decide whether it is possible at all for somebody without a
 * car — and that is more people than any service assumes.
 *
 * TIMES ARE THE CALLER'S PRE-FORMATTED STRINGS, so the component never
 * reformats a date into a locale the letter was not written in.
 */
export function AppointmentOffer({ what, when, where, remoteOption, replyBy, ifNoReply, canDecline = true, onAccept, onDecline, className }: {
  /** What the appointment is — "Assessment". */
  what: string;
  /** Free text — "Tuesday 12 August, 10:30". */
  when: string;
  where?: string;
  /** "This can be done by phone if you prefer." */
  remoteOption?: string;
  /** Free text — "5 August". */
  replyBy?: string;
  /** The consequence of silence. */
  ifNoReply?: string;
  canDecline?: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      <p>
        <span className="font-medium">{what}</span>
        <span className="block">{when}</span>
        {where && <span className="block text-xs text-muted-foreground">{where}</span>}
      </p>
      {remoteOption && <p className="text-xs">{remoteOption}</p>}
      {replyBy && <p className="text-xs text-muted-foreground">Please reply by {replyBy}.</p>}
      {ifNoReply && <p className="text-xs font-medium">{ifNoReply}</p>}
      <div className="flex flex-wrap gap-2 pt-0.5">
        <button
          type="button"
          onClick={onAccept}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium"
        >
          Accept this time
        </button>
        {canDecline && (
          <button
            type="button"
            onClick={onDecline}
            className="rounded-md px-3 py-1.5 text-sm underline underline-offset-2"
          >
            This time does not work
          </button>
        )}
      </div>
      {canDecline && (
        <p className="text-xs text-muted-foreground">
          Telling us why helps us offer something you can actually make.
        </p>
      )}
    </div>
  );
}
