import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
/** A face and a name together — the row that appears in every list of people. */
export function AvatarName({ name, subtitle, src, size = "md", className }: {
  name: string; subtitle?: string | null; src?: string | null;
  size?: "sm" | "md" | "lg"; className?: string;
}) {
  const s = { sm: "size-7", md: "size-9", lg: "size-11" }[size];
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <Avatar className={s}>
        {src && <AvatarImage src={src} alt={name} />}
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{name}</div>
        {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
      </div>
    </div>
  );
}
