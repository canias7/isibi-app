import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A field that appears once something else is answered.
 *
 * It UNMOUNTS rather than hiding with a class, and that is the whole point: a
 * hidden-but-present field is still submitted, still validated, and still
 * focusable by tab — so a form refuses to submit because of a required field
 * nobody can see.
 *
 * `role="region"` with the label announced, so somebody who just answered the
 * question that revealed this is told something appeared.
 */
export function ConditionalField({ when, label, children, className }: {
  when: boolean; label?: string; children?: React.ReactNode; className?: string;
}) {
  if (!when) return null;
  return (
    <div role="region" aria-label={label} className={cn("border-l-2 border-border pl-3", className)}>
      {children}
    </div>
  );
}
