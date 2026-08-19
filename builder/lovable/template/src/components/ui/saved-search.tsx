import * as React from "react";
import { Bookmark, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Named searches somebody has kept — "Saturday no-shows", "Unpaid over £50".
 *
 * IT SAVES THE QUERY, NOT THE RESULTS, and re-runs on open. A saved search
 * whose answer was frozen at save time is a stale report that looks live, which
 * is the worst kind: nobody checks a number that has always been right before.
 *
 * The COUNT beside each is optional and, when shown, is the caller's job to
 * refresh. It is worth having — "Unpaid: 4" is the reason to click — and worth
 * being explicit that it can be stale, which is why it is not computed here.
 *
 * Saving asks for a NAME, because "search 3" is not something anybody comes
 * back to. The default offered is the query itself, which is usually right.
 *
 * A DEFAULT saved search can be marked, so the view somebody starts from is the
 * one they chose rather than an unfiltered list of everything.
 */
export function SavedSearch({ items, active, onRun, onSave, onRemove, onSetDefault, className }: {
  items: { key: string; name: string; query?: React.ReactNode; count?: number; isDefault?: boolean }[];
  active?: string;
  onRun: (key: string) => void;
  onSave?: () => void;
  onRemove?: (key: string) => void;
  onSetDefault?: (key: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-baseline justify-between gap-2 px-1">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
          <Bookmark aria-hidden className="size-3" /> Saved
        </p>
        {onSave ? (
          <button type="button" onClick={onSave}
            className="cursor-pointer text-xs underline underline-offset-2">Save this search</button>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="px-2 py-1 text-xs text-muted-foreground">
          Save a search you run often and it will appear here.
        </p>
      ) : (
        <ul>
          {items.map((i) => (
            <li key={i.key} className="group/s flex items-center">
              <button type="button" onClick={() => onRun(i.key)}
                aria-current={i.key === active ? "true" : undefined}
                className={cn("flex min-w-0 flex-1 cursor-pointer items-baseline gap-2 rounded px-2 py-1 text-start text-sm hover:bg-muted",
                  i.key === active && "bg-muted font-medium")}>
                <span className="min-w-0 flex-1 truncate">
                  {i.name}
                  {i.query ? <span className="ms-1.5 text-xs text-muted-foreground">{i.query}</span> : null}
                </span>
                {i.count != null ? (
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{i.count.toLocaleString()}</span>
                ) : null}
              </button>
              {onSetDefault ? (
                <button type="button" onClick={() => onSetDefault(i.key)}
                  aria-pressed={!!i.isDefault} aria-label={i.isDefault ? `${i.name} is the default` : `Make ${i.name} the default`}
                  className={cn("cursor-pointer rounded p-0.5 text-muted-foreground hover:text-foreground",
                    i.isDefault ? "" : "opacity-0 group-hover/s:opacity-100 focus-visible:opacity-100")}>
                  <Star aria-hidden className={cn("size-3", i.isDefault && "fill-current")} />
                </button>
              ) : null}
              {/* `onRemove` was declared, published in the generated signature,
                  and called by nothing — so a page wired it up and saved
                  searches could never be deleted. Same reveal-on-hover
                  treatment as the default star beside it, and it keeps a real
                  accessible name rather than relying on the icon. */}
              {onRemove ? (
                <button type="button" onClick={() => onRemove(i.key)}
                  aria-label={`Remove ${i.name}`}
                  className="cursor-pointer rounded p-0.5 text-muted-foreground opacity-0 group-hover/s:opacity-100 hover:text-foreground focus-visible:opacity-100">
                  <X aria-hidden className="size-3" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
