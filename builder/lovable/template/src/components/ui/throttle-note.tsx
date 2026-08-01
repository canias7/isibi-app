import { cn } from "@/lib/utils";
/**
 * You are going too fast, and here is when you can carry on.
 *
 * IT SAYS WHEN, NOT JUST NO. "Too many requests" with no retry time makes people
 * hammer the button, which is exactly the behaviour the limit exists to stop.
 *
 * IT STATES THE LIMIT ITSELF, because somebody hitting it repeatedly needs to
 * know the shape of the rule to work within it — and a limit nobody can see is
 * one that feels arbitrary.
 *
 * `role="status"` rather than alert: this is a condition to wait out, not
 * something to interrupt for, and interrupting on every blocked press would be
 * worse than the block.
 */
export function ThrottleNote({ retryIn, limit, className }: {
  /** "30 seconds" */
  retryIn?: string;
  /** "5 messages a minute" */
  limit?: string;
  className?: string;
}) {
  return (
    <p role="status" className={cn("text-sm", className)}>
      <span className="font-medium">
        {retryIn ? `You can try again in ${retryIn}` : "Slow down a moment"}
      </span>
      {limit && <span className="text-muted-foreground"> — the limit is {limit}.</span>}
    </p>
  );
}
