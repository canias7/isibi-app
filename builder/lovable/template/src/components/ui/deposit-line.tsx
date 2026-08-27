import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
/**
 * The bit paid up front, and whether it comes back.
 *
 * REFUNDABLE OR NOT IS THE WHOLE QUESTION, and it is the thing most deposit
 * lines omit. A £200 deposit that is lost on cancellation and one that is
 * returned are completely different commitments shown identically.
 *
 * THE BALANCE AND WHEN IT IS DUE sit with it, because "deposit £200" invites
 * "and then what?" — and the answer arriving later, by email, is how a booking
 * gets disputed.
 *
 * When it is refundable, the CONDITION is stated rather than implied: "returned
 * if you cancel more than 48 hours ahead" is a rule somebody can follow.
 */
export function DepositLine({ deposit, balance, dueWhen, refundable, condition, currency = "GBP", className }: {
  deposit: number;
  /** What is left to pay. */
  balance?: number;
  /** When the balance falls due — "on the day". */
  dueWhen?: string;
  refundable?: boolean;
  /** The rule — "if you cancel more than 48 hours ahead". */
  condition?: string;
  currency?: string;
  className?: string;
}) {
  return (
    <div data-slot="deposit-line" className={cn("flex flex-col gap-0.5 text-sm", className)}>
      <p className="tabular-nums">
        <span className="font-medium"><Money amount={deposit} currency={currency} /> deposit</span>
        {typeof balance === "number" && (
          <span className="text-muted-foreground">
            {" · "}<Money amount={balance} currency={currency} /> {dueWhen ?? "to pay later"}
          </span>
        )}
      </p>
      <p className="text-xs text-muted-foreground">
        {refundable
          ? <>Refundable{condition ? ` ${condition}` : ""}.</>
          : <>Non-refundable{condition ? ` ${condition}` : ""}.</>}
      </p>
    </div>
  );
}
