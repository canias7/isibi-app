import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * The block that stands where owner-supplied content will go — a bio not yet
 * written, a photo not yet chosen.
 *
 * THIS IS NOT A LOADING STATE and must not look like one. A skeleton says
 * "coming in a moment"; this says "nobody has written this yet", which on a
 * generated site is the normal state of half the content on day one. Dashed
 * border, words, no shimmer — the two must be distinguishable at a glance
 * because their remedies are different (wait versus write).
 *
 * IT IS ONLY FOR THE OWNER'S EYES when `forOwner` — a visitor should see the
 * section absent, not a nag about someone else's homework. That flag flips
 * between rendering nothing and rendering the prompt, and defaults to
 * VISITOR-SAFE.
 *
 * The prompt says WHAT GOES HERE and how to add it — "Your opening hours will
 * show here. Add them in Settings." — because a bare "no content" helps
 * neither audience.
 */
export function ContentPlaceholder({ what, how, forOwner, action, minHeight, className }: {
  what: React.ReactNode;
  how?: React.ReactNode;
  forOwner?: boolean;
  action?: React.ReactNode;
  minHeight?: number;
  className?: string;
}) {
  // Visitor-safe by default: absence, not a nag about someone else's homework.
  if (!forOwner) return null;
  return (
    <div data-slot="content-placeholder" style={minHeight ? { minHeight } : undefined}
      className={cn("flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border px-4 py-6 text-center", className)}>
      <p className="text-sm text-muted-foreground">{what}</p>
      {how ? <p className="text-xs text-muted-foreground">{how}</p> : null}
      {action}
    </div>
  );
}
