import * as React from "react";
import { NativeSelect } from "@/components/ui/native-select";
import { TimeInput } from "@/components/ui/time-input";
import { WeekdayPicker } from "@/components/ui/weekday-picker";
import { cn } from "@/lib/utils";
/**
 * Build a schedule without typing cron.
 *
 * `* * * * *` is write-only for almost everybody, and a field that accepts it
 * raw is how a job ends up running every minute instead of every month. This
 * offers the four shapes people actually want and emits the expression.
 *
 * THE EXPRESSION IS ALWAYS SHOWN, in words and in cron. The words are what
 * the person checks; the cron is what they paste somewhere else or send to
 * support.
 *
 * Cron day-of-week is 0–6 with 0 = Sunday, which matches `Date.getDay()` and
 * therefore `WeekdayPicker` — one of the few places those two agree without
 * conversion, and worth stating because it is the usual off-by-one.
 */
type Freq = "hourly" | "daily" | "weekly" | "monthly";
export function CronBuilder({ value, onChange, className }: {
  value?: string; onChange: (cron: string, description: string) => void; className?: string;
}) {
  const [freq, setFreq] = React.useState<Freq>("daily");
  const [time, setTime] = React.useState("09:00");
  const [days, setDays] = React.useState<number[]>([1]);
  const [dom, setDom] = React.useState(1);
  const [h, m] = time.split(":").map((n) => Number(n) || 0);

  const build = React.useCallback((): [string, string] => {
    const at = new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    if (freq === "hourly") return [`${m} * * * *`, `Every hour at ${m} minutes past`];
    if (freq === "daily") return [`${m} ${h} * * *`, `Every day at ${at}`];
    if (freq === "weekly") {
      const list = [...days].sort().map((d) => new Date(2024, 0, 7 + d).toLocaleDateString(undefined, { weekday: "long" }));
      return [`${m} ${h} * * ${[...days].sort().join(",") || "1"}`, `Every ${list.join(", ") || "Monday"} at ${at}`];
    }
    return [`${m} ${h} ${dom} * *`, `On day ${dom} of every month at ${at}`];
  }, [freq, h, m, days, dom]);

  const [cron, words] = build();
  React.useEffect(() => { onChange(cron, words); }, [cron, words, onChange]);

  return (
    <div data-slot="cron-builder" className={cn("space-y-3", className)}>
      <NativeSelect value={freq} aria-label="How often" onChange={(e) => setFreq(e.target.value as Freq)}>
        <option value="hourly">Every hour</option>
        <option value="daily">Every day</option>
        <option value="weekly">Every week</option>
        <option value="monthly">Every month</option>
      </NativeSelect>
      {freq === "weekly" && <WeekdayPicker value={days} onChange={setDays} />}
      {freq === "monthly" && (
        <NativeSelect value={String(dom)} aria-label="Day of the month" onChange={(e) => setDom(Number(e.target.value))}>
          {Array.from({ length: 28 }, (_, i) => <option key={i} value={i + 1}>Day {i + 1}</option>)}
        </NativeSelect>
      )}
      {freq !== "hourly" && <TimeInput value={time} onChange={setTime} className="w-32" />}
      <div className="rounded-md bg-muted/50 px-3 py-2">
        <p className="text-sm">{words}</p>
        <p className="mt-0.5 font-mono text-xs text-muted-foreground">{cron}{value ? "" : ""}</p>
      </div>
    </div>
  );
}
