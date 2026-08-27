import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * A date and a headcount, answered. Not a contact form with a date field on it.
 *
 * THE ANSWER HAS THREE VALUES AND "UNKNOWN" MUST NEVER RENDER AS FREE. A venue
 * whose diary was last touched in March has not thereby got a free Saturday,
 * and telling somebody their date is available when it is not is the worst
 * outcome available here — they stop looking, they tell their family, and they
 * find out later. So `null` is "ask us" and says so, loudly enough to be an
 * answer rather than a shrug.
 *
 * THE HEADCOUNT IS ASKED AT THE SAME TIME, because a date free for forty is a
 * taken date for two hundred. Answering availability without the number is
 * answering a different question from the one being asked, and every venue
 * enquiry form in the country does exactly that and then emails back to ask.
 *
 * A TAKEN DATE OFFERS THE NEAREST FREE ONES. That is the conversion moment and
 * the ordinary version of this control throws it away — "unavailable" with no
 * next step sends somebody to the venue down the road, when they may well not
 * care about the Saturday nearly as much as they care about the room.
 *
 * IT LOOKS NOTHING UP ITSELF. The caller passes `status`, because the diary
 * lives in the site's own tables and this component has no business fetching.
 * `onCheck` fires with the date and the number; the answer comes back as props.
 */
