import { cn } from "@/lib/utils";
/**
 * A webhook destination — its URL, whether it works, and what it is for.
 *
 * THE URL IS SHOWN IN FULL, MONOSPACED AND WRAPPING. A truncated endpoint is
 * useless for the one thing anybody does with it: check that it is the right
 * one. Two endpoints differing only in a path segment are indistinguishable
 * once truncated, and pointing production at staging is precisely that mistake.
 *
 * HTTP RATHER THAN HTTPS IS CALLED OUT. A plain-HTTP webhook sends the payload
 * — often customer data — across the network in the clear, and it is accepted
 * silently by every webhook form.
 *
 * DISABLED-BY-US IS A SEPARATE STATE from switched-off-by-you. Endpoints that
 * fail repeatedly get auto-disabled, and somebody who does not know that spends
 * an afternoon wondering why their toggle keeps flipping.
 *
 * THE EVENT COUNT SAYS WHETHER IT IS SUBSCRIBED TO ANYTHING. An endpoint with
 * no events is configured, healthy and completely inert — the state most likely
 * to be reported as a bug.
 */
export function WebhookEndpoint({ url, state, eventCount, description, action, className }: {
  url: string;
  state: "on" | "off" | "auto-disabled";
  /** How many event types it listens for. */
  eventCount?: number;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  const insecure = /^http:\/\//i.test(url);
  const WORD = { on: "On", off: "Switched off", "auto-disabled": "Turned off by us" } as const;
  return (
    <div data-slot="webhook-endpoint" className={cn("space-y-1 rounded-md border border-border p-3", className)}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <code className="min-w-0 flex-1 break-all font-mono text-xs">{url}</code>
        <span className={cn("shrink-0 text-xs", state === "on" ? "text-muted-foreground" : "font-medium")}>
          {WORD[state]}
        </span>
        {action}
      </div>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <p className="text-xs text-muted-foreground">
        {eventCount === undefined ? null
          : eventCount === 0
            ? <span className="font-medium text-foreground">Not subscribed to any events — nothing will be sent.</span>
            : `${eventCount} ${eventCount === 1 ? "event" : "events"}`}
      </p>
      {insecure && (
        <p className="text-xs font-medium">
          This is plain HTTP — everything sent to it travels unencrypted.
        </p>
      )}
      {state === "auto-disabled" && (
        <p className="text-xs text-muted-foreground">
          We stopped sending because it kept failing. Fix it, then switch it back on.
        </p>
      )}
    </div>
  );
}
