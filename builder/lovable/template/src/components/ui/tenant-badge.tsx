import { cn } from "@/lib/utils";
/**
 * Which workspace you are in — kept visible, especially when it is not yours.
 *
 * ACTING-AS IS THE STATE THIS EXISTS FOR. Support staff and administrators
 * switch into somebody else's workspace and forget, then send an email or
 * delete a record from an account that is not theirs. A quiet badge is
 * insufficient; when `actingAs` is set the whole thing is emphatic and stays on
 * screen.
 *
 * IT NAMES A WAY BACK. A person who realises they are in the wrong workspace
 * needs an exit in the same glance, not a hunt through a menu — which is where
 * the accidental action happens.
 *
 * ENVIRONMENT SITS WITH IT, because "acme, staging" and "acme, live" are the
 * two workspaces most catastrophically confused, and they usually differ by one
 * word in a URL.
 *
 * NOT A COLOUR STRIPE. The convention is a red bar for production, which is
 * invisible in greyscale and means nothing to somebody who has not been told —
 * the words carry it.
 */
export function TenantBadge({ name, environment, actingAs, onLeave, className }: {
  name: string;
  /** "live", "staging". */
  environment?: string;
  /** Set when this is somebody else's workspace. */
  actingAs?: boolean;
  onLeave?: () => void;
  className?: string;
}) {
  if (!actingAs) {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
        <span className="font-medium text-foreground">{name}</span>
        {environment && <span>{environment}</span>}
      </span>
    );
  }
  return (
    <div role="status"
      className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-foreground bg-foreground px-3 py-1.5 text-sm text-background", className)}>
      <span>
        You are in <span className="font-medium">{name}</span>
        {environment && <span> · {environment}</span>}
        <span className="block text-xs opacity-80">This is not your own workspace.</span>
      </span>
      {onLeave && (
        <button type="button" onClick={onLeave} className="ml-auto text-xs underline underline-offset-2">
          Leave it
        </button>
      )}
    </div>
  );
}
