import { cn } from "@/lib/utils";
/**
 * This can be done again later, and here is why not yet.
 *
 * DIFFERENT FROM `throttle-note`, which is about rate. A cooldown is about the
 * SAME action on the SAME thing — you cannot re-send an invite for ten minutes,
 * cannot re-request a code for sixty seconds — and it usually exists to protect
 * the recipient rather than the server.
 *
 * IT SAYS WHO THE RULE PROTECTS. "So we don't spam them" makes the wait
 * reasonable; an unexplained one reads as the product being slow.
 *
 * IT DOES NOT DISABLE THE CONTROL SILENTLY. A greyed button with this note
 * beside it is understandable; a greyed button alone is the thing people report
 * as broken.
 */
export function CooldownNote({ action, readyIn, why, className }: {
  /** What is on cooldown — "resend the invite". */
  action: string;
  /** "8 minutes" */
  readyIn?: string;
  /** Who it protects — "so we don't spam them". */
  why?: string;
  className?: string;
}) {
  return (
    <p data-slot="cooldown-note" role="status" className={cn("text-xs text-muted-foreground", className)}>
      You can {action} again{readyIn ? ` in ${readyIn}` : " shortly"}
      {why ? ` — ${why}` : ""}.
    </p>
  );
}
