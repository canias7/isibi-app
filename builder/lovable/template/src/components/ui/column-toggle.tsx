import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SlidersHorizontal } from "lucide-react";
/** Which columns show. Real checkbox items, so the state is announced. */
export function ColumnToggle({ columns, visible, onToggle, className }: {
  columns: { key: string; label: string }[]; visible: string[];
  onToggle: (key: string) => void; className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className={className}>
          <SlidersHorizontal className="size-4" /> Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {columns.map((c) => (
          <DropdownMenuCheckboxItem key={c.key} checked={visible.includes(c.key)}
            onCheckedChange={() => onToggle(c.key)}>{c.label}</DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
