import * as React from "react";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "Best on price" — marking which option won a particular row.
 *
 * IT MARKS A ROW, NOT AN OPTION. "Winner" on a whole column is a verdict the
 * component has no standing to make; "cheapest" and "quickest" are facts about
 * one criterion, and an honest comparison usually has different winners in
 * different rows. That spread is the useful output.
 *
 * A TIE IS A TIE. Picking one of two equal values by array order invents a
 * result, so `winners` takes a list and every one of them is marked.
 *
 * IT IS NOT SHOWN WHEN EVERYTHING IS EQUAL. A badge on all three columns
 * conveys nothing and makes the reader look for a difference that is not there.
 *
 * It carries a WORD as well as the glyph, because a trophy icon alone on a
 * table cell is ambiguous between "best here" and "featured".
 */
export function WinnerBadge({ criterion, tied, className }: {
  criterion?: React.ReactNode;
  tied?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-foreground px-1.5 py-0.5 text-[10px] font-medium text-background", className)}>
      <Trophy aria-hidden className="size-2.5" />
      {tied ? "Joint best" : "Best"}{criterion ? <> on {criterion}</> : null}
    </span>
  );
}

/**
 * Which options win a row. Returns every tied winner, and NOTHING when they are
 * all equal — a badge on every column says less than no badge at all.
 */
export function winnersFor<T extends string>(
  values: Record<T, number | undefined>,
  better: "higher" | "lower" = "higher",
): T[] {
  const entries = (Object.entries(values) as [T, number | undefined][])
    .filter((e): e is [T, number] => typeof e[1] === "number");
  if (entries.length < 2) return [];
  const best = better === "higher"
    ? Math.max(...entries.map((e) => e[1]))
    : Math.min(...entries.map((e) => e[1]));
  const won = entries.filter((e) => e[1] === best).map((e) => e[0]);
  return won.length === entries.length ? [] : won;
}
