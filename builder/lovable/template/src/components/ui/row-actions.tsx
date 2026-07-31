import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
export type RowAction = { label: string; onSelect: () => void; destructive?: boolean };
/** The … at the end of a row. */
export function RowActions({ actions, label = "Actions" }: { actions: RowAction[]; label?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon-sm" variant="ghost" aria-label={label}><MoreHorizontal /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((a, i) => (
          <div key={a.label}>
            {a.destructive && i > 0 && <DropdownMenuSeparator />}
            {/* Styled by class rather than a `variant` prop: this template's
                dropdown-menu is the v3 copy and does not have one. */}
            <DropdownMenuItem onSelect={a.onSelect}
              className={a.destructive ? "text-destructive focus:text-destructive" : undefined}>
              {a.label}
            </DropdownMenuItem>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
