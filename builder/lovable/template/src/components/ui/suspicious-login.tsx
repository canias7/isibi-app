import * as React from "react";
import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "There was a sign-in from somewhere new" — and the two things to do about it.
 *
 * "That was me" is the QUIET action and "Secure my account" is the loud one,
 * which is the opposite weighting to most notices. Almost every one of these is
 * a holiday, a new phone or a work laptop, so the common answer must be one
 * unremarkable press — but the rare answer is the whole reason the notice
 * exists, and burying it behind a menu means the one person who needed it does
 * not find it.
 *
 * It states the FACTS and draws no conclusion. "Unusual activity detected" is
 * frightening and unfalsifiable; "Chrome on Windows, from Spain, at 03:12" is
 * something the reader can actually check against their own week.
 *
 * "That was me" must not be the only way to dismiss it. Somebody who does
 * neither should still be able to close it, or the notice becomes a thing to
 * click through without reading — which is exactly how the important one gets
 * dismissed.
 */
export function SuspiciousLogin({
  device, location, at, onConfirm, onSecure, onDismiss, busy, className,
}: {
  device?: React.ReactNode;
  location?: React.ReactNode;
  at?: React.ReactNode;
  onConfirm?: () => void;
  onSecure: () => void;
  onDismiss?: () => void;
  busy?: boolean;
  className?: string;
}) {
  return (
    <div data-slot="suspicious-login" role="alert" className={cn("flex flex-col gap-3 rounded-lg border-2 border-foreground p-4", className)}>
      <div className="flex items-start gap-3">
        <ShieldAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">A sign-in from somewhere new</p>
          <dl className="mt-1.5 grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-[auto_1fr]">
            {device ? (<><dt className="text-muted-foreground">Device</dt><dd>{device}</dd></>) : null}
            {location ? (<><dt className="text-muted-foreground">Where</dt><dd>{location}</dd></>) : null}
            {at ? (<><dt className="text-muted-foreground">When</dt><dd className="tabular-nums">{at}</dd></>) : null}
          </dl>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onSecure} disabled={busy}
          className="cursor-pointer rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90 disabled:pointer-events-none disabled:opacity-60">
          This wasn&rsquo;t me — secure my account
        </button>
        {onConfirm ? (
          <button type="button" onClick={onConfirm} disabled={busy}
            className="cursor-pointer text-xs underline underline-offset-2">
            That was me
          </button>
        ) : null}
        {onDismiss ? (
          <button type="button" onClick={onDismiss} disabled={busy}
            className="cursor-pointer text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
            Close
          </button>
        ) : null}
      </div>
    </div>
  );
}
