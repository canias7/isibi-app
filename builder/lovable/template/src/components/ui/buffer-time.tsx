import { DurationInput } from "@/components/ui/duration-input";
import { cn } from "@/lib/utils";
/**
 * The gap kept either side of an appointment.
 *
 * BEFORE AND AFTER ARE SEPARATE, and that is the whole reason this is not just
 * two `duration-input`s a caller wires up. They are almost never the same
 * number: ten minutes to set up beforehand and twenty-five to clean down after
 * is the normal shape, and a single "buffer" field forces the larger one on
 * both ends and quietly costs the business a slot a day.
 *
 * THE TOTAL IS STATED, because that is the number that actually consumes the
 * diary — 10 + 25 means a 30-minute appointment occupies 65 minutes, and an
 * owner setting these two fields separately has no reason to do that sum.
 *
 * Zero on both is normal and says so rather than warning; back-to-back is a
 * legitimate way to run a day.
 */
export function BufferTime({ before, after, onChange, appointmentMinutes, className }: {
  before: number | null;
  after: number | null;
  onChange: (next: { before: number | null; after: number | null }) => void;
  /** Length of the appointment itself, to state the true cost. */
  appointmentMinutes?: number;
  className?: string;
}) {
  const b = before ?? 0, a = after ?? 0;
  const total = b + a;
  const say = (m: number) => {
    const h = Math.floor(m / 60), mm = m % 60;
    return h ? `${h}h${mm ? ` ${mm}m` : ""}` : `${mm}m`;
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">Before</span>
          <DurationInput minutes={before} onChange={(m) => onChange({ before: m, after })} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">After</span>
          <DurationInput minutes={after} onChange={(m) => onChange({ before, after: m })} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {total === 0
          ? "No gap — appointments can run back to back."
          : appointmentMinutes
            ? `A ${say(appointmentMinutes)} appointment takes ${say(appointmentMinutes + total)} of the diary.`
            : `${say(total)} of extra time per appointment.`}
      </p>
    </div>
  );
}
