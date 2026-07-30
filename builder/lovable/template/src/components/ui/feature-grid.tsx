import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type Feature = { title: string; description?: string | null; icon?: React.ReactNode };

/** Two to four things the business wants to say about itself. */
export function FeatureGrid({ items, columns = 3, className }: {
  items: Feature[];
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const cols = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[columns];
  return (
    <div className={cn("grid gap-4", cols, className)}>
      {items.map((f, i) => (
        <Card key={f.title || i}>
          <CardHeader className="gap-2">
            {f.icon && <div className="text-muted-foreground [&_svg]:size-5">{f.icon}</div>}
            <CardTitle className="text-base">{f.title}</CardTitle>
          </CardHeader>
          {f.description && <CardContent className="text-sm text-muted-foreground">{f.description}</CardContent>}
        </Card>
      ))}
    </div>
  );
}
