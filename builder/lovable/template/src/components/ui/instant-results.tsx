import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The dropdown of results that appears as you type.
 *
 * THE PREVIOUS RESULTS STAY ON SCREEN WHILE THE NEXT REQUEST IS IN FLIGHT,
 * dimmed. Clearing to a spinner on every keystroke makes the panel flash
 * between empty and full several times a second, which is unreadable — and the
 * old results are usually still roughly right.
 *
 * STALE RESPONSES ARE DISCARDED. Requests come back out of order, so typing
 * "boo" then "book" can land the shorter query's results last and show the
 * wrong set for the query on screen. `useInstantSearch` tracks the request
 * number and ignores anything but the latest.
 *
 * It is a `combobox` with `aria-activedescendant`, so the highlighted row is
 * announced while focus stays in the input. Moving real focus into the list
 * means the next character typed goes nowhere.
 *
 * The debounce is on the REQUEST, not the display. The typed text updates
 * immediately; only the fetch waits.
 */
export function useInstantSearch<T>(query: string, run: (q: string) => Promise<T[]>, delay = 200) {
  const [results, setResults] = React.useState<T[]>([]);
  const [loading, setLoading] = React.useState(false);
  const seq = React.useRef(0);

  React.useEffect(() => {
    if (!query.trim()) { setResults([]); setLoading(false); return; }
    const mine = ++seq.current;
    setLoading(true);
    const t = setTimeout(() => {
      run(query)
        .then((r) => {
          // Out-of-order responses would otherwise show the wrong query's results.
          if (mine !== seq.current) return;
          setResults(r);
          setLoading(false);
        })
        .catch(() => { if (mine === seq.current) setLoading(false); });
    }, delay);
    return () => clearTimeout(t);
  }, [query, run, delay]);

  return { results, loading };
}

export function InstantResults({ results, loading, query, activeIndex, onActiveChange, onPick, renderItem, className }: {
  results: { key: string }[];
  loading?: boolean;
  query: string;
  activeIndex: number;
  onActiveChange: (i: number) => void;
  onPick: (key: string) => void;
  renderItem: (item: { key: string }, index: number) => React.ReactNode;
  className?: string;
}) {
  const id = React.useId();
  if (!query.trim()) return null;
  return (
    <ul
      id={id}
      role="listbox"
      aria-label="Results"
      // Dimmed rather than cleared: flashing empty on every keystroke is unreadable.
      className={cn("max-h-72 overflow-y-auto rounded-lg border border-border bg-background p-1 shadow-lg",
        loading && results.length > 0 && "opacity-60", className)}
    >
      {results.length === 0 ? (
        <li className="px-3 py-6 text-center text-sm text-muted-foreground">
          {loading ? "Searching…" : `Nothing matches “${query}”.`}
        </li>
      ) : results.map((r, i) => (
        <li key={r.key} id={`${id}-${i}`} role="option" aria-selected={i === activeIndex}>
          <button type="button" onMouseEnter={() => onActiveChange(i)} onClick={() => onPick(r.key)}
            className={cn("w-full cursor-pointer rounded px-2 py-1.5 text-left text-sm", i === activeIndex && "bg-muted")}>
            {renderItem(r, i)}
          </button>
        </li>
      ))}
    </ul>
  );
}
