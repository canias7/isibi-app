import * as React from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * A date and a time, as two plain strings.
 *
 * Values are "YYYY-MM-DD" and "HH:MM" — the shape the schema engine stores and
 * the shape a form submits, so no page has to convert anything. The date is
 * formatted with the VISITOR's locale for display only.
 */
export function DateTimePicker({
  date, time, onDateChange, onTimeChange, minDate, dateLabel = "Date", timeLabel = "Time", className,
}: {
  date?: string;
  time?: string;
  onDateChange: (v: string) => void;
  onTimeChange: (v: string) => void;
  /** Defaults to today — a booking in the past helps nobody. */
  minDate?: Date;
  dateLabel?: string;
  timeLabel?: string;
  className?: string;
}) {
  const selected = date ? new Date(date + "T00:00:00") : undefined;
  const floor = minDate ?? new Date(new Date().setHours(0, 0, 0, 0));
  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", className)}>
      <div className="flex flex-col gap-1.5">
        <Label>{dateLabel}</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className="justify-start font-normal">
              <CalIcon className="size-4" />
              {selected ? selected.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
                        : <span className="text-muted-foreground">Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={selected} disabled={{ before: floor }}
              onSelect={(d) => d && onDateChange(iso(d))} />
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="dtp-time">{timeLabel}</Label>
        <Input id="dtp-time" type="time" value={time ?? ""} onChange={(e) => onTimeChange(e.target.value)} />
      </div>
    </div>
  );
}
