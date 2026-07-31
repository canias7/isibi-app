import * as React from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "Grace is editing this" — the soft lock on a record.
 *
 * IT EXPIRES ON ITS OWN. A lock held by a browser tab that was closed without
 * saving is a record nobody can edit until an administrator intervenes, and
 * that is the failure mode of every pessimistic lock ever shipped. A stale lock
 * shows as expired and the field opens.
 *
 * IT IS A WARNING, NOT A GATE — there is always a way to edit anyway, because
 * the alternative is somebody blocked by a colleague who has gone to lunch. The
 * override is deliberate and says what will happen.
 *
 * The holder's NAME and how long they have held it are both shown. "Locked" is
 * a dead end; "Grace, since 11:04" is something you can act on.
 *
 * The server still has to decide. This is a courtesy that prevents most
 * collisions; a last-writer-wins backend with no version check will still lose
 * an edit, and no component can fix that.
 */
export function EditLock({ by, since, expiresAt, onOverride, onRequest, className }: {
  by: React.ReactNode;
  since?: React.ReactNode;
  expiresAt?: number;
  onOverride?: () => void;
  onRequest?: () => void;
  className?: string;
}) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (expiresAt == null) return;
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, [expiresAt]);

  // A tab closed without saving must not lock a record forever.
  const expired = expiresAt != null && expiresAt <= now;
  if (expired) return null;

  return (
    <div role="status" className={cn("flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs", className)}>
      <Lock aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <strong className="font-medium">{by}</strong> is editing this
        {since ? <span className="text-muted-foreground"> since {since}</span> : null}.
      </span>
      {onRequest ? (
        <button type="button" onClick={onRequest}
          className="cursor-pointer underline underline-offset-2">Ask them to finish</button>
      ) : null}
      {onOverride ? (
        <button type="button" onClick={onOverride}
          className="cursor-pointer text-muted-foreground underline underline-offset-2 hover:text-foreground">
          Edit anyway
        </button>
      ) : null}
    </div>
  );
}
