import { FileSize } from "@/components/ui/file-size";
import { FileTypeIcon } from "@/components/ui/file-type-icon";
import { TruncateMiddle } from "@/components/ui/truncate-middle";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * One file.
 *
 * The name truncates from the MIDDLE, because the extension is the half people
 * need and an end-cut hides it.
 */
export function FileRow({ name, size, meta, href, onRemove, className }: {
  name: string; size?: number; meta?: string | null;
  href?: string; onRemove?: () => void; className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 border-b border-border py-2.5 last:border-0", className)}>
      <FileTypeIcon name={name} className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 text-sm"><TruncateMiddle text={name} max={36} /></span>
      {size != null && <span className="shrink-0 text-xs text-muted-foreground"><FileSize bytes={size} /></span>}
      {meta && <span className="shrink-0 text-xs text-muted-foreground">{meta}</span>}
      {href && <Button size="icon-sm" variant="ghost" asChild aria-label={`Download ${name}`}>
        <a href={href} download><Download className="size-4" /></a></Button>}
      {onRemove && <Button size="icon-sm" variant="ghost" onClick={onRemove} aria-label={`Remove ${name}`}>
        <X className="size-4" /></Button>}
    </div>
  );
}
