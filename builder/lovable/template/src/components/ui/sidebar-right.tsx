import * as React from "react";
import { cn } from "@/lib/utils";
/**
 * Content with a right rail — that reads in the right order everywhere.
 *
 * THE SIDEBAR COMES AFTER THE CONTENT IN SOURCE, always: on a phone the
 * rail stacks BELOW the article, and screen readers meet the article
 * first at every width. A grid that puts the rail first-in-source for
 * styling convenience makes small screens read the furniture before
 * the room.
 *
 * `items-start` is load-bearing: grid stretch would equalise the
 * columns' heights and quietly kill any `sticky` inside the rail (the
 * sticky-columns trap, guarded here too).
 */
export function SidebarRight({ children, rail, railWidth = "280px", className }: {
  children: React.ReactNode;
  rail: React.ReactNode;
  railWidth?: string;
  className?: string;
}) {
  return (
    <div data-slot="sidebar-right" style={{ ["--rail" as string]: railWidth }}
      className={cn("grid items-start gap-6 lg:[grid-template-columns:minmax(0,1fr)_var(--rail)]", className)}>
      <div className="min-w-0">{children}</div>
      <div>{rail}</div>
    </div>
  );
}
