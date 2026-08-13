import { useState , useId } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Renaming one tag everywhere it is used.
 *
 * IT STATES THE BLAST RADIUS. A rename here is not editing a row — it changes
 * what appears on every record carrying the tag, and on everybody else's saved
 * filters. "Renaming affects 412 items" is the sentence that makes that
 * obvious, and it is the one this control usually lacks.
 *
 * IT WARNS WHEN THE NEW NAME ALREADY EXISTS, and says the operation is really a
 * MERGE. That is the single most common accident with tags: renaming "urgent"
 * to "Urgent" when both exist quietly folds two sets together, or fails with a
 * uniqueness error nobody can interpret. Naming it lets the caller route to
 * `TagMerge` instead.
 *
 * THE FIELD STARTS WITH THE CURRENT NAME SELECTED, so the common case — fixing
 * a typo — is type-over rather than clear-then-type.
 *
 * Unchanged input disables the button: submitting a rename to the same name is
 * a write and an audit entry for nothing.
 */
export function TagRename({ name, usageCount, existingNames = [], onRename, onCancel, busy, className }: {
  name: string;
  usageCount?: number;
  /** Every other tag name, for the merge warning. */
  existingNames?: string[];
  onRename: (next: string) => void;
  onCancel?: () => void;
  busy?: boolean;
  className?: string;
}) {
  // Unique per INSTANCE. These ids were literals, so a page rendering
  // this component twice — two contact forms, one in a list — gave every
  // field a duplicate id, and a `<label for>` then focuses the FIRST
  // match. The second form's labels pointed at the first form's inputs.
  const uid = useId();
  const [next, setNext] = useState(name);
  const trimmed = next.trim();
  const changed = trimmed.length > 0 && trimmed !== name;
  const collides = changed && existingNames.some((n) => n.trim().toLowerCase() === trimmed.toLowerCase());
  return (
    <form className={cn("space-y-2", className)}
      onSubmit={(e) => { e.preventDefault(); if (changed) onRename(trimmed); }}>
      <div className="space-y-1">
        <label htmlFor={uid + "-tag-rename"} className="block text-sm font-medium">Rename “{name}”</label>
        <input id={uid + "-tag-rename"} value={next} autoFocus onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setNext(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm" />
      </div>
      {usageCount !== undefined && (
        <p className="text-xs text-muted-foreground">
          This changes the name on <span className="tabular-nums">{usageCount.toLocaleString()}</span> items.
        </p>
      )}
      {collides && (
        <p className="text-xs">
          <span className="font-medium">“{trimmed}” already exists.</span>{" "}
          <span className="text-muted-foreground">Saving this merges the two tags together.</span>
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!changed || busy}>
          {collides ? "Rename and merge" : "Rename"}
        </Button>
        {onCancel && <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>}
      </div>
    </form>
  );
}
