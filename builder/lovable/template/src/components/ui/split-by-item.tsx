import * as React from "react";
import { cn, formatMinor } from "@/lib/utils";
/**
 * Assign each line of a bill to a person, and total per person.
 *
 * A DIFFERENT QUESTION FROM `split-amount`, which divides one number evenly.
 * Nobody who had the steak wants to split evenly with the person who had a
 * salad, and the argument at the end of a meal is always about lines, not
 * about arithmetic.
 *
 * A LINE MAY BE SHARED, and shared lines split with the same largest-
 * remainder rule `split-amount` uses, so the per-person totals still sum to
 * the bill exactly. That is asserted in the footer, visibly.
 *
 * UNASSIGNED IS LOUD AND BLOCKS NOTHING. The bill is usually assigned while
 * people are still eating, so an incomplete split has to be a normal
 * intermediate state — but it is stated in its own line, because an
 * unassigned £24 steak is the difference between the totals and the bill.
 */
function share(amount: number, ways: number): number[] {
  const base = Math.floor(amount / ways);
  const out = Array(ways).fill(base);
  let left = amount - base * ways;
  for (let i = 0; left > 0; i++, left--) out[i] += 1;
  return out;
}

export function SplitByItem({ lines, people, assignment, onAssign, currency = "GBP", className }: {
  lines: { id: string; label: React.ReactNode; amount: number }[];
  people: { key: string; label: string }[];
  /** line id -> the people sharing it. Empty or missing means unassigned. */
  assignment: Record<string, string[]>;
  onAssign: (lineId: string, people: string[]) => void;
  currency?: string;
  className?: string;
}) {
  const fmt = (m: number) => formatMinor(m, currency);
  const totals: Record<string, number> = Object.fromEntries(people.map((p) => [p.key, 0]));
  let unassigned = 0;
  for (const line of lines) {
    const who = assignment[line.id] ?? [];
    if (!who.length) { unassigned += line.amount; continue; }
    const parts = share(line.amount, who.length);
    who.forEach((k, i) => { if (k in totals) totals[k] += parts[i]; });
  }
  const bill = lines.reduce((s, l) => s + l.amount, 0);
  const assignedSum = Object.values(totals).reduce((s, x) => s + x, 0);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <ul className="flex flex-col gap-1">
        {lines.map((l) => {
          const who = assignment[l.id] ?? [];
          return (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-2.5 py-1.5">
              <span className="text-sm">{l.label} <span className="text-xs tabular-nums text-muted-foreground">{fmt(l.amount)}</span></span>
              <span className="flex flex-wrap gap-1">
                {people.map((p) => {
                  const on = who.includes(p.key);
                  return (
                    <button key={p.key} type="button" aria-pressed={on}
                      onClick={() => onAssign(l.id, on ? who.filter((k) => k !== p.key) : [...who, p.key])}
                      className={cn("cursor-pointer rounded-full border px-2 py-0.5 text-[11px]",
                        on ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted")}>
                      {p.label}
                    </button>
                  );
                })}
              </span>
            </li>
          );
        })}
      </ul>
      <ul className="flex flex-col gap-0.5 border-t border-border pt-1.5 text-sm">
        {people.map((p) => (
          <li key={p.key} className="flex justify-between tabular-nums">
            <span>{p.label}</span><span className="font-medium">{fmt(totals[p.key])}</span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] tabular-nums text-muted-foreground">
        {unassigned > 0
          ? <><b className="text-foreground">{fmt(unassigned)} not assigned yet</b> · </>
          : null}
        assigned {fmt(assignedSum)} of {fmt(bill)}
        {unassigned === 0 && assignedSum === bill ? " — the parts sum to the bill exactly." : ""}
      </p>
    </div>
  );
}
