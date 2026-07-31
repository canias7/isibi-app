import * as React from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Jump straight to a thing by name — the file-switcher half of a palette.
 *
 * IT SHOWS RECENTS WHEN THE BOX IS EMPTY, most recent first. That is where the
 * value is: the thing somebody wants is almost always one they had open
 * minutes ago, and an empty palette showing nothing makes them type a name they
 * half-remember.
 *
 * Matching is SUBSEQUENCE, not substring — "shpfd" finds "Sharp Fade". That is
 * what people expect from a switcher and it is what makes typing three letters
 * enough.
 *
 * Results are RANKED: an earlier first match and fewer gaps score higher, so
 * "boo" puts "Bookings" above "Barber Rota Book". Unranked subsequence matching
 * returns the right set in a useless order.
 *
 * The current item is EXCLUDED. Offering to switch to the thing already open is
 * a row that does nothing, sitting where the useful one would be.
 */
export function subsequenceScore(text: string, query: string): number | null {
  if (!query) return 0;
  const t = text.toLowerCase(), q = query.toLowerCase();
  let ti = 0, score = 0, last = -1;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found === -1) return null;
    // Earlier matches and adjacent ones score better.
    score += found === last + 1 ? 0 : found - ti + 1;
    last = found;
    ti = found + 1;
  }
  return score;
}

export function QuickSwitcher({ items, current, recents = [], query, onQueryChange, onPick, className }: {
  items: { key: string; label: string; hint?: React.ReactNode }[];
  current?: string;
  recents?: string[];
  query: string;
  onQueryChange: (q: string) => void;
  onPick: (key: string) => void;
  className?: string;
}) {
  const [at, setAt] = React.useState(0);
  React.useEffect(() => { setAt(0); }, [query]);

  const pool = items.filter((i) => i.key !== current);
  const shown = query
    ? pool
      .map((i) => ({ i, s: subsequenceScore(i.label, query) }))
      .filter((r): r is { i: typeof pool[number]; s: number } => r.s !== null)
      .sort((a, b) => a.s - b.s)
      .map((r) => r.i)
    : recents.map((k) => pool.find((i) => i.key === k)).filter((x): x is typeof pool[number] => !!x);

  const index = Math.min(at, Math.max(0, shown.length - 1));

  return (
    <div className={cn("flex flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl", className)}>
      <input
        autoFocus
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Go to…"
        aria-label="Go to"
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setAt((n) => Math.min(shown.length - 1, n + 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setAt((n) => Math.max(0, n - 1)); }
          if (e.key === "Enter" && shown[index]) { e.preventDefault(); onPick(shown[index].key); }
        }}
        className="h-11 border-b border-border bg-transparent px-3 text-sm outline-none"
      />
      {!query && shown.length ? (
        <p className="flex items-center gap-1.5 px-3 pt-2 text-[11px] font-medium text-muted-foreground">
          <Clock aria-hidden className="size-3" /> Recent
        </p>
      ) : null}
      <ul className="max-h-64 overflow-y-auto p-1">
        {shown.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">
            {query ? `Nothing matches “${query}”.` : "Nothing open yet."}
          </li>
        ) : shown.map((i, k) => (
          <li key={i.key}>
            <button type="button" onMouseEnter={() => setAt(k)} onClick={() => onPick(i.key)}
              aria-current={k === index ? "true" : undefined}
              className={cn("flex w-full cursor-pointer items-baseline gap-2 rounded px-2 py-1.5 text-left text-sm",
                k === index && "bg-muted")}>
              <span className="min-w-0 flex-1 truncate">{i.label}</span>
              {i.hint ? <span className="shrink-0 text-xs text-muted-foreground">{i.hint}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
