import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A box that holds its shape BEFORE its content arrives.
 *
 * THE POINT IS LAYOUT SHIFT: an image without reserved space arrives and
 * shoves everything below it (the progressive-image rule, generalised to
 * any media). `aspect-ratio` reserves the exact box; children fill it
 * with cover semantics by default.
 *
 * The ratio is a STRING PROP fed to the style attribute ("16/9", "1/1",
 * "4/3") — never a template class like `aspect-[${r}]`, which the
 * Tailwind scanner cannot see (the runtime-class trap).
 */
export function AspectBox({ ratio = "16/9", children, className }: {
  ratio?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div style={{ aspectRatio: ratio }} className={cn("relative overflow-hidden [&>img]:h-full [&>img]:w-full [&>img]:object-cover [&>video]:h-full [&>video]:w-full [&>video]:object-cover", className)}>
      {children}
    </div>
  );
}
