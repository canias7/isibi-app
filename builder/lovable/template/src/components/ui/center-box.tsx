import { cn } from "@/lib/utils";
/** Centres a panel in the viewport — sign-in, a 404, a confirmation. */
export function CenterBox({ width = "sm", className, children }: {
  width?: "xs" | "sm" | "md"; className?: string; children?: React.ReactNode;
}) {
  const w = { xs:"max-w-xs", sm:"max-w-sm", md:"max-w-md" }[width];
  return (
    <div data-slot="center-box" className="grid min-h-[60vh] place-items-center px-6">
      <div className={cn("w-full", w, className)}>{children}</div>
    </div>
  );
}
