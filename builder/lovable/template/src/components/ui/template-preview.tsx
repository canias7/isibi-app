import { cn } from "@/lib/utils";
/**
 * A template with its blanks shown as blanks, before anything is filled in.
 *
 * UNFILLED TOKENS ARE MARKED, and that is what makes this a preview rather than
 * a broken document. Rendering `{{customer}}` as plain text among real
 * sentences is how it gets missed and sent; marking it makes every remaining
 * blank countable at a glance.
 *
 * THE COUNT OF WHAT IS STILL MISSING sits above the body. Scanning a two-page
 * preview for highlights is exactly the manual work the component should be
 * doing, and "3 blanks left" answers the question the preview exists for.
 *
 * A FILLED TOKEN LOOKS LIKE ORDINARY TEXT, deliberately — once a value is in,
 * the reader wants to judge the sentence, and a document where every filled
 * field is still boxed reads as a form rather than as the thing it will be.
 *
 * Marked with a dotted underline and the token's name in the accessible label,
 * never a highlight colour: a preview is the thing most likely to be printed.
 */
export function TemplatePreview({ body, values, pattern = /\{\{(\w+)\}\}/g, className }: {
  /** The template text, tokens included. */
  body: string;
  values: Record<string, string>;
  /** Must be a global regex with one capture group — the variable key. */
  pattern?: RegExp;
  className?: string;
}) {
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
  const out: React.ReactNode[] = [];
  let last = 0, missing = 0, m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) out.push(body.slice(last, m.index));
    const key = m[1];
    const filled = values[key];
    if (filled) {
      out.push(<span key={`${key}-${m.index}`}>{filled}</span>);
    } else {
      missing++;
      out.push(
        <span key={`${key}-${m.index}`} aria-label={`${key}, not filled in`}
          className="underline decoration-dotted decoration-from-font underline-offset-4">
          {key}
        </span>,
      );
    }
    last = m.index + m[0].length;
    if (m[0] === "") re.lastIndex++;
  }
  out.push(body.slice(last));
  return (
    <div data-slot="template-preview" className={cn("space-y-2", className)}>
      <p className="text-xs text-muted-foreground">
        {missing === 0 ? "Nothing left to fill in" : `${missing} ${missing === 1 ? "blank" : "blanks"} left`}
      </p>
      <div className="whitespace-pre-wrap rounded-md border border-border p-3 text-sm">{out}</div>
    </div>
  );
}
