import * as React from "react";
import { Shimmer } from "@/components/ui/shimmer";
import { cn } from "@/lib/utils";
/**
 * The placeholder a form shows while its current values load.
 *
 * A LOADING FORM MUST NOT RENDER EMPTY FIELDS. An empty input reads as "no
 * value yet" and invites typing; the load then either overwrites what was
 * typed or is overwritten by it, and both are data loss. The skeleton makes
 * "not loaded" visually distinct from "blank", which is the entire reason to
 * have one.
 *
 * FIELD SHAPES MATCH — label bar, input block, the occasional double-width
 * row — so the swap to the real form does not reflow. Same contract as
 * `skeleton-list`.
 *
 * The submit placeholder is there too, disabled-shaped, because a form whose
 * button pops in later shifts everything above it on arrival.
 */
export function SkeletonForm({ fields = 4, twoColumn, delay, className }: {
  fields?: number;
  twoColumn?: boolean;
  delay?: number;
  className?: string;
}) {
  return (
    <div data-slot="skeleton-form" aria-busy="true" className={className}>
      <p className="sr-only">Loading the form</p>
      <Shimmer delay={delay} className="bg-transparent">
        <div className={cn("grid gap-4", twoColumn && "sm:grid-cols-2")}>
          {Array.from({ length: fields }, (_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <span className={cn("h-2.5 rounded bg-muted", i % 3 === 0 ? "w-24" : "w-16")} />
              <span className="h-9 rounded-md bg-muted" />
            </div>
          ))}
          <span className="mt-1 h-9 w-28 rounded-md bg-muted" />
        </div>
      </Shimmer>
    </div>
  );
}
