import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";

export type Shot = { src?: string | null; alt?: string; caption?: string | null };

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
          <DialogTrigger className="cursor-pointer text-left">
            <SafeImage src={s.src} alt={s.alt} ratio="1/1" />
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogTitle className="sr-only">{s.alt || s.caption || "Photo"}</DialogTitle>
            <SafeImage src={s.src} alt={s.alt} ratio="auto" className="rounded-md" />
            {s.caption && <p className="text-sm text-muted-foreground">{s.caption}</p>}
          </DialogContent>
        </Dialog>
      ))}
    </div>
  );
}
