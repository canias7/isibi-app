import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * The date range every dashboard needs.
 *
 * Presets rather than two calendars: "last 30 days" is what people actually
 * pick, and a range calendar is a lot of interface for a question with five
 * common answers.
 */
export function DateRangePicker({ value, onChange, options, className }: {
  value?: string; onChange: (v: string) => void;
  options?: { value: string; label: string }[]; className?: string;
}) {
  const opts = options ?? [
    { value: "7d", label: "7 days" }, { value: "30d", label: "30 days" },
    { value: "90d", label: "90 days" }, { value: "ytd", label: "Year" },
    { value: "all", label: "All time" },
  ];
  return (
    <div className={cn("inline-flex rounded-md border p-0.5", className)} role="group" aria-label="Date range">
      {opts.map((o) => (
        <Button key={o.value} type="button" size="sm"
          variant={value === o.value ? "secondary" : "ghost"}
          className="h-7 px-2.5" onClick={() => onChange(o.value)}>{o.label}</Button>
      ))}
    </div>
  );
}
