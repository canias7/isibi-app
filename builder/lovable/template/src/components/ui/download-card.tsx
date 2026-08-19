import { Button } from "@/components/ui/button";
import { FileSize } from "@/components/ui/file-size";
import { FileTypeIcon } from "@/components/ui/file-type-icon";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A file offered for download, with its size stated before the click.
 *
 * `href` IS OPTIONAL, AND THAT IS THE SAME RULE `safe-image` FOLLOWS. The file
 * itself is uploaded by the owner AFTER the build — the model writing this page
 * cannot know the address of a document that does not exist yet — so a fresh
 * site has cards with nothing behind them. It used to be required, which meant
 * the honest value was `href=""`, and `<a href="" download>` RELOADS THE CURRENT
 * PAGE: a Download button that appears to work, does nothing, and is invisible
 * to `tsc`, to the lint and to every test in the repo.
 *
 * With nothing behind it the button is replaced by a plain label rather than
 * hidden, because the card is the owner's own reminder of which file is still
 * missing, and a visitor is better told than clicked at.
 */
export function DownloadCard({ name, description, size, href, className }: {
  name: string; description?: string; size?: number; href?: string; className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 rounded-lg border p-3", className)}>
      <FileTypeIcon name={name} className="size-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">
          {description}{description && size != null ? " · " : ""}{size != null && <FileSize bytes={size} />}
        </div>
      </div>
      {href
        ? <Button size="sm" variant="outline" asChild>
            <a href={href} download><Download className="size-4" /> Download</a>
          </Button>
        : <span className="shrink-0 text-xs text-muted-foreground">Not available yet</span>}
    </div>
  );
}
