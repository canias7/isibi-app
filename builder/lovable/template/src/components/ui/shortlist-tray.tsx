import { X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The few you are still considering, kept in view.
 *
 * A SHORTLIST THAT SCROLLS AWAY IS NOT A SHORTLIST. The whole point is comparing
 * three things spread across a long list, and a tray that stays put is what
 * makes that possible without opening tabs.
 *
 * IT CAPS AND SAYS SO. A "shortlist" of eleven is a list, and refusing the
 * twelfth with a stated limit is more useful than silently accepting until the
 * tray covers the page.
 *
 * The compare action is disabled below two, because comparing one thing is not
 * an operation — and an enabled button that then complains is worse than a
 * disabled one whose reason is stated.
 */
export function ShortlistTray({ items, max = 4, onRemove, onCompare, onClear, className }: {
  items: { key: string; label: string }[];
  max?: number;
  onRemove: (key: string) => void;
  onCompare?: () => void;
  onClear?: () => void;
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <div data-slot="shortlist-tray" className={cn("flex flex-wrap items-center gap-2 rounded-md border border-border p-2", className)}>
      <span className="text-sm font-medium tabular-nums">
        Shortlist {items.length} of {max}
      </span>
      <ul className="flex min-w-0 flex-wrap gap-1.5">
        {items.map((i) => (
          <li key={i.key}>
            <span className="inline-flex items-center gap-1 rounded border border-border py-0.5 pe-0.5 ps-2 text-xs">
              <span className="max-w-40 truncate">{i.label}</span>
              <button type="button" onClick={() => onRemove(i.key)}
                aria-label={`Remove ${i.label} from the shortlist`}
                className="cursor-pointer rounded p-0.5 hover:bg-muted">
                <X aria-hidden className="size-3" />
              </button>
            </span>
          </li>
        ))}
      </ul>
      <span className="ms-auto flex items-center gap-2 text-xs">
        {onCompare && (
          <button type="button" onClick={onCompare} disabled={items.length < 2}
            className="cursor-pointer underline underline-offset-2 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50">
            Compare{items.length < 2 ? " (pick two)" : ""}
          </button>
        )}
        {onClear && (
          <button type="button" onClick={onClear} className="cursor-pointer text-muted-foreground underline underline-offset-2">Clear</button>
        )}
      </span>
    </div>
  );
}
