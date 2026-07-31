import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
/** Who is handling this. "Unassigned" is a real option, not an empty state. */
export function AssigneePicker({ people, value, onChange, className }: {
  people: { id: string; name: string }[]; value?: string | null;
  onChange: (id: string | null) => void; className?: string;
}) {
  const who = people.find((p) => p.id === value);
  const initials = (n: string) => n.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className={className}>
          {who ? (
            <>
              <Avatar className="size-5"><AvatarFallback className="text-[10px]">{initials(who.name)}</AvatarFallback></Avatar>
              {who.name}
            </>
          ) : <span className="text-muted-foreground">Unassigned</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={() => onChange(null)}>Unassigned</DropdownMenuItem>
        {people.map((p) => <DropdownMenuItem key={p.id} onSelect={() => onChange(p.id)}>{p.name}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
