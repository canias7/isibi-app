import { DateFormat } from "@/components/ui/date-format";
import { cn } from "@/lib/utils";
/**
 * When this last reached the server.
 *
 * The exact time goes in a real `<time datetime>` and the human phrasing sits
 * beside it. "2 minutes ago" is what somebody wants to read; the machine form
 * is what survives being translated, indexed, or read at a different hour.
 *
 * NEVER SYNCED IS ITS OWN SENTENCE, not a blank and not "just now". A missing
 * timestamp rendered as an em dash reads like a loading state, and somebody
 * waits for a number that is never coming.
 *
 * "Sync now" is a `busy` button rather than a disabled one while syncing —
 * disabling it removes the only feedback that pressing it did anything.
 */
export function LastSynced({ at, syncing, onSyncNow, className }: {
  /** Omit when it has never synced. */
  at?: string | number | Date | null;
  syncing?: boolean;
  onSyncNow?: () => void;
  className?: string;
}) {
  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground", className)}>
      {syncing ? (
        <span role="status">Syncing…</span>
      ) : at ? (
        <span>
          Last synced <time dateTime={new Date(at).toISOString()}><DateFormat date={at} withTime /></time>
        </span>
      ) : (
        <span>Not synced yet</span>
      )}
      {onSyncNow && !syncing && (
        <button type="button" onClick={onSyncNow}
          className="cursor-pointer underline underline-offset-2">Sync now</button>
      )}
    </p>
  );
}
