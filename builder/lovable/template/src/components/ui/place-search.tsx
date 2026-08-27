import * as React from "react";
import { useAsyncValidation } from "@/components/ui/async-validation";
import { cn } from "@/lib/utils";
/**
 * Find a place by name — over the caller's own places, no provider.
 *
 * NO MAP PROVIDER, THE location-card RULE EXTENDED: a places API bills
 * per keystroke and puts a third-party tracker on a small business's
 * site. What a barber platform actually searches is its OWN list —
 * shops, saved addresses, service areas — so `search` is injected and
 * this component owns the UX half: debounce, stale-discard (both from
 * useAsyncValidation's discipline), the listbox, and selection.
 *
 * A PLACE IS NAME + ADDRESS, and selection returns the WHOLE OBJECT —
 * a search that hands back only the display string makes the caller
 * re-find what they already had.
 *
 * No results is a sentence with the query in it ("nothing matches
 * 'x'") — the search-empty rule.
 */
export type Place = { id: string; name: string; address?: string };

export function PlaceSearch({ search, onPick, placeholder = "Search places", className }: {
  search: (q: string) => Promise<Place[]>;
  onPick: (place: Place) => void;
  placeholder?: string;
  className?: string;
}) {
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<Place[] | null>(null);
  const [picked, setPicked] = React.useState<Place | null>(null);

  const state = useAsyncValidation(picked ? "" : q, async (v) => {
    const found = await search(v);
    setResults(found);
    return { ok: true };
  }, 250);

  return (
    <div data-slot="place-search" className={cn("flex max-w-xs flex-col gap-1.5", className)}>
      {picked ? (
        <div className="flex items-start justify-between gap-2 rounded-md border border-border px-2.5 py-1.5">
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{picked.name}</span>
            {picked.address ? <span className="block truncate text-xs text-muted-foreground">{picked.address}</span> : null}
          </span>
          <button type="button" onClick={() => { setPicked(null); setQ(""); setResults(null); }}
            className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2">
            Change
          </button>
        </div>
      ) : (
        <>
          <input value={q} onChange={(e) => { setQ(e.target.value); setResults(null); }}
            placeholder={placeholder} role="combobox" aria-expanded={!!results?.length}
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          {state.status === "checking" ? <p className="text-xs text-muted-foreground">Searching…</p> : null}
          {results && q.trim() ? (
            results.length ? (
              <ul role="listbox" className="divide-y divide-border rounded-md border border-border">
                {/* THE `<li>` CARRIES THE ROLE. It was on the `<button>` inside,
                    which left the listbox's own children roleless — a
                    `role="listbox"` owns `role="option"` children, and an
                    intervening element with no role breaks that relationship —
                    and made every result a tab stop in a popup the input is
                    supposed to keep focus for. */}
                {results.map((p) => (
                  <li key={p.id} role="option" aria-selected={false}
                    onClick={() => { setPicked(p); onPick(p); }}
                    className="cursor-pointer px-2.5 py-1.5 text-start hover:bg-muted">
                    <span className="block truncate text-sm">{p.name}</span>
                    {p.address ? <span className="block truncate text-xs text-muted-foreground">{p.address}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Nothing matches “{q.trim()}”.</p>
            )
          ) : null}
        </>
      )}
    </div>
  );
}
