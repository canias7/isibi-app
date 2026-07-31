import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
/**
 * A list with tick boxes and a select-all that knows about INDETERMINATE.
 *
 * Shift-click extends from the last row touched, which is the behaviour
 * everybody tries and almost nobody implements — without it, selecting forty
 * rows is forty clicks.
 *
 * The header box is indeterminate when some are ticked, so "some" and "none"
 * are distinguishable. As a plain checkbox they look identical, and pressing
 * it then unticks what was already chosen.
 */
export function SelectableList<T>({ items, getKey, selected, onChange, renderItem, className }: {
  items: T[]; getKey: (item: T) => string; selected: string[];
  onChange: (keys: string[]) => void;
  renderItem: (item: T) => React.ReactNode; className?: string;
}) {
  const anchor = React.useRef<number | null>(null);
  const keys = items.map(getKey);
  const all = keys.length > 0 && selected.length === keys.length;
  const some = selected.length > 0 && !all;
  const toggle = (i: number, shift: boolean) => {
    const k = keys[i];
    if (shift && anchor.current != null) {
      const [a, b] = [anchor.current, i].sort((x, y) => x - y);
      const span = keys.slice(a, b + 1);
      const add = !selected.includes(k);
      onChange(add ? [...new Set([...selected, ...span])] : selected.filter((v) => !span.includes(v)));
    } else {
      anchor.current = i;
      onChange(selected.includes(k) ? selected.filter((v) => v !== k) : [...selected, k]);
    }
  };
  return (
    <div className={cn("divide-y divide-border", className)}>
      <label className="flex items-center gap-3 py-2">
        <Checkbox checked={all ? true : some ? "indeterminate" : false}
          aria-label={all ? "Clear selection" : "Select all"}
          onCheckedChange={(v) => onChange(v === true ? keys : [])} />
        <span className="text-xs text-muted-foreground">
          {selected.length ? `${selected.length} selected` : "Select all"}
        </span>
      </label>
      {items.map((it, i) => (
        <label key={keys[i]} className="flex cursor-pointer items-center gap-3 py-2 hover:bg-muted/40">
          <Checkbox checked={selected.includes(keys[i])} aria-label={`Select item ${i + 1}`}
            onClick={(e) => { e.preventDefault(); toggle(i, (e as unknown as MouseEvent).shiftKey); }} />
          <span className="min-w-0 flex-1">{renderItem(it)}</span>
        </label>
      ))}
    </div>
  );
}
