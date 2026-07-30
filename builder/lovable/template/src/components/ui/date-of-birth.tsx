import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
/**
 * Three fields, deliberately NOT a date picker.
 *
 * A calendar is for choosing a date you are looking for; a birthday is one
 * you already know, and paging a picker back forty years is the worst input
 * on any form. Three boxes are typed straight through.
 *
 * The month is a NAME, not a number: 03/04 is March the 4th to half the world
 * and the 3rd of April to the other half, and there is no way to tell which a
 * form meant.
 *
 * `autoComplete` is set per part so a browser can fill the whole thing.
 */
export function DateOfBirth({ value, onChange, id = "dob", className }: {
  value: { day: string; month: string; year: string };
  onChange: (v: { day: string; month: string; year: string }) => void;
  id?: string; className?: string;
}) {
  const months = Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i, 1).toLocaleString(undefined, { month: "long" }));
  const digits = (s: string, max: number) => s.replace(/\D/g, "").slice(0, max);
  return (
    <fieldset className={cn("w-full min-w-0 space-y-1.5", className)}>
      <div className="flex gap-2">
        <div className="w-20">
          <Label htmlFor={`${id}-day`} className="text-xs text-muted-foreground">Day</Label>
          <Input id={`${id}-day`} inputMode="numeric" autoComplete="bday-day" placeholder="DD"
            className="tabular-nums" value={value.day}
            onChange={(e) => onChange({ ...value, day: digits(e.target.value, 2) })} />
        </div>
        <div className="min-w-0 flex-1">
          <Label htmlFor={`${id}-month`} className="text-xs text-muted-foreground">Month</Label>
          <NativeSelect id={`${id}-month`} autoComplete="bday-month" value={value.month}
            onChange={(e) => onChange({ ...value, month: e.target.value })}>
            <option value="">Month</option>
            {months.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
          </NativeSelect>
        </div>
        <div className="w-24">
          <Label htmlFor={`${id}-year`} className="text-xs text-muted-foreground">Year</Label>
          <Input id={`${id}-year`} inputMode="numeric" autoComplete="bday-year" placeholder="YYYY"
            className="tabular-nums" value={value.year}
            onChange={(e) => onChange({ ...value, year: digits(e.target.value, 4) })} />
        </div>
      </div>
    </fieldset>
  );
}
