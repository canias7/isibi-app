import { Button } from "@/components/ui/button";
import { FileSize } from "@/components/ui/file-size";
import { FileTypeIcon } from "@/components/ui/file-type-icon";
import { Download } from "lucide-react";
import { cn } from "@/lib/utils";
/** A file offered for download, with its size stated before the click. */
export function DownloadCard({ name, description, size, href, className }: {
  name: string; description?: string; size?: number; href: string; className?: string;
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
      <Button size="sm" variant="outline" asChild>
        <a href={href} download><Download className="size-4" /> Download</a>
      </Button>
    </div>
  );
}
