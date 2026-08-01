import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Sending an event again, with the duplicate risk stated.
 *
 * IT WARNS THAT THE RECEIVER MAY ACT TWICE. A replay is indistinguishable from
 * a first delivery unless the receiving end checks the event id — so replaying
 * "payment succeeded" against a naive handler ships the goods again. That is
 * the whole content of the confirmation, and no replay button says it.
 *
 * IT SAYS WHETHER THE EVENT WAS EVER DELIVERED. Replaying something that
 * already arrived is the risky case; replaying something that never did is
 * simply the fix. The two need different amounts of caution and the component
 * knows which it is.
 *
 * THE PAYLOAD IS THE ORIGINAL, NOT REBUILT FROM CURRENT DATA, and it says so.
 * A "replay" that quietly sends today's version of the record is a different
 * operation wearing the same name, and it silently breaks anything reconciling
 * against the original.
 *
 * NO BULK REPLAY HERE. Replaying a thousand events is a decision with a
 * different shape and belongs behind its own screen, not a button beside a row.
 */
export function ReplayEvent({ eventId, delivered, capturedAt, onReplay, busy, className }: {
  eventId: string;
  /** True if it reached the endpoint at least once. */
  delivered?: boolean;
  /** Free text — when the payload was captured. */
  capturedAt?: string;
  onReplay: () => void;
  busy?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-xs text-muted-foreground">
        Sends the original payload again
        {capturedAt && <span>, as captured {capturedAt}</span>} — not a fresh copy of the record.
      </p>
      {delivered && (
        <p className="text-xs">
          <span className="font-medium">This one already arrived.</span>{" "}
          <span className="text-muted-foreground">
            Unless your endpoint checks the event id, it may act on it a second time.
          </span>
        </p>
      )}
      <Button type="button" size="sm" variant="outline" disabled={busy}
        onClick={() => {
          const msg = delivered
            ? `Send ${eventId} again? Your endpoint has already had it once and may act on it twice.`
            : `Send ${eventId} again?`;
          if (window.confirm(msg)) onReplay();
        }}>
        {busy ? "Sending…" : "Send it again"}
      </Button>
    </div>
  );
}
