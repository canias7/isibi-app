import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * "Ada is editing this."
 *
 * Names the person holding the lock, always. "Locked" on its own leaves
 * somebody with no next step; a name means they can go and ask.
 *
 * `since` is shown when it is there, because a lock left open by a closed
 * laptop looks exactly like one somebody is actively using, and the age is
 * the only thing that tells them apart.
 */
export function LockIndicator({ by, since, className }: {
  by?: string | null; since?: string; className?: string;
}) {
  if (!by) return null;
  return (
    <span data-slot="lock-indicator" className={cn("inline-flex items-center gap-1.5 rounded bg-muted px-2 py-1 text-xs", className)}>
      <Lock className="size-3.5 shrink-0 text-muted-foreground" />
      <strong className="font-medium">{by}</strong>
      <span className="text-muted-foreground">is editing{since ? ` · ${since}` : ""}</span>
    </span>
  );
}
