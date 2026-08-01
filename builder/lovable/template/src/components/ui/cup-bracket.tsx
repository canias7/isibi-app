import { cn } from "@/lib/utils";
/**
 * A knockout draw — as rounds of ties, not a drawn tree.
 *
 * IT IS A LIST OF ROUNDS, DELIBERATELY. A bracket drawn with connecting lines
 * is unreadable on a phone, unreadable in print past sixteen teams, and
 * completely opaque to a screen reader — and the information is simply "who
 * plays whom, and who went through".
 *
 * A BYE IS SHOWN AS A BYE. Rendering it as a tie against nobody makes a round
 * look wrong, and byes are the ordinary case in any draw that is not a power of
 * two.
 *
 * A TIE STILL TO BE PLAYED SHOWS ITS DATE, because a bracket is mostly consulted
 * by people asking when their next match is rather than admiring the shape of
 * the competition.
 *
 * THE WINNER IS MARKED IN TEXT, not by position or weight alone — "went
 * through" survives greyscale, print and a screen reader in a way that bold
 * does not.
 */
export type Tie = {
  id: string;
  home: string;
  /** Undefined for a bye. */
  away?: string;
  score?: string;
  /** Which side went through. */
  winner?: "home" | "away";
  when?: string;
};

export type BracketRound = { id: string; name: string; ties: Tie[] };

export function CupBracket({ rounds, className }: { rounds: BracketRound[]; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {rounds.map((r) => (
        <div key={r.id} className="space-y-0.5">
          <p className="text-xs font-medium">{r.name}</p>
          <ul className="divide-y divide-border rounded-md border border-border text-sm">
            {r.ties.map((t) => (
              <li key={t.id} className="space-y-0.5 px-3 py-1.5">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="min-w-0 flex-1">
                    {t.away ? (
                      <>
                        <span className={cn(t.winner === "home" && "font-medium")}>{t.home}</span>
                        <span className="text-muted-foreground"> v </span>
                        <span className={cn(t.winner === "away" && "font-medium")}>{t.away}</span>
                      </>
                    ) : (
                      <span className="font-medium">{t.home}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {!t.away ? "Bye" : t.score ?? t.when ?? "To be played"}
                  </span>
                </p>
                {t.winner && t.away && (
                  <p className="text-xs text-muted-foreground">
                    {t.winner === "home" ? t.home : t.away} went through.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
