import * as React from "react";
import { X, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The bar that collects things to compare while somebody browses.
 *
 * IT IS PINNED AND ALWAYS VISIBLE once anything is in it. A shortlist that
 * lives on another page is a shortlist people forget they started — the whole
 * value is that it accumulates in view while they keep looking.
 *
 * IT SAYS HOW MANY MORE CAN GO IN, and refuses politely at the cap rather than
 * silently ignoring the next press. "3 is the most you can compare" is the same
 * limit `side-by-side` enforces, said at the moment somebody hits it.
 *
 * THE COMPARE BUTTON IS DISABLED BELOW TWO, with the reason. Comparing one
 * thing is a page people land on and immediately leave, and a button that
 * navigates there is a wasted press.
 *
 * On a phone it sits above the safe area, like `snackbar`, or its buttons are
 * behind the home indicator.
 */
export function ShortlistBar({ items, max = 3, onRemove, onClear, onCompare, className }: {
  items: { key: string; label: string }[];
  max?: number;
  onRemove: (key: string) => void;
  onClear?: () => void;
  onCompare?: () => void;
  className?: string;
}) {
  if (items.length === 0) return null;
  const room = max - items.length;

  return (
    <div
      role="region"
      aria-label="Shortlist"
      style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      className={cn("fixed inset-x-3 z-40 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-popover p-2 shadow-lg sm:left-1/2 sm:w-[min(44rem,calc(100vw-1.5rem))] sm:-translate-x-1/2", className)}
    >
      <Scale aria-hidden className="ms-1 size-4 shrink-0 text-muted-foreground" />
      <ul className="flex min-w-0 flex-1 flex-wrap gap-1.5">
        {items.map((i) => (
          <li key={i.key}>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pe-1 ps-2 text-xs">
              <span className="max-w-32 truncate">{i.label}</span>
              <button type="button" onClick={() => onRemove(i.key)} aria-label={`Remove ${i.label} from the shortlist`}
                className="cursor-pointer rounded-full px-1 text-muted-foreground hover:text-foreground">
                <X aria-hidden className="size-3" />
              </button>
            </span>
          </li>
        ))}
      </ul>
      <span aria-live="polite" className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {room > 0 ? `${room} more` : `${max} is the most you can compare`}
      </span>
      {onClear ? (
        <button type="button" onClick={onClear}
          className="shrink-0 cursor-pointer text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
          Clear
        </button>
      ) : null}
      {onCompare ? (
        <button type="button" onClick={onCompare} disabled={items.length < 2}
          title={items.length < 2 ? "Add one more to compare" : undefined}
          className="shrink-0 cursor-pointer rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:pointer-events-none disabled:opacity-40">
          Compare {items.length}
        </button>
      ) : null}
    </div>
  );
}
