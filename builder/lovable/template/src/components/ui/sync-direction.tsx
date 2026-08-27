import { cn } from "@/lib/utils";
/**
 * Which way data flows — and, for two-way, who wins a clash.
 *
 * TWO-WAY IS INCOMPLETE WITHOUT A WINNER. When both sides change the same
 * record, something has to be discarded, and every sync tool that offers
 * two-way without asking this quietly picks one — usually whichever wrote last,
 * which means a colleague's correction can be silently reverted by a stale tab.
 * Choosing two-way reveals the question.
 *
 * THE ARROWS ARE ACCOMPANIED BY NAMED SIDES. "→" alone requires knowing which
 * system is on the left, and the two names are what somebody checks against
 * their intention.
 *
 * ONE-WAY IS THE SAFE DEFAULT AND IS FIRST. Most integrations only need one
 * direction, and two-way doubles the ways a record can be wrong.
 *
 * A REAL RADIO GROUP with a nested one for the winner, so the dependent choice
 * is only present when it applies rather than sitting disabled.
 */
export function SyncDirection({ here, there, value, onChange, winner, onWinnerChange, name = "sync-dir", className }: {
  /** Our side's name. */
  here: string;
  /** Their side's name. */
  there: string;
  value: "push" | "pull" | "both";
  onChange: (v: "push" | "pull" | "both") => void;
  /** Which side wins a clash. */
  winner?: "here" | "there";
  onWinnerChange?: (v: "here" | "there") => void;
  name?: string;
  className?: string;
}) {
  const options = [
    { id: "push" as const, label: `${here} → ${there}`, note: `Changes here are copied to ${there}. Nothing comes back.` },
    { id: "pull" as const, label: `${there} → ${here}`, note: `Changes in ${there} are copied here. Nothing goes out.` },
    { id: "both" as const, label: `${here} ⇄ ${there}`, note: "Changes flow both ways." },
  ];
  return (
    <div data-slot="sync-direction" className={cn("space-y-2", className)}>
      <fieldset className="space-y-1.5">
        <legend className="mb-1 text-sm font-medium">Which way does data flow?</legend>
        {options.map((o) => (
          <label key={o.id} className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input type="radio" name={name} checked={value === o.id} onChange={() => onChange(o.id)}
              className="mt-0.5 size-4 accent-foreground" />
            <span className="min-w-0">
              <span className="block">{o.label}</span>
              <span className="block text-xs text-muted-foreground">{o.note}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {value === "both" && onWinnerChange && (
        <fieldset className="space-y-1 rounded-md border border-border p-2.5">
          <legend className="px-1 text-xs font-medium">If both sides changed, which wins?</legend>
          <p className="px-1 text-xs text-muted-foreground">The other side's change is discarded.</p>
          {([["here", here], ["there", there]] as const).map(([id, label]) => (
            <label key={id} className="flex cursor-pointer items-center gap-2 px-1 text-sm">
              <input type="radio" name={`${name}-win`} checked={winner === id}
                onChange={() => onWinnerChange(id)} className="size-4 accent-foreground" />
              {label}
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}
