import * as React from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";

/**
 * Copy a value, and say so. Falls back silently where the clipboard is blocked.
 *
 * `iconOnly` added 2026-07-30, after rendering showed the labelled form is wider
 * than the thing it sits inside wherever it is INLINE — beside a shortened id,
 * in the corner of a code block. The label is still required in that mode; it
 * becomes the accessible name rather than disappearing.
 */
export function CopyButton({ value, label = "Copy", iconOnly, className }: {
  value: string;
  label?: string;
  iconOnly?: boolean;
  className?: string;
}) {
  const [done, setDone] = React.useState(false);
  React.useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 1600);
    return () => clearTimeout(t);
  }, [done]);
  const icon = done ? <Check className="size-4" /> : <Copy className="size-4" />;
  return (
    <Button
      type="button" className={className}
      size={iconOnly ? "icon-sm" : "sm"} variant={iconOnly ? "ghost" : "outline"}
      onClick={() => { navigator.clipboard?.writeText(value).then(() => setDone(true)).catch(() => {}); }}
      aria-label={done ? "Copied" : label}
    >
      {icon}
      {!iconOnly && (done ? "Copied" : label)}
    </Button>
  );
}
