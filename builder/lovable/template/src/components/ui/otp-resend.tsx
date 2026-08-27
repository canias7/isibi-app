import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "Didn't get the code? Send another" — with a countdown that makes it wait.
 *
 * The cooldown exists for the RECIPIENT, not for us. Every press sends another
 * message to a real phone or inbox, and a resend button with no delay lets
 * somebody who is anxious about a code that has not arrived yet send themselves
 * five, then be unable to tell which one is current. It is also, on a public
 * endpoint, a way to aim a message flood at any address.
 *
 * The countdown is derived from a TARGET TIMESTAMP, never decremented from a
 * counter. A background tab throttles timers to once a minute or stops them
 * altogether, so a decrementing counter comes back showing 48 seconds when
 * three minutes have passed, and the button stays disabled long after the wait
 * is over.
 *
 * The remaining time is announced politely once a countdown starts and then
 * left alone — a live region on every tick reads the number out every second.
 */
export function OtpResend({ nextAt, onResend, sentTo, busy, className }: {
  nextAt: number | null;
  onResend: () => void;
  sentTo?: React.ReactNode;
  busy?: boolean;
  className?: string;
}) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (nextAt == null || nextAt <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [nextAt]);

  const left = nextAt == null ? 0 : Math.max(0, Math.ceil((nextAt - now) / 1000));
  const waiting = left > 0;

  return (
    <p data-slot="otp-resend" className={cn("text-xs text-muted-foreground", className)}>
      {sentTo ? <>Sent to <strong className="font-medium text-foreground">{sentTo}</strong>. </> : null}
      Didn&rsquo;t get it?{" "}
      {waiting ? (
        <span className="tabular-nums">
          You can ask again in {left}s.
        </span>
      ) : (
        <button type="button" onClick={onResend} disabled={busy}
          className="cursor-pointer font-medium text-foreground underline underline-offset-2 disabled:pointer-events-none disabled:opacity-60">
          {busy ? "Sending…" : "Send another code"}
        </button>
      )}
      <span aria-live="polite" className="sr-only">
        {waiting ? "A new code can be requested shortly." : "You can request a new code."}
      </span>
    </p>
  );
}
