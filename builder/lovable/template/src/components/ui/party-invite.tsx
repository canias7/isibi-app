import { cn } from "@/lib/utils";
/**
 * An invitation to join — with the reason it might not work.
 *
 * A REGION OR VERSION MISMATCH IS CHECKED BEFORE ACCEPTING. Two people on
 * different regions or patch versions cannot play together, they both accept
 * anyway, and the failure appears as a vague error twenty seconds later.
 * Naming it up front is the whole value.
 *
 * INVITES EXPIRE AND THE COMPONENT SAYS WHEN. A list of stale invitations makes
 * a player look ignored and makes the sender look ignored too — and neither is
 * true.
 *
 * BLOCKING IS OFFERED HERE. Unwanted invitations are the most common form of
 * harassment in any game with a friends list, and the moment somebody wants to
 * block is the moment they receive one — not in a settings menu.
 *
 * DECLINING IS SILENT. A "declined" notification is an invitation to argue, and
 * it is why people leave invitations unanswered instead.
 */
export function PartyInvite({ from, mode, partySize, partyLimit, expiresIn, regionMismatch, versionMismatch, onAccept, onDecline, onBlock, className }: {
  from: string;
  mode?: string;
  partySize?: number;
  partyLimit?: number;
  /** Free text — "4 minutes". */
  expiresIn?: string;
  /** True where you are on different regions. */
  regionMismatch?: boolean;
  /** True where your game versions differ. */
  versionMismatch?: boolean;
  onAccept?: () => void;
  onDecline?: () => void;
  onBlock?: () => void;
  className?: string;
}) {
  const blocked = regionMismatch || versionMismatch;
  const full = partySize !== undefined && partyLimit !== undefined && partySize >= partyLimit;
  return (
    <div data-slot="party-invite" className={cn("space-y-1 text-sm", className)}>
      <p>
        <span className="font-medium">{from}</span> wants you to join
        {mode ? ` a ${mode}` : " their party"}.
        {partySize !== undefined && partyLimit !== undefined && (
          <span className="block text-xs tabular-nums text-muted-foreground">
            {partySize} of {partyLimit} in the party
          </span>
        )}
      </p>
      {regionMismatch && (
        <p className="text-xs font-medium">You are on different regions — this will not connect.</p>
      )}
      {versionMismatch && (
        <p className="text-xs font-medium">Your game versions differ. One of you needs to update first.</p>
      )}
      {full && !blocked && <p className="text-xs font-medium">The party is already full.</p>}
      {expiresIn && !blocked && (
        <p className="text-xs text-muted-foreground">This expires in {expiresIn}.</p>
      )}
      <div className="flex flex-wrap gap-2 pt-0.5">
        <button
          type="button"
          disabled={blocked || full}
          onClick={onAccept}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          Join
        </button>
        <button type="button" onClick={onDecline} className="rounded-md px-3 py-1.5 text-sm underline underline-offset-2">
          No thanks
        </button>
        {onBlock && (
          <button type="button" onClick={onBlock} className="rounded-md px-3 py-1.5 text-sm underline underline-offset-2">
            Block {from}
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{from} is not told if you decline.</p>
    </div>
  );
}
