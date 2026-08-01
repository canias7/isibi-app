import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Combine two records, choosing field by field.
 *
 * FIELD BY FIELD, NOT RECORD BY RECORD. "Keep A or keep B" throws away the
 * good half of whichever loses — the newer record usually has the current phone
 * number and the older one the full history, and a whole-record choice loses one
 * of them.
 *
 * FIELDS THAT AGREE ARE COLLAPSED to a count. A merge screen showing forty rows
 * of which four differ makes people scroll past the decisions, which is how the
 * wrong value gets kept.
 *
 * MERGING IS DESCRIBED AS IRREVERSIBLE where it is, because it usually is, and
 * discovering that after pressing is the worst possible moment.
 */
export type MergeField = { key: string; label: string; a?: string | null; b?: string | null };

export function MergeRecords({ fields, choices, onChoose, onMerge, aLabel = "Existing", bLabel = "New", busy, className }: {
  fields: MergeField[];
  /** field key -> "a" | "b" */
  choices: Record<string, "a" | "b">;
  onChoose: (key: string, side: "a" | "b") => void;
  onMerge: () => void;
  aLabel?: string; bLabel?: string;
  busy?: boolean;
  className?: string;
}) {
  const id = React.useId();
  const same = fields.filter((f) => String(f.a ?? "") === String(f.b ?? ""));
  const differ = fields.filter((f) => String(f.a ?? "") !== String(f.b ?? ""));
  const undecided = differ.filter((f) => !choices[f.key]).length;
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {same.length > 0 && (
        <p className="text-xs text-muted-foreground tabular-nums">{same.length} fields already match</p>
      )}
      <div className="flex flex-col gap-2">
        {differ.map((f) => (
          <fieldset key={f.key} className="flex flex-col gap-1">
            <legend className="text-xs font-medium">{f.label}</legend>
            {(["a", "b"] as const).map((side) => (
              <label key={side} className={cn("flex cursor-pointer items-baseline gap-2 rounded border p-2 text-sm",
                choices[f.key] === side ? "border-foreground" : "border-border")}>
                <input type="radio" name={`${id}-${f.key}`} checked={choices[f.key] === side}
                  onChange={() => onChoose(f.key, side)} className="size-3.5 accent-foreground" />
                <span className="text-xs text-muted-foreground">{side === "a" ? aLabel : bLabel}</span>
                <span className="min-w-0">{(side === "a" ? f.a : f.b) || <span className="text-muted-foreground italic">empty</span>}</span>
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" disabled={undecided > 0 || busy} onClick={onMerge}>
          {busy ? "Merging…" : "Merge them"}
        </Button>
        <span className="text-xs text-muted-foreground tabular-nums">
          {undecided > 0 ? `${undecided} still to decide` : "This can't be undone."}
        </span>
      </div>
    </div>
  );
}
