import { cn } from "@/lib/utils";
/**
 * The small print at the foot of a document.
 *
 * Small, but not `text-[10px]` — this is the part somebody may need to read
 * in a dispute, and a size chosen to make terms unreadable is a size that
 * gets those terms disregarded. Numbered when there is more than one clause,
 * so they can be referred to.
 */
export function TermsBlock({ title = "Terms", clauses, className }: {
  title?: string; clauses: string[]; className?: string;
}) {
  if (!clauses.length) return null;
  return (
    <section className={cn("border-t border-border pt-4 text-xs text-muted-foreground", className)}>
      <h2 className="mb-1.5 font-medium uppercase tracking-wide">{title}</h2>
      {clauses.length === 1
        ? <p className="leading-relaxed">{clauses[0]}</p>
        : <ol className="list-decimal space-y-1 ps-4 leading-relaxed">
            {clauses.map((c, i) => <li key={i}>{c}</li>)}
          </ol>}
    </section>
  );
}
