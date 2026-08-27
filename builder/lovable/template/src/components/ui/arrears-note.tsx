import { cn } from "@/lib/utils";
/**
 * Somebody behind on payments — written to be read by them.
 *
 * IT LEADS WITH WHAT TO DO, NOT WITH THE AMOUNT. Anybody in arrears already
 * knows they are behind; what stops them acting is not knowing whether anything
 * can be done and being frightened of the letter. The contact route is the first
 * thing on the screen for that reason.
 *
 * NO THREATENING LANGUAGE AND NO COUNTDOWN. Fear is why people stop opening
 * post, and a debt nobody opens is worse for the lender as well as the borrower.
 * The tone is plain and the numbers are accurate; neither needs help.
 *
 * ARREARS ARE SHOWN AS AN AMOUNT AND AS MISSED PAYMENTS. "Two months behind" and
 * "£1,840" land very differently on different people, and both are the same fact.
 *
 * AN ARRANGEMENT ALREADY IN PLACE IS SHOWN FIRST AND PROMINENTLY. Somebody who
 * has agreed a plan and is keeping to it is in a completely different position
 * from somebody who has not, and showing them the same screen is how a person
 * doing everything right is driven away.
 */
export function ArrearsNote({ amount, missedPayments, arrangement, arrangementKeptTo, contact, helpNote, currency = "GBP", locale = "en-GB", className }: {
  amount: number;
  missedPayments?: number;
  /** An agreed plan. Shown first when there is one. */
  arrangement?: string;
  arrangementKeptTo?: boolean;
  /** How to reach somebody. The first thing on the screen. */
  contact?: string;
  helpNote?: string;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  const money = (v: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
      maximumFractionDigits: Number.isInteger(v) ? 0 : 2,
    }).format(v);
  return (
    <div data-slot="arrears-note" className={cn("space-y-1 text-sm", className)}>
      {/* Never muted. Somebody keeping to an arrangement is in a completely
          different position from somebody who is not, and greying out the line
          that says so buries the one piece of good news on the screen. */}
      {arrangement && (
        <p className="font-medium">
          {arrangementKeptTo
            ? `You have an arrangement and you are keeping to it: ${arrangement}`
            : `There is an arrangement in place — ${arrangement}`}
        </p>
      )}
      <p className="tabular-nums">
        <span className="font-medium">{money(amount)} behind</span>
        {missedPayments !== undefined && (
          <span className="text-muted-foreground">
            {" "}
            · {missedPayments} missed {missedPayments === 1 ? "payment" : "payments"}
          </span>
        )}
      </p>
      {contact && (
        <p className="text-sm">
          Talk to us before anything else: {contact}. Arrangements are normal and are usually possible.
        </p>
      )}
      {helpNote && <p className="text-xs text-muted-foreground">{helpNote}</p>}
      <p className="text-xs text-muted-foreground">
        Free independent debt advice exists in most places and is worth using. It costs nothing and is not connected
        to us.
      </p>
    </div>
  );
}
