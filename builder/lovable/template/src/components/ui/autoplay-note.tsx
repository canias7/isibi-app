import { cn } from "@/lib/utils";
/**
 * "Sound is off — press to hear it."
 *
 * AUTOPLAY ONLY WORKS MUTED, and readers do not know that. A video playing
 * silently looks like a video with no sound, so people watch the whole thing
 * without the audio and conclude it was pointless.
 *
 * IT IS A CONTROL, not a caption. Saying sound is off without offering to turn
 * it on makes the reader hunt for a control that is usually hidden until hover —
 * which does not exist on touch at all.
 *
 * Renders nothing once unmuted. A permanent "sound is on" label is furniture,
 * and this has one job.
 */
export function AutoplayNote({ muted, onUnmute, className }: {
  muted: boolean;
  onUnmute: () => void;
  className?: string;
}) {
  if (!muted) return null;
  return (
    <button data-slot="autoplay-note" type="button" onClick={onUnmute}
      className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background/90 px-2.5 py-1 text-xs shadow-xs", className)}>
      <span className="font-medium">Sound is off</span>
      <span className="text-muted-foreground">— press to hear it</span>
    </button>
  );
}
