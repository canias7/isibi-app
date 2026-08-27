import * as React from "react";
import { Play, Pause, Volume2, VolumeX, Maximize } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A video with our own controls — for a file we host, where `video-embed`
 * covers YouTube and Vimeo.
 *
 * `playsInline` is not optional. Without it iOS Safari takes any playing video
 * fullscreen, which destroys a page built around a video sitting in a layout,
 * and it is invisible on every desktop browser used to build the page.
 *
 * State is read from the ELEMENT's events, never assumed from the button that
 * was pressed. A video pauses for reasons nothing here initiated — the tab
 * hides, the network stalls, the OS takes the audio focus — and a paused video
 * under a pause button is the commonest bug in a hand-rolled player.
 *
 * `preload="metadata"`, so the duration and the poster are known without
 * pulling the whole file down for a visitor who never presses play.
 *
 * The keyboard gets space and the arrows, and the container is focusable, which
 * is what makes those reachable at all — the native controls have this and
 * every custom bar has to put it back.
 */
export function VideoPlayer({
  src, poster, captions, title, className, ...rest
}: {
  src: string;
  poster?: string;
  captions?: { src: string; label: string; lang: string; default?: boolean }[];
  title?: string;
  className?: string;
} & Omit<React.ComponentProps<"video">, "src" | "poster" | "className">) {
  const ref = React.useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [muted, setMuted] = React.useState(false);
  const [at, setAt] = React.useState(0);
  const [len, setLen] = React.useState(0);

  const clock = (s: number) => {
    if (!Number.isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  };
  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  };

  return (
    <div data-slot="video-player"
      tabIndex={0}
      onKeyDown={(e) => {
        const v = ref.current;
        if (!v) return;
        if (e.key === " " || e.key === "k") { e.preventDefault(); toggle(); }
        if (e.key === "ArrowRight") { e.preventDefault(); v.currentTime += 5; }
        if (e.key === "ArrowLeft") { e.preventDefault(); v.currentTime -= 5; }
        if (e.key === "m") { e.preventDefault(); v.muted = !v.muted; }
      }}
      className={cn("group relative overflow-hidden rounded-lg bg-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring", className)}
    >
      <video
        {...rest}
        ref={ref}
        src={src}
        poster={poster}
        title={title}
        playsInline
        preload="metadata"
        onClick={toggle}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onVolumeChange={(e) => setMuted(e.currentTarget.muted)}
        onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setLen(e.currentTarget.duration)}
        className="block w-full cursor-pointer"
      >
        {captions?.map((c) => (
          <track key={c.src} kind="captions" src={c.src} label={c.label} srcLang={c.lang} default={c.default} />
        ))}
      </video>

      <div className="flex items-center gap-2 bg-foreground px-2 py-1.5 text-background">
        <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"}
          className="cursor-pointer rounded p-1 hover:bg-background/20">
          {playing ? <Pause aria-hidden className="size-4" /> : <Play aria-hidden className="size-4" />}
        </button>
        <span className="text-xs tabular-nums">{clock(at)}</span>
        <input
          type="range" min={0} max={len || 0} step={0.1} value={at}
          onChange={(e) => { if (ref.current) ref.current.currentTime = Number(e.target.value); }}
          aria-label="Seek"
          className="h-1 min-w-0 flex-1 cursor-pointer accent-background"
        />
        <span className="text-xs tabular-nums">{clock(len)}</span>
        <button type="button" aria-label={muted ? "Unmute" : "Mute"}
          onClick={() => { if (ref.current) ref.current.muted = !ref.current.muted; }}
          className="cursor-pointer rounded p-1 hover:bg-background/20">
          {muted ? <VolumeX aria-hidden className="size-4" /> : <Volume2 aria-hidden className="size-4" />}
        </button>
        <button type="button" aria-label="Fullscreen"
          onClick={() => void ref.current?.requestFullscreen?.().catch(() => {})}
          className="cursor-pointer rounded p-1 hover:bg-background/20">
          <Maximize aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  );
}
