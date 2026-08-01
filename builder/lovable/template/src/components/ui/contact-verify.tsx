import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Whether a phone number or address has been proved to work.
 *
 * UNVERIFIED IS NOT AN ERROR AND IS NOT STYLED AS ONE. Most contact details are
 * never verified and work perfectly well; the state matters because it tells
 * staff whether a reminder that bounced is a wrong number or a full inbox, not
 * because the customer did something wrong.
 *
 * A BOUNCED CHANNEL IS ITS OWN STATE, and it is the one worth acting on.
 * "Verified" going stale is invisible — people change numbers — so a delivery
 * failure is the only real signal, and it must not be collapsed into
 * "unverified".
 *
 * RESEND IS RATE-LIMITED BY THE CALLER AND SAYS THE WAIT. A button that appears
 * to do nothing gets pressed four times, which on SMS is four charges and a
 * customer with four codes wondering which one is live.
 *
 * `role="status"` on the state line, so a verification landing while the page
 * is open is announced rather than silently swapping a word.
 */
export function ContactVerify({ value, state, onSend, cooldownSeconds, busy, kind = "email", className }: {
  /** The address or number itself. */
  value: string;
  state: "verified" | "unverified" | "pending" | "bounced";
  onSend?: () => void;
  /** Seconds before resend is allowed. */
  cooldownSeconds?: number;
  busy?: boolean;
  kind?: "email" | "phone";
  className?: string;
}) {
  const WORD = {
    verified: "Confirmed",
    unverified: "Not confirmed",
    pending: "Waiting for the code",
    bounced: kind === "email" ? "Email came back undelivered" : "Texts are not getting through",
  } as const;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-sm", className)}>
      <span className="min-w-0 flex-1">
        <span className="block break-all">{value}</span>
        <span role="status"
          className={cn("block text-xs", state === "bounced" ? "font-medium" : "text-muted-foreground")}>
          {WORD[state]}
        </span>
      </span>
      {state !== "verified" && onSend && (
        <Button type="button" size="sm" variant="outline" disabled={busy || Boolean(cooldownSeconds)}
          onClick={onSend}>
          {cooldownSeconds ? `Wait ${cooldownSeconds}s` : state === "pending" ? "Send again" : "Send a code"}
        </Button>
      )}
    </div>
  );
}
