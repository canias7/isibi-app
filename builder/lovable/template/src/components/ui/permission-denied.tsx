import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * You are signed in, and this still is not yours.
 *
 * IT DISTINGUISHES ITSELF FROM "SIGN IN". Being refused while signed in and
 * being refused because you are not are completely different problems, and
 * showing a login form to somebody already logged in is the loop that generates
 * support tickets.
 *
 * IT NAMES WHO CAN GRANT IT. "You don't have access" is a wall; "Ask Sam, who
 * owns this workspace" is a next step, and it is the difference between a
 * ticket and a message.
 *
 * `needed` states the role required, so an admin reading over somebody's
 * shoulder can fix it without opening a permissions matrix.
 */
export function PermissionDenied({ what = "this", needed, owner, onRequest, className }: {
  what?: string;
  /** The role required — "Editor". */
  needed?: string;
  /** Who can grant it. */
  owner?: string;
  onRequest?: () => void;
  className?: string;
}) {
  return (
    <section role="alert" aria-label="No access"
      className={cn("flex flex-col items-start gap-2 rounded-md border border-border p-6", className)}>
      <Lock aria-hidden className="size-5 text-muted-foreground" />
      <p className="text-sm font-medium">You don&apos;t have access to {what}</p>
      <p className="text-sm text-muted-foreground">
        {needed ? `It needs the ${needed} role. ` : ""}
        {owner ? `Ask ${owner}, who can grant it.` : "Ask whoever owns it for access."}
      </p>
      {onRequest && <Button size="sm" onClick={onRequest}>Request access</Button>}
    </section>
  );
}
