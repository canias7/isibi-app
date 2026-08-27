import * as React from "react";
import { Link2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
/**
 * The ¶ link beside a heading that gives it its own URL.
 *
 * IT IS VISIBLE ON HOVER **AND ON FOCUS**. Hover-only means the link is
 * unreachable by keyboard and invisible on every touchscreen — and this is
 * exactly the control somebody needs when they want to point a colleague at one
 * paragraph.
 *
 * IT WRITES THE HASH WITH `replaceState`, not by navigating. A real navigation
 * adds a history entry, so pressing Back after copying a section link goes to
 * the same page again rather than where the reader came from.
 *
 * The accessible name says WHICH heading — "Copy a link to Opening hours" —
 * because a page of twelve identical "Copy link" buttons is a list of twelve
 * identical choices to anyone navigating by them.
 *
 * The heading id has to exist. That is the caller's job and it is stated,
 * because a permalink to an id nothing carries is a link that lands at the top
 * of the page and looks like it did nothing.
 *
 * PUT `group` ON THE HEADING for the hover reveal to work — `group-hover:` needs
 * an ancestor carrying it, and without one the link only ever appears on focus.
 * Stated for the same reason the id is, and it is not load-bearing: focus and
 * touch reveal it regardless, so forgetting costs the mouse reveal and not the
 * control.
 */
export function Permalink({ id, heading, baseUrl, className }: {
  id: string;
  heading: string;
  baseUrl?: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    const url = `${baseUrl ?? (typeof location !== "undefined" ? location.href.split("#")[0] : "")}#${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* refused clipboard — the hash is still set below */ }
    // replaceState, or Back returns to this page instead of the previous one.
    if (typeof history !== "undefined") history.replaceState(null, "", `#${id}`);
  };

  return (
    <button data-slot="permalink" type="button" onClick={copy}
      aria-label={`Copy a link to ${heading}`}
      className={cn("ms-1.5 inline-flex cursor-pointer items-center rounded p-0.5 align-middle text-muted-foreground",
        // Focus, not only hover: this is the control a keyboard user wants.
        // AND `pointer-coarse`, because the hover reveal needs two things this
        // component does not control: an ancestor carrying `group`, which is
        // the caller's markup, and a pointer that can hover, which a phone does
        // not have. The doc above says hover-only would be "invisible on every
        // touchscreen" and that is what it was — the promise was made and only
        // half kept.
        "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100 hover:text-foreground",
        className)}>
      {copied ? <Check aria-hidden className="size-3.5" /> : <Link2 aria-hidden className="size-3.5" />}
      <span aria-live="polite" className="sr-only">{copied ? "Link copied" : ""}</span>
    </button>
  );
}
