import * as React from "react";
import { ShortcutKeys } from "@/components/ui/shortcut-overlay";
import { cn } from "@/lib/utils";
/**
 * One row of a command palette — the row command-bar and quick-switcher
 * each hand-roll, extracted.
 *
 * A REAL `role="option"` with `aria-selected`, because a palette is a
 * listbox: the input keeps focus (typing continues), the options carry
 * selection state, and a screen reader announces "3 of 12" only when the
 * roles are right. The div-with-hover version is silent.
 *
 * SELECTION IS THE CALLER'S — palettes move selection with arrow keys
 * from the INPUT's keydown, so this row never grabs focus itself
 * (`tabIndex={-1}`); it paints the selected state and scrolls itself into
 * view when it becomes selected, which is the half everyone forgets on
 * long lists.
 *
 * `onSelect` fires on mouse UP semantics (click), not mousedown — a
 * palette that acts on mousedown steals the click from the scrollbar
 * beside it.
 */
export function CommandItem({ selected, onSelect, keys, icon, children, className }: {
  selected?: boolean;
  onSelect: () => void;
  keys?: string[];
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);
  return (
    <div
      ref={ref}
      role="option"
      aria-selected={selected ?? false}
      tabIndex={-1}
      onClick={onSelect}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm",
        selected ? "bg-foreground text-background" : "hover:bg-muted",
        className,
      )}
    >
      {icon ? <span className="shrink-0 [&>svg]:size-4" aria-hidden>{icon}</span> : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {keys?.length ? (
        <span className={cn("shrink-0", selected && "opacity-80")} aria-hidden>
          <ShortcutKeys keys={keys} />
        </span>
      ) : null}
    </div>
  );
}
