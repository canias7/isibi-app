import { cn } from "@/lib/utils";
export type BentoItem = { content: React.ReactNode; span?: 1 | 2; tall?: boolean };
/** Tiles of two sizes. A feature section that is not another row of equal cards. */
export function BentoGrid({ items, className }: { items: BentoItem[]; className?: string }) {
  return (
    <div className={cn("grid auto-rows-[minmax(9rem,auto)] gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {items.map((it, i) => (
        <div key={i} className={cn("rounded-xl border bg-card p-5",
          it.span === 2 && "sm:col-span-2", it.tall && "row-span-2")}>{it.content}</div>
      ))}
    </div>
  );
}
