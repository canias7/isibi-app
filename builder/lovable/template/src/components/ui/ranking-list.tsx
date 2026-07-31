import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Put these in order — with buttons, not drag.
 *
 * UP/DOWN BUTTONS ARE THE MECHANISM (the drag-list rule): drag cannot be done
 * by keyboard, misfires on touch, and for a five-item ranking two clicks are
 * as fast as a drag anyway. Each button says what it moves, so a screen
 * reader hears "Move Price up", not "button".
 *
 * WHAT RANK 1 MEANS IS PRINTED (`topLabel`). A ranked list where the reader
 * has to guess whether the top is "most important" or "first to cut" is two
 * opposite surveys wearing one UI.
 *
 * The rank number rides each row, tabular, so the order reads as the ANSWER
 * it is — not as an arbitrary list order.
 */
export function RankingList({ items, onChange, topLabel = "Most important first", className }: {
  items: string[];
  onChange: (next: string[]) => void;
  topLabel?: string;
  className?: string;
}) {
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const btn = "cursor-pointer rounded p-0.5 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30";
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <p className="text-xs text-muted-foreground">{topLabel}</p>
      <ol className="divide-y divide-border rounded-lg border border-border">
        {items.map((it, i) => (
          <li key={it} className="flex items-center gap-2.5 px-3 py-2">
            <span className="w-5 text-right text-sm font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-sm">{it}</span>
            <span className="flex items-center gap-0.5">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                aria-label={`Move ${it} up`} className={btn}>
                <ChevronUp className="size-4" />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1}
                aria-label={`Move ${it} down`} className={btn}>
                <ChevronDown className="size-4" />
              </button>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
