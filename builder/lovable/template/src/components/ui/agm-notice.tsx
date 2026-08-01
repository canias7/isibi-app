import { cn } from "@/lib/utils";
/**
 * Notice of a general meeting — with the two things that make it valid.
 *
 * THE NOTICE PERIOD AND THE QUORUM ARE THE ONLY THINGS THAT DETERMINE WHETHER
 * DECISIONS TAKEN WILL STAND. Short notice or a meeting held under quorum makes
 * every resolution challengeable, and both are set out in a constitution
 * nobody reads until somebody objects.
 *
 * THE DEADLINE FOR MOTIONS AND NOMINATIONS IS BEFORE THE MEETING and is what
 * members actually need in advance. Publishing only the meeting date means
 * every proposal arrives too late to be put.
 *
 * WHETHER PROXIES ARE ALLOWED IS STATED, because members who cannot attend
 * assume their view cannot count, and in most constitutions it can.
 *
 * IT SAYS WHAT HAPPENS IF THE MEETING IS INQUORATE. Reconvening rules are
 * standard, unknown, and the difference between a wasted evening and a valid
 * decision.
 */
export function AgmNotice({ when, where, noticeGivenOn, noticeRequiredDays, quorum, membersEligible, motionsBy, nominationsBy, proxiesAllowed, ifInquorate, className }: {
  /** Free text — "Thursday 16 October, 19:30". */
  when: string;
  where?: string;
  /** Free text — when notice went out. */
  noticeGivenOn?: string;
  /** What the constitution requires. */
  noticeRequiredDays?: number;
  /** How many must attend for business to be valid. */
  quorum?: number;
  membersEligible?: number;
  /** Free text — deadline for motions. */
  motionsBy?: string;
  nominationsBy?: string;
  proxiesAllowed?: boolean;
  /** The reconvening rule. */
  ifInquorate?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className="font-medium">Annual general meeting</span>
        <span className="block">{when}</span>
        {where && <span className="block text-xs text-muted-foreground">{where}</span>}
      </p>
      {(noticeGivenOn || noticeRequiredDays !== undefined) && (
        <p className="text-xs text-muted-foreground">
          {noticeGivenOn && `Notice given ${noticeGivenOn}`}
          {noticeGivenOn && noticeRequiredDays !== undefined ? " · " : ""}
          {noticeRequiredDays !== undefined && `${noticeRequiredDays} days' notice required`}
        </p>
      )}
      {quorum !== undefined && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {quorum} members must attend for decisions to stand
          {membersEligible !== undefined && ` — ${membersEligible} are eligible`}
        </p>
      )}
      {(motionsBy || nominationsBy) && (
        <p className="text-xs font-medium">
          {motionsBy && `Motions by ${motionsBy}`}
          {motionsBy && nominationsBy ? " · " : ""}
          {nominationsBy && `nominations by ${nominationsBy}`}
        </p>
      )}
      {proxiesAllowed !== undefined && (
        <p className="text-xs">
          {proxiesAllowed
            ? "If you cannot come, you can appoint somebody to vote for you."
            : "Votes must be cast in person — proxies are not allowed."}
        </p>
      )}
      {ifInquorate && <p className="text-xs text-muted-foreground">{ifInquorate}</p>}
    </div>
  );
}
