import * as React from "react";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A select whose options are fetched as you type.
 *
 * DEBOUNCED, and the response is DISCARDED IF IT IS STALE. Typing "ada" fires
 * three searches and they can come back in any order — without a sequence
 * check the results for "a" can land last and overwrite the right answer.
 * That is the bug in nearly every hand-rolled async select and it only shows
 * up on a slow connection.
 *
 * Loading, empty and error are all rendered. A dropdown that shows nothing
 * while fetching is indistinguishable from one with no matches.
 */
export function AsyncSelect({ value, onChange, search, minChars = 1, debounceMs = 250,
  placeholder = "Search…", id, className }: {
  value?: { value: string; label: string } | null;
  onChange: (v: { value: string; label: string }) => void;
  search: (q: string) => Promise<{ value: string; label: string; hint?: string }[]>;
  minChars?: number; debounceMs?: number; placeholder?: string; id?: string; className?: string;
}) {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<{ value: string; label: string; hint?: string }[]>([]);
  const [state, setState] = React.useState<"idle" | "loading" | "error">("idle");
  const seq = React.useRef(0);

  React.useEffect(() => {
    if (q.length < minChars) { setRows([]); setState("idle"); return; }
    const mine = ++seq.current;
    setState("loading");
    const t = setTimeout(() => {
      search(q).then((r) => {
        if (mine !== seq.current) return;          // a later query already won
        setRows(r); setState("idle");
      }).catch(() => { if (mine === seq.current) setState("error"); });
    }, debounceMs);
    return () => clearTimeout(t);
  }, [q, minChars, debounceMs, search]);

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Input id={id} role="combobox" aria-expanded={open} value={open ? q : (value?.label ?? "")}
          placeholder={placeholder} className="pr-8"
          onFocus={() => { setOpen(true); setQ(""); }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onChange={(e) => setQ(e.target.value)} />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
          {state === "loading" ? <Spinner className="size-4" /> : <ChevronDown className="size-4 text-muted-foreground" />}
        </span>
      </div>
      {open && (
        <ul role="listbox" className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-md">
          {q.length < minChars && <li className="px-3 py-2 text-sm text-muted-foreground">Type {minChars} or more characters</li>}
          {state === "error" && <li className="px-3 py-2 text-sm text-destructive">Couldn't search just now.</li>}
          {state === "idle" && q.length >= minChars && rows.length === 0 &&
            <li className="px-3 py-2 text-sm text-muted-foreground">Nothing matches “{q}”.</li>}
          {rows.map((o) => (
            <li key={o.value} role="option" aria-selected={o.value === value?.value}>
              <button type="button" onMouseDown={(e) => { e.preventDefault(); onChange(o); setOpen(false); }}
                className="flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted">
                <span className="truncate">{o.label}</span>
                {o.hint && <span className="shrink-0 text-xs text-muted-foreground">{o.hint}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
