import { cn } from "@/lib/utils";
/**
 * A referral in flight — with whose move it currently is.
 *
 * WHOSE MOVE IT IS ANSWERS THE ONLY QUESTION ANYBODY HAS. Referrals disappear
 * into a gap between two services where each believes the other has it, and the
 * patient chases both. One field, named explicitly, is the whole component.
 *
 * ACCEPTED AND APPOINTED ARE DIFFERENT. A referral accepted by a service is not
 * an appointment, and people stop chasing on the first because the word sounds
 * final.
 *
 * A REJECTED REFERRAL SAYS WHERE IT WENT BACK TO. The failure mode is a rejection
 * landing in a system the referrer does not read, and the patient waiting on
 * something that stopped existing weeks ago.
 *
 * NO ESTIMATED WAIT UNLESS THE SERVICE GAVE ONE. An average produced from
 * elsewhere becomes the number somebody plans around and is then angry about,
 * and it was never a promise anybody made.
 */
export function ReferralRow({ to, forWhat, state = "sent", whoseMove, sentOn, waitingWeeks, statedWait, returnedTo, returnedBecause, className }: {
  to: string;
  forWhat?: string;
  state?: "sent" | "accepted" | "appointed" | "returned";
  /** The whole point. */
  whoseMove?: string;
  sentOn?: string;
  waitingWeeks?: number;
  /** Only what the service itself said. */
  statedWait?: string;
  returnedTo?: string;
  returnedBecause?: string;
  className?: string;
}) {
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1">
          <span className="font-medium">{to}</span>
          {forWhat && <span className="block text-xs text-muted-foreground">{forWhat}</span>}
        </span>
        <span className={cn("shrink-0 text-xs", state === "appointed" ? "text-muted-foreground" : "font-medium")}>
          {state === "sent"
            ? "Sent"
            : state === "accepted"
              ? "Accepted, no date"
              : state === "appointed"
                ? "Appointment made"
                : "Sent back"}
        </span>
      </p>
      <p className={cn("text-xs", whoseMove ? "font-medium" : "font-medium")}>
        {whoseMove
          ? `Waiting on ${whoseMove}.`
          : "Nobody is recorded as holding this. That is the gap referrals get lost in."}
      </p>
      {state === "accepted" && (
        <p className="text-xs text-muted-foreground">
          Accepted is not an appointment. There is no date yet.
        </p>
      )}
      {state === "returned" && (
        <p className="text-xs font-medium">
          Sent back to {returnedTo ?? "the referrer"}
          {returnedBecause ? ` — ${returnedBecause.replace(/\s*[.!?]\s*$/, "")}` : ", no reason recorded"}.
        </p>
      )}
      <p className="text-xs tabular-nums text-muted-foreground">
        {[
          sentOn && `Sent ${sentOn}`,
          waitingWeeks !== undefined && `${waitingWeeks} ${waitingWeeks === 1 ? "week" : "weeks"} so far`,
          statedWait && `they said ${statedWait}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </li>
  );
}
