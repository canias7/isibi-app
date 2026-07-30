import { cn } from "@/lib/utils";
/**
 * What changed between two versions of a short piece of text.
 *
 * Word-level and single-pass — the longest common prefix and suffix, with
 * everything between them treated as the change. That is not a real diff and
 * it does not pretend to be: it is exact for the case this is for (a title
 * edited, a price corrected) and never wrong, only coarse, on the rest.
 *
 * Removed text is struck through as well as tinted, added text underlined, so
 * the two are still distinguishable without colour.
 */
export function DiffText({ before, after, className }: {
  before: string; after: string; className?: string;
}) {
  const a = before.split(/(\s+)/), b = after.split(/(\s+)/);
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head
    && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const removed = a.slice(head, a.length - tail).join("");
  const added = b.slice(head, b.length - tail).join("");
  return (
    <span className={cn("text-sm", className)}>
      {a.slice(0, head).join("")}
      {removed && <del className="bg-destructive/10 text-destructive no-underline line-through">{removed}</del>}
      {added && <ins className="bg-success/10 text-success underline decoration-dotted">{added}</ins>}
      {a.slice(a.length - tail).join("")}
    </span>
  );
}
