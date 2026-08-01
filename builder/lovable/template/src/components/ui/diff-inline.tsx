import { cn } from "@/lib/utils";
/**
 * What changed inside a sentence, marked in the flow of the text.
 *
 * ADDED AND REMOVED ARE NOT GREEN AND RED HERE. That convention fails three
 * ways at once: it is invisible in greyscale and in print, it is the single
 * most common form of colour-blindness, and it says nothing at all to a screen
 * reader. Added text is underlined, removed text is struck through, and each
 * run carries an `sr-only` word — so the same information arrives however the
 * page is being read.
 *
 * `<ins>` and `<del>` are the real elements for this. Some screen readers
 * announce them natively, and the sr-only labels are belt and braces for the
 * ones that do not.
 *
 * Whitespace is preserved, because a diff that reflows is not showing the
 * change, it is showing a different paragraph.
 */
export type DiffPart = { text: string; kind?: "same" | "added" | "removed" };

export function DiffInline({ parts, className }: {
  parts: DiffPart[];
  className?: string;
}) {
  if (!parts.length) return null;
  return (
    <p className={cn("text-sm whitespace-pre-wrap", className)}>
      {parts.map((p, i) => {
        if (p.kind === "added") {
          return (
            <ins key={i} className="underline decoration-2 underline-offset-2">
              <span className="sr-only">added: </span>{p.text}
            </ins>
          );
        }
        if (p.kind === "removed") {
          return (
            <del key={i} className="text-muted-foreground line-through">
              <span className="sr-only">removed: </span>{p.text}
            </del>
          );
        }
        return <span key={i}>{p.text}</span>;
      })}
    </p>
  );
}
