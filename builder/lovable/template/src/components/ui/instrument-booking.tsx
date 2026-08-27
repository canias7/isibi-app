import { cn } from "@/lib/utils";
/**
 * Time booked on a shared instrument — including the parts nobody books.
 *
 * SETUP AND CLEAN-DOWN ARE INSIDE THE BOOKING, and that is the whole reason
 * shared-instrument diaries overrun. A booking for the run time alone means the
 * next user arrives to find somebody still washing a column, every single time.
 *
 * A REQUIRED TRAINING SIGN-OFF IS CHECKED AT BOOKING, not at the door. An
 * untrained user booking a confocal is an hour of instrument time lost and,
 * more often, a supervisor's hour too.
 *
 * THE CANCELLATION WINDOW IS SHOWN because a shared facility's real cost is
 * unused booked time, and somebody who knows a slot can be released two hours
 * ahead will release it.
 *
 * THE CHARGE IS STATED WHERE A FACILITY RECHARGES, since a grant code is being
 * committed and the person booking is often not the person paying.
 */
export function InstrumentBooking({ instrument, when, runMinutes, setupMinutes = 0, cleanMinutes = 0, trainedUser, trainingNote, cancelBy, chargeNote, className }: {
  instrument: string;
  /** Free text — "Tuesday 12 August, 09:00". */
  when: string;
  runMinutes: number;
  setupMinutes?: number;
  cleanMinutes?: number;
  /** Whether this user is signed off. */
  trainedUser?: boolean;
  trainingNote?: string;
  /** Free text — "2 hours before". */
  cancelBy?: string;
  /** Pre-formatted — "£45 an hour to grant code X". */
  chargeNote?: string;
  className?: string;
}) {
  const total = setupMinutes + runMinutes + cleanMinutes;
  const fmt = (m: number) => {
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const r = m % 60;
    return r === 0 ? `${h}h` : `${h}h ${r}m`;
  };
  return (
    <div data-slot="instrument-booking" className={cn("space-y-0.5 text-sm", className)}>
      <p>
        <span className="font-medium">{instrument}</span>
        <span className="block">{when}</span>
      </p>
      <p className="text-xs tabular-nums text-muted-foreground">
        {fmt(total)} booked
        {(setupMinutes > 0 || cleanMinutes > 0) &&
          ` — ${fmt(runMinutes)} running, plus ${fmt(setupMinutes + cleanMinutes)} setting up and clearing down`}
      </p>
      {trainedUser === false && (
        <p className="text-xs font-medium">
          {trainingNote ?? "You are not signed off on this instrument — book with a supervisor."}
        </p>
      )}
      {cancelBy && (
        <p className="text-xs text-muted-foreground">
          Release it up to {cancelBy} if your plans change — an unused slot is the facility's biggest cost.
        </p>
      )}
      {chargeNote && <p className="text-xs">{chargeNote}</p>}
    </div>
  );
}
