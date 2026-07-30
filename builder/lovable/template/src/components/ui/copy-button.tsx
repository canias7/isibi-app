import * as React from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";

/** Copy a value, and say so. Falls back silently where the clipboard is blocked. */
export function CopyButton({ value, label = "Copy", className }: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [done, setDone] = React.useState(false);
  React.useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 1600);
    return () => clearTimeout(t);
  }, [done]);
  return (
    <Button
      type="button" size="sm" variant="outline" className={className}
      onClick={() => { navigator.clipboard?.writeText(value).then(() => setDone(true)).catch(() => {}); }}
      aria-label={done ? "Copied" : label}
    >
      {done ? <Check className="size-4" /> : <Copy className="size-4" />}
      {done ? "Copied" : label}
    </Button>
  );
}
