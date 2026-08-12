import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OrderSummary, type SummaryLine } from "@/components/ui/order-summary";
/** The basket panel: the figures plus the button that moves it forward. */
export function CartSummary({ lines, total, currency = "£", action, note, className }: {
  lines: SummaryLine[]; total: number | string; currency?: string;
  action?: { label: string; href?: string; onClick?: () => void; disabled?: boolean };
  note?: string; className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="flex flex-col gap-4 pt-6">
        <OrderSummary lines={lines} total={total} currency={currency} note={note} />
        {/* A DISABLED LINK IS NOT A THING. `asChild` hands the Button's props to
            the `<a>`, and an anchor has no `disabled` attribute — so with an
            `href` set, `disabled` was decoration and the checkout CTA stayed
            fully clickable while the cart said it was not ready. When it is
            disabled the link is not rendered at all: a real `<button>` is the
            only element the browser will actually refuse to activate. */}
        {action && (
          <Button className="w-full" disabled={action.disabled}
            asChild={!!action.href && !action.disabled} onClick={action.onClick}>
            {action.href && !action.disabled
              ? <a href={action.href}>{action.label}</a>
              : <span>{action.label}</span>}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
