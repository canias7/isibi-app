import { cn } from "@/lib/utils";
/**
 * A message from head office — with what it actually requires.
 *
 * IT SEPARATES INFORMATION FROM INSTRUCTION. Sites are sent a great deal from
 * the centre and treat all of it as noise, so the one message that requires
 * action arrives in the same undifferentiated stream. Marking which is which is
 * the entire value.
 *
 * AN INSTRUCTION HAS A DEADLINE AND A NAMED RECIPIENT. "Please ensure" sent to
 * everybody is done by nobody, and the deadline is what converts it into
 * something schedulable.
 *
 * ACKNOWLEDGEMENT IS TRACKED WHERE IT MATTERS AND NOT WHERE IT DOES NOT.
 * Requiring a read receipt on every circular trains people to click without
 * reading, which destroys the signal on the messages that need it.
 *
 * WHO SENT IT IS A PERSON. "Head office" is nobody, and a site with a question
 * about a message from nobody does not ask it.
 */
export function CentralMessage({ subject, body, from, fromRole, sentOn, requiresAction, actionBy, forRole, acknowledgedBy, acknowledgedOn, className }: {
  subject: string;
  body?: string;
  from?: string;
  fromRole?: string;
  sentOn?: string;
  /** True where something must be done. */
  requiresAction?: boolean;
  /** Free text deadline. */
  actionBy?: string;
  /** Who at the site this is for. */
  forRole?: string;
  acknowledgedBy?: string;
  acknowledgedOn?: string;
  className?: string;
}) {
  return (
    <div data-slot="central-message" className={cn("space-y-0.5 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1 font-medium">{subject}</span>
        <span className={cn("shrink-0 text-xs", requiresAction ? "font-medium" : "text-muted-foreground")}>
          {requiresAction ? "Action needed" : "For information"}
        </span>
      </p>
      {body && <p className="text-xs">{body}</p>}
      {requiresAction && (
        <p className="text-xs font-medium">
          {forRole ? `${forRole}: ` : ""}
          {actionBy ? `by ${actionBy}.` : "no deadline given, which usually means it will not happen."}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {from ? `${from}${fromRole ? `, ${fromRole}` : ""}` : "Sent by head office — which is nobody you can ask"}
        {sentOn && ` · ${sentOn}`}
      </p>
      {requiresAction && (
        <p className={cn("text-xs", acknowledgedBy ? "text-muted-foreground" : "")}>
          {acknowledgedBy
            ? `Acknowledged by ${acknowledgedBy}${acknowledgedOn ? ` on ${acknowledgedOn}` : ""}.`
            : "Not yet acknowledged."}
        </p>
      )}
    </div>
  );
}
