import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Edit a table cell in place: click, type, Enter.
 *
 * BLUR COMMITS, Escape cancels. The other way round — blur discards — loses
 * work every time somebody types a value and then clicks the next cell, which
 * is the normal way to fill a row in. Escape is the deliberate throw-away, and
 * it restores the value the cell had when editing STARTED, not the last one
 * typed.
 *
 * The idle cell is a BUTTON, not a div with onClick: the whole point of an
 * editable grid is moving through it without the mouse, and a div is not in the
 * tab order and does not answer Enter.
 *
 * An empty value still renders something clickable — a cell that collapses to
 * nothing when blank is the one cell nobody can ever fill in.
 */
export function CellEditor({
  value, onCommit, type = "text", align = "left", format, placeholder = "—", disabled, className,
}: {
  value: string | number | null | undefined;
  onCommit: (next: string) => void;
  type?: "text" | "number" | "date" | "email";
  align?: "left" | "right";
  format?: (v: string | number) => React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const original = React.useRef("");
  const ref = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => { if (editing) ref.current?.select(); }, [editing]);

  const open = () => {
    if (disabled) return;
    const s = value == null ? "" : String(value);
    original.current = s;
    setDraft(s);
    setEditing(true);
  };
  const commit = () => {
    setEditing(false);
    if (draft !== original.current) onCommit(draft);
  };

  if (editing) {
    return (
      <input data-slot="cell-editor"
        ref={ref}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { e.preventDefault(); setDraft(original.current); setEditing(false); }
        }}
        className={cn("w-full rounded-sm border border-ring bg-background px-2 py-1 text-sm outline-none",
          align === "right" && "text-end tabular-nums", className)}
      />
    );
  }
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={open}
      onKeyDown={(e) => { if (e.key === "F2") { e.preventDefault(); open(); } }}
      className={cn("w-full rounded-sm px-2 py-1 text-sm",
        align === "right" ? "text-end tabular-nums" : "text-start",
        disabled ? "cursor-default text-muted-foreground" : "cursor-text hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
        className)}
    >
      {value == null || value === ""
        ? <span className="text-muted-foreground">{placeholder}</span>
        : format ? format(value) : String(value)}
    </button>
  );
}
