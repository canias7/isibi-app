import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
/** The plan somebody is on, and when it renews. */
export function PlanCard({ name, price, period, renewsOn, current, action, className }: {
  name: string; price: string; period?: string; renewsOn?: string; current?: boolean;
  action?: { label: string; onClick?: () => void; href?: string }; className?: string;
}) {
  return (
    <Card className={cn(current && "border-foreground", className)}>
      <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{name}</span>
            {current && <Badge variant="secondary">Current</Badge>}
          </div>
          <div className="mt-0.5 text-sm text-muted-foreground tabular-nums">
            {price}{period && `/${period}`}{renewsOn && ` · renews ${renewsOn}`}
          </div>
        </div>
        {action && (
          <Button size="sm" variant={current ? "outline" : "default"}
            asChild={!!action.href} onClick={action.onClick}>
            {action.href ? <a href={action.href}>{action.label}</a> : <span>{action.label}</span>}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
