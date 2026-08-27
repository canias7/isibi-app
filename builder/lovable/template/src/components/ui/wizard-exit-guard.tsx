import { useEffect } from "react";
import { cn } from "@/lib/utils";
/**
 * Catching a browser close or reload mid-form, when there is nothing saved.
 *
 * THE DIFFERENCE FROM `unsaved-guard` IS THE OFFER. That one blocks in-app
 * navigation; this handles the browser's own leave event AND, crucially, gives
 * somebody the save button before they go. A dialog that only says "are you
 * sure?" leaves the same two bad options — lose it, or stay stuck.
 *
 * THE NATIVE DIALOG'S WORDS ARE NOT OURS. Every browser replaced custom
 * `beforeunload` text years ago with its own generic message, so there is no
 * point composing one — the useful sentence has to be on the page, which is why
 * this renders a visible note as well as registering the handler.
 *
 * IT ONLY ARMS WHEN THERE IS SOMETHING TO LOSE, and disarms the moment `dirty`
 * goes false. A permanently-registered handler is why some sites nag on the way
 * out of a page you never touched.
 *
 * IT DOES NOT ARM AFTER A SAVE. `savedAt` present and `dirty` false means the
 * work is somewhere safe, and warning then is a false alarm that teaches people
 * to click through the real one.
 */
export function WizardExitGuard({ dirty, savedAt, onSave, message = "Your answers are not saved yet.", className }: {
  dirty: boolean;
  /** Free text — when it was last saved. */
  savedAt?: string;
  onSave?: () => void;
  message?: string;
  className?: string;
}) {
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);
  if (!dirty) {
    return savedAt
      ? <p className={cn("text-xs text-muted-foreground", className)}>Saved {savedAt}</p>
      : null;
  }
  return (
    <p data-slot="wizard-exit-guard" className={cn("flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground", className)}>
      <span>{message}</span>
      {onSave && (
        <button type="button" onClick={onSave} className="underline underline-offset-2">Save now</button>
      )}
    </p>
  );
}
