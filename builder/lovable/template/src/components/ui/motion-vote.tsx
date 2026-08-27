import { cn } from "@/lib/utils";
/**
 * A motion and its result — with the threshold it had to clear.
 *
 * THE THRESHOLD IS STATED BEFORE THE RESULT. An ordinary resolution needs a
 * simple majority and a special one usually two thirds, and a motion reported
 * as "carried, 58%" without it is either a pass or a fail depending on a fact
 * the reader does not have.
 *
 * ABSTENTIONS ARE COUNTED SEPARATELY AND USUALLY DO NOT COUNT TOWARDS THE
 * TOTAL. Whether they do is constitutional, and folding them into "against" is
 * how a carried motion is recorded as lost.
 *
 * THE TURNOUT IS SHOWN. A motion carried by nine votes in a club of four
 * hundred is a decision somebody will reopen, and the number is the honest
 * context for it.
 *
 * THE FULL WORDING IS KEPT. Minutes summarising a motion into a phrase produce
 * an argument a year later about what was actually agreed.
 */
export function MotionVote({ number, wording, proposedBy, secondedBy, forVotes, againstVotes, abstentions = 0, thresholdLabel = "a simple majority", thresholdFraction = 0.5, abstentionsCount = false, eligible, className }: {
  number?: string | number;
  /** The exact wording put to the meeting. */
  wording: string;
  proposedBy?: string;
  secondedBy?: string;
  forVotes: number;
  againstVotes: number;
  abstentions?: number;
  /** "a simple majority", "two thirds". */
  thresholdLabel?: string;
  /** The fraction of counted votes needed. */
  thresholdFraction?: number;
  /** Whether abstentions count towards the total. */
  abstentionsCount?: boolean;
  /** Members entitled to vote. */
  eligible?: number;
  className?: string;
}) {
  const counted = forVotes + againstVotes + (abstentionsCount ? abstentions : 0);
  const share = counted > 0 ? forVotes / counted : 0;
  // EXACTLY on the threshold is its own answer. 38 of 57 is precisely two
  // thirds, and whether that carries depends on whether the constitution says
  // "two thirds" or "more than two thirds" — reporting a flat "not carried"
  // hides a genuine ambiguity, which is what a club then argues about.
  const exact = counted > 0 && Math.abs(share - thresholdFraction) < 1e-9;
  const carried = share > thresholdFraction;
  const cast = forVotes + againstVotes + abstentions;
  return (
    <div data-slot="motion-vote" className={cn("space-y-0.5 text-sm", className)}>
      {number !== undefined && <p className="text-xs text-muted-foreground">Motion {number}</p>}
      <p>{wording}</p>
      {(proposedBy || secondedBy) && (
        <p className="text-xs text-muted-foreground">
          {proposedBy && `Proposed by ${proposedBy}`}
          {proposedBy && secondedBy ? ", " : ""}
          {secondedBy && `seconded by ${secondedBy}`}
        </p>
      )}
      <p className="text-xs tabular-nums text-muted-foreground">
        {forVotes} for · {againstVotes} against · {abstentions} abstained
        {!abstentionsCount && abstentions > 0 && " (abstentions do not count towards the total)"}
      </p>
      <p className="font-medium tabular-nums">
        {exact ? "Exactly on the threshold" : carried ? "Carried" : "Not carried"} — {forVotes} of {counted}, needing {thresholdLabel}.
      </p>
      {exact && (
        <p className="text-xs font-medium">
          This is precisely {thresholdLabel}. Whether that carries depends on whether the constitution
          says {thresholdLabel} or more than {thresholdLabel} — check it before recording a result.
        </p>
      )}
      {eligible !== undefined && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {cast} of {eligible} eligible members voted.
        </p>
      )}
    </div>
  );
}
