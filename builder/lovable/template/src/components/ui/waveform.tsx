import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The bar chart of an audio file's loudness, used as a seek bar.
 *
 * Plain SVG from PRE-COMPUTED peaks, never decoded in the browser. Decoding
 * audio to draw it means downloading the whole file and running an
 * `AudioContext` on the main thread — for a 40-minute recording that is tens of
 * megabytes and a visible freeze, to draw something decorative. The peaks are a
 * short array a server computes once.
 *
 * It is a real `role="slider"` with arrow keys, because this IS the seek
 * control on any player that has one, and a bar chart with an onClick is a seek
 * control nobody can use from a keyboard.
 *
 * Played and unplayed are told apart by FILL — solid against hollow-outline —
 * not by two tones of the same colour, which vanish at this bar width.
 *
 * With no peaks it renders a flat placeholder rather than nothing: an audio
 * player whose scrubber disappears while the peaks are still being fetched
 * looks broken, and the seek still has to work.
 */
export function Waveform({
  peaks, progress = 0, onSeek, height = 40, bars = 96, label = "Seek", className,
}: {
  peaks: number[];
  progress?: number;
  onSeek?: (fraction: number) => void;
  height?: number;
  bars?: number;
  label?: string;
  className?: string;
}) {
  const data = React.useMemo(() => {
    if (peaks.length === 0) return Array.from({ length: bars }, () => 0.12);
    if (peaks.length <= bars) return peaks;
    // Down-sample by taking the loudest sample in each bucket — averaging
    // flattens a waveform into a grey stripe.
    const step = peaks.length / bars;
    return Array.from({ length: bars }, (_, i) =>
      Math.max(...peaks.slice(Math.floor(i * step), Math.max(Math.floor((i + 1) * step), Math.floor(i * step) + 1))));
  }, [peaks, bars]);

  const max = Math.max(...data, 0.0001);
  const w = 3, gap = 1;
  const width = data.length * (w + gap);
  const seekTo = (clientX: number, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    onSeek?.(Math.min(1, Math.max(0, (clientX - r.left) / r.width)));
  };

  return (
    <div data-slot="waveform"
      role="slider"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      aria-valuetext={`${Math.round(progress * 100)} per cent`}
      tabIndex={0}
      onClick={(e) => seekTo(e.clientX, e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); onSeek?.(Math.min(1, progress + 0.02)); }
        if (e.key === "ArrowLeft") { e.preventDefault(); onSeek?.(Math.max(0, progress - 0.02)); }
        if (e.key === "Home") { e.preventDefault(); onSeek?.(0); }
        if (e.key === "End") { e.preventDefault(); onSeek?.(1); }
      }}
      className={cn("cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        onSeek ? "" : "pointer-events-none", className)}
    >
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" aria-hidden>
        {data.map((v, i) => {
          const h = Math.max(2, (v / max) * height);
          const played = i / data.length < progress;
          return (
            <rect key={i} x={i * (w + gap)} y={(height - h) / 2} width={w} height={h} rx={1}
              fill={played ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth={played ? 0 : 1}
              className={played ? "" : "text-muted-foreground"} />
          );
        })}
      </svg>
    </div>
  );
}
