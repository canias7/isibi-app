import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/**
 * "These two look like the same person."
 *
 * Both records are shown SIDE BY SIDE with their differing fields marked,
 * because a merge decision cannot be made from two names — one of them has
 * the current phone number and there is no way to tell which without seeing
 * both.
 *
 * "Keep both" is a first-class answer and not a hidden one. Two people really
 * do share a name, and a deduplicator that only offers merge or skip forces a
 * wrong choice.
 */
export function DedupeList({ pairs, onMerge, onKeepBoth, className }: {
  pairs: {
    id: string | number;
    left: { title: string; fields: { label: string; value: string }[] };
    right: { title: string; fields: { label: string; value: string }[] };
  }[];
  onMerge?: (id: string | number, keep: "left" | "right") => void;
  onKeepBoth?: (id: string | number) => void;
  className?: string;
}) {
  if (!pairs.length) return null;
  return (
    <div className={cn("space-y-3", className)}>
      {pairs.map((p) => {
        const differs = (label: string) =>
          p.left.fields.find((f) => f.label === label)?.value !== p.right.fields.find((f) => f.label === label)?.value;
        const Side = ({ side, data }: { side: "left" | "right"; data: typeof p.left }) => (
          <div className="min-w-0 flex-1 space-y-2 rounded-md border border-border p-3">
            <p className="text-sm font-medium">{data.title}</p>
            <dl className="space-y-0.5 text-xs">
              {data.fields.map((f) => (
                <div key={f.label} className="flex gap-2">
                  <dt className="w-20 shrink-0 text-muted-foreground">{f.label}</dt>
                  <dd className={cn("min-w-0 truncate", differs(f.label) && "font-medium underline decoration-dotted")}>
                    {f.value || "—"}
                  </dd>
                </div>
              ))}
            </dl>
            {onMerge && (
              <Button size="sm" variant="outline" className="w-full"
                onClick={() => onMerge(p.id, side)}>Keep this one</Button>
            )}
          </div>
        );
        return (
          <div key={p.id} className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Side side="left" data={p.left} />
              <Side side="right" data={p.right} />
            </div>
            {onKeepBoth && (
              <Button size="sm" variant="ghost" onClick={() => onKeepBoth(p.id)}>
                They're different people — keep both
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
