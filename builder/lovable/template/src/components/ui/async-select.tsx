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
 *
 * ARROW KEYS AND `aria-activedescendant`, not a list of focusable buttons.
 * Focus stays on the input — which is what the `onMouseDown` + `preventDefault`
 * below has always been protecting — and the active option is announced by id
 * rather than by moving focus into the popup. Each option used to be a
 * `<button>` inside its `role="option"`, which ARIA forbids and which put every
 * result in the tab order, so Tab walked through the whole list instead of
 * leaving the field.
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
  const [active, setActive] = React.useState(0);
  const seq = React.useRef(0);
  const listId = React.useId();

  React.useEffect(() => {
    if (q.length < minChars) { setRows([]); setState("idle"); return; }
    const mine = ++seq.current;
    setState("loading");
    const t = setTimeout(() => {
      search(q).then((r) => {
        if (mine !== seq.current) return;          // a later query already won
        // BACK TO THE TOP WHEN THE RESULTS CHANGE. Leaving `active` where it
        // was points it at whatever happens to land in that position next,
        // so Enter chooses a row the reader never looked at.
        setRows(r); setActive(0); setState("idle");
      }).catch(() => { if (mine === seq.current) setState("error"); });
    }, debounceMs);
    return () => clearTimeout(t);
  }, [q, minChars, debounceMs, search]);

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Input id={id} role="combobox" aria-expanded={open} value={open ? q : (value?.label ?? "")}
          aria-controls={listId}
          aria-activedescendant={open && rows[active] ? `${listId}-${active}` : undefined}
          placeholder={placeholder} className="pe-8"
          onFocus={() => { setOpen(true); setQ(""); }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onChange={(e) => { setQ(e.target.value); setActive(0); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((i) => Math.min(rows.length - 1, i + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
            else if (e.key === "Enter" && open && rows[active]) { e.preventDefault(); onChange(rows[active]); setOpen(false); }
            else if (e.key === "Escape") setOpen(false);
          }} />
        <span className="pointer-events-none absolute end-2.5 top-1/2 -translate-y-1/2">
          {state === "loading" ? <Spinner className="size-4" /> : <ChevronDown className="size-4 text-muted-foreground" />}
        </span>
      </div>
      {open && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-md">
          {q.length < minChars && <li className="px-3 py-2 text-sm text-muted-foreground">Type {minChars} or more characters</li>}
          {state === "error" && <li className="px-3 py-2 text-sm text-destructive">Couldn't search just now.</li>}
          {state === "idle" && q.length >= minChars && rows.length === 0 &&
            <li className="px-3 py-2 text-sm text-muted-foreground">Nothing matches “{q}”.</li>}
          {rows.map((o, i) => (
            <li key={o.value} id={`${listId}-${i}`} role="option" aria-selected={o.value === value?.value}
              onMouseDown={(e) => { e.preventDefault(); onChange(o); setOpen(false); }}
              className={cn("flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-start text-sm",
                i === active ? "bg-muted" : "hover:bg-muted/60")}>
              <span className="truncate">{o.label}</span>
              {o.hint && <span className="shrink-0 text-xs text-muted-foreground">{o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
