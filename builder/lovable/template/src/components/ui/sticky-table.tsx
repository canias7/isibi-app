import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * A wide table that scrolls sideways with its first column pinned.
 *
 * The pinned cells need a solid background of their own — the rows scroll
 * underneath them, and a transparent sticky cell shows the data sliding
 * through it. Apply `sticky left-0 bg-background` to the first cell of each
 * row; this wrapper supplies the scroll container and the shadow that tells
 * somebody there is more to the right.
 */
export function StickyTable({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative overflow-x-auto", className)}>
      <table className="w-full caption-bottom border-collapse text-sm [&_[data-pin]]:sticky [&_[data-pin]]:left-0 [&_[data-pin]]:z-10 [&_[data-pin]]:bg-background [&_[data-pin]]:after:absolute [&_[data-pin]]:after:inset-y-0 [&_[data-pin]]:after:right-0 [&_[data-pin]]:after:w-px [&_[data-pin]]:after:bg-border">
        {children}
      </table>
    </div>
  );
}
