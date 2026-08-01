import { cn } from "@/lib/utils";
/**
 * One take — with why it was kept, which nobody writes down.
 *
 * THE NOTE IS THE VALUE. Twelve takes of the same part are indistinguishable a
 * week later, and "best chorus, first verse flat" is what makes a comp possible
 * at all. A list of numbered takes with no notes is a list nobody will ever
 * play through again.
 *
 * PARTIAL TAKES ARE MARKED WITH THEIR RANGE. Most takes after the first few are
 * punch-ins covering a few bars, and treating them as full takes makes the list
 * unreadable and the good bars unfindable.
 *
 * A KEEPER IS FLAGGED, and more than one keeper is normal — comping is the
 * point. A single "best take" field forces a decision the session does not need
 * to make yet.
 *
 * THE PERFORMER IS NAMED because sessions have more than one, and a take list
 * without it cannot answer whose part is being reviewed.
 */
export function TakeRow({ number, part, performer, seconds, keeper, partial, note, className }: {
  number: number;
  /** "Lead vocal", "Guitar solo". */
  part?: string;
  performer?: string;
  seconds?: number;
  /** Marked to use, possibly alongside others. */
  keeper?: boolean;
  /** "Bars 33 to 48" — a punch-in rather than a full pass. */
  partial?: string;
  note?: string;
  className?: string;
}) {
  const mmss = seconds !== undefined
    ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
    : undefined;
  return (
    <li className={cn("space-y-0.5 px-3 py-1.5 text-sm", className)}>
      <p className="flex items-baseline gap-3">
        <span className="w-10 shrink-0 text-xs tabular-nums text-muted-foreground">Take {number}</span>
        <span className={cn("min-w-0 flex-1", keeper && "font-medium")}>
          {part ?? "Untitled part"}
          {performer && <span className="font-normal text-muted-foreground"> · {performer}</span>}
        </span>
        {partial && <span className="shrink-0 text-xs text-muted-foreground">{partial}</span>}
        {/* Fixed width so the duration stays in one column whether or not a
            partial range sits beside it — a length that moves between rows
            cannot be scanned down. */}
        <span className="w-12 shrink-0 text-right tabular-nums text-muted-foreground">{mmss ?? ""}</span>
      </p>
      <p className={cn("pl-12 text-xs", note ? "" : "text-muted-foreground")}>
        {note ?? "No note — this take will be indistinguishable from the others by next week."}
      </p>
      {keeper && <p className="pl-12 text-xs text-muted-foreground">Marked to use.</p>}
    </li>
  );
}
