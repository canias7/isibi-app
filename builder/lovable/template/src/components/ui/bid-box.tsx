import * as React from "react";
import { BusyButton } from "@/components/ui/busy-button";
import { DateFormat } from "@/components/ui/date-format";
import { Money } from "@/components/ui/money";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
/**
 * Place a bid. The box on an auction listing.
 *
 * THE FIELD IS PRE-FILLED WITH THE SMALLEST BID THAT WOULD BE ACCEPTED, and the
 * minimum is stated above it in words. Every version of this that starts empty
 * produces the same failure: somebody types the current price, is refused, and
 * has to work out the increment themselves — usually twice, because the price
 * moved while they were reading.
 *
 * The refusal is ONE sentence naming the number. "Bids must be at least £46" is
 * actionable; "invalid bid" is not, and a field that just goes red says even
 * less.
 *
 * WHERE YOU STAND IS SAID IN WORDS — "You are the highest bidder", "You have
 * been outbid" — in a `role="status"` so it is announced when it changes. This
 * is the number one thing a bidder returns to the page to find out, and a
 * coloured border does not answer it for anyone who cannot see the colour, or
 * who has just arrived and has nothing to compare it against.
 *
 * `BusyButton` matters more here than anywhere else in the kit: a double-submit
 * is a real second bid against your own money.
 *
 * No live countdown. `endsAt` renders as a `<time>` and `countdown-ring` is the
 * component to pair it with — rebuilding a ticking clock inside this would be
 * a second, worse copy of one the kit already has.
 */
export function BidBox({
  current, minIncrement, currency = "GBP", bids, endsAt, ended,
  youAreHighest, reserveMet, onBid, busy, className,
}: {
  /** The standing bid, in major units. */
  current: number;
  /** How much more the next bid must be. */
  minIncrement: number;
  currency?: string;
  /** How many bids so far. */
  bids?: number;
  endsAt?: string | number | Date;
  ended?: boolean;
  youAreHighest?: boolean;
  /** Omit if this auction has no reserve. */
  reserveMet?: boolean;
  onBid: (amount: number) => void | Promise<unknown>;
  busy?: boolean;
  className?: string;
}) {
  const minimum = current + minIncrement;
  const [amount, setAmount] = React.useState(String(minimum));
  const [error, setError] = React.useState<string | null>(null);
  const id = React.useId();

  // The floor moves when somebody else bids. A field still holding the old
  // minimum would be refused the moment it is submitted, so it follows —
  // unless the bidder has typed something of their own.
  const [touched, setTouched] = React.useState(false);
  React.useEffect(() => { if (!touched) setAmount(String(minimum)); }, [minimum, touched]);

  const money = new Intl.NumberFormat(undefined, { style: "currency", currency }).format(minimum);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || ended) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value < minimum) { setError(`Bids must be at least ${money}.`); return; }
    setError(null);
    await onBid(value);
    setTouched(false);
  }

  return (
    <section data-slot="bid-box" className={cn("flex flex-col gap-3 rounded-md border border-border p-5", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm text-muted-foreground">{bids ? "Current bid" : "Starting bid"}</p>
          <p className="text-2xl font-semibold tracking-tight">
            <Money amount={current} currency={currency} />
          </p>
        </div>
        <p className="text-sm text-muted-foreground tabular-nums">
          {typeof bids === "number" ? `${bids} ${bids === 1 ? "bid" : "bids"}` : null}
          {typeof reserveMet === "boolean" ? `${typeof bids === "number" ? " · " : ""}${reserveMet ? "Reserve met" : "Reserve not met"}` : null}
        </p>
      </div>

      {(youAreHighest !== undefined || ended) && (
        <p role="status" className="text-sm font-medium">
          {ended ? "Bidding has closed" : youAreHighest ? "You are the highest bidder" : "You have been outbid"}
        </p>
      )}

      {!ended && (
        <form onSubmit={submit} className="flex flex-col gap-2">
          <Label htmlFor={id}>Your bid — {money} or more</Label>
          <div className="flex flex-wrap gap-2">
            <input
              id={id} type="number" inputMode="decimal"
              min={minimum} step={minIncrement} value={amount}
              onChange={(e) => { setTouched(true); setAmount(e.target.value); }}
              aria-invalid={!!error || undefined}
              aria-describedby={error ? `${id}-error` : undefined}
              className="h-9 min-w-32 flex-1 rounded-md border border-input bg-transparent px-3 text-sm tabular-nums"
            />
            <BusyButton type="submit" busy={busy} busyLabel="Placing…">Place bid</BusyButton>
          </div>
          {error && <p id={`${id}-error`} role="alert" className="text-sm font-medium">{error}</p>}
        </form>
      )}

      {endsAt && (
        <p className="text-xs text-muted-foreground">
          {ended ? "Ended" : "Ends"} <DateFormat date={endsAt} withTime />
        </p>
      )}
    </section>
  );
}
