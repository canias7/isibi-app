import { cn } from "@/lib/utils";
/**
 * "Xero is having problems" — the other end being down, said before we are
 * blamed.
 *
 * IT ATTRIBUTES THE FAULT. When a provider is degraded, everything built on
 * them looks broken — and support hears about OUR product. One line naming the
 * real cause turns a bug report into an understandable wait, and it is the
 * single highest-value integration component there is.
 *
 * IT LINKS TO THEIR OWN STATUS PAGE rather than restating their updates. Their
 * page is authoritative and ours would lag; the link is what somebody wants
 * when they need more than a sentence.
 *
 * "WE ARE STILL QUEUEING YOUR WORK" IS THE REASSURING HALF and is only claimed
 * when the caller says it is true. That is what decides whether somebody has to
 * do anything, and asserting it wrongly is worse than saying nothing.
 *
 * `role="status"` — informational; the reader cannot act on it, and it should
 * not interrupt.
 */
export function ProviderStatus({ provider, state, summary, statusUrl, queueing, since, className }: {
  provider: string;
  state: "ok" | "degraded" | "down" | "maintenance";
  /** Their own one-line description. */
  summary?: string;
  statusUrl?: string;
  /** True if work is held rather than dropped. */
  queueing?: boolean;
  /** Free text — "09:20". */
  since?: string;
  className?: string;
}) {
  if (state === "ok") return null;
  const WORD = {
    degraded: `${provider} is having problems`,
    down: `${provider} is down`,
    maintenance: `${provider} is doing planned maintenance`,
  }[state];
  return (
    <div data-slot="provider-status" role="status"
      className={cn("space-y-0.5 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm", className)}>
      <p>
        <span className="font-medium">{WORD}</span>
        {since && <span className="text-muted-foreground"> since {since}</span>}
      </p>
      {summary && <p className="text-xs text-muted-foreground">{summary}</p>}
      <p className="text-xs text-muted-foreground">
        {queueing
          ? "We are holding your work and will send it when they are back."
          : "Anything sent during this may need doing again."}
        {statusUrl && (
          <>
            {" "}
            <a href={statusUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              Their status page
            </a>
          </>
        )}
      </p>
    </div>
  );
}
