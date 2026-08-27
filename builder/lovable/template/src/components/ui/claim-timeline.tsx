import { cn } from "@/lib/utils";
/**
 * What has happened on a claim, in order — including the waiting.
 *
 * THE GAPS ARE SHOWN, NOT JUST THE EVENTS. A timeline of six entries over four
 * months looks like progress; the same timeline showing a 41-day gap with
 * nothing in it is the truth, and it is what a complaint is built from — by
 * either side.
 *
 * WHO ACTED IS RECORDED ON EVERY ENTRY. "Documents requested" with no actor is
 * how a claimant and an insurer each believe the other has the ball.
 *
 * AN OUTSTANDING ACTION SITS AT THE END AS AN OPEN ITEM, not as a completed
 * event. A timeline that ends with "assessor instructed" reads as done; ending
 * with "waiting for the assessor's report since 14 July" reads as what it is.
 *
 * ENTRIES ARE NOT REWRITTEN. A correction is a new entry, because a claim
 * record that changes retrospectively is worthless in any dispute about it.
 */
export type ClaimEvent = {
  id: string;
  /** Free text — "14 July". */
  on: string;
  what: string;
  by?: "you" | "us" | "third-party";
  /** Days since the previous entry, where the caller has computed it. */
  gapDays?: number;
};

export function ClaimTimeline({ events, openItem, openSince, className }: {
  events: ClaimEvent[];
  /** What is outstanding right now. */
  openItem?: string;
  openSince?: string;
  className?: string;
}) {
  const WHO = { you: "you", us: "us", "third-party": "a third party" };
  return (
    <div data-slot="claim-timeline" className={cn("space-y-1", className)}>
      <ol className="space-y-1 text-sm">
        {events.map((e) => (
          <li key={e.id} className="space-y-0.5">
            {e.gapDays !== undefined && e.gapDays >= 14 && (
              <p className="text-xs font-medium tabular-nums">
                {e.gapDays} {e.gapDays === 1 ? "day" : "days"} with nothing recorded
              </p>
            )}
            <p className="flex gap-3">
              <span className="w-20 shrink-0 text-xs tabular-nums text-muted-foreground">{e.on}</span>
              <span className="min-w-0 flex-1">
                {e.what}
                {e.by && <span className="text-xs text-muted-foreground"> · by {WHO[e.by]}</span>}
              </span>
            </p>
          </li>
        ))}
      </ol>
      {openItem && (
        <p className="text-sm font-medium">
          Outstanding: {openItem}
          {openSince && <span className="font-normal text-muted-foreground"> — since {openSince}</span>}
        </p>
      )}
    </div>
  );
}
