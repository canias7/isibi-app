import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Invited, not yet arrived.
 *
 * PENDING IS NOT MEMBERSHIP, and conflating the two is why owners think somebody
 * has access when they never opened the email. This row states it plainly and
 * sits apart from the member list.
 *
 * THE AGE IS SHOWN, because an invite sent an hour ago and one sent five weeks
 * ago call for different actions — the second usually went to the wrong address
 * or a spam folder, and nothing else on the screen reveals that.
 *
 * Resend and revoke are both offered. An invite that cannot be withdrawn is a
 * standing offer of access to whoever controls that mailbox, which may no longer
 * be the person intended.
 */
export function PendingInvite({ email, sentAgo, role, onResend, onRevoke, busy, className }: {
  email: string;
  /** "5 weeks ago" */
  sentAgo?: string;
  role?: string;
  onResend?: () => void; onRevoke?: () => void; busy?: boolean;
  className?: string;
}) {
  return (
    <div data-slot="pending-invite" className={cn("flex flex-wrap items-center justify-between gap-3 py-2", className)}>
      <div className="min-w-0">
        <p className="truncate text-sm">{email}</p>
        <p className="text-xs text-muted-foreground">
          Invited{sentAgo ? ` ${sentAgo}` : ""} · not accepted yet{role ? ` · ${role}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        {onResend && <Button size="sm" variant="outline" disabled={busy} onClick={onResend}>Resend</Button>}
        {onRevoke && <Button size="sm" variant="outline" disabled={busy} onClick={onRevoke}>Revoke</Button>}
      </div>
    </div>
  );
}
