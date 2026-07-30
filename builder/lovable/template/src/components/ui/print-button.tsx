import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
/** Print this. For a booking confirmation or an invoice, which people do print. */
export function PrintButton({ label = "Print", className }: { label?: string; className?: string }) {
  return (
    <Button type="button" size="sm" variant="outline" className={className} onClick={() => window.print()}>
      <Printer className="size-4" /> {label}
    </Button>
  );
}
