import * as React from "react";
import { Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * A heading that can hand out its own address.
 *
 * THE LINK IS A SIBLING OF THE HEADING TEXT, NOT PART OF IT. Wrapping the
 * whole heading in an anchor puts "link" into every screen-reader heading
 * announcement and makes the text unselectable-without-navigating; the #
 * button lives beside the words with its own label.
 *
 * VISIBLE ON HOVER *AND ON FOCUS* — hover-only means keyboard users cannot
 * find it, which is the half everybody forgets. It copies the address
 * rather than navigating: a jump-to-self scrolls nothing and pollutes
 * history (the permalink lesson); after copying it SAYS "copied" in place.
 *
 * The id is required, not derived — deriving here and in table-of-contents
 * would be two slugifiers that drift; pass the id, or let the TOC assign
 * them and use plain headings.
 */
export function AnchorHeading({ id, as: Tag = "h2", children, className }: {
  id: string;
  as?: "h2" | "h3" | "h4";
  children: React.ReactNode;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => {
    const url = `${location.origin}${location.pathname}#${id}`;
    try { await navigator.clipboard.writeText(url); } catch {
      try { history.replaceState(null, "", `#${id}`); } catch { /* sandboxed */ }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Tag id={id} className={cn("group flex items-baseline gap-1.5 scroll-mt-20", className)}>
      {children}
      <button type="button" onClick={copy} aria-label="Copy a link to this section"
        className="cursor-pointer opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100">
        {copied
          ? <span className="text-[11px] font-normal text-muted-foreground">copied</span>
          : <LinkIcon className="size-3.5 text-muted-foreground hover:text-foreground" />}
      </button>
    </Tag>
  );
}
