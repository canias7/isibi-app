import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * "Your connection to Xero has expired" — with what has stopped working.
 *
 * IT NAMES WHAT IS BROKEN AS A RESULT, which is the half every reauth banner
 * omits. "Reconnect your account" is a chore with no stated cost; "your
 * invoices have not been sent since Tuesday" is a reason to do it now — and it
 * is usually a surprise, because the failure is silent.
 *
 * IT SAYS WHETHER WORK IS QUEUED OR LOST. A connection that buffers and will
 * catch up is a mild inconvenience; one that drops what it could not send is an
 * emergency, and the reader cannot tell which without being told.
 *
 * EXPIRED AND REVOKED ARE DIFFERENT. Expired reconnects in two clicks; revoked
 * means somebody at the other end deliberately removed access, and reconnecting
 * without knowing that gets it removed again.
 *
 * `role="alert"` — the thing has already stopped working, so this is not
 * advance notice.
 */
export function ReauthPrompt({ provider, kind = "expired", stopped, since, queued, onReconnect, busy, className }: {
  provider: string;
  kind?: "expired" | "revoked" | "permissions";
  /** What is not happening — "your invoices have not been sent". */
  stopped?: string;
  /** Free text — "Tuesday". */
  since?: string;
  /** Work waiting to go through, if any. */
  queued?: number;
  onReconnect: () => void;
  busy?: boolean;
  className?: string;
}) {
  const WHY = {
    expired: `Your connection to ${provider} has expired.`,
    revoked: `Access to ${provider} was removed at their end.`,
    permissions: `${provider} no longer gives us the permissions we need.`,
  } as const;
  return (
    <div data-slot="reauth-prompt" role="alert"
      className={cn("space-y-2 rounded-md border border-foreground/40 bg-muted/40 p-3", className)}>
      <p className="text-sm font-medium">{WHY[kind]}</p>
      {stopped && (
        <p className="text-sm">
          {stopped}
          {since && <span className="text-muted-foreground"> since {since}</span>}.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {queued === undefined
          ? null
          : queued > 0
            ? `${queued.toLocaleString()} ${queued === 1 ? "item is" : "items are"} waiting and will go through once you reconnect.`
            : "Nothing is queued — anything from this period will need sending again."}
      </p>
      {kind === "revoked" && (
        <p className="text-xs text-muted-foreground">
          Somebody removed our access in {provider}. Check with them before reconnecting, or it will be removed again.
        </p>
      )}
      <Button type="button" size="sm" onClick={onReconnect} disabled={busy}>
        {busy ? "Reconnecting…" : `Reconnect ${provider}`}
      </Button>
    </div>
  );
}
