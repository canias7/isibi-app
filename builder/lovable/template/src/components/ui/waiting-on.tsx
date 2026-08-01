import { cn } from "@/lib/utils";
/**
 * Whose move it is.
 *
 * THE DISTINCTION THAT MATTERS IS US OR THEM. Every "in progress" hides it, and
 * it is the only thing either party wants to know — a customer chasing something
 * that is waiting on them is the commonest wasted support conversation there is.
 *
 * IT SAYS WHAT IS NEEDED, not just who from. "Waiting on you — we need the
 * registration number" turns a status into an action, and it is the sentence
 * that unblocks the majority of stalled records.
 *
 * `since` is shown because two days and two months waiting on the same person
 * call for very different follow-ups.
 */
export function WaitingOn({ who, needs, since, isYou, className }: {
  /** Who it sits with — a name, or omit when `isYou`. */
  who?: string;
  /** What they have to do. */
  needs?: string;
  since?: string;
  /** True when the reader is the one holding it up. */
  isYou?: boolean;
  className?: string;
}) {
  return (
    <p role="status" className={cn("text-sm", className)}>
      <span className={cn(isYou && "font-medium")}>
        Waiting on {isYou ? "you" : who ?? "someone else"}
      </span>
      {needs && <span className="text-muted-foreground"> — {needs}</span>}
      {since && <span className="text-muted-foreground"> · since {since}</span>}
    </p>
  );
}
