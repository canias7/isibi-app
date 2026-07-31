import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The "how to work this with a keyboard" note on a complex widget.
 *
 * IT SITS WITH THE WIDGET, NOT IN A HELP CENTRE. A drag-list, a spreadsheet
 * grid, a tree — their key bindings are undiscoverable by design (nothing
 * looks pressable), so the map belongs at the point of use, collapsed to one
 * line until wanted.
 *
 * IT IS GENERATED FROM THE SAME DATA THE WIDGET BINDS, when the caller has it
 * that way — a hand-written list drifts from the handler the first time a key
 * changes, and a wrong map is worse than none. That is the same drift rule the
 * repo applies to everything.
 *
 * Keys render through `<kbd>` with platform glyphs and spoken names — the
 * `shortcut-overlay` treatment, reused at widget scale rather than app scale.
 * This is the difference between the two: that one lists the app's shortcuts,
 * this one explains one control.
 */
import { ShortcutKeys } from "@/components/ui/shortcut-overlay";

export function KeyboardMap({ bindings, summary = "Works with a keyboard", className }: {
  bindings: { keys: string[]; does: React.ReactNode }[];
  summary?: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className={cn("text-xs", className)}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        className="cursor-pointer text-muted-foreground underline underline-offset-2 hover:text-foreground">
        {summary}{open ? " —" : "…"}
      </button>
      {open ? (
        <ul className="mt-1.5 flex flex-col gap-1 rounded-md border border-border p-2.5">
          {bindings.map((b, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0">{b.does}</span>
              <ShortcutKeys keys={b.keys} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
