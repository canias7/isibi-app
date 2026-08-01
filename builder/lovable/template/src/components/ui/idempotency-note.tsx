import { cn } from "@/lib/utils";
/**
 * "Check the event id — you may get this twice" — said where it is read.
 *
 * AT-LEAST-ONCE DELIVERY IS THE DEFAULT AND ALMOST NOBODY IS TOLD. Retries,
 * replays and network timeouts all produce duplicates, so an endpoint that
 * assumes one delivery per event will eventually double-charge somebody. This
 * is one sentence beside the endpoint that prevents it.
 *
 * IT NAMES THE FIELD TO KEY ON. "Handle duplicates" is advice; "store
 * `event.id` and ignore ones you have seen" is an implementation, and the field
 * name is the part somebody has to go looking for otherwise.
 *
 * IT SAYS HOW LONG IDS SHOULD BE REMEMBERED. Keeping them forever is a growing
 * table nobody prunes; a stated retry window bounds it, and that window is
 * something only we know.
 *
 * ORDER IS ADDRESSED TOO, because the sister assumption — events arrive in
 * order — is equally false and equally silent, and a handler built on it
 * applies a cancellation before the booking it cancels.
 */
export function IdempotencyNote({ idField = "event.id", rememberFor = "7 days", ordered = false, className }: {
  /** The field to deduplicate on. */
  idField?: string;
  /** How long to keep seen ids. */
  rememberFor?: string;
  /** True only if the caller genuinely guarantees ordering. */
  ordered?: boolean;
  className?: string;
}) {
  return (
    <p className={cn("space-y-0.5 text-xs text-muted-foreground", className)}>
      <span className="block">
        You may receive the same event more than once. Store{" "}
        <code className="font-mono text-foreground">{idField}</code> and ignore ones you have already handled — keeping
        them for {rememberFor} is enough.
      </span>
      <span className="block">
        {ordered
          ? "Events for the same record arrive in the order they happened."
          : "Events can arrive out of order, so check the timestamp before overwriting newer data."}
      </span>
    </p>
  );
}
