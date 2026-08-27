import * as React from "react";
import { MailWarning } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "Confirm your email address" — the banner on an account that has not.
 *
 * It says WHAT IS BLOCKED, and if nothing is, it says that too. "Please verify
 * your email" with no consequence attached is ignorable and gets ignored; "You
 * can look around, but you cannot book until you confirm" is a reason.
 *
 * It is DISMISSIBLE for the session, because the alternative is a bar across
 * the top of every page that somebody cannot remove while they wait for a
 * message that may take minutes — and a banner that cannot be closed is the one
 * people learn to look past.
 *
 * `role="status"`, not `role="alert"`. Nothing has gone wrong and nothing is
 * urgent; an alert interrupts whatever is being read at the moment the page
 * loads.
 *
 * The resend is a slot rather than a bare button, so it carries `otp-resend`'s
 * cooldown — the endpoint sends a real message and a free button is a way to
 * flood any address that has been typed into a sign-up form.
 */
export function VerifyPending({ email, blocked, resend, onDismiss, className }: {
  email?: React.ReactNode;
  blocked?: React.ReactNode;
  resend?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
}) {
  const [gone, setGone] = React.useState(false);
  if (gone) return null;
  return (
    <div data-slot="verify-pending" role="status" className={cn("motion-enter flex flex-wrap items-start gap-3 rounded-lg border border-foreground p-3", className)}>
      <MailWarning aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Confirm your email address</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {email ? <>We sent a link to <strong className="font-medium text-foreground">{email}</strong>. </> : null}
          {blocked ?? "Everything works in the meantime."}
        </p>
        {resend ? <div className="mt-1.5">{resend}</div> : null}
      </div>
      <button type="button"
        onClick={() => { setGone(true); onDismiss?.(); }}
        className="shrink-0 cursor-pointer text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
        Hide
      </button>
    </div>
  );
}
