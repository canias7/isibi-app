import { cn } from "@/lib/utils";
/**
 * "This works better on a bigger screen" — with what is missing named.
 *
 * IT NAMES WHAT IS UNAVAILABLE HERE. A vague "best viewed on desktop" tells
 * somebody nothing about whether to stop what they are doing and find a laptop.
 * "Editing the layout needs a bigger screen" answers it, and lets them get on
 * with everything else.
 *
 * IT IS `md:hidden` — CSS, NOT JAVASCRIPT. Width belongs to the stylesheet; a
 * JS width check re-renders on every resize, is wrong until hydration, and
 * disagrees with the media queries governing everything around it.
 *
 * IT IS NOT A BLOCKER AND HAS NO DISMISS. Blocking assumes a bigger screen
 * exists, which for plenty of readers is simply untrue; a dismiss button
 * implies it is an interruption rather than a standing fact about the page.
 *
 * `role="note"` rather than `status` — this does not change, so announcing it
 * as a live update would be wrong.
 */
export function SmallScreenNote({ missing, message, className }: {
  /** What cannot be done at this size — "editing the layout". */
  missing?: string;
  message?: string;
  className?: string;
}) {
  return (
    <p role="note"
      className={cn("rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground md:hidden", className)}>
      {message ?? (missing ? `${missing} needs a bigger screen.` : "Some things here need a bigger screen.")}
    </p>
  );
}
