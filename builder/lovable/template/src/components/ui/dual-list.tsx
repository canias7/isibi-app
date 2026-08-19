import * as React from "react";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Pick from a list AND put the picks in order.
 *
 * That ordering is the whole difference from `transfer-list`, which is for
 * sets where order is meaningless. Here the chosen column has up and down
 * arrows, because the order IS the answer — the columns of a report, the
 * steps of a checklist, the images in a gallery.
 *
 * Up and down as buttons rather than drag-only: reordering by dragging cannot
 * be done from a keyboard, and this is a control whose entire output is an
 * order.
 */
export function DualList({ options, value, onChange, availableLabel = "Available",
  chosenLabel = "In order", className }: {
  options: { value: string; label: string }[]; value: string[];
  onChange: (v: string[]) => void;
  availableLabel?: string; chosenLabel?: string; className?: string;
}) {
  const label = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  const left = options.filter((o) => !value.includes(o.value));
  const move = (i: number, d: -1 | 1) => {
    const to = i + d;
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    [next[i], next[to]] = [next[to], next[i]];
    onChange(next);
  };
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", className)}>
      <div className="rounded-md border border-border">
        <p className="border-b border-border px-3 py-2 text-xs font-medium">
          {availableLabel} <span className="tabular-nums text-muted-foreground">({left.length})</span>
        </p>
        <ul className="max-h-56 overflow-y-auto p-1">
          {left.map((o) => (
            <li key={o.value}>
              <button type="button" onClick={() => onChange([...value, o.value])}
                className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1 text-start text-sm hover:bg-muted">
                <Plus className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{o.label}</span>
              </button>
            </li>
          ))}
          {!left.length && <li className="px-2 py-4 text-center text-xs text-muted-foreground">All added</li>}
        </ul>
      </div>
      <div className="rounded-md border border-border">
        <p className="border-b border-border px-3 py-2 text-xs font-medium">
          {chosenLabel} <span className="tabular-nums text-muted-foreground">({value.length})</span>
        </p>
        <ol className="max-h-56 overflow-y-auto p-1">
          {value.map((v, i) => (
            <li key={v} className="flex items-center gap-1 rounded px-2 py-0.5 hover:bg-muted/60">
              <span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{label(v)}</span>
              <Button type="button" size="icon-sm" variant="ghost" disabled={i === 0}
                aria-label={`Move ${label(v)} up`} onClick={() => move(i, -1)}><ArrowUp className="size-3.5" /></Button>
              <Button type="button" size="icon-sm" variant="ghost" disabled={i === value.length - 1}
                aria-label={`Move ${label(v)} down`} onClick={() => move(i, 1)}><ArrowDown className="size-3.5" /></Button>
              <Button type="button" size="icon-sm" variant="ghost"
                aria-label={`Remove ${label(v)}`} onClick={() => onChange(value.filter((x) => x !== v))}>
                <X className="size-3.5" />
              </Button>
            </li>
          ))}
          {!value.length && <li className="px-2 py-4 text-center text-xs text-muted-foreground">Nothing chosen yet</li>}
        </ol>
      </div>
    </div>
  );
}
