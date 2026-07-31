import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Divide a total among people — and the pennies SUM EXACTLY.
 *
 * LARGEST-REMAINDER, NOT toFixed: £100.00 across three people is
 * 33.34 + 33.33 + 33.33, never three 33.33s that lose a penny or three
 * 33.34s that invent two. The rounding-note lesson made operative —
 * splitMinor returns integer minor units whose sum IS the total, by
 * construction, and a test in the demo asserts it visibly.
 *
 * WHO CARRIES THE ODD PENNY IS STATED ("the first person pays the odd
 * penny"), because fairness arguments are about the rule being visible,
 * not about the penny.
 *
 * Weights are supported (the deposit payer covers 50%) through the same
 * remainder discipline.
 */
export function splitMinor(totalMinor: number, ways: number, weights?: number[]): number[] {
  const w = weights && weights.length === ways ? weights : Array(ways).fill(1);
  const totalW = w.reduce((s, x) => s + x, 0);
  const raw = w.map((x) => (totalMinor * x) / totalW);
  const floors = raw.map(Math.floor);
  let left = totalMinor - floors.reduce((s, x) => s + x, 0);
  // Hand the leftover pennies to the largest remainders, stable by index.
  const order = raw.map((r, i) => ({ i, frac: r - floors[i] }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  const out = [...floors];
  for (let k = 0; k < order.length && left > 0; k++, left--) out[order[k].i] += 1;
  return out;
}

export function SplitAmount({ totalMinor, people, currency = "GBP", className }: {
  totalMinor: number;
  people: string[];
  currency?: string;
  className?: string;
}) {
  const fmt = (m: number) => new Intl.NumberFormat(undefined, { style: "currency", currency }).format(m / 100);
  const parts = splitMinor(totalMinor, people.length);
  const uneven = new Set(parts).size > 1;
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <ul className="divide-y divide-border rounded-md border border-border">
        {people.map((p, i) => (
          <li key={p} className="flex items-baseline justify-between gap-3 px-2.5 py-1.5 text-sm">
            <span className="min-w-0 truncate">{p}</span>
            <span className="shrink-0 font-medium tabular-nums">{fmt(parts[i])}</span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] tabular-nums text-muted-foreground">
        {fmt(totalMinor)} across {people.length}
        {uneven ? " — the first pays the odd penny" : " — even"}
        ; parts sum to {fmt(parts.reduce((s, x) => s + x, 0))}.
      </p>
    </div>
  );
}
