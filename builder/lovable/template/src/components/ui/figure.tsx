import * as React from "react";
import { SafeImage } from "@/components/ui/safe-image";
import { cn } from "@/lib/utils";
/**
 * A picture with a caption, as a real <figure>/<figcaption> pair.
 *
 * TWO WAYS IN, AND THE SECOND ONE IS WHY THIS COMMENT EXISTS. Pass `src` and it
 * draws the picture itself through `SafeImage`, which is the common case and the
 * only one this component had for months. Pass CHILDREN instead and it captions
 * whatever you give it — a QR, a chart, a diagram, an embed — anything that is
 * not a photograph with a URL.
 *
 * IT WAS `src` ONLY, AND THAT COST TWO PAID BUILDS (runs 84 and 85, 2026-08-30,
 * 22 credits between them). Both died the same way:
 *
 *   src/routes/index.tsx(96,14): error TS2322: Type '{ children: Element | null;
 *   alt: string; caption: string; ratio: string; }' is not assignable to
 *   '{ src?; alt?; caption?; credit?; ratio?; className? }'
 *   Property 'children' does not exist
 *
 * The kit had `MediaCaption` for exactly that job, so the capability was never
 * missing — what was missing is any way for the model to KNOW which of two
 * captioned figures holds children, because their names do not say. It reached
 * for the one whose name matched the job. Twice, in two different generations,
 * at two different lines.
 *
 * NAMING THE RIGHT COMPONENT IN THE PROMPT WAS TRIED FIRST AND IS NOT ENOUGH.
 * A rule in prose is one a model eventually reads past, and this repo has that
 * written down. The wall is better than the rule: make the obvious name work,
 * and the mistake stops being possible rather than being discouraged.
 *
 * `MediaCaption` stays and is still the better choice when the caption is rich
 * (it takes ReactNode captions and an alignment); this is the plain one.
 */
export function Figure({ src, alt, caption, credit, ratio = "16/9", className, children }: {
  src?: string | null; alt?: string; caption?: string;
  credit?: string; ratio?: string; className?: string;
  /** Caption something that is not a photograph — a QR, a chart, an embed. Wins over `src`. */
  children?: React.ReactNode;
}) {
  return (
    <figure data-slot="figure" className={cn("flex flex-col gap-2", className)}>
      {/* CHILDREN WIN, and deliberately: a caller who passed both meant the thing
          they handed over, and silently drawing a SafeImage on top of it would
          render two pictures where they asked for one. */}
      {children ?? <SafeImage src={src} alt={alt} ratio={ratio} />}
      {(caption || credit) && (
        <figcaption className="text-sm text-muted-foreground">
          {caption}{credit && <span className="ms-2 text-xs">{credit}</span>}
        </figcaption>
      )}
    </figure>
  );
}
