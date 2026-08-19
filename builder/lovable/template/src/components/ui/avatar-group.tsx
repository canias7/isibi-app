import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
/** Overlapping faces with a +N. The count is announced, not just drawn. */
export function AvatarGroup({ people, max = 4, className }: {
  people: { name: string; initials?: string }[]; max?: number; className?: string;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  return (
    <div className={cn("flex items-center", className)} aria-label={`${people.length} people`}>
      {shown.map((p, i) => (
        <Avatar key={p.name + i} className="size-8 ring-2 ring-background -ml-2 first:ms-0">
          <AvatarFallback className="text-xs">
            {p.initials || p.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ))}
      {rest > 0 && (
        <span className="-ml-2 grid size-8 place-items-center rounded-full bg-muted text-xs font-medium ring-2 ring-background tabular-nums">
          +{rest}
        </span>
      )}
    </div>
  );
}
