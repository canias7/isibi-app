import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * Something did not load.
 *
 * A sentence the visitor can act on and a way to try again — never a stack trace
 * or a status code, which tell a customer nothing they can use.
 */
export function ErrorState({ title = "That didn't load", description, onRetry, className }: {
  title?: string; description?: string; onRetry?: () => void; className?: string;
}) {
  return (
    <div data-slot="error-state" className={cn("flex flex-col items-center gap-3 py-10 text-center", className)} role="alert">
      <AlertTriangle className="size-5 text-muted-foreground" />
      <div>
        <div className="font-medium">{title}</div>
        <p className="mt-1 text-sm text-muted-foreground text-balance">
          {description || "Refresh the page and try again."}
        </p>
      </div>
      {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Try again</Button>}
    </div>
  );
}
