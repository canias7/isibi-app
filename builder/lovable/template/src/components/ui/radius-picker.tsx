import { cn } from "@/lib/utils";
/**
 * Corner roundness, shown as corners.
 *
 * Each option PREVIEWS ITSELF — a square with that radius applied. The names
 * are meaningless on their own ("md" is how round?), and a numeric input
 * makes people guess in pixels. Showing the shape is the entire point of the
 * control.
 */
export function RadiusPicker({ value, onChange, options, label, className }: {
  value: string; onChange: (v: string) => void;
  options?: { value: string; label: string }[]; label?: string; className?: string;
}) {
  const opts = options ?? [
    { value: "0", label: "Square" }, { value: "0.25rem", label: "Slight" },
    { value: "0.5rem", label: "Rounded" }, { value: "1rem", label: "Soft" },
    { value: "9999px", label: "Pill" },
  ];
  return (
    <div data-slot="radius-picker" className={cn("space-y-1.5", className)} role="group" aria-label={label ?? "Corner radius"}>
      <div className="flex flex-wrap gap-2">
        {opts.map((o) => (
          <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}
            className={cn("flex cursor-pointer flex-col items-center gap-1.5 rounded-md border p-2",
              o.value === value ? "border-foreground" : "border-border hover:bg-muted")}>
            <span className="size-8 border-2 border-foreground/70" style={{ borderRadius: o.value }} aria-hidden="true" />
            <span className="text-[10px] text-muted-foreground">{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
