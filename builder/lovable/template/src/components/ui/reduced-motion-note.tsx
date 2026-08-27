import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * "Animations are off because your system asks for that."
 *
 * IT EXPLAINS AN ABSENCE. Somebody whose device requests reduced motion sees a
 * site with no transitions and no autoplay, and has no way to tell that from a
 * site that is broken or from features quietly missing — this is the only thing
 * that closes that gap.
 *
 * IT DOES NOT OFFER TO OVERRIDE THE SYSTEM SETTING. The reader already expressed
 * a preference at the OS level, and a site that asks again is second-guessing an
 * accessibility choice they made deliberately.
 *
 * The check runs in an effect and listens for changes, since the setting can be
 * toggled while the page is open — and renders nothing when motion is allowed,
 * which is the resting state for almost everybody.
 */
export function ReducedMotionNote({ affects, className }: {
  /** What is off as a result — "the slideshow advances on its own only when you press". */
  affects?: string;
  className?: string;
}) {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);
  if (!reduced) return null;
  return (
    <p data-slot="reduced-motion-note" className={cn("text-xs text-muted-foreground", className)}>
      Animations are off because your device asks for reduced motion.
      {affects ? ` ${affects}` : ""}
    </p>
  );
}
