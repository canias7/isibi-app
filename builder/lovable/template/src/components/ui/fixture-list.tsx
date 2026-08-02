import { cn } from "@/lib/utils";
/**
 * Next fixture and last result, as one block. For a club this is the news.
 *
 * HOME AND AWAY WITHOUT COLOUR. "H" and "A" are set as letters at the same
 * weight everything else is — a green pill and a grey one are one pill in
 * greyscale, in print, and to a chunk of the people reading a fixture list on a
 * phone in the sun.
 *
 * A RESULT SAYS WON, DREW OR LOST IN WORDS as well as in the score. The score
 * alone requires the reader to know which side is theirs, and on a club site
 * with four teams that is not a safe assumption.
 *
 * POSTPONED IS A FIRST-CLASS STATE, not an absence. A fixture that has been
 * called off must still appear — a supporter who drives to a called-off match
 * because the site quietly dropped the row is the exact failure this replaces.
 */
export type Fixture = {
  opponent: string;
  /** Already formatted: "Sat 9 Aug, 15:00". The club knows its own conventions. */
  when: string;
  home?: boolean;
  competition?: string | null;
  venue?: string | null;
  /** Present means it has been played. */
  score?: { us: number; them: number } | null;
  postponed?: boolean;
};
const outcome = (s: { us: number; them: number }) =>
  s.us > s.them ? "Won" : s.us < s.them ? "Lost" : "Drew";
export function FixtureList({ fixtures, heading, teamName = "us", className }: {
  fixtures: Fixture[];
  heading?: string;
  /** Used in the "Won 3–1" line so a four-team club stays unambiguous. */
  teamName?: string;
  className?: string;
}) {
  if (!fixtures.length) return null;
  return (
    <div className={cn("", className)}>
      {heading && <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{heading}</p>}
      <ul className={cn("divide-y divide-border border-y border-border", heading && "mt-3")}>
        {fixtures.map((f, i) => (
          <li key={`${f.opponent}-${f.when}-${i}`} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3.5">
            <span className="w-6 shrink-0 text-sm font-medium" aria-hidden="true">{f.home ? "H" : "A"}</span>
            <span className="sr-only">{f.home ? "Home" : "Away"}</span>
            <span className="min-w-0 flex-1">
              <span className={cn("text-sm font-medium", f.postponed && "line-through")}>{f.opponent}</span>
              <span className="block text-sm text-muted-foreground">
                {f.when}
                {f.competition && <> · {f.competition}</>}
                {f.venue && <> · {f.venue}</>}
              </span>
            </span>
            {f.postponed ? (
              <span className="shrink-0 text-sm font-medium">Postponed</span>
            ) : f.score ? (
              <span className="shrink-0 text-sm tabular-nums">
                <span className="font-medium">{outcome(f.score)}</span>{" "}
                {f.score.us}–{f.score.them}
                <span className="sr-only"> — {teamName} {f.score.us}, {f.opponent} {f.score.them}</span>
              </span>
            ) : (
              <span className="shrink-0 text-sm text-muted-foreground">To play</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
