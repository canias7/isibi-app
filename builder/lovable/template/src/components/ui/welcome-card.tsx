import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
/** The first thing somebody sees. One primary action, one way out. */
export function WelcomeCard({ title, body, action, onAction, onSkip, className }: {
  title: string; body?: string; action?: string;
  onAction?: () => void; onSkip?: () => void; className?: string;
}) {
  return (
    <Card className={cn("border-dashed", className)}>
      <CardContent className="flex flex-col items-start gap-3 py-6">
        <h2 className="text-lg font-semibold">{title}</h2>
        {body && <p className="max-w-prose text-sm text-muted-foreground">{body}</p>}
        <div className="flex items-center gap-2 pt-1">
          {action && onAction && <Button onClick={onAction}>{action}</Button>}
          {onSkip && <Button variant="ghost" onClick={onSkip}>Not now</Button>}
        </div>
      </CardContent>
    </Card>
  );
}
