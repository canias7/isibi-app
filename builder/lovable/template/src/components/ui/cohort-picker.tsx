import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * Choosing a group to analyse, with its size shown before you commit.
 *
 * THE SIZE IS SHOWN WITH THE CHOICE. A cohort of eleven people produces charts
 * that look exactly like a cohort of eleven thousand, and somebody who picks
 * "signed up in July, on the Pro plan, in Germany" has narrowed to a group too
 * small to conclude anything from — which is invisible after the fact.
 *
 * A TOO-SMALL COHORT IS SAID PLAINLY. The threshold is the caller's, since what
 * counts as enough depends on what is being measured, but the warning is not
 * optional — this is the commonest way an analytics screen misleads.
 *
 * AN INCOMPLETE PERIOD IS FLAGGED, because a cohort from this week has not had
 * time to do the thing being measured, and it always looks worse than the
 * others. Every retention chart has one misleading final column.
 *
 * DEFINITIONS ARE SHOWN, not just names. "Active users" means something
 * different in every product, and a picker offering the label alone gets
 * compared against somebody else's definition.
 */
export type Cohort = {
  id: string;
  label: string;
  /** What it means. */
  definition?: string;
  size?: number;
  /** True when the period has not finished. */
  incomplete?: boolean;
};

export function CohortPicker({ cohorts, value, onChange, smallBelow = 30, label = "Group", id = "cohort", className }: {
  cohorts: Cohort[];
  value: string;
  onChange: (id: string) => void;
  smallBelow?: number;
  label?: string;
  id?: string;
  className?: string;
}) {
  const chosen = cohorts.find((c) => c.id === value);
  const small = chosen?.size !== undefined && chosen.size < smallBelow;
  return (
    <div className={cn("space-y-1", className)}>
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      <NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {cohorts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}{c.size !== undefined ? ` — ${c.size.toLocaleString()}` : ""}
          </option>
        ))}
      </NativeSelect>
      {chosen?.definition && <p className="text-xs text-muted-foreground">{chosen.definition}</p>}
      {small && (
        <p role="status" className="text-xs font-medium">
          Only {chosen!.size!.toLocaleString()} people — too few to conclude much from.
        </p>
      )}
      {chosen?.incomplete && (
        <p role="status" className="text-xs text-muted-foreground">
          This period has not finished, so this group has had less time than the others and will look worse.
        </p>
      )}
    </div>
  );
}
