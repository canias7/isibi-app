import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * What a visitor sees after submitting.
 *
 * A form that clears itself and says nothing reads as a form that failed. This
 * is the other half of every `collect` table.
 */
export function SuccessPanel({ title, description, action, className }: {
  title: string;
  description?: string;
  action?: { label: string; href?: string; onClick?: () => void };
  className?: string;
}) {
  return (
    <Card className={cn("text-center", className)}>
      <CardContent className="flex flex-col items-center gap-3 pt-6">
        <span className="grid size-10 place-items-center rounded-full bg-muted"><Check className="size-5" /></span>
        <div>
          <div className="font-medium">{title}</div>
          {description && <p className="mt-1 text-sm text-muted-foreground text-balance">{description}</p>}
        </div>
        {action && (
          <Button variant="outline" size="sm" asChild={!!action.href} onClick={action.onClick}>
            {action.href ? <a href={action.href}>{action.label}</a> : <span>{action.label}</span>}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
