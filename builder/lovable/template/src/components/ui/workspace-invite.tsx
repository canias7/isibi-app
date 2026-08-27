import { useState , useId } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * Inviting somebody into a workspace, with the cost and the role stated.
 *
 * IT SAYS WHETHER THIS ADDS TO THE BILL, before the invite is sent. Seat-based
 * pricing means an invite is a purchase, and finding that out from an invoice
 * is the complaint every seat-priced product gets. When seats are free it says
 * that too, which is equally worth knowing.
 *
 * THE ROLE IS CHOSEN AT INVITE TIME AND EACH ONE SAYS WHAT IT CAN DO. Inviting
 * everybody as an administrator because the roles were unexplained is how a
 * workspace ends up with nine owners.
 *
 * THE DOMAIN IS CHECKED AGAINST THE WORKSPACE'S OWN. Inviting a personal
 * address into a company workspace is sometimes right and usually a typo, and
 * a note beats a block — the same reasoning as the signup domain allow-list.
 *
 * MULTIPLE ADDRESSES AT ONCE, split on commas and newlines, because inviting a
 * team one at a time is the friction that makes people share one login.
 */
export function WorkspaceInvite({ roles, role, onRoleChange, onInvite, seatCost, seatsLeft, workspaceDomain, busy, className }: {
  roles: { id: string; label: string; can: string }[];
  role: string;
  onRoleChange: (id: string) => void;
  onInvite: (emails: string[]) => void;
  /** Pre-formatted per-seat cost. Absent means seats are free. */
  seatCost?: string;
  /** Free seats remaining on the plan. */
  seatsLeft?: number;
  /** The workspace's own email domain. */
  workspaceDomain?: string;
  busy?: boolean;
  className?: string;
}) {
  // Unique per INSTANCE. These ids were literals, so a page rendering
  // this component twice — two contact forms, one in a list — gave every
  // field a duplicate id, and a `<label for>` then focuses the FIRST
  // match. The second form's labels pointed at the first form's inputs.
  const uid = useId();
  const [text, setText] = useState("");
  const emails = text.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
  const outside = workspaceDomain
    ? emails.filter((e) => !e.toLowerCase().endsWith(`@${workspaceDomain.toLowerCase()}`))
    : [];
  const chargeable = seatsLeft === undefined ? emails.length : Math.max(0, emails.length - seatsLeft);
  return (
    <form data-slot="workspace-invite" className={cn("space-y-3", className)}
      onSubmit={(e) => { e.preventDefault(); if (emails.length) onInvite(emails); }}>
      <div className="space-y-1">
        <label htmlFor={uid + "-wi-emails"} className="block text-sm font-medium">Email addresses</label>
        <textarea id={uid + "-wi-emails"} rows={2} value={text} onChange={(e) => setText(e.target.value)}
          placeholder="ada@example.com, kit@example.com"
          className="w-full rounded-md border border-input bg-transparent px-2 py-1.5 text-sm" />
        <p className="text-xs text-muted-foreground">One per line, or separated by commas.</p>
      </div>
      <div className="space-y-1">
        <label htmlFor={uid + "-wi-role"} className="block text-sm font-medium">As</label>
        <NativeSelect id={uid + "-wi-role"} value={role} className="w-auto" onChange={(e) => onRoleChange(e.target.value)}>
          {roles.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
        </NativeSelect>
        <p className="text-xs text-muted-foreground">{roles.find((r) => r.id === role)?.can}</p>
      </div>
      {emails.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {seatCost
            ? chargeable > 0
              ? <>This adds <span className="font-medium text-foreground">{chargeable}</span> paid {chargeable === 1 ? "seat" : "seats"} at {seatCost} each.</>
              : <>Covered by the {seatsLeft} free {seatsLeft === 1 ? "seat" : "seats"} on your plan.</>
            : "Extra people do not change your bill."}
        </p>
      )}
      {outside.length > 0 && (
        <p className="text-xs">
          <span className="font-medium">{outside.length} {outside.length === 1 ? "address is" : "addresses are"} outside {workspaceDomain}.</span>{" "}
          <span className="text-muted-foreground">Check that is what you meant.</span>
        </p>
      )}
      <Button type="submit" size="sm" disabled={!emails.length || busy}>
        {busy ? "Sending…" : emails.length > 1 ? `Invite ${emails.length} people` : "Send invite"}
      </Button>
    </form>
  );
}
