import * as React from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "You'll be signed out in 2 minutes" — with a way to stay.
 *
 * The WARNING is the whole feature; the sign-out is not. Being dropped without
 * notice halfway through filling in a booking loses the work and looks like a
 * crash, and the only reason anybody tolerates a session timeout is that they
 * were told it was coming.
 *
 * "Stay signed in" is the primary action and it is the LARGE one. The person
 * seeing this dialog is at their desk, working — that is why they are seeing
 * it — so the overwhelmingly likely answer is "yes, I am still here".
 *
 * Timing is derived from a TARGET TIMESTAMP and re-read on `visibilitychange`,
 * because a throttled background tab is the normal case for this component:
 * somebody comes back to a tab left open at lunch, and a decremented counter
 * would show two minutes left on a session that ended forty minutes ago.
 *
 * It does NOT trap focus or block the page. A modal over an unsaved form stops
 * somebody doing the one useful thing available to them, which is pressing save
 * before the clock runs out.
 *
 * It STACKS below `sm` rather than relying on flex-wrap. Wrapping puts the
 * buttons beside a sentence that has broken over three lines on a phone, which
 * leaves both the text and the buttons in a column too narrow for either.
 */
export function SessionExpiry({ expiresAt, warnSeconds = 120, onExtend, onSignOut, busy, className }: {
  expiresAt: number;
  warnSeconds?: number;
  onExtend: () => void;
  onSignOut?: () => void;
  busy?: boolean;
  className?: string;
}) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const tick = () => setNow(Date.now());
    const t = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", tick); };
  }, []);

  const left = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  if (left > warnSeconds) return null;

  const mins = Math.floor(left / 60), secs = left % 60;
  return (
    <div data-slot="session-expiry" role="status" aria-live="polite"
      className={cn("flex flex-col gap-3 rounded-lg border-2 border-foreground bg-background p-3 sm:flex-row sm:items-center", className)}>
      <Clock aria-hidden className="size-4 shrink-0" />
      <p className="min-w-0 flex-1 text-sm">
        {left === 0 ? (
          <>Your session has ended. Sign in again to carry on.</>
        ) : (
          <>
            You&rsquo;ll be signed out in{" "}
            <strong className="tabular-nums">{mins > 0 ? `${mins}:${String(secs).padStart(2, "0")}` : `${secs}s`}</strong>.
            {" "}Anything unsaved will be lost.
          </>
        )}
      </p>
      <button type="button" onClick={onExtend} disabled={busy}
        className="shrink-0 cursor-pointer rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:pointer-events-none disabled:opacity-60">
        {left === 0 ? "Sign in again" : "Stay signed in"}
      </button>
      {onSignOut && left > 0 ? (
        <button type="button" onClick={onSignOut}
          className="shrink-0 cursor-pointer text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
          Sign out now
        </button>
      ) : null}
    </div>
  );
}
