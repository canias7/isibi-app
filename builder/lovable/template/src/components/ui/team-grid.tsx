import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";

export type Member = { name: string; role?: string | null; photo?: string | null };

/**
 * The people. Photos are owner-supplied and therefore guarded.
 *
 * HOW MANY ACROSS IS THE CALLER'S DECISION. Tailwind's breakpoints are the
 * VIEWPORT's, so a hard-coded `lg:grid-cols-4` still made four columns inside a
 * narrow aside on a 1280px screen — about 95px each, with every name wrapped
 * onto two lines and every role onto four. Fourth component in this kit to have
 * had exactly this bug, and the one the guard for the previous three said would
 * be next. `gallery` has taken `columns` all along and has never had it.
 *
 * The default stays 4, which is what every existing caller renders today.
 */
export function TeamGrid({ items, columns = 4, className }: {
  items: Member[];
  /** How many across at the widest. The parent knows its room; the CSS cannot. */
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}) {
  const cols = {
    1: "",
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
  }[columns];
  return (
    <div className={cn("grid gap-6", cols, className)}>
      {items.map((m, i) => (
        <div key={m.name || i} className="flex min-w-0 flex-col gap-3">
          <SafeImage src={m.photo} alt={m.name} ratio="1/1" className="rounded-xl" />
          <div>
            <div className="font-medium">{m.name}</div>
            {m.role && <div className="text-sm text-muted-foreground">{m.role}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
