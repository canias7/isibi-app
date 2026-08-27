import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Marking a comment thread settled, and unmarking it.
 *
 * IT UNDOES. Resolving is the single most-misfired control in any comment UI —
 * it sits next to reply, it is one click, and half the time the thread was not
 * actually finished. `aria-pressed` makes it a toggle rather than a one-way
 * door, and the label changes to say so.
 *
 * THE RESOLVER IS NAMED when the caller knows it. "Resolved by Sam" ends the
 * argument about whether a thread was closed on purpose or by an accidental
 * click, which is otherwise unanswerable.
 *
 * A TICK PLUS A WORD, never a green tick alone. State that exists only as
 * colour and an icon is the exact pattern the rest of this kit refuses.
 *
 * `aria-pressed` and not a checkbox: this is a button that acts immediately,
 * not a field somebody submits, and a checkbox implies a form around it.
 */
export function ResolveToggle({ resolved, onToggle, by, size = "sm", className }: {
  resolved: boolean;
  onToggle: (next: boolean) => void;
  /** Who resolved it — shown only when resolved. */
  by?: string;
  size?: "sm" | "default";
  className?: string;
}) {
  return (
    <span data-slot="resolve-toggle" className={cn("inline-flex items-center gap-2", className)}>
      <button type="button" aria-pressed={resolved} onClick={() => onToggle(!resolved)}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-2 font-medium",
          size === "sm" ? "h-7 text-xs" : "h-9 text-sm",
          resolved ? "border-foreground bg-foreground text-background" : "border-border",
        )}>
        <Check className="size-3.5" aria-hidden="true" />
        {resolved ? "Resolved" : "Resolve"}
      </button>
      {resolved && by && <span className="text-xs text-muted-foreground">by {by}</span>}
    </span>
  );
}
