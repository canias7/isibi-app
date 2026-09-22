import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DaySpaceLookupProps = {
  preferredDay: string;
  bookingCount: number;
  onPreferredDay: (day: string) => void;
  className?: string;
  children?: React.ReactNode;
};

export default function DaySpaceLookup({
  preferredDay,
  bookingCount,
  onPreferredDay,
  className,
}: DaySpaceLookupProps) {
  return (
    <div className={["max-w-xl space-y-3", className].filter(Boolean).join(" ")}>
      <h2 className="text-xl font-semibold text-foreground">
        Space on a preferred day
      </h2>
      <p className="text-sm text-muted-foreground">
        Pick a day to see how many bookings already sit on it, so you can tell
        if it still has space.
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
      {preferredDay ? (
        <p className="text-sm text-foreground">
          {bookingCount === 0
            ? "No bookings on this day yet — it still has space."
            : `${bookingCount} booking${bookingCount === 1 ? "" : "s"} already on this day.`}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Choose a day to check space.
        </p>
      )}
    </div>
  );
}
