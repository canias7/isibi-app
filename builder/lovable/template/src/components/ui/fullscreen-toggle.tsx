import { useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Enter and leave fullscreen, on whatever element the caller points at.
 *
 * IT LISTENS TO `fullscreenchange` RATHER THAN TRACKING ITS OWN STATE. Escape
 * leaves fullscreen without touching this button, so a component holding a
 * local boolean ends up showing "Exit fullscreen" on a page that is not — and
 * pressing it then does nothing, twice.
 *
 * IT HIDES ITSELF WHERE THE API IS ABSENT, which is iOS Safari on iPhone: it
 * has no element fullscreen at all. A button that cannot work is worse than no
 * button, and this is the one platform where that case is common rather than
 * theoretical.
 *
 * THE REQUEST IS AWAITED AND ITS REJECTION SWALLOWED. `requestFullscreen`
 * rejects when it is not called from a gesture, and an unhandled rejection in a
 * click handler is a console error on a perfectly ordinary refusal.
 *
 * ICON PLUS AN `aria-label` THAT CHANGES, since the two arrows are only
 * distinguishable if you already know the convention.
 */
export function FullscreenToggle({ targetRef, enterLabel = "Fullscreen", exitLabel = "Leave fullscreen", className }: {
  /** The element to expand. Omit for the whole page. */
  targetRef?: React.RefObject<HTMLElement | null>;
  enterLabel?: string;
  exitLabel?: string;
  className?: string;
}) {
  const [on, setOn] = useState(false);
  const [ok, setOk] = useState(false);
  useEffect(() => {
    setOk(typeof document !== "undefined" && Boolean(document.fullscreenEnabled));
    const sync = () => setOn(Boolean(document.fullscreenElement));
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  if (!ok) return null;
  const Icon = on ? Minimize2 : Maximize2;
  return (
    <button type="button" aria-label={on ? exitLabel : enterLabel}
      onClick={() => {
        const el = targetRef?.current ?? document.documentElement;
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
        else void el.requestFullscreen?.().catch(() => {});
      }}
      className={cn("inline-flex size-8 items-center justify-center rounded-md border border-border", className)}>
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}
