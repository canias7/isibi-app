import { X, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Rule one out, and be able to change your mind.
 *
 * NARROWING BY REJECTION IS HOW PEOPLE ACTUALLY CHOOSE from more than a handful
 * — discarding the obvious noes is easier than ranking the maybes, and almost no
 * comparison interface supports it.
 *
 * A DISCARDED OPTION IS DIMMED, NOT REMOVED. Vanishing options make the list
 * reflow under the pointer and leave the reader unsure what they eliminated, so
 * the count of what is left stops being trustworthy.
 *
 * THE UNDO IS ON THE ITEM, where the mistake is visible, rather than in a
 * toolbar that requires remembering which one went.
 */
export function EliminateOption({ eliminated, onToggle, label, className }: {
  eliminated?: boolean;
  onToggle: () => void;
  /** The option's name, for the accessible label. */
  label: string;
  className?: string;
}) {
  return (
    <button data-slot="eliminate-option" type="button" onClick={onToggle}
      aria-pressed={eliminated}
      aria-label={eliminated ? `Bring back ${label}` : `Rule out ${label}`}
      className={cn("inline-flex cursor-pointer items-center gap-1 rounded border border-border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground", className)}>
      {eliminated ? <Undo2 aria-hidden className="size-3" /> : <X aria-hidden className="size-3" />}
      {eliminated ? "Bring back" : "Rule out"}
    </button>
  );
}
