import { cn } from "@/lib/utils";
/**
 * A link to the status page, carrying the current state with it.
 *
 * THE STATE TRAVELS WITH THE LINK. "Check our status page" during an incident
 * is a link somebody follows to learn what we already know — so the headline
 * goes here, and the link is for the detail. That saves a click at the moment
 * clicks are expensive.
 *
 * IT IS ON A DIFFERENT ORIGIN AND SAYS SO. A status page hosted inside the
 * product is unreachable during the outage it exists to explain, which is the
 * classic mistake — and telling somebody it works when the product does not is
 * the reason to follow it.
 *
 * SUBSCRIBING IS OFFERED, since the useful thing during an incident is being
 * told when it ends rather than refreshing. It is a separate link because it is
 * a separate decision.
 *
 * NOTHING-WRONG RENDERS A QUIET LINE. A status link that only appears during an
 * incident cannot be found in advance, and finding it is exactly what somebody
 * tries to do when things break.
 */
export function StatusPageLink({ url, state = "ok", headline, subscribeUrl, className }: {
  url: string;
  state?: "ok" | "incident" | "maintenance";
  /** The current headline from the status page. */
  headline?: string;
  subscribeUrl?: string;
  className?: string;
}) {
  const wrong = state !== "ok";
  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 text-xs", className)}>
      <span className={cn(wrong ? "font-medium" : "text-muted-foreground")}>
        {state === "ok" ? "All systems working" : state === "maintenance" ? "Planned maintenance" : "Something is wrong"}
        {headline && <span className="font-normal text-muted-foreground"> — {headline}</span>}
      </span>
      <a href={url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
        Status page
      </a>
      {subscribeUrl && (
        <a href={subscribeUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
          Get told when it changes
        </a>
      )}
      <span className="text-muted-foreground">It is hosted elsewhere, so it works even when we do not.</span>
    </p>
  );
}
