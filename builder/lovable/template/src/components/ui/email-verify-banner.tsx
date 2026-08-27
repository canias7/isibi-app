import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * "Confirm your email."
 *
 * Once the link is sent the button becomes a sentence rather than staying
 * clickable — a resend button that keeps working sends four emails to somebody
 * waiting for the first, and every extra one is likelier to be marked spam.
 */
export function EmailVerifyBanner({ email, sent, onResend, busy, className }: {
  email?: string; sent?: boolean; onResend?: () => void; busy?: boolean; className?: string;
}) {
  return (
    <div data-slot="email-verify-banner" className={cn("flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2", className)}>
      <p className="text-sm">
        {sent
          ? <>Confirmation sent{email ? <> to <strong className="font-medium">{email}</strong></> : null}. Check your inbox.</>
          : <>Confirm your email address{email ? <> — <strong className="font-medium">{email}</strong></> : null}.</>}
      </p>
      {!sent && onResend && (
        <Button size="sm" variant="outline" onClick={onResend} disabled={busy}>
          {busy ? "Sending…" : "Send the link"}
        </Button>
      )}
    </div>
  );
}
