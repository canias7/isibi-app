import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";

export type Member = { name: string; role?: string | null; photo?: string | null };

/** The people. Photos are owner-supplied and therefore guarded. */
export function TeamGrid({ items, className }: { items: Member[]; className?: string }) {
  return (
    <div className={cn("grid gap-6 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {items.map((m, i) => (
        <div key={m.name || i} className="flex flex-col gap-3">
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
