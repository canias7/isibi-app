import { cn } from "@/lib/utils";
/**
 * Who has read it.
 *
 * NAMES, NOT A COUNT, up to a few. "Seen by 3" prompts the immediate question of
 * which three, and on a small team the names are both shorter and the actual
 * answer.
 *
 * IT SAYS WHO HAS *NOT* when the caller supplies the total. On anything needing
 * acknowledgement — a policy, a shift change — the unread list is the actionable
 * half, and every implementation shows the read one instead.
 *
 * No avatars. A row of 20px circles beside names already written out adds
 * network requests and a layout shift for no information.
 */
export function SeenBy({ names, total, max = 3, className }: {
  names: string[];
  /** Everyone it went to, so the unread count can be stated. */
  total?: number;
  max?: number;
  className?: string;
}) {
  if (!names.length) {
    return <p data-slot="seen-by" className={cn("text-xs text-muted-foreground", className)}>Not seen yet</p>;
  }
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  const unread = typeof total === "number" ? total - names.length : null;
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      Seen by {shown.join(", ")}
      {rest > 0 ? ` and ${rest} more` : ""}
      {unread !== null && unread > 0 && (
        <span className="font-medium text-foreground tabular-nums"> · {unread} yet to see it</span>
      )}
    </p>
  );
}
