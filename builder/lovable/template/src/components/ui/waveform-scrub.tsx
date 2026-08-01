import { cn } from "@/lib/utils";
/**
 * An audio waveform you can seek through.
 *
 * THE SEEK CONTROL IS A NATIVE RANGE INPUT LAID OVER THE DRAWING. The waveform
 * is decoration; the input is the control. Every implementation that makes the
 * bars themselves clickable is unusable by keyboard, and this way arrow keys,
 * Home and End all work for free.
 *
 * THE PEAKS ARE THE CALLER'S. Decoding audio to compute them is expensive,
 * belongs off the render path, and is usually done once server-side — a
 * component that did it would put an AudioContext in a list item.
 *
 * Played bars are filled and the rest hollow, which reads in greyscale; and the
 * whole drawing is `aria-hidden` because a screen reader gets the position from
 * the input's `aria-valuetext` instead.
 */
export function WaveformScrub({ peaks, position, duration, onSeek, formatTime, className }: {
  /** 0-1 per bar. */
  peaks: number[];
  /** Seconds played. */
  position: number;
  /** Seconds total. */
  duration: number;
  onSeek: (seconds: number) => void;
  /** Turns seconds into "3:12" for the announcement. */
  formatTime?: (s: number) => string;
  className?: string;
}) {
  if (!peaks.length || duration <= 0) return null;
  const played = position / duration;
  const say = formatTime ?? ((s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`);
  return (
    <div className={cn("relative", className)}>
      <div aria-hidden className="flex h-12 items-end gap-px">
        {peaks.map((p, i) => (
          <span key={i}
            className={cn("flex-1 rounded-xs", i / peaks.length <= played ? "bg-foreground" : "bg-muted")}
            style={{ height: `${Math.max(Math.min(p, 1), 0.04) * 100}%` }} />
        ))}
      </div>
      <input type="range" min={0} max={duration} step={0.1} value={position}
        aria-label="Seek" aria-valuetext={`${say(position)} of ${say(duration)}`}
        onChange={(e) => onSeek(Number(e.target.value))}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
    </div>
  );
}
