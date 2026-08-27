import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * Rooms, distance and date, answered with a RANGE.
 *
 * THE ANSWER IS A RANGE AND THAT IS THE ENTIRE POINT. This trade's friction is
 * that nobody will publish a number — every removals site in the country asks
 * for a phone number and then quotes on the call, because an exact figure needs
 * a survey and a wrong one is a complaint. So the industry says nothing, and a
 * customer with four quotes to get spends a week on the phone. A range is
 * honest about the uncertainty AND answers the question: "£640 to £860" tells
 * somebody whether to keep reading, which "request a quote" does not.
 *
 * THE SPREAD WIDENS WITH THE JOB, because a two-hour van hire really is
 * predictable and a four-bedroom house across the country really is not. A
 * fixed ±15% would understate the small job and lie about the big one.
 *
 * NOTHING IS HIDDEN BEHIND CONTACT DETAILS. No email field, no phone field, no
 * "we'll send your estimate" — the number appears on the page. Asking for a
 * phone number before answering is the practice this replaces.
 *
 * IT SHOWS ITS WORKING. Base, distance, stairs, packing, date — each line
 * priced, so somebody can see why a Saturday in July costs more and decide to
 * move on the Tuesday. A single opaque figure invites the suspicion the whole
 * trade already suffers from.
 *
 * THE MULTIPLIERS ARE THE CALLER'S. A removals firm in Sheffield and one in
 * central London have nothing in common but the shape of the sum, so every rate
 * is a prop with a plausible default rather than a number baked in here.
 */
