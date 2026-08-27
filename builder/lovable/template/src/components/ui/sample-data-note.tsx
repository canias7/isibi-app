import { cn } from "@/lib/utils";
/**
 * "These are examples, not your real records."
 *
 * THE SINGLE MOST IMPORTANT LINE ON A DEMO SCREEN. Sample data that is not
 * labelled gets treated as real — people delete it thinking it is theirs, or
 * worse, publish a site with a fictional menu on it. Both happen constantly.
 *
 * IT OFFERS THE WAY OUT beside the warning, because the correct reaction on
 * reading it is usually "remove this", and making somebody hunt for that in
 * settings is how the demo content survives to launch.
 *
 * Deliberately not dismissible. A note that can be closed is closed, and the
 * risk it describes lasts as long as the data does.
 */
export function SampleDataNote({ onRemove, onKeep, note, className }: {
  onRemove?: () => void;
  onKeep?: () => void;
  note?: string;
  className?: string;
}) {
  return (
    <div data-slot="sample-data-note" role="status" className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-dashed border-border px-3 py-2 text-sm", className)}>
      <span className="font-medium">This is example data</span>
      <span className="text-muted-foreground">{note ?? "Nothing here is real — replace it before you go live."}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} className="cursor-pointer underline underline-offset-4">Remove it all</button>
      )}
      {onKeep && (
        <button type="button" onClick={onKeep} className="cursor-pointer text-muted-foreground underline underline-offset-4">Keep for now</button>
      )}
    </div>
  );
}
