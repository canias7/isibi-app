import { cn } from "@/lib/utils";
/** Main and aside. Stacks on small screens with the aside underneath. */
export function TwoCol({ aside, asideFirst, ratio = "2/1", gap = 8, className, children }: {
  aside: React.ReactNode; asideFirst?: boolean;
  ratio?: "1/1" | "2/1" | "3/1"; gap?: 4 | 6 | 8 | 10;
  className?: string; children?: React.ReactNode;
}) {
  const cols = { "1/1":"md:grid-cols-2", "2/1":"md:grid-cols-3", "3/1":"md:grid-cols-4" }[ratio];
  const main = ratio === "1/1" ? "" : ratio === "2/1" ? "md:col-span-2" : "md:col-span-3";
  const g: Record<number,string> = {4:"gap-4",6:"gap-6",8:"gap-8",10:"gap-10"};
  return (
    <div data-slot="two-col" className={cn("grid", cols, g[gap], className)}>
      <div className={cn(main, asideFirst && "md:order-2")}>{children}</div>
      <aside className={cn(asideFirst && "md:order-1")}>{aside}</aside>
    </div>
  );
}
