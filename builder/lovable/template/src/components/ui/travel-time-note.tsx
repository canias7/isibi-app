import { cn } from "@/lib/utils";
/**
 * "About 25 minutes by bus" — how long it takes to get there.
 *
 * "ABOUT" IS IN THE TEXT AND THAT IS DELIBERATE. A travel time is an estimate
 * whatever produced it, and stating "25 minutes" flat is a promise about
 * traffic nobody can keep. The hedge is the honest part of the sentence.
 *
 * WALKING AND CYCLING ARE FIRST-CLASS MODES, not an afterthought behind
 * driving. For a barber shop or a café most customers arrive on foot, and a
 * component that only knows about cars gets the common case wrong.
 *
 * THE MODE IS A WORD, NOT AN ICON. A car and a bus silhouette are
 * distinguishable at 16px only if you already know which is which, and a train
 * icon means "rail" to some readers and "underground" to others.
 *
 * MINUTES BELOW AN HOUR, then hours and minutes — "About 1 h 10" rather than
 * "About 70 minutes", which is the point at which people start doing arithmetic
 * to understand a number they were given.
 */
const MODES = { walk: "on foot", cycle: "by bike", drive: "by car", transit: "by public transport" } as const;

export function TravelTimeNote({ minutes, mode = "walk", hedge = "About", note, className }: {
  minutes: number | null | undefined;
  mode?: keyof typeof MODES;
  hedge?: string;
  note?: string;
  className?: string;
}) {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes) || minutes < 0) return null;
  const m = Math.round(minutes);
  const text = m < 1 ? "Less than a minute"
    : m < 60 ? `${m} ${m === 1 ? "minute" : "minutes"}`
    : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ""}`;
  return (
    <span data-slot="travel-time-note" className={cn("text-sm text-muted-foreground", className)}>
      {m < 1 ? text : `${hedge} ${text}`} {MODES[mode]}
      {note && <span className="block text-xs">{note}</span>}
    </span>
  );
}
