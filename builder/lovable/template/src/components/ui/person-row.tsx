import * as React from "react";
import { AvatarName } from "@/components/ui/avatar-name";
import { PresenceDot } from "@/components/ui/presence-dot";
import { cn } from "@/lib/utils";
/**
 * A person in a directory or a team list.
 *
 * Distinct from `ContactCard` (a business's own details) and `ProfileCard`
 * (one person, featured): this is the ROW shape, scanned in a list of forty.
 *
 * The email is a `mailto:` and the phone a `tel:` — a directory whose contact
 * details are plain text is one where every number is copied by hand off a
 * phone screen.
 */
export function PersonRow({ name, role, email, phone, avatar, presence, actions, className }: {
  name: string; role?: string; email?: string; phone?: string;
  avatar?: string | null; presence?: "online" | "away" | "busy" | "offline";
  actions?: React.ReactNode; className?: string;
}) {
  return (
    <div data-slot="person-row" className={cn("flex flex-wrap items-center gap-3 border-b border-border py-2.5 last:border-0", className)}>
      <div className="relative">
        <AvatarName name={name} src={avatar} size="md" avatarOnly />
        {presence && <span className="absolute -bottom-0.5 -end-0.5">
          <PresenceDot state={presence} showLabel={false} ring /></span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        {role && <p className="truncate text-xs text-muted-foreground">{role}</p>}
      </div>
      <div className="hidden min-w-0 flex-1 text-xs text-muted-foreground sm:block">
        {email && <a href={`mailto:${email}`} className="block truncate hover:underline">{email}</a>}
        {phone && <a href={`tel:${phone.replace(/[^+\d]/g, "")}`} className="block truncate hover:underline">{phone}</a>}
      </div>
      {actions}
    </div>
  );
}
