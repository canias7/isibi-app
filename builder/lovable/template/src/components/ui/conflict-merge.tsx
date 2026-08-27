import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Choosing between two versions of each conflicting field, one at a time.
 *
 * IT IS PER FIELD, NOT PER DOCUMENT. "Keep mine / take theirs" for a whole
 * record throws away one person's work in every case where the two edited
 * different fields — which is most of them. Resolving field by field usually
 * keeps everything.
 *
 * NOTHING IS PRESELECTED. A default choice gets accepted wholesale by somebody
 * scrolling to the button, which is the same outcome as a document-level
 * overwrite wearing a merge interface. The Apply button stays disabled until
 * every conflict has an answer, and says how many remain.
 *
 * The two versions are LABELLED WITH NAMES AND TIMES, not "yours" and "theirs"
 * alone — on a document with three editors, "theirs" is ambiguous, and the time
 * is often what decides it.
 *
 * Identical fields are not listed at all. A merge screen padded with rows that
 * agree buries the two that do not.
 */
export type Conflict = { key: string; label: React.ReactNode; mine: React.ReactNode; theirs: React.ReactNode };

export function ConflictMerge({
  conflicts, choices, onChoose, onApply, mineLabel = "Yours", theirsLabel = "Theirs", className,
}: {
  conflicts: Conflict[];
  choices: Record<string, "mine" | "theirs" | undefined>;
  onChoose: (key: string, side: "mine" | "theirs") => void;
  onApply?: () => void;
  mineLabel?: React.ReactNode;
  theirsLabel?: React.ReactNode;
  className?: string;
}) {
  const left = conflicts.filter((c) => !choices[c.key]).length;

  return (
    <div data-slot="conflict-merge" className={cn("flex flex-col gap-3", className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th scope="col" className="px-2 py-1.5 text-start font-medium">Field</th>
            <th scope="col" className="px-2 py-1.5 text-start font-medium">{mineLabel}</th>
            <th scope="col" className="px-2 py-1.5 text-start font-medium">{theirsLabel}</th>
          </tr>
        </thead>
        <tbody>
          {conflicts.map((c) => (
            <tr key={c.key} className="border-b border-border align-top last:border-0">
              <th scope="row" className="px-2 py-2 text-start font-normal text-muted-foreground">{c.label}</th>
              {(["mine", "theirs"] as const).map((side) => {
                const on = choices[c.key] === side;
                return (
                  <td key={side} className="p-1">
                    <button type="button" onClick={() => onChoose(c.key, side)}
                      aria-pressed={on}
                      className={cn("w-full cursor-pointer rounded-md border p-2 text-start text-sm",
                        on ? "border-foreground bg-muted font-medium" : "border-border hover:bg-muted/60")}>
                      {side === "mine" ? c.mine : c.theirs}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center gap-3">
        <button type="button" onClick={onApply} disabled={left > 0}
          className="cursor-pointer rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:pointer-events-none disabled:opacity-40">
          Apply
        </button>
        <p aria-live="polite" className="text-xs text-muted-foreground tabular-nums">
          {left === 0 ? "All conflicts answered." : `${left} still to choose.`}
        </p>
      </div>
    </div>
  );
}
