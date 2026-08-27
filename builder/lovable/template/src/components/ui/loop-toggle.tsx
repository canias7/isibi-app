import { Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Play it again, or don't.
 *
 * `aria-pressed` RATHER THAN A CHECKBOX, because this is a toggle button on a
 * player rather than a form field — and it is the attribute that makes a screen
 * reader announce "Loop, pressed" instead of just "Loop".
 *
 * THE STATE IS IN THE ACCESSIBLE NAME TOO, since a highlighted icon is the only
 * visual signal and highlight alone is exactly the kind of thing that does not
 * survive greyscale or a small screen.
 *
 * No third "loop all" state. A two-state toggle that secretly has three is the
 * commonest complaint about media players, and a list-level repeat belongs on
 * the list, not on the item.
 */
export function LoopToggle({ looping, onChange, className }: {
  looping: boolean;
  onChange: (v: boolean) => void;
  className?: string;
}) {
  return (
    <button data-slot="loop-toggle" type="button" aria-pressed={looping} onClick={() => onChange(!looping)}
      aria-label={looping ? "Loop is on" : "Loop is off"}
      className={cn("grid size-8 cursor-pointer place-items-center rounded border",
        looping ? "border-foreground bg-muted" : "border-border text-muted-foreground hover:text-foreground",
        className)}>
      <Repeat aria-hidden className="size-3.5" />
    </button>
  );
}
