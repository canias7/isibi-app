import { useId } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
/**
 * Reporting a result — with the confirmation step that stops disputes.
 *
 * A RESULT ENTERED BY ONE SIDE IS PROVISIONAL UNTIL THE OTHER AGREES. Scores
 * are entered by whoever remembers, from memory, hours later, and a table built
 * on unconfirmed entries produces an argument in week nine that nobody can
 * settle. The two-sided state is the whole design.
 *
 * IT SAYS WHICH TEAM EACH BOX IS FOR, in words, next to the box. "3 – 1" with
 * the teams above is entered the wrong way round constantly, and a reversed
 * result is the single most common correction any league secretary makes.
 *
 * A WALKOVER IS NOT A SCORE. It is a separate outcome with its own points
 * consequence, and forcing it into a scoreline invents goals that were never
 * scored and pollutes goal difference.
 *
 * `inputMode="numeric"` — this is filled in on a phone at the side of a pitch.
 */
export function ScoreEntry({ home, away, homeScore, awayScore, onHomeScore, onAwayScore, enteredBy, confirmedBy, walkover, className }: {
  home: string;
  away: string;
  homeScore: string;
  awayScore: string;
  onHomeScore: (next: string) => void;
  onAwayScore: (next: string) => void;
  /** Who reported it. */
  enteredBy?: string;
  /** Who agreed it — undefined means provisional. */
  confirmedBy?: string;
  /** Set where the match was not played out. */
  walkover?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("space-y-1.5", className)}>
      {walkover ? (
        <p className="text-sm">
          <span className="font-medium">Walkover</span>
          <span className="block text-xs text-muted-foreground">{walkover}</span>
        </p>
      ) : (
        <div className="flex flex-wrap gap-3">
          <div className="space-y-1">
            <label htmlFor={`${id}-h`} className="block text-xs font-medium">{home} scored</label>
            <Input id={`${id}-h`} value={homeScore} inputMode="numeric" className="w-20" onChange={(e) => onHomeScore(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label htmlFor={`${id}-a`} className="block text-xs font-medium">{away} scored</label>
            <Input id={`${id}-a`} value={awayScore} inputMode="numeric" className="w-20" onChange={(e) => onAwayScore(e.target.value)} />
          </div>
        </div>
      )}
      <p className={cn("text-xs", confirmedBy ? "text-muted-foreground" : "font-medium")}>
        {confirmedBy
          ? `Agreed by ${confirmedBy}.`
          : enteredBy
            ? `Reported by ${enteredBy} — provisional until the other side agrees.`
            : "Not yet reported."}
      </p>
    </div>
  );
}
