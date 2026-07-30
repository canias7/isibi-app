import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
/** The avatar in the corner. Sign out is separated, because it is the destructive one. */
export function AccountMenu({ name, email, avatar, items = [], onSignOut, className }: {
  name: string; email?: string; avatar?: string | null;
  items?: { label: string; href?: string; onSelect?: () => void }[];
  onSignOut?: () => void; className?: string;
}) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={className} aria-label="Account">
          <Avatar className="size-8">
            {avatar && <AvatarImage src={avatar} alt={name} />}
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="text-sm font-medium">{name}</div>
          {email && <div className="truncate text-xs text-muted-foreground">{email}</div>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((i) => (
          <DropdownMenuItem key={i.label} onSelect={i.onSelect} asChild={!!i.href}>
            {i.href ? <a href={i.href}>{i.label}</a> : <span>{i.label}</span>}
          </DropdownMenuItem>
        ))}
        {onSignOut && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onSignOut}>Sign out</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
