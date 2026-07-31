import { toast } from "sonner";
/**
 * "Deleted. Undo" — the alternative to an "are you sure?" dialog.
 *
 * Better than a confirm for anything reversible: a confirmation interrupts
 * every correct action to guard against the rare wrong one, and people learn
 * to dismiss it without reading. An undo interrupts nothing and still saves
 * the mistake.
 *
 * The action is only run once the toast has GONE, so the row disappears
 * immediately and the write is what waits. Undo cancels the write rather than
 * reversing it, which is why it needs no second endpoint.
 */
export function undoToast({ message, onCommit, onUndo, seconds = 6 }: {
  message: string; onCommit: () => void; onUndo?: () => void; seconds?: number;
}) {
  let undone = false;
  toast(message, {
    duration: seconds * 1000,
    action: {
      label: "Undo",
      onClick: () => { undone = true; onUndo?.(); },
    },
    onAutoClose: () => { if (!undone) onCommit(); },
    // A toast dismissed by hand is not an undo — the person read it and moved
    // on, so the action still goes through.
    onDismiss: () => { if (!undone) onCommit(); },
  });
}
