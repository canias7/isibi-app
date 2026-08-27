import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";
/**
 * Uploading a logo, with the two backgrounds it has to survive.
 *
 * IT PREVIEWS ON LIGHT AND DARK AT ONCE. A logo uploaded as black-on-transparent
 * looks perfect on the settings page and disappears entirely in the emails and
 * the dark header — which is discovered by a customer, weeks later. Showing
 * both is the whole component.
 *
 * IT ASKS FOR THE MINIMUM SIZE IN PIXELS, not "high resolution". A logo has to
 * survive a retina header and a PDF, and "high resolution" gets a 200px PNG
 * from somebody's email signature every time.
 *
 * SVG IS ACCEPTED HERE AND NOT ELSEWHERE, deliberately, and only from the
 * account owner. It is the right format for a logo, and it is a scriptable
 * document — so the caller must serve it from a separate origin or sanitise it,
 * which the note says.
 *
 * `SafeImage` on both previews, since the normal state of this component is no
 * logo yet.
 */
export function BrandUpload({ src, onFile, onRemove, minWidth = 512, note, className }: {
  src?: string;
  onFile: (file: File) => void;
  onRemove?: () => void;
  minWidth?: number;
  note?: string;
  className?: string;
}) {
  return (
    <div data-slot="brand-upload" className={cn("space-y-2", className)}>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md border border-border bg-background p-3">
          <p className="mb-1.5 text-xs text-muted-foreground">On light</p>
          <SafeImage src={src} alt="" className="h-10 w-auto object-contain" />
        </div>
        <div className="rounded-md border border-border bg-foreground p-3">
          <p className="mb-1.5 text-xs text-background/70">On dark</p>
          <SafeImage src={src} alt="" className="h-10 w-auto object-contain" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer text-sm underline underline-offset-2">
          {src ? "Choose a different logo" : "Choose a logo"}
          <input type="file" accept="image/png,image/svg+xml,image/jpeg" className="sr-only"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
        </label>
        {src && onRemove && (
          <button type="button" onClick={onRemove} className="text-sm underline underline-offset-2">Remove it</button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        PNG with a transparent background, at least {minWidth}px wide. Check it reads on both backgrounds above —
        a logo that is only black will vanish on the dark one.
        {note && ` ${note}`}
      </p>
    </div>
  );
}
