import * as React from "react";
import { Settings2, Eye, EyeOff, ChevronUp, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
/**
 * Which columns are shown, and in what order — the panel behind the cog.
 *
 * The LAST visible column cannot be hidden. A table with no columns is a box
 * with a row count, and the control that would bring a column back is in this
 * same panel, so it is recoverable — but the state is alarming enough, on a
 * screen somebody is using to do a job, that it is worth simply refusing.
 *
 * Hidden columns stay in the LIST rather than disappearing into a second
 * "hidden" section: the point of the panel is to answer "where did the price
 * column go", and moving it somewhere else answers that with a search.
 *
 * Reordering is arrows, not drag. Inside a popover a drag is fighting the
 * scroll container and the dismiss handler, and the arrows work from a keyboard
 * — which drag never does.
 *
 * `TableColumn` is EXPORTED because this is a round-trip prop: the state goes
 * out and comes back. Written as `useState([{key:"a",header:"A",locked:true}])`
 * TypeScript infers a union of three different literal shapes — one per
 * combination of optional keys actually present — and `onChange` is then not
 * assignable to the setter. Annotating with `useState<TableColumn[]>` is the
 * fix, and the type has to exist for that to be possible.
 */
export type TableColumn = { key: string; header: string; hidden?: boolean; locked?: boolean };

export function TableSettings({ columns, onChange, label = "Columns", className }: {
  columns: TableColumn[];
  onChange: (next: TableColumn[]) => void;
  label?: string;
  className?: string;
}) {
  const visible = columns.filter((c) => !c.hidden).length;
  const hiddenCount = columns.length - visible;

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= columns.length) return;
    const next = columns.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button"
          className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted", className)}>
          <Settings2 aria-hidden className="size-3.5" />
          {label}
          {hiddenCount > 0 ? <span className="text-muted-foreground tabular-nums">({hiddenCount} hidden)</span> : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-1">
        <ul className="max-h-72 overflow-y-auto">
          {columns.map((c, i) => {
            const last = !c.hidden && visible === 1;
            return (
              <li key={c.key} className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-muted">
                <button type="button"
                  disabled={c.locked || last}
                  onClick={() => onChange(columns.map((x) => (x.key === c.key ? { ...x, hidden: !x.hidden } : x)))}
                  aria-pressed={!c.hidden}
                  title={last ? "A table needs at least one column" : c.locked ? "Always shown" : undefined}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded px-1 py-1 text-left text-sm disabled:cursor-default disabled:opacity-60">
                  {c.hidden
                    ? <EyeOff aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
                    : <Eye aria-hidden className="size-3.5 shrink-0" />}
                  <span className={cn("truncate", c.hidden && "text-muted-foreground")}>{c.header}</span>
                </button>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${c.header} up`}
                  className="cursor-pointer rounded p-0.5 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-30">
                  <ChevronUp aria-hidden className="size-3.5" />
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === columns.length - 1} aria-label={`Move ${c.header} down`}
                  className="cursor-pointer rounded p-0.5 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-30">
                  <ChevronDown aria-hidden className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
