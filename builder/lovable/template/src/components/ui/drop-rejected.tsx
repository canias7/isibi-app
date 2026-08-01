import { cn } from "@/lib/utils";
/**
 * Why letting go there did nothing.
 *
 * A refused drop is the most silent failure in an interface: the item animates
 * back to where it started, which is exactly what a cancelled drag looks like,
 * so the reader cannot tell "not allowed" from "I let go too early". They try
 * again, usually more than once.
 *
 * THE REASON IS REQUIRED and should name the rule — "A folder can't go inside
 * itself", "That board is full", "You don't have access to Archive". "Invalid
 * drop target" is the non-answer this component exists to replace.
 *
 * `role="alert"`, because it follows an action the reader just took and is
 * meaningless a moment later.
 *
 * `where` names the target, since a page of drop zones gives no clue which one
 * refused — the pointer has already moved on by the time this is read.
 */
export function DropRejected({ reason, what, where, className }: {
  /** The rule, in words. Required. */
  reason: string;
  /** What was being dragged. */
  what?: string;
  /** What refused it. */
  where?: string;
  className?: string;
}) {
  return (
    <p role="alert" className={cn("text-sm", className)}>
      <span className="font-medium">
        {what && where ? `${what} can't go in ${where}` : what ? `${what} can't go there` : "That can't go there"}
      </span>
      <span className="text-muted-foreground"> — {reason}</span>
    </p>
  );
}
