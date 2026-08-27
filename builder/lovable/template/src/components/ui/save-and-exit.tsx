import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Leaving a long form without losing it.
 *
 * A LONG FORM WITH NO EXIT IS A FORM PEOPLE ABANDON. Somebody halfway through a
 * ten-minute application who has to find a document, take a call, or catch a
 * train has exactly two options without this: close the tab and lose
 * everything, or leave it open and hope. Neither is a decision anybody should
 * have to make.
 *
 * IT SAYS WHERE THE PROGRESS GOES AND FOR HOW LONG. "Saved" is not enough —
 * saved to this browser and saved to an account are different promises, and the
 * first evaporates on a different device or a cleared cache. Where the caller
 * knows, it says which.
 *
 * WHAT IS NOT SAVED IS NAMED. Uploaded files usually are not, and discovering
 * that on return is worse than being told now.
 *
 * NO CONFIRMATION DIALOG. The whole point is that leaving is safe; asking "are
 * you sure?" implies it is not, which is the message this component exists to
 * contradict.
 */
export function SaveAndExit({ onSave, scope = "account", keepFor, notSaved, busy, label = "Save and finish later", className }: {
  onSave: () => void;
  /** Where progress is kept — a browser copy is lost on another device. */
  scope?: "account" | "browser";
  /** Free text — "30 days". */
  keepFor?: string;
  /** Things that will not be kept — "the photos you uploaded". */
  notSaved?: string;
  busy?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <div data-slot="save-and-exit" className={cn("space-y-1", className)}>
      <Button type="button" variant="outline" size="sm" onClick={onSave} disabled={busy}>
        {busy ? "Saving…" : label}
      </Button>
      <p className="text-xs text-muted-foreground">
        {scope === "account"
          ? "Your answers are kept on your account, so you can carry on from any device."
          : "Your answers are kept in this browser only, on this device."}
        {keepFor && ` We keep them for ${keepFor}.`}
        {notSaved && ` ${notSaved} will not be kept.`}
      </p>
    </div>
  );
}
