import { cn } from "@/lib/utils";
/**
 * One match — with the things that stop people turning up to the wrong place.
 *
 * HOME AND AWAY ARE STRUCTURAL, NOT A STRING. "Rovers v United" hides which
 * ground it is at, and a reversed fixture reads identically. The component
 * takes them separately and names the venue, because half a league's Saturday
 * problems are people at the wrong pitch.
 *
 * KICK-OFF IS A TIME AND MEET-UP IS A DIFFERENT TIME. Players need the second
 * and it is the one nobody publishes, so an hour before kick-off twenty people
 * ask the same question in a group chat.
 *
 * A RESULT REPLACES THE TIME, and the fixture stays in the list. Removing
 * played fixtures makes a season impossible to read backwards, which is what
 * anybody checking a table wants to do.
 *
 * THE COMPETITION IS NAMED. Clubs run league, cup and friendly fixtures in one
 * calendar, and they have different squads, different rules and different
 * consequences for losing.
 */
export function FixtureRow({ home, away, competition, venue, kickOff, meetAt, homeScore, awayScore, played, postponed, className }: {
  home: string;
  away: string;
  competition?: string;
  venue?: string;
  /** Free text — "Saturday 16 August, 15:00". */
  kickOff?: string;
  /** When players are expected, which is not kick-off. */
  meetAt?: string;
  homeScore?: number;
  awayScore?: number;
  played?: boolean;
  postponed?: boolean;
  className?: string;
}) {
  const hasScore = homeScore !== undefined && awayScore !== undefined;
  return (
    <li className={cn("space-y-0.5 px-3 py-2 text-sm", className)}>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="min-w-0 flex-1">
          {home} <span className="text-muted-foreground">v</span> {away}
        </span>
        <span className={cn("shrink-0 tabular-nums", hasScore && "font-medium")}>
          {postponed ? "Postponed" : hasScore ? `${homeScore}–${awayScore}` : kickOff ?? "Date to be fixed"}
        </span>
      </p>
      <p className="text-xs text-muted-foreground">
        {competition && `${competition} · `}
        {venue ? `at ${venue}` : `${home} at home`}
      </p>
      {!played && !postponed && meetAt && (
        <p className="text-xs">Players meet at {meetAt}.</p>
      )}
    </li>
  );
}
