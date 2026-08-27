import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * One integration in a directory — what it does, and whether it is connected.
 *
 * IT SAYS WHAT THE INTEGRATION WILL DO, not what the other product is.
 * "Xero — accounting software" is a description of Xero; "sends your invoices
 * to Xero every night" is what connecting it does to YOUR data, which is the
 * only thing the reader is deciding about.
 *
 * CONNECTED IS A WORD PLUS THE ACCOUNT NAME. "Connected" alone leaves somebody
 * unable to tell which of their two Xero organisations it is pointed at — and
 * that is exactly the mistake that quietly files invoices in the wrong company
 * for a month.
 *
 * NO LOGO. A directory of brand marks needs licensed artwork, ships a remote
 * image per card, and is the thing most likely to be out of date; the name in
 * text is unambiguous and free. Same reasoning as `payment-methods`.
 *
 * DISCONNECT IS NOT ON THE CARD. It has consequences that need explaining, so
 * it belongs to `disconnect-warning` — a one-click disconnect in a grid is the
 * kind of thing done by accident.
 */
export function ConnectorCard({ name, does, connected, account, onConnect, onManage, unavailable, reason, className }: {
  name: string;
  /** What connecting it does — "sends your invoices every night". */
  does: string;
  connected?: boolean;
  /** Which account it is joined to. */
  account?: string;
  onConnect?: () => void;
  onManage?: () => void;
  unavailable?: boolean;
  reason?: string;
  className?: string;
}) {
  return (
    <div data-slot="connector-card" className={cn("flex flex-col gap-2 rounded-lg border border-border p-3", className)}>
      <div>
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{does}</p>
      </div>
      {connected && (
        <p className="text-xs">
          <span className="font-medium">Connected</span>
          {account && <span className="text-muted-foreground"> · {account}</span>}
        </p>
      )}
      {unavailable && <p className="text-xs text-muted-foreground">{reason ?? "Not available on your plan"}</p>}
      <div className="mt-auto">
        {connected
          ? onManage && <Button type="button" size="sm" variant="outline" onClick={onManage}>Settings</Button>
          : onConnect && <Button type="button" size="sm" onClick={onConnect} disabled={unavailable}>Connect</Button>}
      </div>
    </div>
  );
}
