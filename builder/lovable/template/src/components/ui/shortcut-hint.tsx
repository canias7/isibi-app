import { KbdChord } from "@/components/ui/kbd-chord";
import { cn } from "@/lib/utils";
/**
 * The shortcut, shown next to the thing it does.
 *
 * This is how anybody learns a shortcut — beside the button they were already
 * about to press, at the moment they were about to press it. A shortcuts page
 * is a reference for people who already know they exist; this is the part that
 * tells everyone else.
 *
 * IT IS `aria-hidden` BY DEFAULT, which sounds wrong and is not. This sits
 * inside a control whose accessible name is already "Search", and appending
 * "Command or Control plus K" to that name makes every menu item read as a
 * sentence. Pass `announce` for the standalone case where nothing else is
 * saying it.
 *
 * Muted and small on purpose: a hint that competes with its own label has
 * stopped being a hint.
 */
export function ShortcutHint({ chord, announce, className }: {
  chord: string;
  /** Read it out. Only when this is not inside an already-named control. */
  announce?: boolean;
  className?: string;
}) {
  return (
    <span data-slot="shortcut-hint" aria-hidden={!announce}
      className={cn("inline-flex text-muted-foreground", className)}>
      <KbdChord chord={chord} />
    </span>
  );
}
