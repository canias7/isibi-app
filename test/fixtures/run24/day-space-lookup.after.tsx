import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SLOTS_A_DAY = 6;

type DaySpaceQuery = {
  isPending: boolean;
  isError: boolean;
  data: unknown;
};

type DaySpaceLookupProps = {
  preferredDay: string;
  query: DaySpaceQuery;
  onPreferredDay: (day: string) => void;
  className?: string;
  children?: React.ReactNode;
};

function placesLeftLabel(data: unknown): string {
  if (data == null) return "Not available";
  const booked = Number(data);
  if (!Number.isFinite(booked)) return "Not available";
  const left = Math.min(SLOTS_A_DAY, Math.max(0, SLOTS_A_DAY - booked));
  if (left === 0) return "None left.";
  if (left === 1) return "1 place left.";
  if (left === 6) return "Six places left.";
  return `${left} places left.`;
}

export default function DaySpaceLookup({
  preferredDay,
  query,
  onPreferredDay,
  className,
}: DaySpaceLookupProps) {
  return (
    <div className={["max-w-xl space-y-3", className].filter(Boolean).join(" ")}>
      <h2 className="text-xl font-semibold text-foreground">
        Space on a preferred day
      </h2>
      <p className="text-sm text-muted-foreground">
        Pick a day to see how many places are left. Six lesson slots a day.
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
          {query.isPending
            ? "Checking…"
            : query.isError
              ? "Couldn't check — try again"
              : placesLeftLabel(query.data)}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Choose a day to check space.
        </p>
      )}
    </div>
  );
}
