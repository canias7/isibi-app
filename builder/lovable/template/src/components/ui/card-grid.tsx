import { AutoGrid } from "@/components/ui/auto-grid";
/** The grid cards sit in. A named default so every listing page matches. */
export function CardGrid({ min = 260, gap = 4, className, children }: {
  min?: number; gap?: 2 | 3 | 4 | 6 | 8; className?: string; children?: React.ReactNode;
}) {
  return <AutoGrid min={min} gap={gap} className={className}>{children}</AutoGrid>;
}
