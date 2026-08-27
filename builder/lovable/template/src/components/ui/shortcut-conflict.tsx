import { KbdChord } from "@/components/ui/kbd-chord";
import { cn } from "@/lib/utils";
/**
 * "That one is already Duplicate."
 *
 * Shown while somebody is recording a custom shortcut, before they commit to
 * it. Afterwards is too late: two actions on one chord means one of them
 * silently stops working, and the person who broke it has no reason to connect
 * the two.
 *
 * IT NAMES WHAT HOLDS THE KEYS. "Already in use" sends somebody hunting through
 * a settings page; "already Duplicate" is the whole answer.
 *
 * BROWSER AND SYSTEM CHORDS GET A DIFFERENT SENTENCE, because they cannot be
 * taken — ⌘W closes the tab whatever this app would prefer, and offering to
 * reassign it is a promise that will not hold. `reserved` marks that case.
 *
 * `role="alert"`: it appears in direct response to a keypress the reader just
 * made, which is the moment interrupting is correct.
 */
export function ShortcutConflict({ chord, takenBy, reserved, onReplace, className }: {
  chord: string;
  /** What currently owns it. */
  takenBy?: string;
  /** True when the browser or OS owns it and it cannot be reassigned. */
  reserved?: boolean;
  onReplace?: () => void;
  className?: string;
}) {
  return (
    <p data-slot="shortcut-conflict" role="alert" className={cn("flex flex-wrap items-center gap-2 text-sm", className)}>
      <KbdChord chord={chord} />
      {reserved ? (
        <span className="text-muted-foreground">is reserved by your browser and can&apos;t be changed.</span>
      ) : (
        <>
          <span className="text-muted-foreground">
            is already {takenBy ? <span className="font-medium text-foreground">{takenBy}</span> : "in use"}.
          </span>
          {onReplace && (
            <button type="button" onClick={onReplace}
              className="cursor-pointer underline underline-offset-4">Use it here instead</button>
          )}
        </>
      )}
    </p>
  );
}
