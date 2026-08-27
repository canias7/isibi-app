import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
export type Rsvp = "yes" | "maybe" | "no";
/**
 * Going / maybe / can't.
 *
 * `aria-pressed` on all three rather than one highlighted button, so the
 * current answer is announced and not merely shaded — this is a control whose
 * whole job is showing what you already said.
 */
export function RsvpButtons({ value, onChange, counts, className }: {
  value?: Rsvp | null; onChange: (v: Rsvp) => void;
  counts?: Partial<Record<Rsvp, number>>; className?: string;
}) {
  const opts: { key: Rsvp; label: string }[] = [
    { key: "yes", label: "Going" }, { key: "maybe", label: "Maybe" }, { key: "no", label: "Can't" },
  ];
  return (
    <div data-slot="rsvp-buttons" className={cn("flex flex-wrap gap-2", className)}>
      {opts.map((o) => (
        <Button key={o.key} size="sm" variant={value === o.key ? "default" : "outline"}
          aria-pressed={value === o.key} onClick={() => onChange(o.key)}>
          {o.label}
          {counts?.[o.key] != null && <span className="ms-1.5 tabular-nums opacity-70">{counts[o.key]}</span>}
        </Button>
      ))}
    </div>
  );
}
