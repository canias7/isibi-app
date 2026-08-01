import { cn } from "@/lib/utils";
/**
 * A yes/no filter that can also be OFF — three states, not two.
 *
 * A CHECKBOX CANNOT EXPRESS THIS AND IS USED FOR IT ANYWAY. Ticked means "only
 * paid"; unticked has to mean both "only unpaid" and "do not filter on this",
 * and it silently means the second — so there is no way to ask for the unpaid
 * ones at all. That missing state is why an "unpaid" list so often has to be
 * built as a separate saved view.
 *
 * THE LABELS ARE THE CALLER'S. "Yes/No" is meaningless on a filter called
 * "Paid" — "Paid/Unpaid" is what somebody scanning a filter panel can read
 * without translating.
 *
 * A REAL RADIO GROUP with a `<legend>`, so arrow keys move between the three
 * and a screen reader announces which of three is chosen. The row-of-buttons
 * version announces three unrelated buttons.
 *
 * "EITHER" IS FIRST, because it is the neutral state and putting it last makes
 * the panel read as though a filter is always applied.
 */
export function BooleanFilter({ label, value, onChange, yesLabel = "Yes", noLabel = "No", anyLabel = "Either", name, className }: {
  label: string;
  /** null means not filtered. */
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  yesLabel?: string;
  noLabel?: string;
  anyLabel?: string;
  name?: string;
  className?: string;
}) {
  const group = name ?? `bf-${label.replace(/\W+/g, "-").toLowerCase()}`;
  const options: { v: boolean | null; text: string }[] = [
    { v: null, text: anyLabel },
    { v: true, text: yesLabel },
    { v: false, text: noLabel },
  ];
  return (
    <fieldset className={cn("space-y-1", className)}>
      <legend className="text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-3">
        {options.map((o) => (
          <label key={String(o.v)} className="flex items-center gap-1.5 text-sm">
            <input type="radio" name={group} checked={value === o.v} onChange={() => onChange(o.v)}
              className="size-4 accent-foreground" />
            {o.text}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
