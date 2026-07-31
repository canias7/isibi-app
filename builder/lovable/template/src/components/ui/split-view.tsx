import { cn } from "@/lib/utils";
/**
 * A list beside a detail pane.
 *
 * On a phone only ONE side shows, chosen by whether something is selected — a
 * two-pane layout squeezed onto 375px is two unusable panes.
 */
export function SplitView({ list, detail, hasSelection, listWidth = "20rem", className }: {
  list: React.ReactNode; detail: React.ReactNode; hasSelection?: boolean;
  listWidth?: string; className?: string;
}) {
  return (
    <div className={cn("flex min-h-0 flex-1 md:gap-4", className)}>
      <div className={cn("min-w-0 flex-1 md:flex-none", hasSelection && "hidden md:block")}
        style={{ ["--w" as string]: listWidth }}>
        <div className="md:w-[var(--w)]">{list}</div>
      </div>
      <div className={cn("min-w-0 flex-1", !hasSelection && "hidden md:block")}>{detail}</div>
    </div>
  );
}
