import { cn } from "@/lib/utils";
/**
 * Asking for a repeat prescription.
 *
 * IT SAYS HOW LONG IT WILL TAKE BEFORE THE REQUEST IS SENT, not after. A patient
 * with two days of tablets left needs to know now that this takes three working
 * days, while there is still time to do something about it.
 *
 * ORDERING EVERY ITEM ON THE LIST IS THE HABIT THIS DISCOURAGES. Nothing is
 * pre-ticked, and the component says what is not needed yet based on the last
 * supply — over-ordering is most of the medicine that ends up in a bin.
 *
 * AN ITEM DUE FOR REVIEW IS SHOWN BEFORE IT IS REFUSED. Finding out at the
 * counter that a review was needed is a wasted journey; saying so at the point
 * of ordering lets the patient book the review in the same minute.
 *
 * THE REQUEST IS NOT THE SUPPLY. Wording throughout is "asked for", never
 * "ordered" — the prescriber can decline, and a patient who believes it is
 * guaranteed does not chase.
 */
export type RepeatItem = {
  id: string;
  name: string;
  /** Roughly how many days of this the patient has left. */
  daysLeft?: number;
  /** True where the prescriber wants to see them before reissuing. */
  reviewDue?: boolean;
};

export function RepeatRequest({ items, selected = [], onToggle, onSubmit, workingDays = 3, className }: {
  items: RepeatItem[];
  selected?: string[];
  onToggle?: (id: string) => void;
  onSubmit?: () => void;
  /** How long the practice takes. Stated before ordering, not after. */
  workingDays?: number;
  className?: string;
}) {
  const chosen = items.filter((i) => selected.includes(i.id));
  const early = chosen.filter((i) => i.daysLeft !== undefined && i.daysLeft > 14);
  const reviews = chosen.filter((i) => i.reviewDue);
  return (
    <div data-slot="repeat-request" className={cn("space-y-2", className)}>
      <p className="text-sm">
        This takes about{" "}
        <span className="font-medium tabular-nums">
          {workingDays} working {workingDays === 1 ? "day" : "days"}
        </span>
        . Ask before you get down to your last few.
      </p>
      <ul className="divide-y divide-border rounded-md border border-border">
        {items.map((i) => {
          const on = selected.includes(i.id);
          return (
            <li key={i.id}>
              <label className="flex cursor-pointer items-baseline gap-3 px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onToggle?.(i.id)}
                  className="mt-1 accent-foreground"
                />
                <span className="min-w-0 flex-1">
                  {i.name}
                  <span className="block text-xs text-muted-foreground">
                    {i.daysLeft !== undefined
                      ? `About ${i.daysLeft} ${i.daysLeft === 1 ? "day" : "days"} left`
                      : "We do not know how much you have left"}
                    {i.reviewDue ? " · review due" : ""}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {early.length > 0 && (
        <p className="text-xs text-muted-foreground">
          You have a fortnight or more of {early.map((i) => i.name).join(", ")} left. It will keep.
        </p>
      )}
      {reviews.length > 0 && (
        <p className="text-xs font-medium">
          {reviews.map((i) => i.name).join(", ")} {reviews.length === 1 ? "needs" : "need"} a review first —
          book that now rather than finding out at the counter.
        </p>
      )}
      <button
        type="button"
        onClick={onSubmit}
        disabled={chosen.length === 0}
        className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        Ask for {chosen.length} {chosen.length === 1 ? "item" : "items"}
      </button>
      <p className="text-xs text-muted-foreground">
        This is a request. The prescriber decides.
      </p>
    </div>
  );
}
