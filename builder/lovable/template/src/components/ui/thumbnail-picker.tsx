import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";
/**
 * Choose the still that represents a video.
 *
 * THE AUTOMATIC FRAME IS USUALLY WRONG. Grabbing frame zero gives a black
 * fade-in, and grabbing the midpoint gives whatever happened to be there — which
 * is how a video ends up represented by the back of somebody's head.
 *
 * FRAME TIMES ARE SHOWN, so the chooser knows which part of the clip each still
 * comes from rather than picking blind from a row of similar images.
 *
 * A real `radiogroup`: one of several, arrow-key navigable, and the selected one
 * announced. A row of clickable images is the usual implementation and is
 * unreachable by keyboard.
 */
export function ThumbnailPicker({ frames, value, onChange, className }: {
  frames: { key: string; src?: string | null; at: string }[];
  value?: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  if (!frames.length) return null;
  return (
    <div data-slot="thumbnail-picker" role="radiogroup" aria-label="Choose a thumbnail" className={cn("flex gap-2 overflow-x-auto pb-1", className)}>
      {frames.map((f) => {
        const active = f.key === value;
        return (
          <button key={f.key} type="button" role="radio" aria-checked={active}
            onClick={() => onChange(f.key)}
            aria-label={`Frame at ${f.at}`}
            className={cn("flex w-24 shrink-0 cursor-pointer flex-col gap-1 rounded border p-1",
              active ? "border-foreground" : "border-border hover:border-foreground/40")}>
            <SafeImage src={f.src ?? null} alt="" ratio="16/9" className="rounded-xs" />
            <span className={cn("text-center text-xs tabular-nums", active ? "font-medium" : "text-muted-foreground")}>
              {f.at}
            </span>
          </button>
        );
      })}
    </div>
  );
}
