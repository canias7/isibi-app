import * as React from "react";
import { Input } from "@/components/ui/input";
import { HighlightMatch } from "@/components/ui/highlight-match";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A select you can type into. The one people mean by "dropdown with search".
 *
 * `role="combobox"` with `aria-activedescendant`, so the highlighted option is
 * announced while focus stays in the box — the thing that makes this usable
 * without sight. Moving real focus into the list instead is what breaks
 * typing in almost every hand-rolled version.
 *
 * Below about 8 options a plain `native-select` is better: it is lighter,
 * works with the phone's own picker, and needs none of this.
 */
export function SearchSelect({ value, onChange, options, placeholder = "Choose…", empty = "Nothing matches", id, className }: {
  value?: string | null; onChange: (v: string) => void;
  options: { value: string; label: string; hint?: string }[];
  placeholder?: string; empty?: string; id?: string; className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [active, setActive] = React.useState(0);
  const box = React.useRef<HTMLDivElement>(null);
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : options;
  const chosen = options.find((o) => o.value === value);

  React.useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  return (
    <div ref={box} className={cn("relative", className)}>
      <div className="relative">
        <Input id={id} role="combobox" aria-expanded={open} aria-controls={`${id ?? "ss"}-list`}
          aria-activedescendant={open && shown[active] ? `${id ?? "ss"}-${active}` : undefined}
          value={open ? q : (chosen?.label ?? "")} placeholder={placeholder} className="pe-8"
          onFocus={() => { setOpen(true); setQ(""); }}
          onChange={(e) => { setQ(e.target.value); setActive(0); setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((i) => Math.min(shown.length - 1, i + 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
            else if (e.key === "Enter" && open && shown[active]) { e.preventDefault(); onChange(shown[active].value); setOpen(false); }
            else if (e.key === "Escape") setOpen(false);
          }} />
        <ChevronDown className="pointer-events-none absolute end-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
      {open && (
        <ul id={`${id ?? "ss"}-list`} role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-md">
          {shown.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">{empty}</li>}
          {shown.map((o, i) => (
            // The option IS the clickable element. This one already had the
            // whole keyboard model on the input above — arrows move `active`,
            // `aria-activedescendant` announces it, Enter chooses it — so the
            // nested button was surplus that only ever added a tab stop.
            <li key={o.value} id={`${id ?? "ss"}-${i}`} role="option" aria-selected={o.value === value}
              onMouseDown={(e) => { e.preventDefault(); onChange(o.value); setOpen(false); }}
              className={cn("flex cursor-pointer items-center gap-2 px-3 py-1.5 text-start text-sm",
                i === active ? "bg-muted" : "hover:bg-muted/60")}>
              <Check className={cn("size-4 shrink-0", o.value === value ? "opacity-100" : "opacity-0")} />
              <span className="min-w-0 flex-1 truncate"><HighlightMatch text={o.label} query={q} /></span>
              {o.hint && <span className="shrink-0 text-xs text-muted-foreground">{o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
