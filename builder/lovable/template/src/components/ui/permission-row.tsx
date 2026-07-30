import { AvatarName } from "@/components/ui/avatar-name";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
/** One person and what they may do. The owner's row cannot be changed. */
export function PermissionRow({ name, email, avatar, role, roles = ["Member", "Admin"],
  onRole, locked, actions, className }: {
  name: string; email?: string; avatar?: string | null; role: string; roles?: string[];
  onRole?: (r: string) => void; locked?: boolean; actions?: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3 border-b border-border py-3 last:border-0", className)}>
      <div className="min-w-0 flex-1"><AvatarName name={name} subtitle={email} src={avatar} /></div>
      {locked || !onRole
        ? <span className="text-sm text-muted-foreground">{role}</span>
        : (
          <Select value={role} onValueChange={onRole}>
            <SelectTrigger className="w-32" aria-label={`Role for ${name}`}><SelectValue /></SelectTrigger>
            <SelectContent>{roles.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
        )}
      {actions}
    </div>
  );
}
