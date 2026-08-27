import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Loudness, with a mute that remembers where you were.
 *
 * MUTING DOES NOT SET THE VOLUME TO ZERO. It sets a flag, so unmuting returns to
 * the level the listener chose — a player that drops to zero and comes back at
 * full is the reason people mute the browser tab instead.
 *
 * A native range input, so it is keyboard-operable and honours OS pointer
 * settings; `aria-valuetext` carries a percentage, since "0.62" announced raw is
 * meaningless.
 *
 * Named `volume-control` for loudness and deliberately distinct from
 * `capacity-input`, which is volume as a measurement — two different words that
 * are the same string in English, which is exactly why the pair was renamed
 * during the dedup rather than left to collide.
 */
export function VolumeControl({ volume, muted, onVolumeChange, onMutedChange, id, className }: {
  /** 0-1. */
  volume: number;
  muted: boolean;
  onVolumeChange: (v: number) => void;
  onMutedChange: (v: boolean) => void;
  id?: string;
  className?: string;
}) {
  const pct = Math.round(Math.min(Math.max(volume, 0), 1) * 100);
  const Icon = muted || pct === 0 ? VolumeX : Volume2;
  return (
    <span data-slot="volume-control" className={cn("inline-flex items-center gap-2", className)}>
      <button type="button" onClick={() => onMutedChange(!muted)}
        aria-pressed={muted} aria-label={muted ? "Unmute" : "Mute"}
        className="grid size-8 cursor-pointer place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground">
        <Icon aria-hidden className="size-4" />
      </button>
      <input id={id} type="range" min={0} max={1} step={0.01} value={muted ? 0 : volume}
        aria-label="Volume" aria-valuetext={muted ? "Muted" : `${pct}%`}
        onChange={(e) => { onVolumeChange(Number(e.target.value)); if (muted) onMutedChange(false); }}
        className="w-24 cursor-pointer accent-foreground" />
    </span>
  );
}
