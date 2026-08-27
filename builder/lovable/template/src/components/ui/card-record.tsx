import { cn } from "@/lib/utils";
/**
 * A booking or a dismissal — with the suspension it triggers.
 *
 * THE ACCUMULATION IS THE POINT. Nobody tracks their own bookings, and the
 * useful moment is "one more and you miss the cup tie" rather than the letter
 * that arrives afterwards. The threshold is per competition and is supplied.
 *
 * TWO YELLOWS AND A STRAIGHT RED ARE DIFFERENT OFFENCES with different bans,
 * and recording both as "sent off" gets the suspension length wrong in the
 * direction that gets appealed.
 *
 * WHICH MATCHES A SUSPENSION COVERS IS NAMED, not just a count. Bans apply to
 * particular competitions, and a player serving a league ban is often available
 * for a cup tie two days later — which nobody believes without it in writing.
 *
 * SEVERITY IS CARRIED BY THE WORD, never by colour alone. A card record printed
 * in black and white must still say which was which, and "yellow" and "red" are
 * the words the sport itself uses.
 */
export type CardKind = "yellow" | "second-yellow" | "red";

const WORDS: Record<CardKind, string> = {
  yellow: "Yellow card",
  "second-yellow": "Sent off — two yellows",
  red: "Sent off — straight red",
};

export function CardRecord({ player, kind, minute, offence, fixture, totalYellows, suspensionAt, suspensionMatches = [], className }: {
  player: string;
  kind: CardKind;
  /** Free text — "68". */
  minute?: string;
  offence?: string;
  fixture?: string;
  /** Yellows accumulated in this competition. */
  totalYellows?: number;
  /** How many trigger a ban. */
  suspensionAt?: number;
  /** Which matches the ban covers. */
  suspensionMatches?: string[];
  className?: string;
}) {
  const away = totalYellows !== undefined && suspensionAt !== undefined ? suspensionAt - totalYellows : undefined;
  return (
    <li data-slot="card-record" className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">
          {player}
          {fixture && <span className="block text-xs text-muted-foreground">{fixture}</span>}
        </span>
        <span className={cn("shrink-0 text-xs", kind !== "yellow" && "font-medium")}>
          {WORDS[kind]}
          {minute && <span className="font-normal text-muted-foreground"> · {minute}</span>}
        </span>
      </p>
      {offence && <p className="text-xs text-muted-foreground">{offence}</p>}
      {away !== undefined && kind === "yellow" && (
        <p className={cn("text-xs tabular-nums", away <= 1 ? "font-medium" : "text-muted-foreground")}>
          {away <= 0
            ? `${totalYellows} yellows — a suspension is due.`
            : away === 1
              ? "One more booking and they are suspended."
              : `${totalYellows} of ${suspensionAt} bookings before a suspension.`}
        </p>
      )}
      {suspensionMatches.length > 0 && (
        <p className="text-xs">
          Misses {suspensionMatches.join(", ")}. Available for anything not listed.
        </p>
      )}
    </li>
  );
}
