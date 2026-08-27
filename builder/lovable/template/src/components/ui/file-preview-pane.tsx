import { SafeImage } from "@/components/ui/safe-image";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A look at a file without opening it.
 *
 * IT DEGRADES BY KIND RATHER THAN FAILING. An image previews, a PDF shows its
 * first page if the caller supplies one, and everything else gets a named
 * placeholder with the size and type — a preview pane that renders a broken
 * image icon for a spreadsheet is worse than one that says "spreadsheet".
 *
 * THE DOWNLOAD IS ALWAYS AVAILABLE, including when a preview exists. A preview
 * is a convenience; assuming it removes the need for the real file strands
 * anybody whose format did not render.
 *
 * `SafeImage` rather than a bare `<img>`, because a thumbnail URL that has
 * expired or was never set would otherwise paint a broken icon — the failure
 * this kit already solved once.
 */
export function FilePreviewPane({ name, kind, size, thumbnail, href, className }: {
  name: string;
  /** "image" | "pdf" | anything else, shown as-is. */
  kind?: string;
  /** Formatted by the caller — "2.4 MB". */
  size?: string;
  thumbnail?: string | null;
  href?: string;
  className?: string;
}) {
  const visual = kind === "image" || kind === "pdf";
  return (
    <figure data-slot="file-preview-pane" className={cn("flex flex-col gap-2 rounded-md border border-border p-3", className)}>
      {visual && thumbnail ? (
        <SafeImage src={thumbnail} alt="" ratio="4/3" />
      ) : (
        <div className="flex aspect-4/3 items-center justify-center rounded bg-muted">
          <FileText aria-hidden className="size-8 text-muted-foreground" />
        </div>
      )}
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="min-w-0 truncate font-medium">{name}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {[kind, size].filter(Boolean).join(" · ")}
        </span>
      </figcaption>
      {href && (
        <a href={href} download className="text-sm underline underline-offset-4">Download</a>
      )}
    </figure>
  );
}
