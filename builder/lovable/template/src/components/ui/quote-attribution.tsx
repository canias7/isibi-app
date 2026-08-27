import { cn } from "@/lib/utils";
/**
 * Who said it, under the quote.
 *
 * A real `<figcaption>` inside the caller's `<figure>`, with `<cite>` around the
 * name — the elements that exist for exactly this, and which make a quote and
 * its source one unit rather than two paragraphs that happen to be adjacent.
 *
 * THE SOURCE IS A LINK WHEN THERE IS ONE, and external links carry
 * `rel="noreferrer"` — a testimonial pointing at a review site is the common
 * case and it should not hand `window.opener` to it.
 *
 * The em dash is `aria-hidden`, so a screen reader reads "Ana Trelawny,
 * Falmouth" rather than "dash Ana Trelawny".
 */
export function QuoteAttribution({ name, role, href, className }: {
  name: string; role?: string; href?: string;
  className?: string;
}) {
  const body = (
    <>
      <cite className="not-italic font-medium">{name}</cite>
      {role && <span className="text-muted-foreground">, {role}</span>}
    </>
  );
  return (
    <figcaption data-slot="quote-attribution" className={cn("text-sm", className)}>
      <span aria-hidden className="text-muted-foreground">— </span>
      {href
        ? <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-4">{body}</a>
        : body}
    </figcaption>
  );
}
