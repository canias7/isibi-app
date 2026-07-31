import * as React from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
/**
 * Bigger text, for a page of it.
 *
 * It scales the ROOT font size, so everything sized in rem follows. Scaling a
 * container's px sizes instead leaves the buttons and labels around the text
 * at their original size, which is exactly the half somebody enlarging the
 * text is struggling with.
 *
 * The browser's own zoom does this better and this does not replace it — but
 * a reader who does not know about Ctrl+plus is a reader who squints, and on
 * a phone zoom reflows nothing.
 */
export function TextSize({ className }: { className?: string }) {
  const [size, setSize] = React.useState("100");
  React.useEffect(() => {
    document.documentElement.style.fontSize = size === "100" ? "" : `${Number(size)}%`;
    return () => { document.documentElement.style.fontSize = ""; };
  }, [size]);
  return (
    <ToggleGroup type="single" value={size} size="sm" className={cn(className)}
      onValueChange={(v) => { if (v) setSize(v); }} aria-label="Text size">
      <ToggleGroupItem value="100" aria-label="Normal text"><span className="text-xs">A</span></ToggleGroupItem>
      <ToggleGroupItem value="115" aria-label="Larger text"><span className="text-sm">A</span></ToggleGroupItem>
      <ToggleGroupItem value="130" aria-label="Largest text"><span className="text-base">A</span></ToggleGroupItem>
    </ToggleGroup>
  );
}
