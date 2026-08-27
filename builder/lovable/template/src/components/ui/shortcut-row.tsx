import * as React from "react";
import { ShortcutKeys } from "@/components/ui/shortcut-overlay";
import { cn } from "@/lib/utils";
/**
 * A rebindable keyboard shortcut, as a settings row.
 *
 * CAPTURE IS A MODE WITH A VISIBLE STATE AND TWO EXITS: the next chord is
 * recorded, Escape cancels. While capturing, the row SAYS "press keys" —
 * an invisible capture mode is a page that suddenly eats every keystroke.
 * Escape is reserved for cancel and therefore cannot be bound; a shortcut
 * you cannot cancel out of setting is a trap, and Escape-bound-to-something
 * breaks every dialog in the app.
 *
 * CONFLICTS REFUSE WITH THE NAME of what already holds the chord (the
 * caller knows the whole map; this row knows its own). Silently stealing a
 * binding breaks the other feature with no visible cause.
 *
 * MODIFIER-ONLY CHORDS ARE NOT ACCEPTED — releasing Ctrl on the way to
 * Ctrl+K would otherwise bind bare Ctrl. A chord is complete when a
 * non-modifier key arrives.
 *
 * Reset-to-default appears only when the binding differs from the default.
 */
export function ShortcutRow({ label, keys, defaultKeys, conflictsWith, onChange, className }: {
  label: React.ReactNode;
  keys: string[];
  defaultKeys?: string[];
  /** Given a candidate chord, the name of the feature already using it — or null. */
  conflictsWith?: (keys: string[]) => string | null;
  onChange: (keys: string[]) => void;
  className?: string;
}) {
  const [capturing, setCapturing] = React.useState(false);
  const [refused, setRefused] = React.useState<string | null>(null);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!capturing) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === "Escape") { setCapturing(false); setRefused(null); return; }
    // Wait for a non-modifier: a chord is complete when the real key lands.
    if (["Control", "Meta", "Alt", "Shift"].includes(e.key)) return;
    const chord = [
      ...(e.ctrlKey ? ["ctrl"] : []),
      ...(e.metaKey ? ["cmd"] : []),
      ...(e.altKey ? ["alt"] : []),
      ...(e.shiftKey ? ["shift"] : []),
      e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase(),
    ];
    const clash = conflictsWith?.(chord);
    if (clash) { setRefused(clash); return; }
    setCapturing(false);
    setRefused(null);
    onChange(chord);
  };

  const isDefault = !defaultKeys || JSON.stringify(keys) === JSON.stringify(defaultKeys);

  return (
    <div data-slot="shortcut-row" className={cn("flex items-center justify-between gap-4 px-3.5 py-2.5", className)}>
      <span className="text-sm font-medium">{label}</span>
      <span className="flex items-center gap-2">
        {!isDefault ? (
          <button type="button" onClick={() => onChange(defaultKeys!)}
            className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2">
            Reset
          </button>
        ) : null}
        {capturing ? (
          <span className="flex flex-col items-end gap-0.5">
            <button type="button" autoFocus onKeyDown={onKeyDown} onBlur={() => { setCapturing(false); setRefused(null); }}
              className="cursor-pointer rounded-md border-2 border-foreground px-2 py-0.5 text-xs font-medium">
              Press keys… (Esc cancels)
            </button>
            {refused ? <span className="text-[11px] text-muted-foreground">Already used by {refused}.</span> : null}
          </span>
        ) : (
          <button type="button" onClick={() => setCapturing(true)}
            className="cursor-pointer rounded-md border border-transparent p-0.5 hover:border-border"
            aria-label={`Change the ${typeof label === "string" ? label : "shortcut"} key`}>
            <ShortcutKeys keys={keys} />
          </button>
        )}
      </span>
    </div>
  );
}
