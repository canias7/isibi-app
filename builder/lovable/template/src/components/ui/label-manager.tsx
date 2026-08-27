import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * The list of labels themselves — add, rename, remove.
 *
 * DELETING A LABEL SAYS HOW MANY THINGS LOSE IT. "Delete 'urgent'?" and "Delete
 * 'urgent' from 340 records?" are different questions, and only the second can
 * be answered — the count is the entire content of that decision, and it is the
 * one every label manager omits.
 *
 * A NEW LABEL MATCHING AN EXISTING ONE IS REFUSED BEFORE SUBMISSION, matched
 * case-insensitively. "Urgent" beside "urgent" is the standard way a tag list
 * doubles in size while every filter silently returns half the results.
 *
 * IN-PLACE RENAMING with the input replacing the row, so the surrounding list
 * stays as context — a rename dialog hides the very neighbours somebody needs
 * to see to pick a consistent name.
 *
 * The delete confirm carries the count in its own text, because that is the
 * last thing read before the irreversible click.
 */
export type ManagedLabel = { id: string; name: string; count?: number };

export function LabelManager({ labels, onAdd, onRename, onDelete, className }: {
  labels: ManagedLabel[];
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  className?: string;
}) {
  const [next, setNext] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const taken = (name: string, exceptId?: string) =>
    labels.some((l) => l.id !== exceptId && l.name.trim().toLowerCase() === name.trim().toLowerCase());
  const canAdd = next.trim().length > 0 && !taken(next);
  return (
    <div data-slot="label-manager" className={cn("space-y-3", className)}>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (canAdd) { onAdd(next.trim()); setNext(""); } }}>
        <input value={next} onChange={(e) => setNext(e.target.value)} aria-label="New label"
          placeholder="New label"
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 text-sm" />
        <Button type="submit" size="sm" disabled={!canAdd}>Add</Button>
      </form>
      {next.trim() && taken(next) && (
        <p className="text-xs text-muted-foreground">“{next.trim()}” already exists.</p>
      )}
      <ul className="divide-y divide-border rounded-md border border-border">
        {labels.map((l) => (
          <li key={l.id} className="flex items-center gap-2 px-3 py-2 text-sm">
            {editing === l.id ? (
              <form className="flex min-w-0 flex-1 gap-2"
                onSubmit={(e) => { e.preventDefault(); if (draft.trim() && !taken(draft, l.id)) { onRename(l.id, draft.trim()); setEditing(null); } }}>
                <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={`Rename ${l.name}`}
                  className="h-8 min-w-0 flex-1 rounded-md border border-input bg-transparent px-2 text-sm" />
                <Button type="submit" size="sm" disabled={!draft.trim() || taken(draft, l.id)}>Save</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              </form>
            ) : (
              <>
                <span className="min-w-0 flex-1 truncate">{l.name}</span>
                {l.count !== undefined && (
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{l.count.toLocaleString()}</span>
                )}
                <button type="button" className="shrink-0 text-xs underline underline-offset-2"
                  onClick={() => { setEditing(l.id); setDraft(l.name); }}>Rename</button>
                <button type="button" className="shrink-0 text-xs underline underline-offset-2"
                  onClick={() => {
                    const n = l.count ?? 0;
                    if (window.confirm(n ? `Remove “${l.name}” from ${n.toLocaleString()} items?` : `Delete “${l.name}”?`)) onDelete(l.id);
                  }}>Delete</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
