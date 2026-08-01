import { cn } from "@/lib/utils";
/**
 * A concern raised — and nothing more than raised.
 *
 * RAISING IS NOT INVESTIGATING, AND THE COMPONENT REFUSES TO BLUR THEM. The
 * person who notices something is not the person who looks into it, and a form
 * that invites them to reach a conclusion produces both false reassurance and
 * contaminated accounts. The fields are: what was seen, when, and who has been
 * told.
 *
 * OBSERVATION AND OPINION ARE SEPARATE FIELDS. "Bruise on the left forearm,
 * roughly the size of a thumb" and "I think her son did it" are different kinds
 * of statement with different weight, and running them together is what makes a
 * record unusable later.
 *
 * THE PERSON'S OWN ACCOUNT IS QUOTED, NEVER PARAPHRASED. A summary of what
 * somebody said is the reporter's words, and the words are frequently the
 * evidence.
 *
 * IT WILL NOT SIT UNSENT. A concern with nobody notified is the failure mode
 * that every review finds, so an unsent note says so as its most prominent line.
 */
export function SafeguardingNote({ observed, whenSeen, theirWords, concern, raisedBy, notified, notifiedOn, className }: {
  /** What was actually seen or heard. Facts only. */
  observed: string;
  whenSeen?: string;
  /** Quoted, never paraphrased. */
  theirWords?: string;
  /** What the reporter thinks it might mean — kept separate. */
  concern?: string;
  raisedBy?: string;
  /** Who it has gone to. Empty is the failure this component shouts about. */
  notified?: string;
  notifiedOn?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      {!notified && (
        <p className="font-medium">Nobody has been told about this yet.</p>
      )}
      <div>
        <p className="text-xs font-medium text-muted-foreground">What was seen</p>
        <p>{observed}</p>
        {whenSeen && <p className="text-xs text-muted-foreground">{whenSeen}</p>}
      </div>
      {theirWords && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">What they said</p>
          <p className="italic">"{theirWords}"</p>
        </div>
      )}
      {concern && (
        <div>
          <p className="text-xs font-medium text-muted-foreground">What the reporter thinks — not a finding</p>
          <p className="text-xs">{concern}</p>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {[raisedBy && `Raised by ${raisedBy}`, notified ? `Passed to ${notified}` : "", notifiedOn]
          .filter(Boolean)
          .join(" · ")}
      </p>
      <p className="text-xs text-muted-foreground">
        Raising a concern is not investigating it. Do not ask further questions or repeat the account back.
      </p>
    </div>
  );
}
