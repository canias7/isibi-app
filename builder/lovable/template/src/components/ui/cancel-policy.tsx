import { Callout } from "@/components/ui/callout";
/**
 * The cancellation terms, before booking rather than after.
 *
 * Warning-toned because it is a condition the customer is agreeing to — showing
 * it only in the confirmation email is how a business ends up arguing about it.
 */
export function CancelPolicy({ hours = 24, deposit, className }: {
  hours?: number; deposit?: string; className?: string;
}) {
  return (
    <Callout tone="warning" title="Cancellations" className={className}>
      Free to cancel or change up to {hours} hours before.
      {deposit ? ` After that the ${deposit} deposit is kept.` : " After that we may charge for the slot."}
    </Callout>
  );
}
