import { cn } from "@/lib/utils";
/**
 * "Showing 1–20 of 84". Pluralised properly, and it says when a filter is
 * narrowing the list — a visitor seeing three results needs to know why.
 */
export function ResultCount({ from, to, total, noun = "result", filtered, className }: {
  from?: number; to?: number; total: number; noun?: string; filtered?: boolean; className?: string;
}) {
  const word = total === 1 ? noun : noun + "s";
  const range = from != null && to != null && total > 0 ? `${from}–${to} of ` : "";
  return (
    <p data-slot="result-count" className={cn("text-sm text-muted-foreground tabular-nums", className)} role="status">
      {total === 0 ? `No ${word}` : `Showing ${range}${total} ${word}`}{filtered ? " (filtered)" : ""}
    </p>
  );
}