export type QuoteRates = {
  /** Charged on every job before anything else. */
  callOut: number;
  /** Per room, including the kitchen but not the loft. */
  perRoom: number;
  /** Per mile beyond `freeMiles`. */
  perMile: number;
  freeMiles: number;
  /** Per flight of stairs at either end, where there is no lift. */
  perFlight: number;
  /** Per room, if they pack for you. */
  packingPerRoom: number;
  /** Multiplier for a Saturday, Sunday or a bank holiday. */
  weekendUplift: number;
  /** Multiplier for the last three working days of a month. */
  monthEndUplift: number;
};
const DEFAULTS: QuoteRates = {
  callOut: 180, perRoom: 95, perMile: 1.8, freeMiles: 15,
  perFlight: 45, packingPerRoom: 60, weekendUplift: 1.15, monthEndUplift: 1.1,
};
export function QuoteCalculator({
  rates, maxRooms = 6, currency = "GBP", locale = "en-GB",
  onBookSurvey, className,
}: {
  rates?: Partial<QuoteRates>;
  maxRooms?: number;
  currency?: string;
  locale?: string;
  onBookSurvey?: (v: { rooms: number; miles: number; low: number; high: number }) => void;
  className?: string;
}) {
  const r = { ...DEFAULTS, ...rates };
  const id = React.useId();
  const [rooms, setRooms] = React.useState(2);
  const [miles, setMiles] = React.useState("12");
  const [flights, setFlights] = React.useState(0);
  const [packing, setPacking] = React.useState(false);
  const [when, setWhen] = React.useState<"weekday" | "weekend" | "monthEnd">("weekday");

  const m = Math.max(0, Number(miles.replace(/[^\d.]/g, "")) || 0);
  const lines = [
    { label: "Call-out, van and two crew", value: r.callOut },
    { label: `${rooms} room${rooms === 1 ? "" : "s"}`, value: rooms * r.perRoom },
    {
      label: m > r.freeMiles ? `${Math.round(m - r.freeMiles)} miles beyond the first ${r.freeMiles}` : `Within ${r.freeMiles} miles`,
      value: Math.max(0, m - r.freeMiles) * r.perMile,
    },
    { label: flights ? `${flights} flight${flights === 1 ? "" : "s"} of stairs, no lift` : "Ground floor at both ends", value: flights * r.perFlight },
    { label: packing ? "We pack for you" : "You pack", value: packing ? rooms * r.packingPerRoom : 0 },
  ];
  const base = lines.reduce((a, l) => a + l.value, 0);
  const uplift = when === "weekend" ? r.weekendUplift : when === "monthEnd" ? r.monthEndUplift : 1;
  const total = base * uplift;
  // THE SPREAD WIDENS WITH THE JOB. A one-room local move is genuinely
  // predictable; four bedrooms across the country is not, and a flat ±15%
  // would be too wide for the first and far too narrow for the second.
  const spread = 0.08 + rooms * 0.02 + (m > 100 ? 0.06 : 0);
  const money = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  const chip = (on: boolean) =>
    cn("rounded-md border px-3 py-1.5 text-sm", on ? "border-foreground bg-foreground font-medium text-background" : "border-border");

  return (
    <div data-slot="quote-calculator" className={cn("rounded-xl border border-border bg-background p-6 sm:p-8", className)}>
      <div className="grid gap-8 lg:grid-cols-[1fr_auto]">
        <div className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium">How many rooms</legend>
            <p className="mt-1 text-xs text-muted-foreground">Count the kitchen. Do not count the loft — tell us about that separately.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {Array.from({ length: maxRooms }, (_, i) => i + 1).map((n) => (
                <button key={n} type="button" onClick={() => setRooms(n)} aria-pressed={rooms === n} className={chip(rooms === n)}>
                  {n}{n === maxRooms ? "+" : ""}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-1.5">
            <label htmlFor={`${id}-miles`} className="text-sm font-medium">How far, in miles</label>
            <input
              id={`${id}-miles`} value={miles} inputMode="numeric"
              onChange={(e) => setMiles(e.target.value.replace(/[^\d]/g, ""))}
              className="h-10 w-28 rounded-md border border-border bg-background px-3 tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground">Door to door. The first {r.freeMiles} are in the call-out.</p>
          </div>

          <fieldset>
            <legend className="text-sm font-medium">Stairs, with no lift</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {[0, 1, 2, 3, 4].map((n) => (
                <button key={n} type="button" onClick={() => setFlights(n)} aria-pressed={flights === n} className={chip(flights === n)}>
                  {n === 0 ? "None" : `${n} flight${n === 1 ? "" : "s"}`}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium">When</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {([["weekday", "A weekday"], ["weekend", "A weekend"], ["monthEnd", "End of the month"]] as const).map(([k, label]) => (
                <button key={k} type="button" onClick={() => setWhen(k)} aria-pressed={when === k} className={chip(when === k)}>
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              The last three working days of a month and every Saturday are the busy ones. Moving on
              a Tuesday is the cheapest thing on this page.
            </p>
          </fieldset>

          <label className="flex items-start gap-3">
            <input type="checkbox" checked={packing} onChange={(e) => setPacking(e.target.checked)} className="mt-1" />
            <span>
              <span className="block text-sm font-medium">Pack for me</span>
              <span className="block text-xs text-muted-foreground">Boxes, paper and two extra people the day before.</span>
            </span>
          </label>
        </div>

        <div className="lg:w-80">
          <div className="rounded-lg border border-border bg-muted/50 p-5">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Likely cost</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
              {money(total * (1 - spread))} – {money(total * (1 + spread))}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              A range, not a quote. A survey turns it into a fixed price and takes about twenty
              minutes — over video if that is easier.
            </p>
            <Button className="mt-4 w-full"
              onClick={() => onBookSurvey?.({ rooms, miles: m, low: Math.round(total * (1 - spread)), high: Math.round(total * (1 + spread)) })}>
              Book a survey
            </Button>
          </div>

          {/* SHOWS ITS WORKING. An opaque figure invites exactly the suspicion
              this whole trade already suffers from. */}
          <dl className="mt-5 divide-y divide-border border-y border-border text-sm">
            {lines.map((l) => (
              <div key={l.label} className="flex items-baseline justify-between gap-3 py-2">
                <dt className="text-muted-foreground">{l.label}</dt>
                <dd className="tabular-nums">{money(l.value)}</dd>
              </div>
            ))}
            {uplift !== 1 && (
              <div className="flex items-baseline justify-between gap-3 py-2">
                <dt className="text-muted-foreground">{when === "weekend" ? "Weekend" : "End of the month"}</dt>
                <dd className="tabular-nums">+{Math.round((uplift - 1) * 100)}%</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    </div>
  );
}
