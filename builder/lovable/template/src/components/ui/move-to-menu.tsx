import * as React from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * "Move to…" — the way to relocate something without dragging it anywhere.
 *
 * Drag works when both ends are on screen. Moving a row into a folder three
 * screens down, or onto another board, is a drag nobody can complete — and for
 * a keyboard or switch user it was never available at all. A destination list
 * solves both at once, and it is the reason this exists alongside
 * `reorder-buttons`, which only shuffles within one list.
 *
 * A NATIVE `<select>`, deliberately. On a phone it opens the system picker,
 * which is scrollable, searchable by typing and already familiar — a custom
 * menu of eighty destinations is worse in every one of those ways.
 *
 * THE CURRENT LOCATION IS DISABLED IN THE LIST rather than removed. Removing it
 * makes the list shift depending on where you are, so the same destination sits
 * in a different place each time; leaving it visible and unselectable also
 * answers "where is it now?" without a second label.
 *
 * The button stays disabled until a different destination is chosen, so "Move"
 * can never mean "move it where it already is".
 */
export function MoveToMenu({ what, destinations, currentKey, onMove, busy, className }: {
  /** The item being moved, for the accessible label. */
  what: string;
  destinations: { key: string; label: string }[];
  currentKey?: string;
  onMove: (key: string) => void;
  busy?: boolean;
  className?: string;
}) {
  const [to, setTo] = React.useState("");
  const id = React.useId();
  if (!destinations.length) return null;

  return (
    <div className={cn("flex flex-wrap items-end gap-2", className)}>
      <div className="flex min-w-40 flex-col gap-1">
        <label htmlFor={id} className="text-xs text-muted-foreground">Move {what} to</label>
        <NativeSelect id={id} value={to} onChange={(e) => setTo(e.target.value)} className="h-8 text-sm">
          <option value="">Choose…</option>
          {destinations.map((d) => (
            <option key={d.key} value={d.key} disabled={d.key === currentKey}>
              {d.label}{d.key === currentKey ? " (here now)" : ""}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Button size="sm" disabled={!to || to === currentKey || busy} onClick={() => onMove(to)}>
        {busy ? "Moving…" : "Move"}
      </Button>
    </div>
  );
}
