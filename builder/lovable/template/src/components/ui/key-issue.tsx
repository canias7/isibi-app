import { cn } from "@/lib/utils";
/**
 * A physical key signed out — and whether it came back.
 *
 * A KEY NOT RETURNED IS THE WHOLE REASON THIS EXISTS. Keys cannot be revoked
 * remotely, so an outstanding one is a permanent hole until the lock is
 * changed, and the register is the only thing that knows.
 *
 * THE COST OF NOT GETTING IT BACK IS SHOWN WHERE THE KEY IS RESTRICTED. A
 * master that suites forty doors means re-suiting the building, which is a
 * five-figure decision that ought to be visible when somebody signs it out
 * rather than when they lose it.
 *
 * WHO HOLDS IT NOW IS THE QUESTION, AND A CHAIN OF HANDOVERS ANSWERS IT WRONGLY.
 * Keys get passed on informally, so the register records the person who signed
 * for it and states that a key passed to somebody else is still theirs.
 *
 * DUE-BACK IS A TIME, NOT A DAY, for anything issued within a shift — a key due
 * back "today" is unreconcilable at 23:00.
 */
export function KeyIssue({ keyName, suitesDoors, holder, issuedAt, dueBack, returnedAt, restricted, replacementCostNote, className }: {
  keyName: string;
  /** How many doors it opens. */
  suitesDoors?: number;
  holder?: string;
  /** Free text — "14 July, 08:10". */
  issuedAt?: string;
  dueBack?: string;
  returnedAt?: string;
  /** True where copies are controlled. */
  restricted?: boolean;
  /** What losing it costs. */
  replacementCostNote?: string;
  className?: string;
}) {
  const out = !returnedAt;
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">
          {keyName}
          {suitesDoors !== undefined && (
            <span className="text-muted-foreground"> · opens {suitesDoors} {suitesDoors === 1 ? "door" : "doors"}</span>
          )}
        </span>
        <span className={cn("shrink-0 text-xs", out ? "font-medium" : "text-muted-foreground")}>
          {out ? "Out" : "Returned"}
        </span>
      </p>
      <p className="text-xs tabular-nums text-muted-foreground">
        {holder ? `Signed for by ${holder}` : "Nobody signed for it"}
        {issuedAt && ` · ${issuedAt}`}
        {returnedAt && ` · back ${returnedAt}`}
      </p>
      {out && dueBack && <p className="text-xs">Due back {dueBack}.</p>}
      {out && holder && (
        <p className="text-xs text-muted-foreground">
          It remains {holder}'s responsibility even if they have passed it to somebody else.
        </p>
      )}
      {out && restricted && (
        <p className="text-xs font-medium">
          Restricted key — it cannot be cancelled remotely.
          {replacementCostNote ? ` ${replacementCostNote}` : ""}
        </p>
      )}
    </li>
  );
}
