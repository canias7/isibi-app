import * as React from "react";
import { Captions } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Captions on/off for a single player, sharing the site-wide preference.
 *
 * IT READS AND WRITES THE SAME STORED PREFERENCE AS `subtitle-track`, because
 * "captions on" is a fact about the person, not about one video — somebody who
 * needs them needs them on the next player too, and two components with two
 * stores is how the second video forgets. This is the one-question rule the
 * repo applies to schema checks, applied to a preference.
 *
 * IT IS A PRESSED-STATE BUTTON, not a menu, for the player chrome where space
 * is one icon: the full language chooser stays `subtitle-track`, and this
 * toggles the last-chosen language against off.
 *
 * When no track exists it renders DISABLED WITH A REASON rather than nothing —
 * a viewer who relies on captions deserves "this video has none" over a
 * mysteriously absent control. That absence is a fact about the video worth
 * one tooltip.
 */
import { useCaptionPreference } from "@/components/ui/subtitle-track";

export function CaptionToggle({ hasTrack = true, defaultLang = "en", className }: {
  hasTrack?: boolean;
  defaultLang?: string;
  className?: string;
}) {
  const [pref, setPref] = useCaptionPreference("off");
  const on = pref !== "off";
  const last = React.useRef(pref !== "off" ? pref : defaultLang);
  if (on) last.current = pref;

  return (
    <button data-slot="caption-toggle"
      type="button"
      disabled={!hasTrack}
      aria-pressed={on}
      title={!hasTrack ? "This video has no captions" : undefined}
      onClick={() => setPref(on ? "off" : last.current)}
      className={cn("cursor-pointer rounded p-1.5 disabled:cursor-not-allowed disabled:opacity-40",
        on ? "bg-foreground text-background" : "hover:bg-muted", className)}
    >
      <Captions aria-hidden className="size-4" />
      <span className="sr-only">
        {!hasTrack ? "This video has no captions" : on ? "Turn captions off" : "Turn captions on"}
      </span>
    </button>
  );
}
