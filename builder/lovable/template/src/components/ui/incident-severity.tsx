import { cn } from "@/lib/utils";
/**
 * How bad it is — expressed as what it demands, not as a number.
 *
 * A SEVERITY LEVEL IS ONLY USEFUL IF IT SAYS WHAT HAPPENS AT THAT LEVEL. "P2"
 * means nothing to somebody who has not memorised the table, and at three in the
 * morning nobody has. The response — who is woken, how fast, who is told — is
 * the level, and it goes on the screen with it.
 *
 * IT CAN BE RAISED BY ANYBODY AND LOWERED ONLY WITH A REASON. Every incident
 * culture that works has that asymmetry, and every one that does not has people
 * who saw something and said nothing.
 *
 * THE LEVEL IS SHOWN BY WEIGHT AND BY WORDS, never by colour alone. Red and
 * amber are indistinguishable to a meaningful share of any on-call rota, and an
 * incident screen is the worst place to find that out.
 *
 * NO AUTOMATIC ESCALATION ON A TIMER ALONE. An incident that is being handled
 * quietly should not wake six more people because a clock ran out; escalation is
 * a decision somebody makes and is recorded as one.
 */
export function IncidentSeverity({ level, label, meansResponse, whoIsWoken, tellWithin, raisedBy, loweredFrom, loweredBecause, className }: {
  /** 1 is worst. */
  level: 1 | 2 | 3 | 4;
  label?: string;
  /** What this level actually demands. */
  meansResponse?: string;
  whoIsWoken?: string;
  tellWithin?: string;
  raisedBy?: string;
  /** Lowering needs a reason; raising does not. */
  loweredFrom?: number;
  loweredBecause?: string;
  className?: string;
}) {
  const heavy = level <= 2;
  return (
    <div data-slot="incident-severity" className={cn("space-y-0.5 text-sm", className)}>
      <p className={cn(heavy ? "text-lg font-medium" : "font-medium")}>
        {label ?? `Level ${level}`}
      </p>
      <p className={cn("text-sm", heavy ? "font-medium" : "text-muted-foreground")}>
        {meansResponse ?? "Nobody has written down what this level actually demands, which makes the number decorative."}
      </p>
      <p className="text-xs text-muted-foreground">
        {[whoIsWoken && `Wakes ${whoIsWoken}`, tellWithin && `told within ${tellWithin}`, raisedBy && `raised by ${raisedBy}`]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {loweredFrom !== undefined && (
        <p className={cn("text-xs", loweredBecause ? "text-muted-foreground" : "font-medium")}>
          {loweredBecause
            ? `Lowered from level ${loweredFrom} — ${loweredBecause.replace(/\s*[.!?]\s*$/, "")}.`
            : `Lowered from level ${loweredFrom} with no reason recorded. Raising needs nobody's permission; lowering needs a reason.`}
        </p>
      )}
    </div>
  );
}
