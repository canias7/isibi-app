import { cn } from "@/lib/utils";
/**
 * The three or four things somebody would take away.
 *
 * CAPPED, deliberately. A "key points" list of eleven items is a summary of
 * nothing — the value is entirely in the selection, and a component that accepts
 * any number lets the caller off the one decision that matters. Extra items are
 * dropped and the count is reported, so the truncation is never silent.
 *
 * A real `<ul>` under a heading, which is what makes it skimmable by a screen
 * reader in the same way it is by eye — the whole point of a summary block.
 *
 * No icons. A tick beside every line implies the points are achievements or
 * confirmations, which they usually are not, and a row of identical marks adds
 * nothing a bullet does not.
 */
export function KeyPoints({ points, title = "In short", max = 5, className }: {
  points: React.ReactNode[];
  title?: string; max?: number;
  className?: string;
}) {
  if (!points.length) return null;
  const shown = points.slice(0, max);
  const dropped = points.length - shown.length;
  return (
    <section data-slot="key-points" aria-label={title} className={cn("rounded-md border border-border p-4", className)}>
      <h2 className="mb-2 text-sm font-medium">{title}</h2>
      <ul className="flex list-disc flex-col gap-1 ps-5 text-sm text-muted-foreground">
        {shown.map((p, i) => <li key={i}>{p}</li>)}
      </ul>
      {dropped > 0 && (
        <p className="mt-2 text-xs text-muted-foreground tabular-nums">{dropped} more not shown</p>
      )}
    </section>
  );
}
