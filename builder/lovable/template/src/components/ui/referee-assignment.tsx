import { cn } from "@/lib/utils";
/**
 * Who is officiating — with the conflicts that should stop them.
 *
 * A CONFLICT OF INTEREST IS CHECKED AND NAMED. An official who plays for,
 * coaches at or lives beside one of the clubs is the complaint that follows
 * every close decision, and it is knowable at the point of appointment rather
 * than afterwards.
 *
 * AN UNAPPOINTED FIXTURE IS THE HEADLINE. Matches are played without a neutral
 * referee constantly because nobody noticed the gap until Saturday, and a list
 * that only shows appointments hides exactly the fixtures that need attention.
 *
 * THE ASSISTANTS ARE PART OF THE APPOINTMENT. A referee expecting two
 * assistants and finding none officiates a different match, and in many
 * competitions is entitled to decline.
 *
 * ACCEPTANCE IS TRACKED. An appointment sent is not an appointment agreed, and
 * the gap between them is where fixtures go uncovered.
 */
export function RefereeAssignment({ fixture, referee, assistants = [], accepted, conflict, feeNote, className }: {
  fixture: string;
  /** Undefined where nobody has been appointed. */
  referee?: string;
  assistants?: string[];
  /** Undefined means sent, not yet answered. */
  accepted?: boolean;
  /** Why they should not do this match. */
  conflict?: string;
  feeNote?: string;
  className?: string;
}) {
  return (
    <li data-slot="referee-assignment" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">{fixture}</span>
        <span className={cn("shrink-0 text-xs", !referee || accepted === false ? "font-medium" : "text-muted-foreground")}>
          {!referee ? "No referee" : accepted === true ? "Accepted" : accepted === false ? "Declined" : "Awaiting reply"}
        </span>
      </p>
      {referee && (
        <p className="text-xs text-muted-foreground">
          {referee}
          {assistants.length > 0
            ? ` · assistants ${assistants.join(" and ")}`
            : " · no assistants appointed"}
        </p>
      )}
      {!referee && (
        <p className="text-xs font-medium">Nobody appointed — this will be played without a neutral official.</p>
      )}
      {conflict && <p className="text-xs font-medium">Conflict: {conflict}</p>}
      {feeNote && <p className="text-xs text-muted-foreground">{feeNote}</p>}
    </li>
  );
}
