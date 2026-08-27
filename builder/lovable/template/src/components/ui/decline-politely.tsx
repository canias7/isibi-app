import { useId } from "react";
import { cn } from "@/lib/utils";
/**
 * Saying no — with a reason that helps the system, not the person.
 *
 * THE REASON IS FOR THE MATCHING, AND IS NOT SENT. That distinction is the
 * whole component. "Too far away" improves what somebody is shown next;
 * delivered to the other person it is a criticism nobody asked for. Saying
 * plainly that it stays private is what gets an honest answer.
 *
 * A REASON IS OPTIONAL. Requiring one to decline makes people ghost instead,
 * which is worse for both sides and for the data.
 *
 * THE OPTIONS ARE ABOUT FIT, NOT ABOUT THE PERSON. "Not what I am looking for"
 * is a usable signal; a list that invites judgements of somebody's photograph
 * or manner produces a dataset nobody should hold.
 *
 * DECLINING IS ONE ACTION AND IS NOT CONFIRMED TWICE. An "are you sure?" on a
 * decline is pressure, and people who feel pressured stop answering at all.
 */
export function DeclinePolitely({ reasons = ["Too far away", "Timing does not work", "Not what I am looking for", "Already sorted"], value, onChange, onDecline, className }: {
  /** About fit, never about the person. */
  reasons?: string[];
  value?: string;
  onChange?: (next: string) => void;
  onDecline?: () => void;
  className?: string;
}) {
  const id = useId();
  return (
    <div data-slot="decline-politely" className={cn("space-y-1.5", className)}>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">Why not, if you do not mind saying</legend>
        <p className="text-xs text-muted-foreground">
          Optional, and never shown to them. It only changes what we suggest you next.
        </p>
        <div className="space-y-1 pt-0.5">
          {reasons.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name={id}
                value={r}
                checked={value === r}
                onChange={() => onChange?.(r)}
                className="size-4 accent-foreground"
              />
              <span>{r}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <button
        type="button"
        onClick={onDecline}
        className="rounded-md border border-border px-3 py-1.5 text-sm font-medium"
      >
        Pass on this one
      </button>
    </div>
  );
}
