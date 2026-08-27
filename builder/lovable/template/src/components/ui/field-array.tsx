import * as React from "react";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A repeating group of fields — three opening-hours lines, four team members,
 * as many phone numbers as somebody has.
 *
 * Rows are keyed by a generated ID, never by the array INDEX. Keyed by index,
 * deleting the second of three rows makes React reuse the third row's DOM for
 * the second, and whatever was typed into an uncontrolled field inside it stays
 * behind on the wrong row — a data-corruption bug that looks like a rendering
 * glitch. `useFieldArray` mints the ids and hands them back.
 *
 * Removing is confirmed by nothing and undone by nothing, so `min` exists: a
 * form that requires at least one line should not offer a button that empties
 * it. Below the minimum the remove button is disabled and says why.
 *
 * The add button says WHAT it adds — "Add opening time", not "+" — because a
 * bare plus at the bottom of a form is ambiguous about which of the groups
 * above it belongs to.
 */
export function useFieldArray<T>(initial: T[], blank: () => T) {
  const nextId = React.useRef(initial.length);
  const [items, setItems] = React.useState(() => initial.map((value, i) => ({ id: i, value })));
  const add = React.useCallback(() => {
    setItems((xs) => [...xs, { id: nextId.current++, value: blank() }]);
  }, [blank]);
  const remove = React.useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const update = React.useCallback((id: number, value: T) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, value } : x)));
  }, []);
  const move = React.useCallback((id: number, d: -1 | 1) => {
    setItems((xs) => {
      const i = xs.findIndex((x) => x.id === id);
      const j = i + d;
      if (i < 0 || j < 0 || j >= xs.length) return xs;
      const next = xs.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }, []);
  return { items, add, remove, update, move, values: items.map((x) => x.value) };
}

export function FieldArray<T>({
  items, onAdd, onRemove, onMove, render, addLabel, min = 0, max, legend, className,
}: {
  items: { id: number; value: T }[];
  onAdd: () => void;
  onRemove: (id: number) => void;
  onMove?: (id: number, d: -1 | 1) => void;
  render: (value: T, id: number, index: number) => React.ReactNode;
  addLabel: string;
  min?: number;
  max?: number;
  legend?: React.ReactNode;
  className?: string;
}) {
  const atMin = items.length <= min;
  return (
    <fieldset data-slot="field-array" className={cn("flex w-full min-w-0 flex-col gap-2", className)}>
      {legend ? <legend className="mb-1 text-sm font-medium">{legend}</legend> : null}
      {items.map((item, i) => (
        <div key={item.id} className="flex items-start gap-2">
          <div className="min-w-0 flex-1">{render(item.value, item.id, i)}</div>
          {onMove ? (
            <div className="flex shrink-0 flex-col">
              <button type="button" onClick={() => onMove(item.id, -1)} disabled={i === 0}
                aria-label={`Move item ${i + 1} up`}
                className="cursor-pointer rounded p-0.5 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-30">
                <ChevronUp aria-hidden className="size-3.5" />
              </button>
              <button type="button" onClick={() => onMove(item.id, 1)} disabled={i === items.length - 1}
                aria-label={`Move item ${i + 1} down`}
                className="cursor-pointer rounded p-0.5 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-30">
                <ChevronDown aria-hidden className="size-3.5" />
              </button>
            </div>
          ) : null}
          <button type="button" onClick={() => onRemove(item.id)} disabled={atMin}
            aria-label={`Remove item ${i + 1}`}
            title={atMin ? `At least ${min} required` : undefined}
            className="mt-1 shrink-0 cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30">
            <Trash2 aria-hidden className="size-4" />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <button type="button" onClick={onAdd} disabled={max != null && items.length >= max}
          className="inline-flex cursor-pointer items-center gap-1.5 self-start rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted disabled:pointer-events-none disabled:opacity-50">
          <Plus aria-hidden className="size-3.5" />
          {addLabel}
        </button>
        {max != null ? (
          <span className="text-xs text-muted-foreground tabular-nums">{items.length} of {max}</span>
        ) : null}
      </div>
    </fieldset>
  );
}
