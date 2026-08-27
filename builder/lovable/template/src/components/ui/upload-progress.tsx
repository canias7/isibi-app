import { Progress } from "@/components/ui/progress";
import { FileTypeIcon } from "@/components/ui/file-type-icon";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * One upload in flight.
 *
 * A failed upload keeps its row and offers a retry rather than vanishing —
 * disappearing is indistinguishable from having worked.
 */
export function UploadProgress({ name, percent, error, onCancel, onRetry, className }: {
  name: string; percent: number; error?: string | null;
  onCancel?: () => void; onRetry?: () => void; className?: string;
}) {
  return (
    <div data-slot="upload-progress" className={cn("flex flex-col gap-1.5 border-b border-border py-2.5 last:border-0", className)}>
      <div className="flex items-center gap-2">
        <FileTypeIcon name={name} className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {error ? "Failed" : `${Math.round(percent)}%`}
        </span>
        {error && onRetry && <Button size="sm" variant="ghost" onClick={onRetry}>Retry</Button>}
        {onCancel && <Button size="icon-sm" variant="ghost" onClick={onCancel} aria-label={`Cancel ${name}`}>
          <X className="size-4" /></Button>}
      </div>
      {error ? <InlineAlert tone="error">{error}</InlineAlert>
             : <Progress value={percent} aria-label={`Uploading ${name}`} />}
    </div>
  );
}
