import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download } from "lucide-react";
/** Download this, in a format. */
export function ExportButton({ formats = ["CSV", "JSON"], onExport, busy, className }: {
  formats?: string[]; onExport: (format: string) => void; busy?: boolean; className?: string;
}) {
  if (formats.length === 1) {
    return (
      <Button size="sm" variant="outline" disabled={busy} className={className} onClick={() => onExport(formats[0])}>
        <Download className="size-4" /> {busy ? "Preparing…" : "Export"}
      </Button>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" disabled={busy} className={className}>
          <Download className="size-4" /> {busy ? "Preparing…" : "Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {formats.map((f) => <DropdownMenuItem key={f} onSelect={() => onExport(f)}>Export as {f}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
