import { cn } from "@/lib/utils";
/**
 * Get told when this changes, or stop being told.
 *
 * THE LABEL SAYS WHAT WILL HAPPEN, not what the state is. "Following" as a
 * button label is ambiguous — is that the current state or what pressing does? —
 * and it is the most reliably misread control on any page. `aria-pressed`
 * carries the state; the words carry the action.
 *
 * IT NAMES WHAT IS BEING FOLLOWED in the accessible label, since a list of
 * twenty identical "Follow" buttons is what a screen reader gets otherwise.
 *
 * AUTOMATIC FOLLOWING IS DISCLOSED. Being subscribed because you commented is
 * the commonest source of unwanted notification, and somebody who never pressed
 * anything deserves to be told why they are getting mail.
 */
export function FollowToggle({ following, onChange, what, becauseAuto, className }: {
  following: boolean;
  onChange: (v: boolean) => void;
  /** What is being followed, for the accessible name. */
  what?: string;
  /** Why they are following without asking — "you commented". */
  becauseAuto?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-2", className)}>
      <button type="button" aria-pressed={following} onClick={() => onChange(!following)}
        aria-label={`${following ? "Stop following" : "Follow"}${what ? ` ${what}` : ""}`}
        className={cn("cursor-pointer rounded-md border px-3 py-1 text-sm",
          following ? "border-border text-muted-foreground hover:text-foreground" : "border-foreground font-medium")}>
        {following ? "Stop following" : "Follow"}
      </button>
      {following && becauseAuto && (
        <span className="text-xs text-muted-foreground">Following because {becauseAuto}.</span>
      )}
    </span>
  );
}
