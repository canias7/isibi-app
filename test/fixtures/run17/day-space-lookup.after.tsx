import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DaySpaceLookupProps = {
  preferredDay: string;
  bookingCount: number;
  slotsPerDay?: number;
  loading?: boolean;
  failed?: boolean;
  onPreferredDay: (day: string) => void;
  className?: string;
  children?: React.ReactNode;
};

export default function DaySpaceLookup({
  preferredDay,
  bookingCount,
  slotsPerDay = 6,
  loading = false,
  failed = false,
  onPreferredDay,
  className,
}: DaySpaceLookupProps) {
  const booked = Number.isFinite(bookingCount) ? Math.max(0, Math.trunc(bookingCount)) : 0;
  const capacity = Number.isFinite(slotsPerDay) ? Math.max(0, Math.trunc(slotsPerDay)) : 0;
  const placesLeft = Math.max(0, capacity - booked);

  return (
    <div className={["max-w-xl space-y-3", className].filter(Boolean).join(" ")}>
      <h2 className="text-xl font-semibold text-foreground">
        Space on a preferred day
      </h2>
      <p className="text-sm text-muted-foreground">
        Pick a day to see how many places are left on it, out of {capacity}{" "}
        lesson slots a day.
      </p>
      <div className="space-y-2">
        <Label htmlFor="preferred-day">Preferred day</Label>
        <Input
          id="preferred-day"
          type="date"
          value={preferredDay}
          onChange={(e) => onPreferredDay(e.target.value)}
        />
      </div>
      {!preferredDay ? (
        <p className="text-sm text-muted-foreground">
          Choose a day to check space.
        </p>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">
          Checking that day&rsquo;s places&hellip;
        </p>
      ) : failed ? (
        <p className="text-sm text-muted-foreground">
          We could not check that day just now. Please try again.
        </p>
      ) : (
        <p className="text-sm text-foreground">
          {placesLeft === 0
            ? "No places left on this day."
            : `${placesLeft} ${placesLeft === 1 ? "place" : "places"} left on this day.`}
        </p>
      )}
    </div>
  );
}
