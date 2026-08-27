import { cn } from "@/lib/utils";
/**
 * A club event — with whether it is on, and who has said they are coming.
 *
 * A MINIMUM NUMBER IS THE REASON CLUB EVENTS ARE CANCELLED, and showing it
 * turns a passive list into a reason to reply. "Four more and this goes ahead"
 * fills events that would otherwise fall over.
 *
 * A DEADLINE TO COMMIT IS SHOWN because a coach, a table booking or a green fee
 * has to be confirmed in advance, and the organiser is guessing until people
 * answer.
 *
 * IT DISTINGUISHES MEMBERS FROM GUESTS in the count, since most club events cap
 * guests separately and an organiser looking at one total cannot tell whether
 * they are within it.
 *
 * NO REPLY IS SHOWN AS ITS OWN NUMBER. It is usually the largest of the three
 * and it is the only one an organiser can act on — a chase is aimed at people
 * who have not answered, not at people who declined.
 */
export function ClubFixture({ title, when, where, memberYes = 0, guestYes = 0, noReply = 0, minimum, replyBy, cancelled, costNote, className }: {
  title: string;
  /** Free text — "Saturday 16 August, 14:00". */
  when?: string;
  where?: string;
  memberYes?: number;
  guestYes?: number;
  /** People who have not answered. */
  noReply?: number;
  /** Below this the event does not run. */
  minimum?: number;
  /** Free text — deadline to commit. */
  replyBy?: string;
  cancelled?: boolean;
  costNote?: string;
  className?: string;
}) {
  const going = memberYes + guestYes;
  const short = minimum !== undefined ? minimum - going : undefined;
  return (
    <div data-slot="club-fixture" className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className={cn("font-medium", cancelled && "line-through")}>{title}</span>
        {when && <span className="block text-xs text-muted-foreground">{when}</span>}
        {where && <span className="block text-xs text-muted-foreground">{where}</span>}
      </p>
      {cancelled ? (
        <p className="text-xs font-medium">Cancelled.</p>
      ) : (
        <>
          <p className="text-xs tabular-nums text-muted-foreground">
            {memberYes} {memberYes === 1 ? "member" : "members"} coming
            {guestYes > 0 && ` · ${guestYes} ${guestYes === 1 ? "guest" : "guests"}`}
            {noReply > 0 && ` · ${noReply} not replied`}
          </p>
          {short !== undefined && short > 0 && (
            <p className="text-xs font-medium tabular-nums">
              {short} more and this goes ahead. Below {minimum} it does not run.
            </p>
          )}
          {short !== undefined && short <= 0 && (
            <p className="text-xs text-muted-foreground">Enough people — this is going ahead.</p>
          )}
          {replyBy && <p className="text-xs">Please say by {replyBy}.</p>}
        </>
      )}
      {costNote && <p className="text-xs text-muted-foreground">{costNote}</p>}
    </div>
  );
}
