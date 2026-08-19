import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
/**
 * A value that becomes an input when clicked.
 *
 * Escape reverts and blur commits, which is what every spreadsheet does — the
 * opposite (blur reverts) loses somebody's typing every time they click away to
 * check something.
 */
export function InlineEdit({ value, onSave, label, placeholder, className }: {
  value: string; onSave: (v: string) => void; label?: string;
  placeholder?: string; className?: string;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);
  const commit = () => { setEditing(false); if (draft !== value) onSave(draft); };
  if (editing) {
    return (
      <Input autoFocus value={draft} placeholder={placeholder} aria-label={label}
        className={cn("h-8", className)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { e.preventDefault(); setDraft(value); setEditing(false); }
        }} />
    );
  }
  return (
    <button type="button" onClick={() => setEditing(true)}
      className={cn("w-full cursor-text rounded px-2 py-1 text-start text-sm hover:bg-muted", className)}>
      {value || <span className="text-muted-foreground">{placeholder ?? "—"}</span>}
      <span className="sr-only">{label ? `Edit ${label}` : "Edit"}</span>
    </button>
  );
}
