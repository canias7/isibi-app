import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type Tier = {
  name: string;
  price: string;
  period?: string;
  description?: string;
  features: string[];
  featured?: boolean;
  action?: { label: string; href?: string; onClick?: () => void };
};

/** Tiered pricing. One tier may be `featured`, which is the only visual emphasis. */
export function PricingTable({ tiers, className }: { tiers: Tier[]; className?: string }) {
  return (
    <div className={cn("grid gap-4", tiers.length > 2 ? "lg:grid-cols-3" : "sm:grid-cols-2", className)}>
      {tiers.map((t) => (
        <Card key={t.name} className={cn("flex flex-col", t.featured && "border-foreground shadow-sm")}>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">{t.name}</CardTitle>
              {t.featured && <Badge>Popular</Badge>}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-semibold tracking-tight tabular-nums">{t.price}</span>
              {t.period && <span className="text-sm text-muted-foreground">/{t.period}</span>}
            </div>
            {t.description && <CardDescription>{t.description}</CardDescription>}
          </CardHeader>
          <CardContent className="flex-1">
            <ul className="flex flex-col gap-2 text-sm">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </CardContent>
          {t.action && (
            <CardFooter>
              <Button className="w-full" variant={t.featured ? "default" : "outline"}
                asChild={!!t.action.href} onClick={t.action.onClick}>
                {t.action.href ? <a href={t.action.href}>{t.action.label}</a> : <span>{t.action.label}</span>}
              </Button>
            </CardFooter>
          )}
        </Card>
      ))}
    </div>
  );
}
