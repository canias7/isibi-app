import { cn } from "@/lib/utils";
/** Something fixed-width beside flowing text. The oldest layout on the web. */
export function MediaObject({ media, align = "start", reverse, className, children }: {
  media: React.ReactNode; align?: "start" | "center"; reverse?: boolean;
  className?: string; children?: React.ReactNode;
}) {
  return (
    <div className={cn("flex gap-3", align === "center" ? "items-center" : "items-start",
      reverse && "flex-row-reverse", className)}>
      <div className="shrink-0">{media}</div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
