import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A shortened link shown with what it actually points at.
 *
 * THE DESTINATION IS ALWAYS VISIBLE. A short link is an opaque redirect, and
 * hiding where it goes is the mechanism of every link-based scam there is — so
 * this shows the real host underneath, and never only the short form.
 *
 * The CLICK COUNT is shown when the caller has one, because that is the entire
 * reason most people shorten a link, and it is otherwise buried in a dashboard.
 *
 * It does NOT create short links. That needs a service, a redirect and a
 * database, and a component that pretends to do it with a hash produces
 * collisions. This displays and copies one somebody else minted.
 *
 * A link that has been DISABLED or has expired says so instead of rendering as
 * live — a dead short link that looks fine is discovered by whoever received it.
 */
export function ShortLink({ short, destination, clicks, expired, disabled, className }: {
  short: string;
  destination: string;
  clicks?: number;
  expired?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  let host = destination;
  try { host = new URL(destination).host.replace(/^www\./, "") + new URL(destination).pathname; } catch { /* not a URL */ }
  const dead = expired || disabled;

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <div className="flex flex-wrap items-baseline gap-2">
        {dead ? (
          <span className="font-mono text-sm text-muted-foreground line-through">{short}</span>
        ) : (
          <a href={short} className="font-mono text-sm font-medium hover:underline">{short}</a>
        )}
        {clicks != null && !dead ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {clicks.toLocaleString()} {clicks === 1 ? "click" : "clicks"}
          </span>
        ) : null}
        {dead ? (
          <span className="text-xs font-medium">{expired ? "Expired" : "Turned off"}</span>
        ) : null}
      </div>
      {/* Never only the short form: an opaque redirect is how link scams work. */}
      <p className="truncate text-xs text-muted-foreground">&rarr; {host}</p>
    </div>
  );
}
