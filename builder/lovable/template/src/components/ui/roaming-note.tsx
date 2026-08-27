import { cn } from "@/lib/utils";
/**
 * What using the phone abroad costs, before somebody uses it.
 *
 * THE CAP IS THE FIRST THING SHOWN, and whether there is one at all. Uncapped
 * roaming is how a fortnight abroad produces a four-figure bill, and the person
 * who needs that sentence reads it before they travel, not in the itemised
 * statement afterwards.
 *
 * INCOMING CALLS ARE PRICED SEPARATELY, because being charged to receive a call
 * is the charge nobody anticipates — it has no equivalent at home and it is
 * invisible on any list that prices only what you do.
 *
 * DATA IS PRICED PER MEGABYTE AND ALSO AS SOMETHING RECOGNISABLE. "£3/MB" is
 * unreadable; "about £45 to watch a short video" is the same number in a unit
 * people have.
 *
 * NO COUNTRY LIST BUILT IN. Which destinations are included differs by provider
 * and changes constantly, and a stale list inside a component is worse than no
 * list at all.
 */
export function RoamingNote({ destination, included, spendCap, callOutPerMinute, callInPerMinute, textEach, dataPerMb, videoMinuteMb = 25, currency = "GBP", locale = "en-GB", className }: {
  destination: string;
  /** True where it costs the same as at home. */
  included?: boolean;
  /** Undefined means uncapped, and the component says so loudly. */
  spendCap?: number;
  callOutPerMinute?: number;
  /** The charge nobody anticipates. */
  callInPerMinute?: number;
  textEach?: number;
  dataPerMb?: number;
  /** Roughly how much data a minute of video uses. */
  videoMinuteMb?: number;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  // Always two, because every one of these is a rate in the same column and
  // "£3/MB" beside "£1.80/min" breaks the alignment the column exists for.
  const money = (v: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v);
  if (included) {
    return (
      <div data-slot="roaming-note" className={cn("space-y-0.5 text-sm", className)}>
        <p className="font-medium">{destination} costs the same as at home.</p>
        <p className="text-xs text-muted-foreground">Your usual allowances apply. Nothing extra to set up.</p>
      </div>
    );
  }
  return (
    <div className={cn("space-y-1 text-sm", className)}>
      <p className={cn(spendCap === undefined ? "font-medium" : "")}>
        {spendCap === undefined
          ? `${destination} is charged separately and there is no spending cap. A fortnight of ordinary use can run into four figures.`
          : `${destination} is charged separately, capped at ${money(spendCap)}.`}
      </p>
      <dl className="space-y-0.5 text-xs tabular-nums text-muted-foreground">
        {callOutPerMinute !== undefined && (
          <div className="flex justify-between gap-4">
            <dt>Calls you make</dt>
            <dd>{money(callOutPerMinute)}/min</dd>
          </div>
        )}
        {callInPerMinute !== undefined && (
          <div className="flex justify-between gap-4">
            <dt className="font-medium text-foreground">Calls you receive</dt>
            <dd className="font-medium text-foreground">{money(callInPerMinute)}/min</dd>
          </div>
        )}
        {textEach !== undefined && (
          <div className="flex justify-between gap-4">
            <dt>Each text</dt>
            <dd>{money(textEach)}</dd>
          </div>
        )}
        {dataPerMb !== undefined && (
          <div className="flex justify-between gap-4">
            <dt>Data</dt>
            <dd>{money(dataPerMb)}/MB</dd>
          </div>
        )}
      </dl>
      {dataPerMb !== undefined && (
        <p className="text-xs tabular-nums">
          A minute of video is roughly {videoMinuteMb} MB — about {money(dataPerMb * videoMinuteMb)}.
        </p>
      )}
      {callInPerMinute !== undefined && (
        <p className="text-xs text-muted-foreground">
          You are charged for calls you answer as well as calls you make. There is no equivalent of that at home.
        </p>
      )}
    </div>
  );
}
