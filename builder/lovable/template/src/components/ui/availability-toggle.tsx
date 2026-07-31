import * as React from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
/**
 * "Taking bookings" on and off — and away always says until when.
 *
 * AN OPEN-ENDED AWAY READS AS QUIT. A shop toggled to "not taking
 * bookings" with no return date loses the customer to whoever answers —
 * so switching OFF asks "back when?" with a short list (the snooze
 * discipline: absolute times), and the away state WEARS the answer:
 * "back tomorrow 09:00". "Indefinitely" exists but must be chosen, never
 * defaulted into.
 *
 * The moment away expires is the CALLER's cron/read-path concern — this
 * component states the promise; keeping it is the system's job, stated
 * here so nobody believes the toggle flips itself.
 */
export function AvailabilityToggle({ on, until, options, onChange, className }: {
  on: boolean;
  until?: string;
  options?: { label: string; until: string | null }[];
  onChange: (v: { on: boolean; until?: string | null }) => void;
  className?: string;
}) {
  const [asking, setAsking] = React.useState(false);
  const opts = options ?? [
    { label: "Back in an hour", until: "in an hour" },
    { label: "Back tomorrow 09:00", until: "tomorrow 09:00" },
    { label: "Until I turn it back on", until: null },
  ];
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label className="flex cursor-pointer items-center gap-2.5">
        <Switch checked={on} onCheckedChange={(v) => {
          if (v) { setAsking(false); onChange({ on: true }); }
          else setAsking(true); // off needs a "back when" first
        }} />
        <span className="text-sm font-medium">
          {on ? "Taking bookings" : "Not taking bookings"}
          {!on && until ? <span className="ml-1 text-xs font-normal text-muted-foreground">· back {until}</span> : null}
        </span>
      </label>
      {asking ? (
        <div className="flex flex-wrap gap-1.5 pl-10">
          {opts.map((o) => (
            <button key={o.label} type="button"
              onClick={() => { setAsking(false); onChange({ on: false, until: o.until }); }}
              className="cursor-pointer rounded-full border border-border px-2.5 py-1 text-xs hover:bg-muted">
              {o.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
