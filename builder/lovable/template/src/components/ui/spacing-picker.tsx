import { cn } from "@/lib/utils";
/**
 * How much room between things — none through roomy.
 *
 * Each option SHOWS THE GAP it means, as two bars with that space between
 * them. "md" is not a quantity anybody can picture, and a pixel box makes
 * people guess; the preview is the control.
 */
export function SpacingPicker({ value, onChange, options, label, className }: {
  value: string; onChange: (v: string) => void;
  options?: { value: string; label: string }[]; label?: string; className?: string;
}) {
  const opts = options ?? [
    { value: "0", label: "None" }, { value: "0.25rem", label: "Tight" },
    { value: "0.5rem", label: "Snug" }, { value: "1rem", label: "Normal" },
    { value: "1.5rem", label: "Loose" }, { value: "2.5rem", label: "Roomy" },
  ];
  return (
    <div className={cn("flex flex-wrap gap-2", className)} role="group" aria-label={label ?? "Spacing"}>
      {opts.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}
          className={cn("flex w-16 cursor-pointer flex-col items-center gap-1.5 rounded-md border p-2",
            o.value === value ? "border-foreground" : "border-border hover:bg-muted")}>
          <span className="flex h-8 flex-col justify-center" style={{ gap: o.value }} aria-hidden="true">
            <span className="h-1.5 w-8 rounded-sm bg-foreground/70" />
            <span className="h-1.5 w-8 rounded-sm bg-foreground/70" />
          </span>
          <span className="text-[10px] text-muted-foreground">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
