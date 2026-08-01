import { cn } from "@/lib/utils";
/**
 * Handing over the keys — with what has to be true first.
 *
 * KEYS ARE RELEASED ON CONDITIONS AND THE CONDITIONS ARE THE COMPONENT. Money
 * received, paperwork done, the seller actually out — each is somebody else's
 * job, each blocks the handover, and a single "ready" flag means the person
 * waiting in a loaded van cannot tell which one is holding them.
 *
 * WHO IS HOLDING THEM RIGHT NOW IS ALWAYS SHOWN. Keys sit with an agent, a
 * solicitor, a neighbour or in a lockbox, and the most common failure of a
 * moving day is that nobody knows which.
 *
 * THE NUMBER OF SETS IS RECORDED, AND SO IS WHO ELSE HAS ONE. A buyer receiving
 * two sets when three exist is the reason locks get changed on the first evening
 * — and the honest answer is cheaper than the locksmith.
 *
 * NO AUTOMATIC RELEASE. Nothing here flips to released on a timer or a date: a
 * key handover is somebody physically doing something, and a screen that says it
 * happened when it did not is worse than one that says nothing.
 */
export type ReleaseCondition = { id: string; what: string; met?: boolean; whose?: string };

export function KeyRelease({ conditions, heldBy, sets, othersWithKeys = [], releasedTo, releasedOn, className }: {
  conditions: ReleaseCondition[];
  /** Where the keys physically are. */
  heldBy?: string;
  sets?: number;
  /** Honest, and cheaper than a locksmith. */
  othersWithKeys?: string[];
  releasedTo?: string;
  releasedOn?: string;
  className?: string;
}) {
  const AND = new Intl.ListFormat("en", { style: "long", type: "conjunction" });
  const outstanding = conditions.filter((c) => !c.met);
  if (releasedOn) {
    return (
      <div className={cn("space-y-0.5 text-sm", className)}>
        <p className="font-medium">Keys handed to {releasedTo ?? "the buyer"} on {releasedOn}.</p>
        {othersWithKeys.length > 0 && (
          <p className="text-xs">Still held by {AND.format(othersWithKeys)}.</p>
        )}
      </div>
    );
  }
  return (
    <div className={cn("space-y-1.5 text-sm", className)}>
      <p className={cn(outstanding.length > 0 ? "font-medium" : "")}>
        {outstanding.length === 0
          ? "Everything is done. The keys can be handed over."
          : `Held until ${AND.format(outstanding.map((c) => c.what.toLowerCase()))}.`}
      </p>
      <ul className="divide-y divide-border rounded-md border border-border">
        {conditions.map((c) => (
          <li key={c.id} className="flex items-baseline gap-3 px-3 py-1.5">
            <span className="min-w-0 flex-1">
              {c.what}
              {c.whose && <span className="block text-xs text-muted-foreground">{c.whose}</span>}
            </span>
            <span className={cn("shrink-0 text-xs", c.met ? "text-muted-foreground" : "font-medium")}>
              {c.met ? "Done" : "Not yet"}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        {[heldBy ? `Keys are with ${heldBy}` : "Nobody recorded as holding the keys", sets !== undefined && `${sets} ${sets === 1 ? "set" : "sets"}`]
          .filter(Boolean)
          .join(" · ")}
        .
      </p>
      {/* Never sentence-initial: the list is caller text and "the cleaner" at the
          start of a sentence reads as a typo, while capitalising it would rewrite
          somebody's words. Put a word of ours in front instead. */}
      {othersWithKeys.length > 0 && (
        <p className="text-xs">Also held by {AND.format(othersWithKeys)}.</p>
      )}
    </div>
  );
}
