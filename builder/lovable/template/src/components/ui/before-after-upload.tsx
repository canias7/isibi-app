import { SafeImage } from "@/components/ui/safe-image";
import { cn, toDate } from "@/lib/utils";
/**
 * A pair of photos taken at two moments, kept together and labelled.
 *
 * THE PAIR IS THE POINT AND IT IS ALWAYS SHOWN AS A PAIR, even when only one
 * side exists. A gallery of loose photos loses which was before and which was
 * after — and once lost, a set of six images proves nothing at all.
 *
 * THE EMPTY SIDE IS AN UPLOAD SLOT, NOT A GAP. On a repair, a treatment or a
 * cleaning job, the "after" is taken hours later by somebody who has left the
 * page — so the half-finished state is the normal one, and it has to be
 * obviously resumable.
 *
 * NO SLIDER. The draggable before/after wipe is unusable on a phone, requires a
 * pointer, and is worse than two images side by side for the thing people
 * actually do, which is look from one to the other.
 *
 * `SafeImage` on both sides, since a just-uploaded photo has no thumbnail yet
 * and a bare `<img>` would paint a broken icon on the commonest state.
 */
export function BeforeAfterUpload({ before, after, onPick, beforeLabel = "Before", afterLabel = "After", className }: {
  before?: { url?: string; at?: string };
  after?: { url?: string; at?: string };
  /** Called with which side was chosen. */
  onPick?: (side: "before" | "after", file: File) => void;
  beforeLabel?: string;
  afterLabel?: string;
  className?: string;
}) {
  const side = (which: "before" | "after", data: { url?: string; at?: string } | undefined, label: string) => {
    const d = data?.at ? toDate(data.at) : null;
    const ok = d && !Number.isNaN(d.getTime());
    return (
      <div className="min-w-0">
        <p className="mb-1 text-xs font-medium">{label}</p>
        {data?.url ? (
          <SafeImage src={data.url} alt="" className="aspect-4/3 w-full rounded-md object-cover" />
        ) : onPick ? (
          <label className="flex aspect-4/3 w-full cursor-pointer items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
            Add the {label.toLowerCase()} photo
            <input type="file" accept="image/*" className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(which, f); }} />
          </label>
        ) : (
          <div className="flex aspect-4/3 w-full items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
            Not taken
          </div>
        )}
        {ok && (
          <time dateTime={d!.toISOString()} className="mt-0.5 block text-xs text-muted-foreground">
            {d!.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </time>
        )}
      </div>
    );
  };
  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      {side("before", before, beforeLabel)}
      {side("after", after, afterLabel)}
    </div>
  );
}
