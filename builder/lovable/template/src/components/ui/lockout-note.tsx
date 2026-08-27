import * as React from "react";
import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "Too many attempts — try again in 10 minutes."
 *
 * DO NOT PUT THIS ON A LOGIN FORM. A server that refuses a delayed account
 * differently from a wrong password has told an attacker that the address
 * belongs to a real member — which is precisely what a well-built brute-force
 * delay avoids by answering byte-identically either way. Rendering this in
 * response to a failed sign-in hands back the information the backend went to
 * some trouble not to leak.
 *
 * Where it IS right: a screen where identity is already established (an account
 * settings page, a step-up prompt after signing in), and a limit the client
 * itself imposes — a resend, a search, an export — where there is no secret
 * about who is asking.
 *
 * The countdown is derived from a TARGET TIMESTAMP, for the reason `otp-resend`
 * spells out: a background tab throttles or stops timers, so a decrementing
 * counter comes back showing a wait that has already passed.
 *
 * It never says "locked". A good delay escalates and always ends on its own; a
 * lock somebody has to get cleared is a denial of service anyone can aim at
 * anyone by failing a login eight times. The wording says wait, not blocked.
 */
export function LockoutNote({ until, attempts, onExpire, className }: {
  until: number;
  attempts?: number;
  onExpire?: () => void;
  className?: string;
}) {
  const [now, setNow] = React.useState(() => Date.now());
  const fired = React.useRef(false);
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [until]);
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  const expireRef = React.useRef(onExpire);
  expireRef.current = onExpire;
  React.useEffect(() => {
    if (left === 0 && !fired.current) { fired.current = true; expireRef.current?.(); }
    if (left > 0) fired.current = false;
  }, [left]);

  if (left === 0) return null;
  const mins = Math.floor(left / 60), secs = left % 60;
  const wait = mins > 0 ? `${mins} minute${mins === 1 ? "" : "s"}${secs ? ` ${secs}s` : ""}` : `${secs} seconds`;

  return (
    <div data-slot="lockout-note" role="status" className={cn("flex items-start gap-2.5 rounded-md border border-border p-3", className)}>
      <Timer aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-sm">
          Too many attempts. Try again in <strong className="tabular-nums">{wait}</strong>.
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {attempts ? `${attempts} attempts so far. ` : null}
          The wait ends on its own — nobody has to unlock anything.
        </p>
      </div>
    </div>
  );
}
