import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Leaving something shared, with the consequences named.
 *
 * THE THREE THINGS PEOPLE ASK, answered before they press: does my work stay,
 * can I come back, and does anyone else lose anything. All three are props, and
 * the last one is why the owner case is special.
 *
 * THE LAST OWNER IS BLOCKED, not warned. If leaving would strand a resource with
 * no owner, the honest answer is that this action is unavailable until somebody
 * else is made owner — and the message says so and points at
 * `transfer-ownership` rather than letting the press fail with an error.
 *
 * Cancel comes first in the DOM so a keyboard user lands on the safe answer.
 */
export function LeaveConfirm({ what, keepsWork, canRejoin, lastOwner, onLeave, onCancel, busy, className }: {
  what: string;
  /** Does their content stay behind? */
  keepsWork?: boolean;
  canRejoin?: boolean;
  /** True when they are the only owner — leaving is refused. */
  lastOwner?: boolean;
  onLeave: () => void; onCancel: () => void; busy?: boolean;
  className?: string;
}) {
  return (
    <section data-slot="leave-confirm" role="alertdialog" aria-label={`Leave ${what}`}
      className={cn("flex flex-col gap-3 rounded-md border border-border p-4", className)}>
      <p className="text-sm font-medium">Leave {what}?</p>
      {lastOwner ? (
        <p className="text-sm text-muted-foreground">
          You&apos;re the only owner. Make someone else an owner first, then you can leave.
        </p>
      ) : (
        <ul className="flex list-disc flex-col gap-0.5 ps-5 text-sm text-muted-foreground">
          <li>{keepsWork ? "Everything you added stays." : "Everything you added is removed with you."}</li>
          <li>{canRejoin ? "You can be invited back." : "You'd need a new invitation to return."}</li>
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button size="sm" disabled={lastOwner || busy} onClick={onLeave}>
          {busy ? "Leaving…" : "Leave"}
        </Button>
      </div>
    </section>
  );
}
