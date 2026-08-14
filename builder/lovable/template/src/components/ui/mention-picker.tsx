import * as React from "react";
import { AvatarName } from "@/components/ui/avatar-name";
import { HighlightMatch } from "@/components/ui/highlight-match";
import { cn } from "@/lib/utils";
/**
 * The @-list that appears while typing a name.
 *
 * `onMouseDown` with `preventDefault`, not `onClick` — a click fires after
 * blur, and by then the textarea has lost focus and the caret position the
 * insertion depends on. This is the single reason most hand-built mention
 * pickers insert at the wrong place or not at all.
 *
 * The highlighted index is owned by the CALLER, so the same state drives both
 * this list and the arrow keys handled on the input above it.
 */
export function MentionPicker({ people, query, activeIndex = 0, onPick, className }: {
  people: { id: string | number; name: string; role?: string; avatar?: string | null }[];
  query?: string; activeIndex?: number;
  onPick: (person: { id: string | number; name: string }) => void; className?: string;
}) {
  if (!people.length) return null;
  return (
    <ul role="listbox" aria-label="People"
      className={cn("max-h-56 overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-md", className)}>
      {people.map((p, i) => (
        // The option IS the clickable element — a focusable control inside a
        // `role="option"` is not allowed, and makes Tab walk into the popup
        // rather than leaving focus on the editor the caller is driving.
        <li key={p.id} role="option" aria-selected={i === activeIndex}
          onMouseDown={(e) => { e.preventDefault(); onPick(p); }}
          className={cn("flex cursor-pointer items-center gap-2 px-2 py-1.5 text-left",
            i === activeIndex ? "bg-muted" : "hover:bg-muted/60")}>
          <AvatarName name={p.name} src={p.avatar} size="sm" avatarOnly />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm"><HighlightMatch text={p.name} query={query ?? ""} /></span>
            {p.role && <span className="block truncate text-xs text-muted-foreground">{p.role}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
