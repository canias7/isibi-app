import { DurationInput } from "@/components/ui/duration-input";
import { cn } from "@/lib/utils";
/**
 * How much notice you need before a booking.
 *
 * The setting that stops somebody booking a haircut for eight minutes' time.
 * Every business has one and almost no booking form asks for it, which is why
 * owners end up declining bookings by hand.
 *
 * IT SHOWS THE CONSEQUENCE IN PLAIN WORDS — "the earliest bookable slot is
 * tomorrow at 09:00" — because "1440 minutes" is a number nobody can picture.
 * The caller computes that sentence, since only it knows the opening hours the
 * lead time lands in.
 *
 * ZERO IS A REAL, SUPPORTED ANSWER and says so: "Bookings accepted right up to
 * the start time." Plenty of businesses want that, and a control that treats 0
 * as unset forces them to pick 1 minute to mean nothing.
 */
export function LeadTimeInput({ minutes, onChange, earliestNote, id, className }: {
  minutes: number | null;
  onChange: (minutes: number | null) => void;
  /** "The earliest bookable slot is tomorrow at 09:00" — computed by the caller. */
  earliestNote?: string;
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <DurationInput minutes={minutes} onChange={onChange} id={id} />
      <p className="text-xs text-muted-foreground">
        {minutes === null
          ? "No notice required yet."
          : minutes === 0
            ? "Bookings accepted right up to the start time."
            : earliestNote ?? "Bookings must be made this far ahead."}
      </p>
    </div>
  );
}
