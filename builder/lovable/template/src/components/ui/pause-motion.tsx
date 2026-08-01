import { Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Stop anything that is moving on its own.
 *
 * REQUIRED, NOT OPTIONAL, for anything that animates for more than five seconds
 * — a carousel, a ticker, an auto-advancing slideshow. It is one of the oldest
 * accessibility requirements there is and one of the least often met, because
 * the control is usually left out rather than deliberately refused.
 *
 * IT IS THE FIRST THING IN THE TAB ORDER of whatever it controls, so somebody
 * who needs it does not have to Tab through the moving content to reach the
 * button that stops it — which is the failure that makes an auto-carousel
 * genuinely unusable.
 *
 * The state is in the accessible name as well as the icon, since a
 * play/pause glyph swap is the entire visual signal.
 */
export function PauseMotion({ paused, onChange, what = "the animation", className }: {
  paused: boolean;
  onChange: (paused: boolean) => void;
  /** What it controls — "the slideshow". */
  what?: string;
  className?: string;
}) {
  const Icon = paused ? Play : Pause;
  return (
    <button type="button" onClick={() => onChange(!paused)}
      aria-pressed={paused}
      aria-label={paused ? `Start ${what}` : `Stop ${what}`}
      className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs", className)}>
      <Icon aria-hidden className="size-3.5" />
      {paused ? "Start" : "Stop"}
    </button>
  );
}
