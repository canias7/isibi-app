import { EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Stands in for content that was removed.
 *
 * Leaves the gap visible rather than silently deleting the row: a thread that
 * loses a comment without saying so reads as broken, and the reply below it
 * stops making sense.
 */
export function ModerationNote({ reason = "This comment was removed.", className }: {
  reason?: string; className?: string;
}) {
  return (
    <p className={cn("flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground", className)}>
      <EyeOff className="size-4 shrink-0" />{reason}
    </p>
  );
}
