import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * "Add this to your home screen" — asked once, at a sensible moment.
 *
 * THE DISMISS IS PERMANENT AND THAT IS THE POINT. An install prompt that
 * reappears on every visit is the single most resented pattern on the mobile
 * web. `onDismiss` is expected to persist the refusal; the component makes the
 * button as prominent as the accept so nobody has to hunt for it.
 *
 * IT NEVER APPEARS ON FIRST LOAD, by construction — the caller decides when,
 * and the prop is named `ready` rather than `open` to say so. Asking somebody
 * to install an app before they know what it is gets refused, and the refusal
 * is permanent in the other direction too.
 *
 * IOS GETS INSTRUCTIONS INSTEAD OF A BUTTON, because Safari has no install
 * event — there is nothing to call. A button that does nothing on a third of
 * phones is worse than a sentence saying which menu item to press.
 *
 * IT SAYS WHAT INSTALLING BUYS. "Add to home screen" describes the gesture;
 * "opens faster and works without signal" is the reason to make it.
 */
export function InstallPrompt({ ready, benefit, onInstall, onDismiss, platform = "prompt", className }: {
  ready: boolean;
  /** Why it is worth doing. */
  benefit?: string;
  onInstall?: () => void;
  onDismiss: () => void;
  /** "prompt" when the browser offers one, "ios" for Safari's manual route. */
  platform?: "prompt" | "ios";
  className?: string;
}) {
  if (!ready) return null;
  return (
    <div data-slot="install-prompt" className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-border p-3", className)}>
      <p className="min-w-0 flex-1 text-sm">
        Add this to your home screen
        {benefit && <span className="block text-xs text-muted-foreground">{benefit}</span>}
        {platform === "ios" && (
          <span className="block text-xs text-muted-foreground">
            Press Share, then “Add to Home Screen”.
          </span>
        )}
      </p>
      <span className="flex shrink-0 gap-2">
        {platform === "prompt" && onInstall && (
          <Button type="button" size="sm" onClick={onInstall}>Add</Button>
        )}
        <Button type="button" size="sm" variant="outline" onClick={onDismiss}>No thanks</Button>
      </span>
    </div>
  );
}
