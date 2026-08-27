import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * What a link will look like when somebody pastes it into a chat.
 *
 * IT CHECKS THE LENGTHS AND SAYS WHAT WILL BE CUT. A title over ~60 characters
 * and a description over ~155 are truncated by most platforms, and the author
 * finds out when the link is already in a group chat. The counts are the whole
 * point of a preview tool.
 *
 * A MISSING IMAGE IS AN EXPLICIT WARNING, not an empty box. A link with no
 * `og:image` renders as a bare grey card on WhatsApp and iMessage, which is the
 * commonest reason a shared page looks broken — and it is invisible until
 * somebody shares it. `site-meta.mjs` exists in this repo for exactly this.
 *
 * The image ratio is drawn at 1.91:1, the size the platforms actually crop to.
 * Previewing at whatever ratio the file happens to be hides the crop.
 *
 * The DOMAIN is shown as the platforms show it — upper-cased, no path — because
 * that is the part a reader uses to decide whether to trust the link, and it is
 * not what the author expects to see.
 */
const TITLE_MAX = 60;
const DESC_MAX = 155;

export function SocialPreview({ url, title, description, image, className }: {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  className?: string;
}) {
  let host = url;
  try { host = new URL(url).host.replace(/^www\./, ""); } catch { /* not a URL */ }
  const titleLong = (title?.length ?? 0) > TITLE_MAX;
  const descLong = (description?.length ?? 0) > DESC_MAX;

  return (
    <div data-slot="social-preview" className={cn("flex flex-col gap-2", className)}>
      <div className="max-w-sm overflow-hidden rounded-lg border border-border">
        {image ? (
          <img src={image} alt="" className="aspect-[1.91/1] w-full object-cover" />
        ) : (
          <div className="grid aspect-[1.91/1] w-full place-items-center bg-muted text-xs text-muted-foreground">
            No image
          </div>
        )}
        <div className="flex flex-col gap-0.5 p-3">
          <p className="text-[11px] tracking-wide text-muted-foreground uppercase">{host}</p>
          <p className="line-clamp-1 text-sm font-medium">{title || "No title"}</p>
          <p className="line-clamp-2 text-xs text-muted-foreground">{description || "No description"}</p>
        </div>
      </div>
      <ul className="flex flex-col gap-1 text-xs">
        {!image ? (
          <li className="flex items-start gap-1.5 font-medium">
            <AlertCircle aria-hidden className="mt-px size-3.5 shrink-0" />
            No image — this shares as a bare grey card on WhatsApp and iMessage.
          </li>
        ) : null}
        <li className={cn("tabular-nums", titleLong ? "font-medium" : "text-muted-foreground")}>
          Title {title?.length ?? 0}/{TITLE_MAX}{titleLong ? " — will be cut off" : ""}
        </li>
        <li className={cn("tabular-nums", descLong ? "font-medium" : "text-muted-foreground")}>
          Description {description?.length ?? 0}/{DESC_MAX}{descLong ? " — will be cut off" : ""}
        </li>
      </ul>
    </div>
  );
}
