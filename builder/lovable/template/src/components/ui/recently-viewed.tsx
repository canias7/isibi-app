import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The things this person looked at — theirs, and clearable.
 *
 * IT IS A BROWSING TRAIL, WHICH IS PERSONAL DATA IN A SHARED-DEVICE SENSE.
 * A family tablet showing what somebody was looking at is the gift-spoiling,
 * occasionally worse, failure — so clearing is one visible press, not buried
 * in settings, and the store is per-device only.
 *
 * MOST RECENT FIRST, DEDUPED, CAPPED. Looking at one thing five times is one
 * entry; the cap keeps the strip a strip.
 *
 * `useRecentlyViewed` is the storage half so a page can record without
 * rendering anything, which is how the trail gets built at all.
 */
export function useRecentlyViewed<T extends { id: string }>(key = "recently-viewed", max = 12) {
  const [items, setItems] = React.useState<T[]>([]);
  React.useEffect(() => {
    try { const raw = localStorage.getItem(key); if (raw) setItems(JSON.parse(raw)); } catch { /* private mode */ }
  }, [key]);
  const record = React.useCallback((item: T) => {
    setItems((cur) => {
      const next = [item, ...cur.filter((x) => x.id !== item.id)].slice(0, max);
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* best effort */ }
      return next;
    });
  }, [key, max]);
  const clear = React.useCallback(() => {
    setItems([]);
    try { localStorage.removeItem(key); } catch { /* best effort */ }
  }, [key]);
  return { items, record, clear };
}

export function RecentlyViewed<T extends { id: string }>({ items, onClear, render, className }: {
  items: T[];
  onClear?: () => void;
  render: (item: T) => React.ReactNode;
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <section data-slot="recently-viewed" className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Recently viewed</h2>
        {/* One press, in view - a shared tablet is the reason. */}
        {onClear ? (
          <button type="button" onClick={onClear} className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2">
            Clear
          </button>
        ) : null}
      </div>
      <ul className="flex gap-3 overflow-x-auto pb-1">
        {items.map((i) => <li key={i.id} className="w-32 shrink-0">{render(i)}</li>)}
      </ul>
    </section>
  );
}
