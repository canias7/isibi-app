import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * From, to, and a FIXED price — on the page, before anybody rings.
 *
 * THE WHOLE TRADE RUNS ON NOT SAYING. Every taxi firm's site asks for a phone
 * number and quotes on the call, and a passenger comparing three firms spends
 * an evening on hold. A fixed figure on the page is the entire competitive
 * position, exactly as the range is for removals — the difference is that a
 * journey between two known points really can be quoted exactly, so this
 * answers with a price rather than a spread.
 *
 * WHAT IS INCLUDED IS PART OF THE PRICE, not a follow-up. Waiting time,
 * luggage, the meet-and-greet and the airport drop-off fee are what turn a £38
 * quote into £52 at the end of the journey, and every one of them is knowable
 * up front. Stating them is what makes the number trustworthy.
 *
 * IT LOOKS NOTHING UP ITSELF. `onQuote` fires with the two addresses and the
 * time; the answer comes back as props. Same shape as `date-enquiry`,
 * `repair-status` and `vehicle-lookup` — the pricing is the firm's business and
 * this component has none of it.
 *
 * A NIGHT OR AIRPORT SURCHARGE IS SHOWN AS ITS OWN LINE, never folded silently
 * into the total. A passenger who sees the tariff explained does not feel
 * stung; one who sees a bigger number than they expected does, even when it is
 * the same number.
 */
export function FareQuote({
  fare, quoting, notCovered, lines, includes, onQuote, onBook,
  currency = "GBP", locale = "en-GB", heading = "What will it cost?", className,
}: {
  /** The fixed price. Null until asked, or when nothing can be quoted. */
  fare?: number | null;
  quoting?: boolean;
  /** True when the journey is outside the area — a different answer from "no price yet". */
  notCovered?: boolean;
  /** How the fare is made up: night tariff, airport drop-off, extra stop. */
  lines?: { label: string; value: number }[];
  /** What is already in the price. */
  includes?: string[];
  onQuote?: (v: { from: string; to: string; when: string }) => void;
  onBook?: (v: { from: string; to: string; when: string; fare: number }) => void;
  currency?: string;
  locale?: string;
  heading?: string;
  className?: string;
}) {
  const id = React.useId();
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [when, setWhen] = React.useState("now");
  const ready = from.trim().length > 1 && to.trim().length > 1;
  const money = (n: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);
  const field = "h-10 w-full rounded-md border border-border bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <div className={cn("rounded-xl border border-border bg-background p-6 sm:p-8", className)}>
      <h2 className="text-lg font-semibold tracking-tight">{heading}</h2>
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => { e.preventDefault(); if (ready) onQuote?.({ from, to, when }); }}
      >
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-from`} className="text-sm font-medium">Picking up from</label>
          <input id={`${id}-from`} value={from} autoComplete="off" placeholder="Postcode, street or place"
            onChange={(e) => setFrom(e.target.value)} className={field} />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-to`} className="text-sm font-medium">Going to</label>
          <input id={`${id}-to`} value={to} autoComplete="off" placeholder="Postcode, street or place"
            onChange={(e) => setTo(e.target.value)} className={field} />
        </div>
        <fieldset>
          <legend className="text-sm font-medium">When</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {([["now", "Now"], ["today", "Later today"], ["booked", "Another day"]] as const).map(([k, label]) => (
              <button key={k} type="button" onClick={() => setWhen(k)} aria-pressed={when === k}
                className={cn("rounded-md border px-3 py-1.5 text-sm",
                  when === k ? "border-foreground bg-foreground font-medium text-background" : "border-border")}>
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <Button type="submit" size="lg" disabled={!ready || quoting}>
          {quoting ? "Working it out…" : "Get a fixed price"}
        </Button>
      </form>

      {notCovered && (
        <p className="mt-5 border-t border-border pt-5 text-sm">
          <span className="font-medium">That one is outside our patch. </span>
          <span className="text-muted-foreground">
            Ring anyway — we will either take it or give you the number of somebody who will.
          </span>
        </p>
      )}

      {typeof fare === "number" && !notCovered && (
        <div className="mt-5 border-t border-border pt-5">
          {/* THE NUMBER, at size, in words that say it will not move. */}
          <p className="text-3xl font-semibold tracking-tight tabular-nums">{money(fare)}</p>
          <p className="mt-1 text-sm font-medium">Fixed. This is what you pay.</p>

          {lines && lines.length > 0 && (
            /* SURCHARGES AS THEIR OWN LINES. Folded into the total silently,
               the same figure feels like being stung. */
            <dl className="mt-4 divide-y divide-border border-y border-border text-sm">
              {lines.map((l) => (
                <div key={l.label} className="flex items-baseline justify-between gap-3 py-2">
                  <dt className="text-muted-foreground">{l.label}</dt>
                  <dd className="tabular-nums">{money(l.value)}</dd>
                </div>
              ))}
            </dl>
          )}

          {includes && includes.length > 0 && (
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Included: </span>{includes.join(" · ")}
            </p>
          )}

          <Button className="mt-5" size="lg" onClick={() => onBook?.({ from, to, when, fare })}>
            Book this journey
          </Button>
        </div>
      )}
    </div>
  );
}
