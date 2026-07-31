import { Card, CardContent } from "@/components/ui/card";
import { DescriptionList, type Pair } from "@/components/ui/description-list";
import { Separator } from "@/components/ui/separator";
/**
 * What is about to be booked, shown before the button.
 *
 * A confirmation step that restates the choice is the cheapest way to stop the
 * wrong-day booking that costs a business a no-show.
 */
export function BookingSummary({ items, total, currency = "£", footer, className }: {
  items: Pair[]; total?: number | string; currency?: string;
  footer?: React.ReactNode; className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="flex flex-col gap-3 pt-6">
        <DescriptionList items={items} />
        {total != null && (
          <>
            <Separator />
            <div className="flex items-baseline justify-between font-medium">
              <span>Total</span>
              <span className="tabular-nums">{typeof total === "number" ? currency + total.toFixed(2) : total}</span>
            </div>
          </>
        )}
        {footer}
      </CardContent>
    </Card>
  );
}
