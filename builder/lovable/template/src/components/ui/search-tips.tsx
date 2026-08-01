import { cn } from "@/lib/utils";
/**
 * A few ways to get better results, shown where the results are not.
 *
 * PLACED AT THE POINT OF FAILURE, not behind a help link. Tips are read when
 * somebody has just got nothing back; anywhere else they are ignored, which is
 * why every search-help page is unvisited.
 *
 * SPECIFIC TO THIS SEARCH. "Try fewer words" is generic filler; "try a postcode
 * instead of a place name" is what a caller who knows their data can offer, and
 * the difference is whether the tip ever helps.
 *
 * Capped at a handful — a list of ten tips is a manual, and somebody who found
 * nothing is not going to read a manual.
 */
export function SearchTips({ tips, max = 4, title = "Try", className }: {
  tips: React.ReactNode[];
  max?: number; title?: string;
  className?: string;
}) {
  const shown = tips.slice(0, max);
  if (!shown.length) return null;
  return (
    <div className={cn("text-sm", className)}>
      <p className="mb-1 font-medium">{title}</p>
      <ul className="flex list-disc flex-col gap-0.5 pl-5 text-muted-foreground">
        {shown.map((t, i) => <li key={i}>{t}</li>)}
      </ul>
    </div>
  );
}
