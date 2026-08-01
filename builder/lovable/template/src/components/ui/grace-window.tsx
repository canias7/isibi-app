import { cn } from "@/lib/utils";
/**
 * "You can still change this for another 12 minutes."
 *
 * The window after an action during which it can be taken back — cancel an
 * order, edit a message, undo a send. Stating it is what makes people commit:
 * the alternative is a confirmation dialog before every action, which is slower
 * and worse for everyone.
 *
 * IT SAYS WHAT HAPPENS WHEN THE WINDOW CLOSES, not just that it does. "After
 * that it goes to the kitchen" is a reason; "expires in 12 minutes" is a
 * countdown to an unnamed consequence, which reads as a threat and gets
 * ignored.
 *
 * EXPIRED IS AN EXPLANATION, not a disappearance. A component that unmounts on
 * expiry leaves somebody looking for a cancel link that was there a minute ago
 * and concluding the site is broken — where "This has gone to the kitchen and
 * can't be changed" answers them completely.
 *
 * `role="status"` so the change from open to closed is announced without
 * interrupting.
 */
export function GraceWindow({ remaining, action, thenWhat, expired, onAct, className }: {
  /** "12 minutes" — the caller counts it. */
  remaining?: string;
  /** What can still be done — "change this order". */
  action: string;
  /** What happens after — "it goes to the kitchen". */
  thenWhat?: string;
  expired?: boolean;
  onAct?: () => void;
  className?: string;
}) {
  if (expired) {
    return (
      <p role="status" className={cn("text-sm text-muted-foreground", className)}>
        {thenWhat ? `Too late to ${action} — ${thenWhat}.` : `Too late to ${action}.`}
      </p>
    );
  }
  return (
    <p role="status" className={cn("flex flex-wrap items-center gap-x-2 text-sm", className)}>
      <span>
        You can still <span className="font-medium">{action}</span>
        {remaining ? <> for another <span className="tabular-nums">{remaining}</span></> : null}
        {thenWhat ? <span className="text-muted-foreground"> — after that {thenWhat}.</span> : "."}
      </span>
      {onAct && (
        <button type="button" onClick={onAct}
          className="cursor-pointer underline underline-offset-4">{action}</button>
      )}
    </p>
  );
}
