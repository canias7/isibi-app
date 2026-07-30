import { cn } from "@/lib/utils";
/** The sentence under a title. Wider measure, lighter colour. */
export function Lead({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <p className={cn("max-w-2xl text-lg text-muted-foreground text-balance", className)}>{children}</p>;
}
