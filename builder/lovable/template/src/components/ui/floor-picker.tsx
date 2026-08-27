import { cn } from "@/lib/utils";
/**
 * Choosing a floor, described by what is on it.
 *
 * A FLOOR NUMBER MEANS NOTHING AND ITS CONTENTS MEAN EVERYTHING. "Floor 3" is
 * unusable to anybody who has not been here; "Floor 3 — quiet zone, no calls" is
 * a choice somebody can make on their first day. The label is the description,
 * not a decoration beside it.
 *
 * A FULL FLOOR IS DISABLED AND SAYS WHY, rather than silently accepting a choice
 * that fails at the next step. That is the wizard failure everybody has met: pick
 * something, press continue, get told.
 *
 * THE QUIET AND THE CALL-FRIENDLY FLOORS ARE MARKED, because it is the single
 * most common reason somebody moves floors after their first hour, and it is
 * knowable in advance.
 *
 * REAL RADIO BUTTONS UNDERNEATH, so arrow keys move between floors and the whole
 * thing is reachable without a mouse. The clickable-div version of this control
 * is unusable by keyboard, which is the usual implementation.
 */
export type Floor = {
  id: string;
  label: string;
  /** What is actually on it. */
  describes?: string;
  free?: number;
  capacity?: number;
  quiet?: boolean;
  callsAllowed?: boolean;
};

export function FloorPicker({ floors, value, onChange, name = "floor", className }: {
  floors: Floor[];
  value?: string;
  onChange?: (id: string) => void;
  name?: string;
  className?: string;
}) {
  return (
    <fieldset data-slot="floor-picker" className={cn("space-y-1.5", className)}>
      <legend className="mb-1 text-sm font-medium">Which floor</legend>
      <div className="divide-y divide-border rounded-md border border-border">
        {floors.map((f) => {
          const full = f.free !== undefined && f.free <= 0;
          return (
            <label
              key={f.id}
              className={cn(
                "flex cursor-pointer items-baseline gap-3 px-3 py-2 text-sm",
                full && "cursor-not-allowed text-muted-foreground",
              )}
            >
              <input
                type="radio"
                name={name}
                value={f.id}
                checked={value === f.id}
                disabled={full}
                onChange={() => onChange?.(f.id)}
                className="mt-1 accent-foreground"
              />
              <span className="min-w-0 flex-1">
                <span className="font-medium">{f.label}</span>
                {f.describes && <span className="block text-xs text-muted-foreground">{f.describes}</span>}
                <span className="block text-xs text-muted-foreground">
                  {[
                    f.quiet ? "Quiet — no calls" : f.callsAllowed ? "Calls fine here" : "",
                    f.free !== undefined && f.capacity !== undefined && `${f.free} of ${f.capacity} free`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              {full && <span className="shrink-0 text-xs font-medium">Full</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
