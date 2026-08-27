import { useId } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
/**
 * Signing a guest into a members' club — with the rules that apply to the host.
 *
 * THE HOST'S REMAINING ALLOWANCE IS THE CONSTRAINT AND IS SHOWN BEFORE THE
 * FORM. Most clubs cap guests per member per period, and a member who signs in
 * four people and is told at the bar has embarrassed themselves in front of
 * their guests.
 *
 * THE HOST REMAINS RESPONSIBLE, and the component says so plainly. It is the
 * substance of the rule — for the bill, for conduct, for the guest being
 * accompanied — and it is invariably in a rulebook nobody has read.
 *
 * A PREVIOUSLY REFUSED GUEST IS FLAGGED TO STAFF, NOT TO THE MEMBER. That is a
 * matter for whoever runs the door, and surfacing it on a member-facing screen
 * is a scene in a lobby.
 *
 * IT ASKS FOR A NAME AND NOTHING ELSE. A guest book is not an opportunity to
 * collect addresses, and the extra fields clubs add are never used for anything.
 */
export function GuestSignIn({ hostName, guestName, onGuestNameChange, guestsUsed, guestsAllowed, periodLabel = "this month", staffFlag, className }: {
  hostName?: string;
  guestName: string;
  onGuestNameChange: (next: string) => void;
  guestsUsed?: number;
  guestsAllowed?: number;
  /** "this month", "today". */
  periodLabel?: string;
  /** Shown only where the caller has decided staff are the audience. */
  staffFlag?: string;
  className?: string;
}) {
  const id = useId();
  const left = guestsUsed !== undefined && guestsAllowed !== undefined ? guestsAllowed - guestsUsed : undefined;
  const none = left !== undefined && left <= 0;
  return (
    <div data-slot="guest-sign-in" className={cn("space-y-1", className)}>
      {left !== undefined && (
        <p className={cn("text-sm tabular-nums", none && "font-medium")}>
          {none
            ? `You have signed in all ${guestsAllowed} of your guests ${periodLabel}.`
            : `${left} of your ${guestsAllowed} guests left ${periodLabel}.`}
        </p>
      )}
      <label htmlFor={id} className="block text-sm font-medium">Guest's name</label>
      <Input id={id} value={guestName} autoComplete="off" disabled={none} onChange={(e) => onGuestNameChange(e.target.value)} />
      <p className="text-xs text-muted-foreground">
        {hostName ? `${hostName} remains` : "You remain"} responsible for your guest — for the bill, for their conduct, and for staying with them.
      </p>
      {staffFlag && <p className="text-xs font-medium">{staffFlag}</p>}
    </div>
  );
}
