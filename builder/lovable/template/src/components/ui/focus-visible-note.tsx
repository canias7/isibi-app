import { cn } from "@/lib/utils";
/**
 * "Press Tab to move between things."
 *
 * SHOWN ONLY TO KEYBOARD USERS, via `:focus-within` on a wrapper — a hint about
 * Tab is noise to somebody using a mouse and appears for nobody until the first
 * Tab press, which is exactly when it becomes useful.
 *
 * IT DESCRIBES THE OUTLINE rather than apologising for it. The commonest
 * "problem" reported about focus rings is people not knowing what they are, and
 * the commonest fix applied is removing them — which strands every keyboard
 * user. Naming it stops the question.
 *
 * Deliberately tiny. This is orientation, not instruction, and anything larger
 * competes with the content the reader is trying to reach.
 */
export function FocusVisibleNote({ children = "Press Tab to move between things — the outline shows where you are.", className }: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="focus-visible-note" className={cn("group/fv", className)}>
      <p className="sr-only group-focus-within/fv:not-sr-only group-focus-within/fv:block group-focus-within/fv:text-xs group-focus-within/fv:text-muted-foreground">
        {children}
      </p>
    </div>
  );
}
