import { cn } from "@/lib/utils";
/** A pulled quote. Distinct from `testimonial`, which is a card with a person on it. */
export function Quote({ cite, className, children }: {
  cite?: string; className?: string; children?: React.ReactNode;
}) {
  return (
    <figure data-slot="quote" className={cn("border-s-2 ps-4", className)}>
      <blockquote className="text-balance italic">{children}</blockquote>
      {cite && <figcaption className="mt-2 text-sm text-muted-foreground">— {cite}</figcaption>}
    </figure>
  );
}
