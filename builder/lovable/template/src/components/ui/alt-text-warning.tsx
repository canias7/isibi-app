import { cn } from "@/lib/utils";
/**
 * An image with no alt text, flagged where it is added.
 *
 * AT UPLOAD, NOT AT AUDIT. Alt text written months later by somebody who did not
 * take the photograph is guesswork; the person uploading knows what it shows,
 * and this is the only moment that knowledge exists.
 *
 * DECORATIVE IS A REAL ANSWER, and offering it is what stops people typing
 * "image" to make the warning go away — which is worse than empty alt, because a
 * screen reader then announces a useless word instead of skipping.
 *
 * A FILENAME IS NOT ALT TEXT. "DSC_4471.jpg" as a description is the commonest
 * automated "fix" and it is pure noise; it is called out explicitly.
 */
export function AltTextWarning({ alt, decorative, onMarkDecorative, onWrite, className }: {
  alt?: string | null;
  decorative?: boolean;
  onMarkDecorative?: () => void;
  onWrite?: () => void;
  className?: string;
}) {
  if (decorative) {
    return <p data-slot="alt-text-warning" className={cn("text-xs text-muted-foreground", className)}>Marked decorative — screen readers skip it.</p>;
  }
  const text = (alt ?? "").trim();
  const looksLikeFilename = /\.(jpe?g|png|gif|webp|heic)$/i.test(text) || /^(dsc|img)[-_ ]?\d+/i.test(text);
  if (text && !looksLikeFilename) return null;
  return (
    <p role="status" className={cn("flex flex-wrap items-baseline gap-x-2 text-xs", className)}>
      <span className="font-medium">
        {looksLikeFilename ? "That's a filename, not a description" : "No description yet"}
      </span>
      <span className="text-muted-foreground">Say what the picture shows.</span>
      {onWrite && (
        <button type="button" onClick={onWrite} className="cursor-pointer underline underline-offset-2">Add one</button>
      )}
      {onMarkDecorative && (
        <button type="button" onClick={onMarkDecorative} className="cursor-pointer underline underline-offset-2">
          It&apos;s decorative
        </button>
      )}
    </p>
  );
}
