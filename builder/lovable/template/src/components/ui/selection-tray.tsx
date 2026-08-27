import { X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * What is currently picked, as chips you can take things out of.
 *
 * The point is that a selection made across pages, filters and searches becomes
 * INVISIBLE the moment the reader scrolls away from the rows. A count in a
 * toolbar says four things are chosen; only this says which four, which is what
 * somebody needs before pressing delete.
 *
 * Each chip removes ITSELF, and its button is named with the item — twenty
 * controls all called "Remove" is what a screen reader gets otherwise, in the
 * one place where knowing which is the entire question.
 *
 * LONG SELECTIONS ARE CAPPED with "and 44 more" rather than growing without
 * bound. A tray that fills the viewport hides the actions underneath it, and
 * the fiftieth chip was never going to be read.
 *
 * Renders nothing when empty, so it can sit permanently in a layout without
 * leaving a hole.
 */
export function SelectionTray({ items, onRemove, onClear, max = 8, actions, className }: {
  items: { key: string; label: string }[];
  onRemove: (key: string) => void;
  onClear?: () => void;
  /** Chips shown before collapsing to a count. */
  max?: number;
  actions?: React.ReactNode;
  className?: string;
}) {
  if (!items.length) return null;
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;

  return (
    <div data-slot="selection-tray" className={cn("flex flex-wrap items-center gap-2 rounded-md border border-border p-2", className)}>
      <span className="text-sm font-medium tabular-nums">{items.length} selected</span>
      <ul className="flex min-w-0 flex-wrap gap-1.5">
        {shown.map((i) => (
          <li key={i.key}>
            <span className="inline-flex items-center gap-1 rounded border border-border py-0.5 pe-0.5 ps-2 text-xs">
              <span className="max-w-40 truncate">{i.label}</span>
              <button type="button" onClick={() => onRemove(i.key)}
                aria-label={`Remove ${i.label} from the selection`}
                className="cursor-pointer rounded p-0.5 hover:bg-muted">
                <X className="size-3" aria-hidden />
              </button>
            </span>
          </li>
        ))}
        {rest > 0 && (
          <li className="self-center text-xs text-muted-foreground tabular-nums">and {rest} more</li>
        )}
      </ul>
      <span className="ms-auto flex items-center gap-2">
        {actions}
        {onClear && (
          <button type="button" onClick={onClear}
            className="cursor-pointer text-xs underline underline-offset-2">Clear</button>
        )}
      </span>
    </div>
  );
}
