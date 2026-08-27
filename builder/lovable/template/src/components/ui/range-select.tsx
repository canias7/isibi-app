import * as React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
/**
 * Tick rows 40 to 260 without scrolling to either of them.
 *
 * Shift-click is the usual way to select a block, and it requires the reader to
 * reach both ends with a mouse — which on a list of thousands means scrolling
 * to row 260 while holding a modifier and hoping nothing re-sorts. This is the
 * keyboard-and-typing version of the same intent.
 *
 * THE COUNT IS SHOWN BEFORE THE PRESS, so "40 to 260" is read back as "221
 * rows" — an off-by-one on a bulk selection is the sort of thing discovered
 * after the delete, and the inclusive count is the number people actually mean.
 *
 * BACKWARDS INPUT IS ACCEPTED, not rejected. Typing 260 to 40 means the same
 * thing to a person, so it is normalised rather than refused; a validation
 * error there is pedantry about the order somebody happened to type two numbers
 * in.
 *
 * Values are clamped to the list rather than erroring, and `inputMode` is
 * numeric so a phone raises the right keypad.
 */
export function RangeSelect({ total, onSelect, className }: {
  /** Rows in the list. */
  total: number;
  onSelect: (from: number, to: number) => void;
  className?: string;
}) {
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const id = React.useId();
  if (total <= 0) return null;

  const clamp = (n: number) => Math.min(Math.max(n, 1), total);
  const a = Number(from), b = Number(to);
  const valid = Number.isFinite(a) && Number.isFinite(b) && from !== "" && to !== "";
  const lo = valid ? clamp(Math.min(a, b)) : 0;
  const hi = valid ? clamp(Math.max(a, b)) : 0;
  const count = valid ? hi - lo + 1 : 0;

  return (
    <div data-slot="range-select" className={cn("flex flex-wrap items-end gap-2", className)}>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-a`} className="text-xs">From</Label>
        <input id={`${id}-a`} value={from} onChange={(e) => setFrom(e.target.value)}
          type="number" inputMode="numeric" min={1} max={total} placeholder="1"
          className="h-8 w-20 rounded-md border border-input bg-transparent px-2 text-sm tabular-nums" />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-b`} className="text-xs">To</Label>
        <input id={`${id}-b`} value={to} onChange={(e) => setTo(e.target.value)}
          type="number" inputMode="numeric" min={1} max={total} placeholder={String(total)}
          className="h-8 w-20 rounded-md border border-input bg-transparent px-2 text-sm tabular-nums" />
      </div>
      <Button size="sm" disabled={!valid} onClick={() => valid && onSelect(lo, hi)}>
        Select{count > 0 ? ` ${count.toLocaleString()}` : ""}
      </Button>
      <p role="status" className="sr-only">
        {valid ? `${count} rows, ${lo} to ${hi}` : "Enter a range"}
      </p>
    </div>
  );
}
