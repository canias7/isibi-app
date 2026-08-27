import { cn } from "@/lib/utils";
/**
 * Container charges accruing daily — with the date they start biting.
 *
 * IT COUNTS DOWN TO THE FIRST CHARGEABLE DAY. Free days run from arrival and
 * nobody notices them passing; by the time an invoice appears the container has
 * been sitting for a fortnight. The date is what prompts action while action is
 * still free.
 *
 * DEMURRAGE AND DETENTION ARE DIFFERENT AND BOTH ARE SHOWN. One is the box
 * sitting in the terminal, the other is the box off-terminal and not yet
 * returned — different free periods, different rates, and frequently both
 * running at once on the same container.
 *
 * THE RATE ESCALATES AND THE COMPONENT SAYS SO. These charges commonly step up
 * after a few days, so a linear projection understates the position — and the
 * step is what makes clearing it urgent rather than merely desirable.
 *
 * THE RUNNING TOTAL IS SHOWN, because the number is what gets somebody to
 * authorise the haulage that clears it.
 */
export function DemurrageNote({ container, kind = "demurrage", freeUntil, daysCharged, currentRate, nextRate, nextRateFrom, accrued, className }: {
  container?: string;
  kind?: "demurrage" | "detention";
  /** Free text — "14 August". */
  freeUntil?: string;
  /** Days already chargeable. */
  daysCharged?: number;
  /** Pre-formatted — "£85 a day". */
  currentRate?: string;
  /** What it goes up to. */
  nextRate?: string;
  /** Free text — when the higher rate starts. */
  nextRateFrom?: string;
  /** Pre-formatted running total. */
  accrued?: string;
  className?: string;
}) {
  const charging = (daysCharged ?? 0) > 0;
  const WORD = kind === "demurrage" ? "sitting in the terminal" : "not yet returned";
  return (
    <div data-slot="demurrage-note" className={cn("space-y-0.5 text-sm", className)}>
      <p>
        {container && <code className="font-mono text-xs">{container}</code>}
        <span className={cn("block", charging && "font-medium")}>
          {charging
            ? <>{daysCharged} chargeable {daysCharged === 1 ? "day" : "days"} — {WORD}</>
            : <>Free until {freeUntil ?? "an unstated date"}</>}
        </span>
      </p>
      {(currentRate || accrued) && (
        <p className="text-xs text-muted-foreground">
          {currentRate && <span>{currentRate}</span>}
          {currentRate && accrued ? " · " : ""}
          {accrued && <span className="tabular-nums">{accrued} so far</span>}
        </p>
      )}
      {nextRate && (
        <p className="text-xs font-medium">
          Goes up to {nextRate}{nextRateFrom ? ` from ${nextRateFrom}` : ""}.
        </p>
      )}
    </div>
  );
}
