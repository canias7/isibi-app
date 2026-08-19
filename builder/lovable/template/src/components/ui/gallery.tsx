import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";

/**
 * A picture in the grid.
 *
 * `fallbackSeed` IS HERE BECAUSE THE MODEL KEPT REACHING FOR IT and the type
 * refused. It is a real `SafeImage` prop, every Shot is drawn BY a `SafeImage`,
 * and the generator passing it is the correct instinct — but `Shot` did not
 * carry it, so the page failed to typecheck and the whole site published as the
 * placeholder. Measured across the page-gen eval: this single mismatch was the
 * most common compile error there is, usually three at a time in one file.
 *
 * It also does real work. The seed decides the placeholder's angle and colours,
 * and it falls back to the ALT — so a gallery whose shots have similar or empty
 * alts paints a row of identical panels, which is precisely the state a fresh
 * site is in before the owner has uploaded anything.
 */
export type Shot = { src?: string | null; alt?: string; caption?: string | null; fallbackSeed?: string };

/** A grid of pictures, each opening full size. */
export function Gallery({ items, columns = 3, className }: {
  items: Shot[];
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const cols = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4" }[columns];
  return (
    <div className={cn("grid gap-3", cols, className)}>
      {items.map((s, i) => (
        <Dialog key={i}>
          <DialogTrigger className="cursor-pointer text-start">
            <SafeImage src={s.src} alt={s.alt} ratio="1/1" fallbackSeed={s.fallbackSeed ?? s.caption ?? undefined} />
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogTitle className="sr-only">{s.alt || s.caption || "Photo"}</DialogTitle>
            <SafeImage src={s.src} alt={s.alt} ratio="auto" className="rounded-md" fallbackSeed={s.fallbackSeed ?? s.caption ?? undefined} />
            {s.caption && <p className="text-sm text-muted-foreground">{s.caption}</p>}
          </DialogContent>
        </Dialog>
      ))}
    </div>
  );
}
