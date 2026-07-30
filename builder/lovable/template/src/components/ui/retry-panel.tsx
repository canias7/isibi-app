import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
/** A compact inline retry, where a full error state would be too much. */
export function RetryPanel({ message = "Couldn't load this.", onRetry, className }: {
  message?: string; onRetry: () => void; className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-lg border border-dashed px-4 py-3", className)}>
      <span className="text-sm text-muted-foreground">{message}</span>
      <Button size="sm" variant="ghost" onClick={onRetry}><RefreshCw className="size-4" /> Retry</Button>
    </div>
  );
}
