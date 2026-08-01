import { ClipboardBlocked } from "@/components/ui/clipboard-blocked";
import { PreviewFrame } from "@/components/ui/preview-frame";
import { cn } from "@/lib/utils";
/**
 * The snippet to paste, next to what it will look like.
 *
 * THE SNIPPET AND THE PREVIEW SIT TOGETHER, because they answer one question:
 * will this look right on my page? Splitting them across tabs means somebody
 * copies the code without ever seeing the result, and discovers the mismatch
 * after publishing.
 *
 * THE PREVIEW IS AT A CHOSEN WIDTH, not the width of this panel. An embed
 * previewed in a wide settings page and dropped into a 320px sidebar is the
 * standard disappointment, and `PreviewFrame` already solves showing a real
 * width honestly.
 *
 * THE SNIPPET IS SELECTABLE TEXT RATHER THAN A COPY BUTTON, since
 * `navigator.clipboard` fails silently on plain HTTP and outside a gesture —
 * and a snippet that did not copy is pasted as whatever was on the clipboard
 * before.
 *
 * IT SAYS WHERE THE CODE GOES. "Paste it where you want it to appear" sounds
 * obvious and is the question support gets most, because plenty of site editors
 * have a separate header field that looks like the right place.
 */
export function EmbedPreview({ snippet, width = 375, available, where = "Paste this where you want it to appear on your page.", children, className }: {
  snippet: string;
  /** Preview width in CSS pixels. */
  width?: number;
  /** Room available to draw it in. */
  available?: number;
  where?: string;
  /** What the embed renders. */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <ClipboardBlocked value={snippet} multiline label="Select and copy this" />
      <p className="text-xs text-muted-foreground">{where}</p>
      {children && (
        <PreviewFrame width={width} available={available} label="How it will look">
          {children}
        </PreviewFrame>
      )}
    </div>
  );
}
