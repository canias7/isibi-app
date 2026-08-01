import { cn } from "@/lib/utils";
/**
 * A change during a match — counted against the allowance.
 *
 * SUBSTITUTIONS AND WINDOWS ARE COUNTED SEPARATELY, and this catches out real
 * teams. Many competitions allow five changes but only three stoppages to make
 * them in, so a manager with two substitutions left can have no opportunities
 * left, and only one of those numbers is ever displayed.
 *
 * A CONCUSSION SUBSTITUTION IS USUALLY ADDITIONAL and is marked. Treating it as
 * an ordinary change discourages taking a player off, which is the exact
 * behaviour those rules exist to remove.
 *
 * BOTH PLAYERS ARE NAMED because a record showing only who came on cannot
 * reconstruct who was on the pitch, which is what a disciplinary or an
 * eligibility query needs.
 *
 * THE MINUTE IS THE MATCH MINUTE, free text, because stoppage time is "45+2"
 * and forcing a number loses it.
 */
export function SubstitutionRow({ off, on, minute, used, allowed, windowsUsed, windowsAllowed, concussion, className }: {
  off: string;
  on: string;
  /** Free text — "45+2". */
  minute?: string;
  /** Ordinary substitutions used, including this one. */
  used?: number;
  allowed?: number;
  /** Stoppages used to make them. */
  windowsUsed?: number;
  windowsAllowed?: number;
  /** Usually additional to the allowance. */
  concussion?: boolean;
  className?: string;
}) {
  const subsLeft = used !== undefined && allowed !== undefined ? allowed - used : undefined;
  const windowsLeft = windowsUsed !== undefined && windowsAllowed !== undefined ? windowsAllowed - windowsUsed : undefined;
  const stuck = subsLeft !== undefined && subsLeft > 0 && windowsLeft === 0;
  return (
    <li className={cn("space-y-0.5 px-3 py-1.5 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        {minute && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{minute}</span>}
        <span className="min-w-0 flex-1">
          {on} <span className="text-muted-foreground">for</span> {off}
        </span>
        {concussion && <span className="shrink-0 text-xs">Concussion</span>}
      </p>
      {(subsLeft !== undefined || windowsLeft !== undefined) && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {subsLeft !== undefined && `${subsLeft} ${subsLeft === 1 ? "change" : "changes"} left`}
          {subsLeft !== undefined && windowsLeft !== undefined ? " · " : ""}
          {windowsLeft !== undefined && `${windowsLeft} ${windowsLeft === 1 ? "stoppage" : "stoppages"} left`}
        </p>
      )}
      {concussion && (
        <p className="text-xs text-muted-foreground">Additional to the allowance under most competition rules.</p>
      )}
      {stuck && (
        <p className="text-xs font-medium">
          Changes left but no stoppages left — any further change must wait for half time.
        </p>
      )}
    </li>
  );
}
