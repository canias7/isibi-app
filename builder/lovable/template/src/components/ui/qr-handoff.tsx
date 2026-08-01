import { cn } from "@/lib/utils";
/**
 * Move this to a phone.
 *
 * THE URL IS PRINTED BESIDE THE CODE, always. A QR code alone is useless to
 * anybody whose camera will not focus, whose phone is the device already showing
 * it, or who is reading with a screen reader — and the plain link costs one
 * line.
 *
 * IT SAYS WHAT SCANNING WILL DO. An unexplained code is one people are right to
 * be wary of scanning, and "opens the booking on your phone" removes the doubt.
 *
 * THE IMAGE IS THE CALLER'S. Generating a QR code is a real algorithm and a
 * dependency; the kit already refuses to ship one for the same reason it refuses
 * a map tile provider. This is the presentation around it.
 */
export function QrHandoff({ url, image, does, expiresIn, className }: {
  url: string;
  /** A rendered QR image — data URI or URL. */
  image?: string | null;
  /** What scanning achieves — "opens this booking on your phone". */
  does?: string;
  /** "10 minutes" */
  expiresIn?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-4", className)}>
      {image
        ? <img src={image} alt="" aria-hidden className="size-32 rounded border border-border bg-background" />
        : <div aria-hidden className="grid size-32 place-items-center rounded border border-dashed border-border text-xs text-muted-foreground">QR</div>}
      <div className="flex min-w-0 flex-col gap-1">
        {does && <p className="text-sm">{does}</p>}
        <code className="max-w-full truncate font-mono text-xs text-muted-foreground select-all">{url}</code>
        {expiresIn && <p className="text-xs text-muted-foreground">Expires in {expiresIn}.</p>}
      </div>
    </div>
  );
}
