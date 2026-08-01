import { Mic } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Hold to speak — with a tap-to-toggle path for anybody who cannot hold.
 *
 * HOLDING A BUTTON IS AN ACCESSIBILITY PROBLEM and this is the component that
 * fixes it. Sustained pressure is impossible for some people and hard for
 * others, and a press-and-hold with no alternative simply excludes them. `mode`
 * offers toggle, and it is not a lesser path.
 *
 * IT SHOWS THAT IT IS LISTENING WITH A WORD, never a pulsing dot alone. Whether
 * a microphone is live is the single most important state on the screen, and
 * encoding it purely in an animation fails for reduced-motion and in a
 * screenshot.
 *
 * IT ENDS ON `pointerup` ANYWHERE, not just on the button. Dragging off the
 * button while holding is the ordinary way a press ends on a touchscreen, and
 * handling only `onPointerUp` on the element leaves the microphone open.
 *
 * `aria-pressed` in toggle mode, and a spoken hint in hold mode, so somebody
 * using a screen reader knows which of the two behaviours this instance has.
 */
export function PushToTalk({ listening, onStart, onStop, mode = "hold", disabled, className }: {
  listening: boolean;
  onStart: () => void;
  onStop: () => void;
  /** "hold" is press-and-hold, "toggle" is tap on, tap off. */
  mode?: "hold" | "toggle";
  disabled?: boolean;
  className?: string;
}) {
  const hold = mode === "hold";
  return (
    <div className={cn("space-y-1", className)}>
      <button type="button" disabled={disabled}
        {...(hold
          ? {
              onPointerDown: onStart,
              onPointerUp: onStop,
              onPointerCancel: onStop,
              onPointerLeave: () => { if (listening) onStop(); },
              onKeyDown: (e: React.KeyboardEvent) => { if ((e.key === " " || e.key === "Enter") && !listening) onStart(); },
              onKeyUp: (e: React.KeyboardEvent) => { if ((e.key === " " || e.key === "Enter") && listening) onStop(); },
            }
          : { onClick: () => (listening ? onStop() : onStart()), "aria-pressed": listening })}
        className={cn("inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
          listening ? "border-foreground bg-foreground text-background" : "border-border")}>
        <Mic className="size-4" aria-hidden="true" />
        {listening ? "Listening — speak now" : hold ? "Hold to speak" : "Tap to speak"}
      </button>
      <p className="text-xs text-muted-foreground">
        {hold
          ? "Hold the button, or hold space, while you speak."
          : "Tap once to start, tap again to stop."}
      </p>
    </div>
  );
}
