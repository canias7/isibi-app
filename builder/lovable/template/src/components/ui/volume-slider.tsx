import * as React from "react";
import { Volume2, Volume1, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Volume, with a mute that REMEMBERS.
 *
 * Muting stores the level and unmuting restores it. The naive version sets the
 * volume to 0 on mute, which means unmute has nothing to go back to and
 * everybody lands at either silence or full — and full is the one that makes
 * somebody slam the laptop lid in an office.
 *
 * Dragging to zero mutes, and dragging up from a muted state unmutes, because
 * a slider at zero beside an unmuted icon is a control disagreeing with itself.
 *
 * The icon has THREE states, not two. One speaker glyph for everything from 1%
 * to 100% wastes the only at-a-glance signal there is about how loud this is
 * about to be.
 *
 * Volume is PERCEPTUAL, not linear: a slider at half sounds much louder than
 * half because loudness follows roughly a cube law, so the position is squared
 * on the way to the element. Without it the useful range is all crammed into
 * the bottom fifth of the track.
 */
export function VolumeSlider({ value, muted, onChange, onMutedChange, className }: {
  value: number;
  muted?: boolean;
  onChange: (value: number) => void;
  onMutedChange?: (muted: boolean) => void;
  className?: string;
}) {
  const last = React.useRef(value || 0.6);
  const effective = muted ? 0 : value;
  const Icon = effective === 0 ? VolumeX : effective < 0.5 ? Volume1 : Volume2;

  const toggle = () => {
    if (muted) { onMutedChange?.(false); if (value === 0) onChange(last.current); }
    else { last.current = value || last.current; onMutedChange?.(true); }
  };

  return (
    <div data-slot="volume-slider" className={cn("flex items-center gap-2", className)}>
      <button type="button" onClick={toggle} aria-label={muted || effective === 0 ? "Unmute" : "Mute"}
        aria-pressed={!!muted}
        className="cursor-pointer rounded p-1 hover:bg-muted">
        <Icon aria-hidden className="size-4" />
      </button>
      <input
        type="range" min={0} max={1} step={0.01} value={effective}
        onChange={(e) => {
          const v = Number(e.target.value);
          onChange(v);
          if (v > 0) { last.current = v; if (muted) onMutedChange?.(false); }
          else if (!muted) onMutedChange?.(true);
        }}
        aria-label="Volume"
        aria-valuetext={`${Math.round(effective * 100)} per cent`}
        className="h-1 w-24 cursor-pointer accent-foreground"
      />
    </div>
  );
}

/** Slider position to element volume. Loudness is roughly a cube law; squaring is close enough and cheap. */
export function perceptualVolume(position: number) {
  return Math.min(1, Math.max(0, position)) ** 2;
}