export type DateStatus = "free" | "taken" | "ask";
export function DateEnquiry({
  status = null, checking, alternatives, minGuests, maxGuests,
  defaultDate = "", defaultGuests,
  onCheck, onEnquire, now, heading = "Is your date free?", className,
}: {
  /** The answer. `null` means nothing has been asked yet OR nothing is known. */
  status?: DateStatus | null;
  checking?: boolean;
  /**
   * Seed the fields. A caller that resolves availability on the server — from
   * `?date=` in the URL, say — passes `status` on the very first render, and
   * without these the component would be answering about a date it has never
   * been told. See the note on the answer sentence below.
   */
  defaultDate?: string;
  defaultGuests?: number;
  /** Nearest free dates, offered when the asked-for one is taken. ISO "2026-08-15". */
  alternatives?: string[];
  minGuests?: number;
  maxGuests?: number;
  onCheck?: (v: { date: string; guests: number }) => void;
  /** The follow-up once they have an answer. */
  onEnquire?: (v: { date: string; guests: number }) => void;
  /** Injectable clock, so the past cannot be picked and a test can fix "today". */
  now?: Date;
  heading?: string;
  className?: string;
}) {
  const id = React.useId();
  const [date, setDate] = React.useState(defaultDate);
  const [guests, setGuests] = React.useState(defaultGuests ? String(defaultGuests) : "");
  const today = (now ?? new Date()).toISOString().slice(0, 10);
  const n = Number(guests);
  const over = maxGuests != null && n > maxGuests;
  const under = minGuests != null && guests.trim() !== "" && n < minGuests;
  const ready = !!date && n > 0 && !over && !under;
  // ISO parsed as LOCAL, not through `new Date("2026-08-15")` — that is UTC
  // midnight, which renders as the 14th for every reader west of Greenwich.
  //
  // TWO FORMATTERS AND OUR OWN SPACE, NOT ONE FORMATTER WITH FOUR FIELDS. Asking
  // ICU for `{weekday:"short", day, month:"long", year}` in one call makes it
  // improvise the join, and implementations disagree about it: measured, Node
  // (ICU 78.2) returns "Sat, 19 September 2026" and this Chromium returns
  // "Sat 19 September 2026". One character, same timezone, same locale — and it
  // is rendered during SSR whenever a caller passes `status` with a date, so
  // React refused the hydration (#418, "text") and took `entertainer /` down.
  //
  // IT IS NOT THE PROBLEM `pinSiteLocale` SOLVES, which is worth being clear
  // about because that module looks like it should cover this. It makes an
  // ABSENT locale mean the site's, and deliberately leaves an explicit one
  // alone — both sides here already agreed on "en-GB". This is two ICU VERSIONS
  // disagreeing about one locale's pattern, which no amount of locale-pinning
  // reaches.
  //
  // AND IT CANNOT BE FIXED BY MATCHING ENGINES, which is why the answer is to
  // stop asking. We SSR in workerd and hydrate in whatever browser the visitor
  // brought, at whatever ICU version it ships — so any format whose output
  // depends on the ICU version WILL mismatch for some fraction of real
  // visitors. The proof that this is luck rather than safety: CI's Node and
  // CI's Chromium happen to agree, so `family apps` was green on this page
  // while it failed here.
  //
  // Both halves below were measured stable across both engines on their own; the
  // only unstable part was the literal between them, and now it is ours.
  const pretty = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return iso;
    const at = new Date(y, m - 1, d);
    const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short" }).format(at);
    const rest = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(at);
    return `${weekday} ${rest}`;
  };
  return (
    <div data-slot="date-enquiry" className={cn("rounded-xl border border-border bg-background p-6", className)}>
      <h2 className="text-lg font-semibold tracking-tight">{heading}</h2>
      {/* Flex-wrap, not a grid with an `1fr` first column. In a wide container
          that `1fr` stretched the date input to eight hundred pixels, which is
          a control the width of the page for six characters of input. A date
          field is date-sized whatever the container is doing. */}
      <form
        className="mt-4 flex flex-wrap items-end gap-4"
        onSubmit={(e) => { e.preventDefault(); if (ready) onCheck?.({ date, guests: n }); }}
      >
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-date`} className="text-sm font-medium">The date</label>
          <input
            id={`${id}-date`} type="date" value={date} min={today}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 w-48 rounded-md border border-border bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor={`${id}-guests`} className="text-sm font-medium">How many</label>
          <input
            id={`${id}-guests`} value={guests} inputMode="numeric" placeholder="120"
            aria-describedby={over || under ? `${id}-limit` : undefined}
            onChange={(e) => setGuests(e.target.value.replace(/[^\d]/g, ""))}
            className="h-10 w-28 rounded-md border border-border bg-background px-3 tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="w-full">
          <Button type="submit" size="lg" disabled={!ready || checking}>
            {checking ? "Checking…" : "Check this date"}
          </Button>
        </div>
      </form>

      {(over || under) && (
        <p id={`${id}-limit`} className="mt-3 text-sm font-medium">
          {over
            ? `We hold ${maxGuests} at most. Tell us anyway — we know people who can take more.`
            : `Our smallest room takes ${minGuests}. Anything under that would be lost in it.`}
        </p>
      )}

      {status && (
        <div className="mt-5 border-t border-border pt-5">
          {/* WORDS AT WEIGHT, never a green tick and a red cross. This is the one
              sentence the whole page exists to produce and it has to survive
              greyscale, a printout and anybody who does not see colour. */}
          {/* NEITHER SENTENCE MAY RENDER WITH A HOLE IN IT. Rendered against a
              `status` passed before anything was typed, the naive version read
              " is free" and "For 0 people" — a leading space where the date
              should be and a headcount of nobody. Both clauses are now
              conditional on the value existing, so the worst case is a slightly
              vaguer sentence rather than an obviously broken one. */}
          <p className="text-base font-semibold">
            {status === "free" && <>{date ? pretty(date) : "That date"} is free</>}
            {status === "taken" && <>{date ? pretty(date) : "That date"} is taken</>}
            {status === "ask" && <>We cannot say from here</>}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {status === "free" && (n > 0
              ? <>For {n} people, in the rooms that take that number. Nothing is held until you ask us to hold it.</>
              : <>Nothing is held until you ask us to hold it.</>)}
            {status === "taken" && <>Somebody has it. It is worth asking anyway — provisional dates fall through more often than people expect.</>}
            {status === "ask" && <>The diary is not online for that date. Send it over and you will have an answer the same day.</>}
          </p>

          {status === "taken" && alternatives && alternatives.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Free, either side</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {alternatives.map((a) => (
                  <li key={a}>
                    <button
                      type="button"
                      onClick={() => { setDate(a); onCheck?.({ date: a, guests: n }); }}
                      className="rounded-md border border-border px-3 py-1.5 text-sm"
                    >
                      {pretty(a)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button className="mt-5" variant={status === "free" ? "default" : "outline"}
            onClick={() => onEnquire?.({ date, guests: n })}>
            {status === "free" ? "Ask us to hold it" : "Send the enquiry anyway"}
          </Button>
        </div>
      )}
    </div>
  );
}
