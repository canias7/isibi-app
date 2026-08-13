import { cn, toDate } from "@/lib/utils";
/**
 * One movement of stock — in, out, or between places — with who and why.
 *
 * THE REASON IS AS IMPORTANT AS THE NUMBER. A stock ledger of quantities with
 * no causes cannot answer the only question anybody asks it: why is the count
 * wrong? "−3, damaged, Sam" is an answer; "−3" is a puzzle.
 *
 * IN AND OUT ARE MARKED BY SIGN AND WORD, never by colour, and the sign is
 * `aria-hidden` with the direction spelled out — "minus three" read aloud is
 * fine, but a bare "3" in a red cell is silent.
 *
 * A TRANSFER SHOWS BOTH ENDS. Moving stock between two shops is one event, not
 * a matched pair of an out and an in, and splitting it makes reconciling two
 * locations a manual job.
 *
 * `<li>` composing into a ledger, with the quantity right-aligned and
 * `tabular-nums` so a column of movements can be scanned and added up.
 */
export function StockMove({ kind, quantity, unit, reason, by, at, from, to, className }: {
  kind: "in" | "out" | "transfer";
  /** Always positive — the sign comes from `kind`. */
  quantity: number;
  unit?: string;
  reason?: string;
  by?: string;
  /** ISO date-time. */
  at?: string;
  /** For transfers. */
  from?: string;
  to?: string;
  className?: string;
}) {
  const d = at ? toDate(at) : null;
  const ok = d && !Number.isNaN(d.getTime());
  const sign = kind === "in" ? "+" : kind === "out" ? "−" : "";
  const word = kind === "in" ? "In" : kind === "out" ? "Out" : "Moved";
  return (
    <li className={cn("flex items-start gap-3 px-3 py-2 text-sm", className)}>
      <span className="min-w-0 flex-1">
        <span className="block">
          {word}
          {kind === "transfer" && from && to && (
            <span className="text-muted-foreground"> {from} <span aria-hidden="true">→</span> {to}</span>
          )}
          {reason && <span className="text-muted-foreground"> · {reason}</span>}
        </span>
        <span className="block text-xs text-muted-foreground">
          {by}
          {by && ok ? " · " : ""}
          {ok && (
            <time dateTime={d!.toISOString()}>
              {d!.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </time>
          )}
        </span>
      </span>
      <span className="shrink-0 tabular-nums">
        <span aria-hidden="true">{sign}</span>
        <span className="sr-only">{kind === "out" ? "minus " : kind === "in" ? "plus " : ""}</span>
        {quantity.toLocaleString()}
        {unit && <span className="text-xs text-muted-foreground"> {unit}</span>}
      </span>
    </li>
  );
}
