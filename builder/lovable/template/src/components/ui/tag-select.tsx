import * as React from "react";
import { Input } from "@/components/ui/input";
import { HighlightMatch } from "@/components/ui/highlight-match";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Pick several from a known list — the multi-select with chips inside the box.
 *
 * Different from `tag-input`, which invents new values, and from
 * `multi-select`, which is a checkbox list: this one is CLOSED (only what is
 * offered) and searchable, which is what a category or an assignee field
 * wants.
 *
 * Backspace on an empty box removes the last chip, which is what everybody
 * tries first. An already-chosen option stays in the list, greyed and
 * disabled, rather than vanishing — a list that reshuffles as you pick makes
 * the next option you were reaching for jump.
 */
export function TagSelect({ value, onChange, options, placeholder = "Add…", max, id, className }: {
  value: string[]; onChange: (v: string[]) => void;
  options: { value: string; label: string }[];
  placeholder?: string; max?: number; id?: string; className?: string;
}) {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const label = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  const full = max != null && value.length >= max;
  const shown = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className={cn("relative", className)}>
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring/40">
        {value.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded bg-muted py-0.5 pl-2 pr-1 text-sm">
            {label(v)}
            <button type="button" aria-label={`Remove ${label(v)}`} className="cursor-pointer rounded p-0.5 hover:bg-background"
              onClick={() => onChange(value.filter((x) => x !== v))}>
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input id={id} value={q} disabled={full}
          placeholder={full ? `${max} is the limit` : placeholder}
          className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !q && value.length) onChange(value.slice(0, -1));
            if (e.key === "Escape") setOpen(false);
          }} />
      </div>
      {open && shown.length > 0 && (
        <ul role="listbox" className="absolute z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-md">
          {shown.map((o) => {
            const taken = value.includes(o.value);
            return (
              <li key={o.value} role="option" aria-selected={taken}>
                <button type="button" disabled={taken || full}
                  onMouseDown={(e) => { e.preventDefault(); onChange([...value, o.value]); setQ(""); }}
                  className={cn("w-full px-3 py-1.5 text-left text-sm",
                    taken ? "cursor-default text-muted-foreground line-through" : "cursor-pointer hover:bg-muted")}>
                  <HighlightMatch text={o.label} query={q} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
