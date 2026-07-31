import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DescriptionList, type Pair } from "@/components/ui/description-list";
/** One record, opened. Title, its fields, and whatever actions belong to it. */
export function DetailPanel({ title, items, actions, className }: {
  title: string; items: Pair[]; actions?: React.ReactNode; className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </CardHeader>
      <CardContent><DescriptionList items={items} /></CardContent>
    </Card>
  );
}
