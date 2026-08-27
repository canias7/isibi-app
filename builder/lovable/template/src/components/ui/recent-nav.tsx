import * as React from "react";
import { Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "Recently viewed" in a sidebar.
 *
 * IT IS CAPPED AND DEDUPLICATED, most recent first. Without dedup, opening the
 * same booking four times fills the whole list with it and pushes out
 * everything else — which is exactly the behaviour of somebody working on one
 * thing, so it is the normal case rather than an edge one.
 *
 * The CURRENT item is excluded, like `quick-switcher`: a link to where you
 * already are is a row that does nothing, sitting where a useful one would be.
 *
 * Each entry can be REMOVED. A recents list is a small history of what somebody
 * has been looking at, and there is no way to justify making that permanent on
 * a shared screen.
 *
 * `useRecents` keeps the list in `localStorage` under a namespaced key so two
 * features on one site do not overwrite each other's history.
 */
export function useRecents(name: string, max = 8) {
  const [items, setItems] = React.useState<{ key: string; label: string; hint?: string }[]>([]);
  const storageKey = `recent:${name}`;

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setItems(JSON.parse(raw));
    } catch { /* private mode, or a bad value someone else wrote */ }
  }, [storageKey]);

  const save = React.useCallback((next: { key: string; label: string; hint?: string }[]) => {
    setItems(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* as above */ }
  }, [storageKey]);

  const push = React.useCallback((item: { key: string; label: string; hint?: string }) => {
    setItems((prev) => {
      // Dedup first, or working on one thing fills the whole list with it.
      const next = [item, ...prev.filter((p) => p.key !== item.key)].slice(0, max);
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* as above */ }
      return next;
    });
  }, [storageKey, max]);

  const remove = React.useCallback((key: string) => {
    setItems((prev) => {
      const next = prev.filter((p) => p.key !== key);
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* as above */ }
      return next;
    });
  }, [storageKey]);

  return { items, push, remove, clear: () => save([]) };
}

export function RecentNav({ items, current, onPick, onRemove, title = "Recent", className }: {
  items: { key: string; label: string; hint?: string }[];
  current?: string;
  onPick: (key: string) => void;
  onRemove?: (key: string) => void;
  title?: React.ReactNode;
  className?: string;
}) {
  const shown = items.filter((i) => i.key !== current);
  if (shown.length === 0) return null;
  return (
    <nav data-slot="recent-nav" aria-label={typeof title === "string" ? title : "Recent"} className={cn("flex flex-col gap-1", className)}>
      <p className="flex items-center gap-1.5 px-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        <Clock aria-hidden className="size-3" /> {title}
      </p>
      <ul>
        {shown.map((i) => (
          <li key={i.key} className="group/r flex items-center">
            <button type="button" onClick={() => onPick(i.key)}
              className="min-w-0 flex-1 cursor-pointer truncate rounded px-2 py-1 text-start text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
              {i.label}
              {i.hint ? <span className="ms-1.5 text-xs">{i.hint}</span> : null}
            </button>
            {onRemove ? (
              <button type="button" onClick={() => onRemove(i.key)} aria-label={`Remove ${i.label} from recent`}
                className="cursor-pointer rounded p-0.5 text-muted-foreground opacity-0 group-hover/r:opacity-100 focus-visible:opacity-100 hover:text-foreground">
                <X aria-hidden className="size-3" />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </nav>
  );
}
