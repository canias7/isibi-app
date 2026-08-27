/**
 * Marks the matching part of a search result.
 *
 * The query is escaped before it becomes a regex — an unescaped one throws on a
 * bracket, which is a crash triggered by somebody typing "(" into a search box.
 * Uses <mark>, so it is announced as a highlight rather than only shaded.
 */
export function HighlightMatch({ text, query, className }: {
  text: string; query: string; className?: string;
}) {
  const q = query.trim();
  if (!q) return <span data-slot="highlight-match" className={className}>{text}</span>;
  const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${safe})`, "ig"));
  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.toLowerCase() === q.toLowerCase()
          ? <mark key={i} className="bg-warning/30 text-foreground">{p}</mark>
          : <span key={i}>{p}</span>)}
    </span>
  );
}
