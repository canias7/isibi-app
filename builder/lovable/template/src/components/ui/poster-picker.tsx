import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Choosing the still that represents a video.
 *
 * Frames from ACROSS the video, never the first one. Frame zero is a fade from
 * black on most footage, so a player that uses it shows a black rectangle for
 * every video on the page — which is why every platform that ever shipped this
 * offers a choice.
 *
 * `captureFrames` seeks a hidden `<video>` and draws to a canvas, and it is
 * exported separately because it FAILS on a cross-origin file: the canvas is
 * tainted and `toDataURL` throws. That is not a bug to work around, it is the
 * browser refusing to let one origin read another's pixels, and the honest
 * response is to fall back to a manual upload — which is why `onUpload` exists.
 *
 * The selected frame is marked by a tick and a heavier border, not a tint: a
 * translucent overlay on a photograph is invisible on the light ones.
 */
export async function captureFrames(src: string, count = 6): Promise<string[]> {
  const video = document.createElement("video");
  video.src = src;
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.preload = "metadata";
  await new Promise<void>((res, rej) => {
    video.onloadedmetadata = () => res();
    video.onerror = () => rej(new Error("Could not read that video"));
  });
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 360;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas");
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    // Spread across the middle of the file: the very start and the very end are
    // usually a fade to or from black on real footage.
    const at = ((i + 0.5) / count) * video.duration * 0.9 + video.duration * 0.05;
    await new Promise<void>((res) => { video.onseeked = () => res(); video.currentTime = at; });
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    out.push(canvas.toDataURL("image/jpeg", 0.7));
  }
  return out;
}

export function PosterPicker({ frames, value, onChange, onUpload, error, className }: {
  frames: string[];
  value?: string;
  onChange: (src: string) => void;
  onUpload?: () => void;
  error?: React.ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="poster-picker" className={cn("flex flex-col gap-2", className)}>
      <p className="text-sm font-medium">Cover image</p>
      {frames.length === 0 ? (
        <p className="text-xs text-muted-foreground">No frames yet.</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {frames.map((f, i) => {
            const on = f === value;
            return (
              <li key={i}>
                <button type="button" onClick={() => onChange(f)} aria-pressed={on}
                  aria-label={`Use frame ${i + 1}`}
                  className={cn("relative block w-full cursor-pointer overflow-hidden rounded-md border-2",
                    on ? "border-foreground" : "border-transparent hover:border-border")}>
                  <img src={f} alt="" className="block aspect-video w-full object-cover" />
                  {on ? (
                    <span className="absolute top-1 end-1 rounded-full bg-foreground p-0.5 text-background">
                      <Check aria-hidden className="size-3" />
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {error ? <p className="text-xs font-medium">{error}</p> : null}
      {onUpload ? (
        <button type="button" onClick={onUpload}
          className="cursor-pointer self-start text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
          Upload your own instead
        </button>
      ) : null}
    </div>
  );
}
