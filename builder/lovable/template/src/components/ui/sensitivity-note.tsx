import { cn } from "@/lib/utils";
/**
 * Which input the answer actually depends on.
 *
 * An estimate built from eight fields looks equally dependent on all eight, and
 * it never is. Naming the one that moves it most tells the reader where to spend
 * their attention — and where a small error becomes a large one.
 *
 * THE EFFECT IS QUANTIFIED, not just ranked. "Mostly depends on hours" is a
 * hint; "10% more hours changes the total by 8%" is something a person can act
 * on, and it is the difference between a note and a decoration.
 *
 * Listed most-influential first and capped, because the fourth and fifth
 * drivers are noise by definition — if they mattered they would be first.
 */
export function SensitivityNote({ drivers, max = 3, className }: {
  /** Most influential first. */
  drivers: { label: string; effect: string }[];
  max?: number;
  className?: string;
}) {
  const shown = drivers.slice(0, max);
  if (!shown.length) return null;
  return (
    <div className={cn("flex flex-col gap-0.5 text-xs text-muted-foreground", className)}>
      <p className="font-medium text-foreground">What moves this most</p>
      <ul>
        {shown.map((d) => (
          <li key={d.label}><span className="text-foreground">{d.label}</span> — {d.effect}</li>
        ))}
      </ul>
    </div>
  );
}
