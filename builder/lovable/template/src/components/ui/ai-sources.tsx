import { cn } from "@/lib/utils";
/**
 * What the answer was drawn from.
 *
 * AN ANSWER WITHOUT SOURCES CANNOT BE CHECKED, and checking is the only defence
 * against a confident wrong one. Listing what it read turns an assertion into
 * something a reader can verify in thirty seconds.
 *
 * IT SAYS WHEN NOTHING WAS CONSULTED. "Answered from general knowledge" is a
 * genuinely different claim from "answered from your documents", and an empty
 * source list rendered as nothing lets the reader assume the stronger one.
 *
 * External links carry `rel="noreferrer"`, matching `external-link` — a cited
 * source is exactly the kind of link that goes somewhere unvetted.
 */
export function AiSources({ sources, noneNote = "Answered from general knowledge, not from your documents.", className }: {
  sources: { key: string; label: string; href?: string; detail?: string }[];
  noneNote?: string;
  className?: string;
}) {
  if (!sources.length) {
    return <p className={cn("text-xs text-muted-foreground", className)}>{noneNote}</p>;
  }
  return (
    <div className={cn("text-xs", className)}>
      <p className="text-muted-foreground">Based on {sources.length} {sources.length === 1 ? "source" : "sources"}</p>
      <ol className="mt-0.5 flex flex-col gap-0.5">
        {sources.map((s, i) => (
          <li key={s.key} className="flex gap-1.5">
            <span aria-hidden className="text-muted-foreground tabular-nums">{i + 1}.</span>
            <span className="min-w-0">
              {s.href
                ? <a href={s.href} target="_blank" rel="noreferrer" className="underline underline-offset-2">{s.label}</a>
                : s.label}
              {s.detail && <span className="text-muted-foreground"> — {s.detail}</span>}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
