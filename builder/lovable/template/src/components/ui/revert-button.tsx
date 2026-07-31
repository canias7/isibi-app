import * as React from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
/**
 * Throw away the changes and go back to what was saved.
 *
 * Two presses, not a confirm dialog: the first arms it and the label says
 * what will happen, the second does it. A dialog for this is an interruption
 * on the rare wrong press and gets dismissed unread on the common one.
 *
 * It disarms itself after four seconds so a stray first press cannot sit
 * there waiting to catch a later, unrelated click.
 */
export function RevertButton({ onRevert, disabled, label = "Revert", className }: {
  onRevert: () => void; disabled?: boolean; label?: string; className?: string;
}) {
  const [armed, setArmed] = React.useState(false);
  React.useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Button type="button" size="sm" variant={armed ? "destructive" : "ghost"} disabled={disabled}
      className={className}
      onClick={() => { if (armed) { setArmed(false); onRevert(); } else setArmed(true); }}>
      <RotateCcw className="size-4" />
      {armed ? "Discard changes?" : label}
    </Button>
  );
}
