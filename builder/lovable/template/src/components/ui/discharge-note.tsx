import { cn } from "@/lib/utils";
/**
 * Going home — with the things that get dropped at the door.
 *
 * WHAT CHANGED ABOUT THE MEDICINES IS THE HEADLINE. Stopped, started and changed
 * doses are where discharge goes wrong, and they are usually a paragraph in the
 * middle of a letter that reaches the person's own doctor a fortnight later.
 * Three lists, named, at the top.
 *
 * WHO IS DOING WHAT NEXT IS NAMED. A discharge that says "follow up in six
 * weeks" without saying who arranges it produces a person waiting for a letter
 * that nobody is writing.
 *
 * THE SAFETY NET IS PRESENT AND SPECIFIC. "Come back if you feel worse" is not
 * usable; the specific things to watch for, and where to go with them at two in
 * the morning, are.
 *
 * NO CLINICAL SUMMARY OF THE ADMISSION. That belongs in a letter to a clinician.
 * This is the document somebody reads at home, and mixing the two produces one
 * neither audience can use.
 */
export function DischargeNote({ started = [], stopped = [], changed = [], whoArrangesFollowUp, followUpWhen, watchFor = [], whereToGo, suppliedDays, className }: {
  started?: string[];
  stopped?: string[];
  changed?: string[];
  /** Named, or nobody does it. */
  whoArrangesFollowUp?: string;
  followUpWhen?: string;
  /** Specific, not "if you feel worse". */
  watchFor?: string[];
  whereToGo?: string;
  /** How many days of medicine went home with them. */
  suppliedDays?: number;
  className?: string;
}) {
  const AND = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
  return (
    <div data-slot="discharge-note" className={cn("space-y-1.5 text-sm", className)}>
      {(started.length > 0 || stopped.length > 0 || changed.length > 0) && (
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-muted-foreground">Your medicines have changed</p>
          {started.length > 0 && <p>Started: {AND.format(started)}.</p>}
          {stopped.length > 0 && <p className="font-medium">Stopped: {AND.format(stopped)}.</p>}
          {changed.length > 0 && <p className="font-medium">Changed: {AND.format(changed)}.</p>}
        </div>
      )}
      {suppliedDays !== undefined && (
        <p className="text-xs tabular-nums">
          You have {suppliedDays} {suppliedDays === 1 ? "day" : "days"} of medicine with you. Order more before it
          runs out — it takes a few days.
        </p>
      )}
      <div>
        <p className="text-xs font-medium text-muted-foreground">What happens next</p>
        <p className={cn(whoArrangesFollowUp ? "" : "font-medium")}>
          {whoArrangesFollowUp
            ? `${whoArrangesFollowUp} will arrange the follow-up${followUpWhen ? `, ${followUpWhen}` : ""}.`
            : "Nobody is named as arranging the follow-up, which means it may not happen. Ask before you leave."}
        </p>
      </div>
      <div>
        <p className="text-xs font-medium text-muted-foreground">Get help if</p>
        {watchFor.length > 0 ? (
          <ul className="space-y-0.5">
            {watchFor.map((w) => (
              <li key={w} className="font-medium">
                {w}
              </li>
            ))}
          </ul>
        ) : (
          <p className="font-medium">
            Nothing specific written down. "If you feel worse" is not something anybody can act on at two in the
            morning.
          </p>
        )}
        {whereToGo && <p className="text-xs text-muted-foreground">{whereToGo}</p>}
      </div>
    </div>
  );
}
