import { cn } from "@/lib/utils";
/** What a publication said. Bigger than a testimonial, and attributed. */
export function PressQuote({ quote, source, href, className }: {
  quote: string; source: string; href?: string; className?: string;
}) {
  return (
    <figure data-slot="press-quote" className={cn("flex flex-col gap-3 text-center", className)}>
      <blockquote className="text-xl font-medium tracking-tight text-balance">&ldquo;{quote}&rdquo;</blockquote>
      <figcaption className="text-sm text-muted-foreground">
        {href ? <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-4">{source}</a> : source}
      </figcaption>
    </figure>
  );
}
