import { Button } from "@/components/ui/button";
import { Duration } from "@/components/ui/duration";
import { cn } from "@/lib/utils";
/** How long, from a fixed set. Free-text minutes is a worse question to ask. */
export function DurationPicker({ options = [15, 30, 45, 60, 90], value, onChange, className }: {
  options?: number[]; value?: number | null; onChange: (m: number) => void; className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)} role="group" aria-label="Duration">
      {options.map((m) => (
        <Button key={m} type="button" size="sm" variant={value === m ? "default" : "outline"}
          onClick={() => onChange(m)} className="tabular-nums"><Duration minutes={m} /></Button>
      ))}
    </div>
  );
}
