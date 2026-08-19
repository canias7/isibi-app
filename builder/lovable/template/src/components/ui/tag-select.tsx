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
 *
 * ARROW KEYS AND `aria-activedescendant`. Focus stays in the text box and the
 * active option is announced by id; the options are not focusable, because a
 * focusable control inside a `role="option"` is not allowed and put every
 * suggestion in the tab order — so Tab walked the whole dropdown instead of
 * leaving the field. Arrows SKIP an option that is already taken: stopping on
 * one that cannot be chosen is a dead press with nothing to explain it.
 */
export function TagSelect({ value, onChange, options, placeholder = "Add…", max, id, className }: {
  value: string[]; onChange: (v: string[]) => void;
  options: { value: string; label: string }[];
  placeholder?: string; max?: number; id?: string; className?: string;
}) {
  const [q, setQ] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const listId = React.useId();
  const label = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  const full = max != null && value.length >= max;
  const shown = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));
  const pickable = (i: number) => shown[i] && !value.includes(shown[i].value) && !full;
  /** The next option that can actually be chosen, or where we already are. */
  const step = (from: number, by: 1 | -1) => {
    for (let i = from + by; i >= 0 && i < shown.length; i += by) if (pickable(i)) return i;
    return from;
  };
  const add = (v: string) => { onChange([...value, v]); setQ(""); setActive(0); };
  return (
    <div className={cn("relative", className)}>
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring/40">
        {value.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded bg-muted py-0.5 ps-2 pe-1 text-sm">
            {label(v)}
            <button type="button" aria-label={`Remove ${label(v)}`} className="cursor-pointer rounded p-0.5 hover:bg-background"
              onClick={() => onChange(value.filter((x) => x !== v))}>
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input id={id} value={q} disabled={full}
          role="combobox" aria-expanded={open} aria-controls={listId}
          aria-activedescendant={open && shown[active] ? `${listId}-${active}` : undefined}
          placeholder={full ? `${max} is the limit` : placeholder}
          className="min-w-24 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
          onChange={(e) => { setQ(e.target.value); setActive(0); setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !q && value.length) onChange(value.slice(0, -1));
            else if (e.key === "Escape") setOpen(false);
            else if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((i) => step(i, 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => step(i, -1)); }
            else if (e.key === "Enter" && open && pickable(active)) { e.preventDefault(); add(shown[active].value); }
          }} />
      </div>
      {open && shown.length > 0 && (
        <ul id={listId} role="listbox" className="absolute z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-md">
          {shown.map((o, i) => {
            const taken = value.includes(o.value);
            return (
              // `aria-disabled`, not `disabled` — an `<li>` has no disabled
              // attribute, and the guard that matters is the handler refusing
              // rather than the element being inert.
              <li key={o.value} id={`${listId}-${i}`} role="option" aria-selected={taken}
                aria-disabled={taken || full || undefined}
                onMouseDown={(e) => { e.preventDefault(); if (!taken && !full) add(o.value); }}
                className={cn("px-3 py-1.5 text-start text-sm",
                  taken || full ? "cursor-default text-muted-foreground line-through"
                    : cn("cursor-pointer", i === active ? "bg-muted" : "hover:bg-muted/60"))}>
                <HighlightMatch text={o.label} query={q} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
