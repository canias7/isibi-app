import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A picture with a caption underneath.
 *
 * `<figure>` and `<figcaption>`, which is what actually binds the two: a `<p>`
 * under an image is a paragraph that happens to be nearby, and a screen reader
 * reading the page linearly gives no indication the sentence describes the
 * picture above it.
 *
 * The CAPTION AND THE ALT TEXT ARE DIFFERENT THINGS and both are needed. Alt
 * describes what the picture shows, for somebody who cannot see it; a caption
 * adds what the picture does not say — who, when, why it is here — and everyone
 * reads it. Repeating the caption as alt means a listener hears the same
 * sentence twice and learns nothing about the image itself.
 *
 * `credit` is separate from the caption because a photographer's name is a
 * different kind of statement from a description, and licences frequently
 * require it to be attached to the image rather than buried in a paragraph.
 */
export function MediaCaption({ children, caption, credit, align = "left", className }: {
  children: React.ReactNode;
  caption?: React.ReactNode;
  credit?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <figure data-slot="media-caption" className={cn("m-0 flex flex-col gap-1.5", className)}>
      {children}
      {caption || credit ? (
        <figcaption className={cn("text-xs text-muted-foreground", align === "center" && "text-center")}>
          {caption}
          {credit ? (
            <span className={cn("block", caption ? "mt-0.5" : "")}>
              <span className="sr-only">Credit: </span>
              {credit}
            </span>
          ) : null}
        </figcaption>
      ) : null}
    </figure>
  );
}
