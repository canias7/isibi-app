import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
/**
 * A face and a name together — the row that appears in every list of people.
 *
 * `avatarOnly` added 2026-07-30. Several components want the face beside their
 * own layout of the name, and were reaching for `[&>div]:hidden` to get it —
 * a selector that depends on this file's internal markup and would break every
 * one of them, silently, the moment it changed. The name stays in the
 * accessible name either way: the Avatar's alt and fallback carry it.
 */
export function AvatarName({ name, subtitle, src, size = "md", avatarOnly, className }: {
  name: string; subtitle?: string | null; src?: string | null;
  size?: "sm" | "md" | "lg"; avatarOnly?: boolean; className?: string;
}) {
  const s = { sm: "size-7", md: "size-9", lg: "size-11" }[size];
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
  return (
    <div data-slot="avatar-name" className={cn("flex min-w-0 items-center gap-2.5", className)}>
      <Avatar className={s}>
        {src && <AvatarImage src={src} alt={name} />}
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
      {!avatarOnly && (
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{name}</div>
          {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
        </div>
      )}
    </div>
  );
}
