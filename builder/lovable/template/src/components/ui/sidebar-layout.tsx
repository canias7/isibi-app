import { cn } from "@/lib/utils";
/**
 * Navigation on the left, content on the right.
 *
 * The aside is sticky and scrolls independently, so a long content column does
 * not carry the navigation off the top of the screen. Stacks on small screens.
 */
export function SidebarLayout({ aside, width = "14rem", className, children }: {
  aside: React.ReactNode; width?: string; className?: string; children?: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-8 md:flex-row", className)}>
      <aside className="md:sticky md:top-6 md:h-fit md:shrink-0" style={{ ["--aside" as string]: width }}>
        <div className="md:w-[var(--aside)]">{aside}</div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
