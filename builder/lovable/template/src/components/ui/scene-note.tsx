import { cn } from "@/lib/utils";
/**
 * What is actually there — written in the order somebody arriving needs it.
 *
 * HAZARDS COME FIRST, ABOVE EVERYTHING INCLUDING THE CASUALTY COUNT. Somebody
 * reading this is about to walk in, and what could hurt them changes whether they
 * should. Every incident form puts the description first and the dangers in a
 * box further down.
 *
 * ACCESS IS ITS OWN FIELD. A scene reachable only from one end, or with a barrier
 * somebody needs a key for, wastes the minutes that matter, and it is knowledge
 * held by whoever is already there.
 *
 * WHAT IS NOT KNOWN IS STATED. An early scene report is mostly gaps, and a
 * report that reads as complete stops people asking. Naming the unknowns is what
 * makes it a report rather than a guess.
 *
 * NO PHOTOGRAPHS. They upload badly on a poor connection, arrive after the
 * decision has been made, and are a record of people at their worst moment held
 * on somebody's phone.
 */
export function SceneNote({ hazards = [], access, casualties, whatHappened, notKnown = [], reportedBy, at, className }: {
  /** First, above everything. */
  hazards?: string[];
  access?: string;
  casualties?: number;
  whatHappened?: string;
  /** Named gaps, so people keep asking. */
  notKnown?: string[];
  reportedBy?: string;
  at?: string;
  className?: string;
}) {
  const AND = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
  return (
    <div data-slot="scene-note" className={cn("space-y-1 text-sm", className)}>
      <p className={cn(hazards.length > 0 ? "font-medium" : "text-muted-foreground")}>
        {hazards.length > 0 ? `Hazards: ${AND.format(hazards)}.` : "No hazards reported — which is not the same as none."}
      </p>
      <p className={cn("text-sm", access ? "" : "text-muted-foreground")}>
        {access ? `Access: ${access}` : "Nothing recorded about getting in."}
      </p>
      {casualties !== undefined && (
        <p className="tabular-nums">
          {casualties === 0
            ? "No casualties reported."
            : `${casualties} ${casualties === 1 ? "casualty" : "casualties"}.`}
        </p>
      )}
      {whatHappened && <p className="text-xs text-muted-foreground">{whatHappened}</p>}
      {notKnown.length > 0 && (
        <p className="text-xs font-medium">Not known yet: {AND.format(notKnown)}.</p>
      )}
      <p className="text-xs text-muted-foreground">
        {[reportedBy && `From ${reportedBy}`, at].filter(Boolean).join(" · ")}
      </p>
    </div>
  );
}
