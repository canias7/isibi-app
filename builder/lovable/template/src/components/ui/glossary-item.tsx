import { cn } from "@/lib/utils";
/** A term and what it means, as a real definition pair. */
export function GlossaryItem({ term, children, className }: {
  term: string; children?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("border-b border-border py-3 last:border-0", className)}>
      <dt className="font-medium" id={term.toLowerCase().replace(/\W+/g, "-")}>{term}</dt>
      <dd className="mt-0.5 text-sm text-muted-foreground">{children}</dd>
    </div>
  );
}
