import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
/** Save for later. `aria-pressed` carries the state, not the fill alone. */
export function WishlistButton({ saved, onToggle, label = "Save", className }: {
  saved?: boolean; onToggle: () => void; label?: string; className?: string;
}) {
  return (
    <Button type="button" size="icon" variant="outline" onClick={onToggle}
      aria-pressed={!!saved} aria-label={saved ? `Remove from saved` : label} className={className}>
      <Heart className={cn("size-4", saved && "fill-foreground")} />
    </Button>
  );
}
